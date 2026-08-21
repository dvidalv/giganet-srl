import {
  consultarEstatusDocumentoLogic,
  consultarRncLogic,
} from "@/app/controllers/comprobantes";
import { sendWhatsAppTextMessage } from "@/lib/whatsapp";

const MENU_TEXT = `*Giganet Systems — Facturación electrónica*

No necesitas API key.

*MENU* — este menú
*ESTADO* <NCF> <RNC emisor> — estatus de un e-CF
*RNC* <número> — consultar un contribuyente

Ejemplo:
ESTADO E320000000001 131098193

El RNC emisor es el de la empresa que aparece en la factura.`;

function digitsOnly(value) {
  return String(value ?? "").replace(/\D/g, "");
}

function envEmisorRnc() {
  return digitsOnly(
    process.env.WHATSAPP_BOT_RNC_EMISOR || process.env.THEFACTORY_RNC || "",
  );
}

/**
 * Busca el usuario Giganet cuya empresa.rnc coincide (credenciales TheFactory).
 * @param {string} rnc
 * @returns {Promise<string | null>}
 */
async function findUserIdByEmpresaRnc(rnc) {
  const rncNorm = digitsOnly(rnc);
  if (rncNorm.length !== 9 && rncNorm.length !== 11) return null;

  try {
    const mod = await import("@/app/models/user");
    const User = mod.default;

    // Coincidencia exacta (lo habitual: RNC solo dígitos en Mi Empresa)
    let user = await User.findOne({ "empresa.rnc": rncNorm })
      .select("_id")
      .lean();
    if (user?._id) return user._id.toString();

    // Por si el RNC se guardó con guiones u otros separadores
    const loose = new RegExp(`^${rncNorm.split("").join("\\D*")}$`);
    user = await User.findOne({ "empresa.rnc": loose }).select("_id").lean();
    return user?._id?.toString() ?? null;
  } catch (error) {
    console.error("WHATSAPP BOT: findUserIdByEmpresaRnc failed", error);
    return null;
  }
}

/**
 * RNC de empresa de un userId.
 * @param {string} userId
 * @returns {Promise<string>}
 */
async function getEmpresaRncByUserId(userId) {
  if (!userId) return "";
  try {
    const mod = await import("@/app/models/user");
    const User = mod.default;
    const owner = await User.findById(userId).select("empresa.rnc").lean();
    return digitsOnly(owner?.empresa?.rnc);
  } catch (error) {
    console.error("WHATSAPP BOT: getEmpresaRncByUserId failed", error);
    return "";
  }
}

/**
 * Credenciales de servicio del bot (lado servidor).
 * El usuario de WhatsApp nunca envía API key ni userId.
 *
 * Orden:
 * 1) WHATSAPP_BOT_USER_ID
 * 2) Usuario Mongo con empresa.rnc = WHATSAPP_BOT_RNC_EMISOR / THEFACTORY_RNC
 * 3) Solo RNC emisor en env (requiere fallback TheFactory por env en el controlador)
 *
 * @returns {Promise<{ userId: string | null, emisorRnc: string }>}
 */
async function resolveServiceAuth() {
  const botUserId = process.env.WHATSAPP_BOT_USER_ID?.trim() || null;
  if (botUserId) {
    const emisorRnc = (await getEmpresaRncByUserId(botUserId)) || envEmisorRnc();
    return { userId: botUserId, emisorRnc };
  }

  const emisorRnc = envEmisorRnc();
  if (emisorRnc) {
    const userId = await findUserIdByEmpresaRnc(emisorRnc);
    return { userId, emisorRnc };
  }

  return { userId: null, emisorRnc: "" };
}

/**
 * Auth para consultar estatus: SOLO por RNC emisor del mensaje.
 * Busca usuario Giganet con ese empresa.rnc (mismas credenciales que usaría el API key).
 * @param {string} emisorRnc
 * @returns {Promise<{ userId: string | null, emisorRnc: string }>}
 */
async function resolveAuthForEmisor(emisorRnc) {
  const rncNorm = digitsOnly(emisorRnc);
  const userId = await findUserIdByEmpresaRnc(rncNorm);
  return { userId, emisorRnc: rncNorm };
}

/**
 * Interpreta un mensaje de texto entrante y responde por WhatsApp.
 * @param {string} from
 * @param {string} text
 */
export async function handleWhatsAppBotText(from, text) {
  const raw = String(text ?? "").trim();
  const normalized = raw.replace(/\s+/g, " ");
  const upper = normalized.toUpperCase();

  if (!raw || isMenuCommand(upper)) {
    await sendWhatsAppTextMessage(from, MENU_TEXT);
    return;
  }

  if (upper.startsWith("RNC ") || upper === "RNC") {
    await handleRncCommand(from, normalized);
    return;
  }

  if (upper.startsWith("ESTADO ") || upper === "ESTADO") {
    await handleEstadoCommand(from, normalized);
    return;
  }

  await sendWhatsAppTextMessage(
    from,
    `No reconocí ese comando.\n\n${MENU_TEXT}`,
  );
}

function isMenuCommand(upper) {
  return (
    upper === "MENU" ||
    upper === "MENÚ" ||
    upper === "AYUDA" ||
    upper === "HELP" ||
    upper === "HOLA" ||
    upper === "HI" ||
    upper === "HELLO" ||
    upper === "START" ||
    upper === "1"
  );
}

async function handleRncCommand(from, normalized) {
  const parts = normalized.split(" ");
  const rncConsultar = digitsOnly(parts[1]);

  if (rncConsultar.length !== 9 && rncConsultar.length !== 11) {
    await sendWhatsAppTextMessage(
      from,
      "Uso: *RNC* <9 u 11 dígitos>\nEjemplo: RNC 101609921",
    );
    return;
  }

  const service = await resolveServiceAuth();
  if (!service.emisorRnc || (service.emisorRnc.length !== 9 && service.emisorRnc.length !== 11)) {
    await sendWhatsAppTextMessage(
      from,
      "El bot aún no está configurado en el servidor para consultar RNC. (Falta cuenta de servicio The Factory.)",
    );
    return;
  }

  await sendWhatsAppTextMessage(from, `Consultando RNC ${rncConsultar}…`);

  try {
    const result = await consultarRncLogic(
      { rncConsultar, rnc: service.emisorRnc },
      { userId: service.userId },
    );
    const data = result.data ?? {};

    if (!data.ok) {
      await sendWhatsAppTextMessage(
        from,
        `*Consulta RNC*\nRNC: ${rncConsultar}\nResultado: no encontrado o error.\n${data.message || data.detalle || ""}`.trim(),
      );
      return;
    }

    const lines = [
      "*Consulta RNC*",
      `RNC: ${data.rnc || rncConsultar}`,
      `Razón social: ${data.razonSocial || "—"}`,
      data.nombreComercial ? `Nombre comercial: ${data.nombreComercial}` : null,
      `Estado: ${data.estado || "—"}`,
      data.regimen ? `Régimen: ${data.regimen}` : null,
      data.fechaIncorporacion
        ? `Incorporación: ${data.fechaIncorporacion}`
        : null,
    ].filter(Boolean);

    await sendWhatsAppTextMessage(from, lines.join("\n"));
  } catch (error) {
    console.error("WHATSAPP BOT RNC error:", error);
    await sendWhatsAppTextMessage(
      from,
      "No pude consultar el RNC en este momento. Intenta más tarde.",
    );
  }
}

async function handleEstadoCommand(from, normalized) {
  const parts = normalized.split(" ").filter(Boolean);
  const ncf = String(parts[1] ?? "")
    .trim()
    .toUpperCase();
  const rncFromMessage = digitsOnly(parts[2]);

  if (!ncf || ncf.length < 5 || (rncFromMessage.length !== 9 && rncFromMessage.length !== 11)) {
    await sendWhatsAppTextMessage(
      from,
      "Uso: *ESTADO* <NCF> <RNC emisor>\nEjemplo: ESTADO E320000000001 131098193\n\nAmbos datos aparecen en la factura. No necesitas API key.",
    );
    return;
  }

  const auth = await resolveAuthForEmisor(rncFromMessage);

  if (!auth.userId) {
    await sendWhatsAppTextMessage(
      from,
      `No encontré en Giganet una empresa con RNC *${auth.emisorRnc}*.\n\nEse emisor debe tener cuenta en Giganet con The Factory configurado en Mi Empresa.`,
    );
    return;
  }

  await sendWhatsAppTextMessage(
    from,
    `Consultando estatus de ${ncf} (RNC ${auth.emisorRnc})…`,
  );

  try {
    const result = await consultarEstatusDocumentoLogic(
      { ncf, rnc: auth.emisorRnc },
      { userId: auth.userId },
    );
    const payload = result.data ?? {};

    if (payload.status !== "success" || !payload.data) {
      const details = String(payload.details || payload.message || "");
      const hint = details.includes("CREDENCIALES_THEFACTORY")
        ? "\n\nEsa empresa está en Giganet pero sin credenciales The Factory en Mi Empresa."
        : "";
      await sendWhatsAppTextMessage(
        from,
        `*Estatus e-CF*\nNCF: ${ncf}\nNo se pudo consultar.\n${payload.message || ""}\n${payload.details || ""}${hint}`.trim(),
      );
      return;
    }

    const d = payload.data;
    const lines = [
      "*Estatus e-CF*",
      `NCF: ${d.ncf || ncf}`,
      `Estado: ${d.estado || "—"}`,
      d.estadoOriginal && d.estadoOriginal !== d.estado
        ? `Estado original: ${d.estadoOriginal}`
        : null,
      `Mensaje: ${d.mensaje || "—"}`,
      d.fechaConsulta ? `Consulta: ${d.fechaConsulta}` : null,
      d.advertencia ? `Nota: ${d.advertencia}` : null,
    ].filter(Boolean);

    await sendWhatsAppTextMessage(from, lines.join("\n"));
  } catch (error) {
    console.error("WHATSAPP BOT ESTADO error:", error);
    await sendWhatsAppTextMessage(
      from,
      "No pude consultar el estatus en este momento. Intenta más tarde.",
    );
  }
}
