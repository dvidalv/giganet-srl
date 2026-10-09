import { syncTheFactoryCrearSeriesFromComprobante } from "@/app/controllers/comprobantes";
import {
  getComprobanteModelForUserId,
  userUsesComprobantesDevMongo,
} from "@/lib/comprobantesStore";

/**
 * Crea una secuencia e-CF para el usuario indicado y sincroniza The Factory.
 * @param {string} userId
 * @param {Record<string, unknown>} body
 * @returns {Promise<{ status: number, json: Record<string, unknown> }>}
 */
export async function createComprobanteSequence(userId, body) {
  const {
    rnc,
    razon_social,
    tipo_comprobante,
    descripcion_tipo,
    prefijo,
    numero_inicial,
    numero_final,
    proximo_numero,
    fecha_autorizacion,
    fecha_vencimiento,
    alerta_minima_restante,
    comentario,
    tf_serie,
    tf_codigo_sucursal,
  } = body;

  const tipoOpcionalesFechaVenc = ["32", "34"];
  const requiereFechaVenc =
    tipo_comprobante && !tipoOpcionalesFechaVenc.includes(tipo_comprobante);

  const rangoData = {
    rnc: rnc ? String(rnc).replace(/\D/g, "").trim() : "",
    razon_social: razon_social ? String(razon_social).trim() : "",
    tipo_comprobante: tipo_comprobante ? String(tipo_comprobante).trim() : "",
    descripcion_tipo: descripcion_tipo
      ? String(descripcion_tipo).trim().slice(0, 100)
      : "",
    prefijo: prefijo && /^[A-Z]$/.test(String(prefijo)) ? String(prefijo) : "E",
    numero_inicial: numero_inicial != null ? Number(numero_inicial) : undefined,
    numero_final: numero_final != null ? Number(numero_final) : undefined,
    fecha_autorizacion: fecha_autorizacion
      ? new Date(fecha_autorizacion)
      : undefined,
    fecha_vencimiento:
      fecha_vencimiento && String(fecha_vencimiento).trim()
        ? new Date(fecha_vencimiento)
        : requiereFechaVenc
          ? undefined
          : null,
    alerta_minima_restante:
      alerta_minima_restante != null ? Number(alerta_minima_restante) : undefined,
    comentario: comentario ? String(comentario).trim().slice(0, 500) : "",
    tf_serie: tf_serie != null ? String(tf_serie).trim().slice(0, 24) : "",
    tf_codigo_sucursal:
      tf_codigo_sucursal != null
        ? String(tf_codigo_sucursal).trim().slice(0, 12)
        : "",
    usuario: userId,
  };

  if (
    rangoData.tipo_comprobante &&
    tipoOpcionalesFechaVenc.includes(rangoData.tipo_comprobante)
  ) {
    delete rangoData.fecha_vencimiento;
  }

  if (
    proximo_numero != null &&
    String(proximo_numero).trim() !== "" &&
    Number.isInteger(rangoData.numero_inicial)
  ) {
    const proximo = Number(proximo_numero);
    if (!Number.isInteger(proximo)) {
      return {
        status: 400,
        json: { error: "El próximo número debe ser un entero" },
      };
    }
    if (proximo < rangoData.numero_inicial) {
      return {
        status: 400,
        json: {
          error:
            "El próximo número no puede ser menor que el número inicial del rango",
        },
      };
    }
    if (
      Number.isInteger(rangoData.numero_final) &&
      proximo > rangoData.numero_final + 1
    ) {
      return {
        status: 400,
        json: {
          error: "El próximo número no puede superar el final del rango",
        },
      };
    }
    rangoData.numeros_utilizados = proximo - rangoData.numero_inicial;
  }

  try {
    const Comprobante = await getComprobanteModelForUserId(userId);
    const useDemoStorage = await userUsesComprobantesDevMongo(userId);
    const rango = await Comprobante.create(rangoData);
    let created = rango.toObject ? rango.toObject() : rango;

    const theFactorySync = await syncTheFactoryCrearSeriesFromComprobante(
      created,
      userId,
    );

    if (!theFactorySync.ok) {
      if (!useDemoStorage) {
        await Comprobante.deleteOne({ _id: rango._id });
        return {
          status: 502,
          json: {
            error:
              "The Factory no registró la serie. La secuencia no se guardó en Giganet (producción exige sincronización con el emisor).",
            details: theFactorySync.message,
            theFactorySync,
          },
        };
      }
    } else if (theFactorySync.enrichedSerie?.serie) {
      await Comprobante.updateOne(
        { _id: rango._id },
        {
          $set: {
            tf_serie: theFactorySync.enrichedSerie.serie,
            tf_codigo_sucursal:
              theFactorySync.enrichedSerie.codigoSucursal || "",
          },
        },
      );
      const refreshed = await Comprobante.findById(rango._id).lean();
      if (refreshed) created = refreshed;
    }

    return {
      status: 200,
      json: {
        status: "success",
        message: theFactorySync.ok
          ? theFactorySync.linkedExisting
            ? "Secuencia registrada en Giganet; serie ya existente en The Factory (vinculada)"
            : theFactorySync.updatedExisting
              ? "Secuencia registrada en Giganet; serie existente actualizada en The Factory"
              : "Secuencia creada en Giganet y The Factory"
          : "Secuencia creada solo en Giganet (ambiente demo; The Factory no respondió OK).",
        data: created,
        theFactorySync,
      },
    };
  } catch (err) {
    console.error("createComprobanteSequence:", err);

    if (err.name === "ValidationError") {
      const details = Object.values(err.errors || {}).map((e) => e.message);
      return {
        status: 400,
        json: { error: "Datos del rango inválidos", details: details.join(" ") },
      };
    }
    if (err.code === 11000) {
      return {
        status: 409,
        json: {
          error:
            "Ya existe un rango con esos números para este RNC y este mismo tipo de comprobante. Otros tipos pueden usar el mismo rango.",
        },
      };
    }
    if (err.message && err.message.includes("superpuestos")) {
      return {
        status: 409,
        json: {
          error:
            "Solo se comprueba superposición con secuencias del mismo tipo de comprobante. " +
            err.message,
        },
      };
    }
    if (
      err.message &&
      (err.message.includes("número final") ||
        err.message.includes("vencimiento"))
    ) {
      return { status: 400, json: { error: err.message } };
    }

    return { status: 500, json: { error: "Error al crear la secuencia" } };
  }
}
