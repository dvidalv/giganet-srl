import { NextResponse } from "next/server";
import { hashApiKey } from "@/utils/apiKey";

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
  const apiKey = getApiKeyFromRequest(request);
  if (!apiKey) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const userId = await getUserIdByApiKey(apiKey);
  if (!userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const rncRaw = body.rnc != null ? String(body.rnc).replace(/\D/g, "").trim() : "";
  const tipo_comprobante = body.tipo_comprobante != null ? String(body.tipo_comprobante).trim() : "";
  const solo_preview = Boolean(body.solo_preview);

  if (!rncRaw || rncRaw.length < RNC_MIN || rncRaw.length > RNC_MAX) {
    return NextResponse.json(
      { error: "RNC inválido (debe tener entre 9 y 11 dígitos)" },
      { status: 400 }
    );
  }
  if (!TIPOS_COMPROBANTE.includes(tipo_comprobante)) {
    return NextResponse.json(
      { error: "Tipo de comprobante inválido. Debe ser: 31, 32, 33, 34, 41, 43, 44, 45" },
      { status: 400 }
    );
  }

  try {
    const Comprobante = await getComprobante();
    const mongoose = await import("mongoose");
    const query = {
      usuario: new mongoose.default.Types.ObjectId(userId),
      rnc: rncRaw,
      tipo_comprobante,
      estado: { $in: ["activo", "alerta"] },
      numeros_disponibles: { $gt: 0 },
    };

    if (!["32", "34"].includes(tipo_comprobante)) {
      query.$or = [
        { fecha_vencimiento: { $gte: new Date() } },
        { fecha_vencimiento: null },
      ];
    }

    const rango = await Comprobante.findOne(query)
      .sort({ fechaCreacion: 1 })
      .exec();

    if (!rango) {
      return NextResponse.json(
        { error: "Secuencia no encontrada o no autorizada" },
        { status: 404 }
      );
    }

    if (!rango.esValido()) {
      return NextResponse.json(
        { error: "El rango no está disponible (vencido, agotado o inactivo)" },
        { status: 400 }
      );
    }

    const formatFechaVencimiento = (fecha) => {
      if (!fecha) return null;
      const d = new Date(fecha);
      if (isNaN(d.getTime())) return null;
      const dia = d.getDate().toString().padStart(2, "0");
      const mes = (d.getMonth() + 1).toString().padStart(2, "0");
      const año = d.getFullYear();
      return `${dia}-${mes}-${año}`;
    };
    const fechaVencimiento = formatFechaVencimiento(rango.fecha_vencimiento);

    if (solo_preview) {
      const proximoNumero = rango.numero_inicial + rango.numeros_utilizados;
      const numeroFormateado = rango.formatearNumeroECF(proximoNumero);
      return NextResponse.json({
        status: "success",
        message: "Próximo número (sin consumir)",
        data: {
          proximoNumero,
          numeroFormateado,
          numerosDisponibles: rango.numeros_disponibles,
          estadoRango: rango.estado,
          fechaVencimiento,
        },
      });
    }

    await rango.consumirNumero();
    const numeroConsumido = rango.numero_inicial + rango.numeros_utilizados - 1;
    const numeroFormateado = rango.formatearNumeroECF(numeroConsumido);

    let mensajeAlerta = null;
    if (rango.estado === "agotado") {
      mensajeAlerta = "ÚLTIMO COMPROBANTE USADO - Solicitar nuevo rango urgente";
    } else if (rango.estado === "alerta") {
      mensajeAlerta = `Quedan ${rango.numeros_disponibles} comprobantes - Solicitar nuevo rango pronto`;
    }

    return NextResponse.json({
      status: "success",
      message: "Número consumido exitosamente",
      data: {
        numeroConsumido,
        numeroFormateado,
        numerosDisponibles: rango.numeros_disponibles,
        estadoRango: rango.estado,
        fechaVencimiento,
        alertaAgotamiento: rango.estado === "alerta" || rango.estado === "agotado",
        mensajeAlerta,
        rnc: rango.rnc,
        tipoComprobante: rango.tipo_comprobante,
        prefijo: rango.prefijo ?? "E",
      },
    });
  } catch (err) {
    if (err.message && err.message.includes("No hay números disponibles")) {
      return NextResponse.json(
        { error: "No hay números disponibles en el rango" },
        { status: 400 }
      );
    }
    console.error("POST /api/comprobantes/solicitar-numero:", err);
    return NextResponse.json(
      { error: "Error al solicitar número" },
      { status: 500 }
    );
  }
}
