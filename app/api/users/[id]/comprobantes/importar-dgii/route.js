import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import User from "@/app/models/user";
import { createComprobanteSequence } from "@/lib/createComprobanteSequence";
import {
  claveDedupSolicitud,
  deduplicarFilasPorSolicitud,
  enriquecerFilaConSolicitudAutorizacion,
  existeSecuenciaPorSolicitud,
  existeSecuenciaSolapada,
  validarFilaParaCrear,
} from "@/lib/comprobantes/dgiiImport";
import { connectDB } from "@/lib/mongoDB";

export const runtime = "nodejs";
export const maxDuration = 180;

/**
 * POST /api/users/[id]/comprobantes/importar-dgii
 * Crea en producción (Mongo + The Factory) las secuencias revisadas por el admin,
 * sin cambiar empresa.theFactoryAmbiente.
 */
export async function POST(request, { params }) {
  const check = await requireAdmin();
  if (check.error) return check.error;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const filas = Array.isArray(body?.filas) ? body.filas : null;
  if (!filas?.length) {
    return NextResponse.json(
      { error: "Indique al menos una secuencia revisada para crear" },
      { status: 400 },
    );
  }
  if (filas.length > 20) {
    return NextResponse.json(
      { error: "Máximo 20 secuencias por importación" },
      { status: 400 },
    );
  }

  try {
    await connectDB();
    const user = await User.findById(id)
      .select("empresa.rnc empresa.razonSocial empresa.nombre empresa.theFactoryAmbiente")
      .lean();
    if (!user) {
      return NextResponse.json({ error: "Empresa no encontrada" }, { status: 404 });
    }
    const rnc = String(user.empresa?.rnc || "").replace(/\D/g, "");
    const razonSocial =
      user.empresa?.razonSocial || user.empresa?.nombre || "Sin razón social";
    if (!rnc) {
      return NextResponse.json(
        { error: "La empresa no tiene RNC configurado" },
        { status: 400 },
      );
    }

    const resultados = [];
    const vistasSolicitud = new Set();
    const filasEnriquecidas = filas.map(enriquecerFilaConSolicitudAutorizacion);
    const filasDedup = deduplicarFilasPorSolicitud(filasEnriquecidas);
    let omitidasPorSolicitud = filas.length - filasDedup.length;

    for (const fila of filasDedup) {
      const validado = validarFilaParaCrear(fila, { rnc, razonSocial });
      if (!validado.ok) {
        resultados.push({
          ok: false,
          tipo_comprobante: fila?.tipo_comprobante,
          numero_inicial: fila?.numero_inicial,
          numero_final: fila?.numero_final,
          error: validado.error,
        });
        continue;
      }

      const solKey = claveDedupSolicitud(fila);
      const noSolicitud = String(fila?.no_solicitud ?? "")
        .trim()
        .replace(/\D/g, "");
      const noAutorizacion = String(fila?.no_autorizacion ?? "")
        .trim()
        .replace(/\D/g, "");

      if (solKey && vistasSolicitud.has(solKey)) {
        omitidasPorSolicitud += 1;
        resultados.push({
          ok: true,
          omitida: true,
          tipo_comprobante: validado.body.tipo_comprobante,
          numero_inicial: validado.body.numero_inicial,
          numero_final: validado.body.numero_final,
          message:
            "Omitida: misma solicitud y autorización ya procesadas en esta importación.",
        });
        continue;
      }

      if (noSolicitud && noAutorizacion) {
        const existe = await existeSecuenciaPorSolicitud({
          userId: id,
          rnc,
          noSolicitud,
          noAutorizacion,
        });
        if (existe) {
          omitidasPorSolicitud += 1;
          if (solKey) vistasSolicitud.add(solKey);
          resultados.push({
            ok: true,
            omitida: true,
            tipo_comprobante: validado.body.tipo_comprobante,
            numero_inicial: validado.body.numero_inicial,
            numero_final: validado.body.numero_final,
            message:
              "Omitida: ya existe una secuencia de producción con esa solicitud y autorización.",
          });
          continue;
        }
      }

      const solapa = await existeSecuenciaSolapada({
        userId: id,
        rnc,
        tipoComprobante: validado.body.tipo_comprobante,
        numeroInicial: validado.body.numero_inicial,
        numeroFinal: validado.body.numero_final,
      });
      if (solapa) {
        omitidasPorSolicitud += 1;
        if (solKey) vistasSolicitud.add(solKey);
        resultados.push({
          ok: true,
          omitida: true,
          tipo_comprobante: validado.body.tipo_comprobante,
          numero_inicial: validado.body.numero_inicial,
          numero_final: validado.body.numero_final,
          message:
            "Omitida: ya existe una secuencia de producción con rango solapado para este tipo.",
        });
        continue;
      }

      const r = await createComprobanteSequence(id, validado.body, {
        forceProduction: true,
      });
      if (r.status === 200) {
        if (solKey) vistasSolicitud.add(solKey);
        resultados.push({
          ok: true,
          tipo_comprobante: validado.body.tipo_comprobante,
          numero_inicial: validado.body.numero_inicial,
          numero_final: validado.body.numero_final,
          cantidad:
            validado.body.numero_final - validado.body.numero_inicial + 1,
          id: r.json?.data?._id ? String(r.json.data._id) : null,
          tf_serie: r.json?.data?.tf_serie || null,
          message: r.json?.message || "Creada",
          theFactorySync: r.json?.theFactorySync
            ? { ok: !!r.json.theFactorySync.ok, message: r.json.theFactorySync.message }
            : null,
        });
      } else if (
        r.status === 409 &&
        /superpuest/i.test(String(r.json?.error || ""))
      ) {
        omitidasPorSolicitud += 1;
        if (solKey) vistasSolicitud.add(solKey);
        resultados.push({
          ok: true,
          omitida: true,
          tipo_comprobante: validado.body.tipo_comprobante,
          numero_inicial: validado.body.numero_inicial,
          numero_final: validado.body.numero_final,
          message:
            "Omitida: ya existe una secuencia de producción con rango solapado para este tipo.",
          details: r.json?.error || null,
        });
      } else {
        resultados.push({
          ok: false,
          tipo_comprobante: validado.body.tipo_comprobante,
          numero_inicial: validado.body.numero_inicial,
          numero_final: validado.body.numero_final,
          error: r.json?.error || "Error al crear la secuencia",
          details: r.json?.details || null,
        });
      }
    }

    const creadas = resultados.filter((x) => x.ok && !x.omitida).length;
    const omitidas = resultados.filter((x) => x.omitida).length;
    const fallidas = resultados.filter((x) => !x.ok).length;

    return NextResponse.json({
      empresa: {
        id: String(user._id),
        rnc,
        razonSocial,
        ambienteEmpresa: user.empresa?.theFactoryAmbiente === "demo" ? "demo" : "production",
      },
      destino: "production",
      ambienteEmpresaSinCambiar: true,
      creadas,
      omitidas,
      omitidasPorSolicitud,
      fallidas,
      resultados,
    });
  } catch (err) {
    console.error("POST importar-dgii:", err);
    return NextResponse.json(
      { error: "Error al importar las secuencias" },
      { status: 500 },
    );
  }
}
