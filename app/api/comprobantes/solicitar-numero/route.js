import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { hashApiKey } from "@/utils/apiKey";

/** @param {string} reqId */
function logSn(reqId, ...args) {
  console.log(`[comprobantes/solicitar-numero][${reqId}]`, ...args);
}

/** @param {string} reqId */
function errSn(reqId, ...args) {
  console.error(`[comprobantes/solicitar-numero][${reqId}]`, ...args);
}

const TIPOS_COMPROBANTE = ["31", "32", "33", "34", "41", "43", "44", "45"];
const RNC_MIN = 9;
const RNC_MAX = 11;

function getApiKeyFromRequest(request) {
  const authHeader = request.headers.get("authorization");
  const bearer = authHeader?.replace(/^Bearer\s+/i, "").trim();
  if (bearer) return bearer;
  return request.headers.get("x-api-key")?.trim() ?? null;
}

async function getUserIdByApiKey(apiKey) {
  if (!apiKey) return null;
  const keyHash = hashApiKey(apiKey);
  if (!keyHash) return null;
  const mod = await import("@/app/models/user");
  const User = mod.default;
  const user = await User.findOne({ apiKeyHash: keyHash }).select("_id").lean();
  return user?._id?.toString() ?? null;
}

async function getComprobante() {
  const mod = await import("@/app/models/comprobante");
  const def = mod.default;
  const Comprobante =
    mod.Comprobante ??
    (def && typeof def.Comprobante !== "undefined" ? def.Comprobante : null) ??
    (def && typeof def.create === "function" ? def : null);
  if (!Comprobante || typeof Comprobante.create !== "function") {
    throw new Error("Comprobante model not available");
  }
  return Comprobante;
}

/**
 * POST /api/comprobantes/solicitar-numero
 * Autorización: API Key (Authorization: Bearer <api_key> o X-API-Key: <api_key>).
 * Body: { rnc: string, tipo_comprobante: string, solo_preview?: boolean }
 * El sistema del cliente envía RNC y tipo; solo se consumen secuencias del usuario dueño de la API Key.
 */
export async function POST(request) {
  const reqId = randomUUID().slice(0, 8);
  const t0 = Date.now();
  logSn(reqId, "=== INICIO solicitar-numero ===");

  const apiKey = getApiKeyFromRequest(request);
  logSn(
    reqId,
    "API Key recibida:",
    apiKey ? `${apiKey.substring(0, 10)}...` : "null",
  );

  if (!apiKey) {
    logSn(reqId, "ERROR: No se proporcionó API Key");
    logSn(reqId, `FIN 401 (${Date.now() - t0}ms)`);
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const userId = await getUserIdByApiKey(apiKey);
  logSn(reqId,"Usuario ID encontrado:", userId);

  if (!userId) {
    logSn(reqId, "ERROR: API Key no válida o usuario no encontrado");
    logSn(reqId, `FIN 401 (${Date.now() - t0}ms)`);
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
    logSn(reqId,"Body recibido:", JSON.stringify(body, null, 2));
  } catch (error) {
    errSn(reqId, "ERROR: Cuerpo JSON inválido", error);
    logSn(reqId, `FIN 400 (${Date.now() - t0}ms)`);
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const rncRaw =
    body.rnc != null ? String(body.rnc).replace(/\D/g, "").trim() : "";
  const tipo_comprobante =
    body.tipo_comprobante != null ? String(body.tipo_comprobante).trim() : "";
  const solo_preview = Boolean(body.solo_preview);

  logSn(reqId,"Parámetros procesados:", {
    rncRaw,
    tipo_comprobante,
    solo_preview,
  });

  if (!rncRaw || rncRaw.length < RNC_MIN || rncRaw.length > RNC_MAX) {
    logSn(reqId,
      `ERROR: RNC inválido - longitud: ${rncRaw.length}, valor: ${rncRaw}`,
    );
    logSn(reqId, `FIN 400 RNC inválido (${Date.now() - t0}ms)`);
    return NextResponse.json(
      { error: "RNC inválido (debe tener entre 9 y 11 dígitos)" },
      { status: 400 },
    );
  }
  if (!TIPOS_COMPROBANTE.includes(tipo_comprobante)) {
    logSn(reqId, `ERROR: Tipo de comprobante inválido: ${tipo_comprobante}`);
    logSn(reqId, `FIN 400 tipo inválido (${Date.now() - t0}ms)`);
    return NextResponse.json(
      {
        error:
          "Tipo de comprobante inválido. Debe ser: 31, 32, 33, 34, 41, 43, 44, 45",
      },
      { status: 400 },
    );
  }

  logSn(reqId,"✓ Validaciones básicas pasadas");

  try {
    logSn(reqId,"Obteniendo modelo Comprobante...");
    const Comprobante = await getComprobante();
    logSn(reqId,"✓ Modelo Comprobante obtenido");

    const mongoose = await import("mongoose");
    const query = {
      usuario: new mongoose.default.Types.ObjectId(userId),
      rnc: rncRaw,
      tipo_comprobante,
      estado: { $in: ["activo", "alerta"] },
      // Condición atómica: solo coincidir si aún hay números disponibles.
      // Evita condición de carrera cuando varias peticiones solicitan al mismo tiempo.
      $expr: {
        $lt: [
          "$numeros_utilizados",
          { $add: [{ $subtract: ["$numero_final", "$numero_inicial"] }, 1] },
        ],
      },
    };

    if (!["32", "34"].includes(tipo_comprobante)) {
      query.$or = [
        { fecha_vencimiento: { $gte: new Date() } },
        { fecha_vencimiento: null },
      ];
    }

    logSn(reqId,"Query para buscar rango:", JSON.stringify(query, null, 2));

    // Para preview: solo leer, no modificar. findOne es suficiente.
    const rango = solo_preview
      ? await Comprobante.findOne(query).sort({ fechaCreacion: 1 }).exec()
      : await Comprobante.findOneAndUpdate(
          query,
          [
            { $set: { numeros_utilizados: { $add: ["$numeros_utilizados", 1] } } },
            {
              $set: {
                numeros_disponibles: {
                  $subtract: ["$cantidad_numeros", "$numeros_utilizados"],
                },
              },
            },
            {
              $set: {
                estado: {
                  $cond: [
                    { $lte: ["$numeros_disponibles", 0] },
                    "agotado",
                    {
                      $cond: [
                        {
                          $lte: [
                            "$numeros_disponibles",
                            { $ifNull: ["$alerta_minima_restante", 5] },
                          ],
                        },
                        "alerta",
                        "$estado",
                      ],
                    },
                  ],
                },
                fechaActualizacion: new Date(),
              },
            },
          ],
          {
            new: true,
            sort: { fechaCreacion: 1 },
            updatePipeline: true,
          }
        );

    logSn(reqId,"Rango encontrado:", rango ? `ID: ${rango._id}` : "null");

    if (!rango) {
      logSn(reqId, "ERROR: No se encontró ningún rango válido");
      errSn(reqId, "404 Secuencia no encontrada — sin rango atómico para RNC/tipo (ver diagnóstico siguiente)");
      // Consultar si existen rangos agotados o vencidos para dar mensaje útil a FileMaker
      const queryDiagnostico = {
        usuario: new mongoose.default.Types.ObjectId(userId),
        rnc: rncRaw,
        tipo_comprobante,
      };
      const rangosExistentes = await Comprobante.find(queryDiagnostico)
        .select("estado numeros_disponibles")
        .lean();
      let mensaje = null;
      if (rangosExistentes.length > 0) {
        const totalDisponible = rangosExistentes.reduce(
          (sum, r) => sum + (r.numeros_disponibles ?? 0),
          0,
        );
        if (totalDisponible === 0) {
          mensaje =
            "Los números de comprobantes están agotados. Solicitar nuevo rango urgente.";
        } else {
          mensaje =
            "No hay números disponibles. Los rangos pueden estar agotados o vencidos. Solicitar nuevo rango urgente.";
        }
      } else {
        mensaje =
          "No hay rangos configurados para este RNC y tipo de comprobante. Solicitar nuevo rango.";
      }
      logSn(reqId, "diagnóstico sin rango", {
        rangosMismaQuery: rangosExistentes.length,
        mensaje,
      });
      logSn(reqId, `FIN 404 secuencia no disponible (${Date.now() - t0}ms)`);
      // Línea única en stderr: la UI del cliente no escribe en esta terminal; esto sí.
      console.error(
        "[GIGANET solicitar-numero] 404 Secuencia no encontrada | RNC",
        rncRaw,
        "| tipo",
        tipo_comprobante,
        "|",
        mensaje,
      );
      return NextResponse.json(
        {
          error: "Secuencia no encontrada o no autorizada",
          mensaje,
        },
        { status: 404 },
      );
    }

    logSn(reqId,"Datos del rango encontrado:", {
      id: rango._id,
      rnc: rango.rnc,
      tipo: rango.tipo_comprobante,
      estado: rango.estado,
      disponibles: rango.numeros_disponibles,
      utilizados: rango.numeros_utilizados,
      inicial: rango.numero_inicial,
      final: rango.numero_final,
    });

    // Solo validar con esValido en preview; en consumo, findOneAndUpdate ya garantizó
    // que el rango era elegible antes de incrementar.
    if (solo_preview && !rango.esValido()) {
      logSn(reqId,
        "ERROR: El rango no es válido (método esValido() retornó false)",
      );
      logSn(reqId, `FIN 400 rango inválido preview (${Date.now() - t0}ms)`);
      return NextResponse.json(
        {
          error: "El rango no está disponible (vencido, agotado o inactivo)",
          mensaje:
            "Los números de comprobantes están agotados o vencidos. Solicitar nuevo rango urgente.",
        },
        { status: 400 },
      );
    }

    logSn(reqId,"✓ Rango válido");

    const formatFechaVencimiento = (fecha) => {
      if (!fecha) return null;
      const d = new Date(fecha);
      if (isNaN(d.getTime())) return null;
      // Usar UTC para evitar desfase por zona horaria (ej: 31-12-2028 en DB → 30-12-2028 en local)
      const dia = d.getUTCDate().toString().padStart(2, "0");
      const mes = (d.getUTCMonth() + 1).toString().padStart(2, "0");
      const año = d.getUTCFullYear();
      return `${dia}-${mes}-${año}`;
    };
    const fechaVencimiento = formatFechaVencimiento(rango.fecha_vencimiento);

    if (solo_preview) {
      logSn(reqId,"Modo PREVIEW activado - no se consumirá número");
      const proximoNumero = rango.numero_inicial + rango.numeros_utilizados;
      const numeroFormateado = rango.formatearNumeroECF(proximoNumero);

      // Total disponible en todos los rangos del mismo RNC+tipo
      const queryTotalPreview = {
        usuario: new mongoose.default.Types.ObjectId(userId),
        rnc: rncRaw,
        tipo_comprobante,
        estado: { $in: ["activo", "alerta"] },
        numeros_disponibles: { $gt: 0 },
      };
      if (!["32", "34"].includes(tipo_comprobante)) {
        queryTotalPreview.$or = [
          { fecha_vencimiento: { $gte: new Date() } },
          { fecha_vencimiento: null },
        ];
      }
      const totalPreview = await Comprobante.aggregate([
        { $match: queryTotalPreview },
        { $group: { _id: null, total: { $sum: "$numeros_disponibles" } } },
      ]);
      const totalDisponiblesGrupoPreview = totalPreview[0]?.total ?? 0;
      const umbralPreview = rango.alerta_minima_restante ?? 5;
      const alertaPreview = totalDisponiblesGrupoPreview <= umbralPreview;

      logSn(reqId,"Próximo número (preview):", {
        proximoNumero,
        numeroFormateado,
        totalGrupo: totalDisponiblesGrupoPreview,
      });
      const mensajePreview = alertaPreview
        ? `Quedan ${totalDisponiblesGrupoPreview} comprobantes - Solicitar nuevo rango pronto`
        : null;
      const previewBody = {
        status: "success",
        message: "Próximo número (sin consumir)",
        data: {
          proximoNumero,
          numeroFormateado,
          numerosDisponibles: rango.numeros_disponibles,
          numerosDisponiblesGrupo: totalDisponiblesGrupoPreview,
          estadoRango: rango.estado,
          fechaVencimiento,
          alertaAgotamiento: alertaPreview,
        },
      };
      if (mensajePreview) previewBody.mensaje = mensajePreview;
      logSn(reqId, `FIN 200 preview OK (${Date.now() - t0}ms)`);
      return NextResponse.json(previewBody);
    }

    // Número ya consumido de forma atómica en findOneAndUpdate
    const numeroConsumido = rango.numero_inicial + rango.numeros_utilizados - 1;
    const numeroFormateado = rango.formatearNumeroECF(numeroConsumido);

    logSn(reqId,"Número consumido:", { numeroConsumido, numeroFormateado });
    logSn(reqId,"Estado después de consumir:", {
      estado: rango.estado,
      disponibles: rango.numeros_disponibles,
      utilizados: rango.numeros_utilizados,
    });

    // Calcular total de disponibles en TODOS los rangos activos del mismo RNC+tipo.
    // La alerta solo debe dispararse si el TOTAL del grupo está bajo, no por un rango individual.
    const queryTotal = {
      usuario: new mongoose.default.Types.ObjectId(userId),
      rnc: rncRaw,
      tipo_comprobante,
      estado: { $in: ["activo", "alerta"] },
      numeros_disponibles: { $gt: 0 },
    };
    if (!["32", "34"].includes(tipo_comprobante)) {
      queryTotal.$or = [
        { fecha_vencimiento: { $gte: new Date() } },
        { fecha_vencimiento: null },
      ];
    }
    const totalResult = await Comprobante.aggregate([
      { $match: queryTotal },
      { $group: { _id: null, total: { $sum: "$numeros_disponibles" } } },
    ]);
    const totalDisponiblesGrupo = totalResult[0]?.total ?? 0;
    const umbralAlerta = rango.alerta_minima_restante ?? 5;

    let mensajeAlerta = null;
    let alertaAgotamiento = false;

    // Solo mostrar alerta si el TOTAL del grupo está por debajo del umbral
    if (totalDisponiblesGrupo <= umbralAlerta) {
      alertaAgotamiento = true;
      if (rango.estado === "agotado") {
        mensajeAlerta =
          "ÚLTIMO COMPROBANTE USADO - Solicitar nuevo rango urgente";
        logSn(reqId,"⚠️ ALERTA: Rango agotado, total grupo bajo");
      } else {
        mensajeAlerta = `Quedan ${totalDisponiblesGrupo} comprobantes en total - Solicitar nuevo rango pronto`;
        logSn(reqId,
          `⚠️ ALERTA: Total del grupo bajo (${totalDisponiblesGrupo} disponibles)`,
        );
      }
    } else {
      logSn(reqId,
        `✓ Total del grupo suficiente (${totalDisponiblesGrupo} disponibles), no se muestra alerta`,
      );
    }

    logSn(reqId, "=== FIN solicitar-numero (éxito) ===", `${Date.now() - t0}ms`);
    const responseBody = {
      status: "success",
      message: "Número consumido exitosamente",
      data: {
        numeroConsumido,
        numeroFormateado,
        numerosDisponibles: rango.numeros_disponibles,
        numerosDisponiblesGrupo: totalDisponiblesGrupo,
        estadoRango: rango.estado,
        fechaVencimiento,
        alertaAgotamiento,
        mensajeAlerta,
        rnc: rango.rnc,
        tipoComprobante: rango.tipo_comprobante,
        prefijo: rango.prefijo ?? "E",
      },
    };
    if (alertaAgotamiento && mensajeAlerta) {
      responseBody.mensaje = mensajeAlerta;
    }
    return NextResponse.json(responseBody);
  } catch (err) {
    errSn(reqId, "=== ERROR en solicitar-numero ===", err);
    if (err instanceof Error && err.stack) {
      errSn(reqId, "Stack:", err.stack);
    }

    if (err instanceof Error && err.message.includes("No hay números disponibles")) {
      logSn(reqId, "ERROR: No hay números disponibles en el rango");
      logSn(reqId, `FIN 400 (${Date.now() - t0}ms)`);
      return NextResponse.json(
        {
          error: "No hay números disponibles en el rango",
          mensaje:
            "Los números de comprobantes están agotados. Solicitar nuevo rango urgente.",
        },
        { status: 400 },
      );
    }
    errSn(reqId, "POST /api/comprobantes/solicitar-numero — error no clasificado");
    logSn(reqId, `FIN 500 (${Date.now() - t0}ms)`);
    return NextResponse.json(
      { error: "Error al solicitar número" },
      { status: 500 },
    );
  }
}
