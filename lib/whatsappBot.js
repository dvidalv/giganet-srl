import {
  consultarEstatusDocumentoLogic,
  consultarRncLogic,
} from "@/app/controllers/comprobantes";
import { sendWhatsAppTextMessage } from "@/lib/whatsapp";

const MENU_TEXT = `*Giganet Systems — Facturación electrónica*

Escribe un comando:

*MENU* — ver este menú
*RNC* <número> — consultar contribuyente
*ESTADO* <NCF> — estatus de un e-CF
*ESTADO* <NCF> <RNC emisor> — estatus indicando el RNC emisor

Ejemplos:
RNC 101609921
ESTADO E320000000001
ESTADO E320000000001 131098193`;

/**
 * Resuelve el userId de Mongo usado para credenciales TheFactory.
 * @returns {string | null}
 */
function getBotUserId() {
  const id = process.env.WHATSAPP_BOT_USER_ID?.trim();
  return id || null;
}

/**
 * RNC emisor por defecto (env o empresa del usuario bot).
 * @param {string | null} userId
 * @returns {Promise<string>}
 */
async function resolveDefaultEmisorRnc(userId) {
  const fromEnv = String(process.env.WHATSAPP_BOT_RNC_EMISOR ?? "").replace(
    /\D/g,
    "",
  );
  if (fromEnv.length === 9 || fromEnv.length === 11) return fromEnv;

  if (!userId) return "";

  try {
    const mod = await import("@/app/models/user");
    const User = mod.default;
    const owner = await User.findById(userId).select("empresa.rnc").lean();
    return String(owner?.empresa?.rnc ?? "").replace(/\D/g, "");
  } catch (error) {
    console.error("WHATSAPP BOT: no se pudo leer RNC emisor del usuario", error);
    return "";
  }
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
  const rncConsultar = String(parts[1] ?? "").replace(/\D/g, "");

  if (rncConsultar.length !== 9 && rncConsultar.length !== 11) {
    await sendWhatsAppTextMessage(
      from,
      "Uso: *RNC* <9 u 11 dígitos>\nEjemplo: RNC 101609921",
    );
    return;
  }

  const userId = getBotUserId();
  if (!userId) {
    await sendWhatsAppTextMessage(
      from,
      "Consulta RNC no configurada: falta WHATSAPP_BOT_USER_ID en el servidor.",
    );
    return;
  }

  await sendWhatsAppTextMessage(from, `Consultando RNC ${rncConsultar}…`);

  try {
    const result = await consultarRncLogic({ rncConsultar }, { userId });
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
  // ESTADO <ncf> [rnc]
  const ncf = String(parts[1] ?? "")
    .trim()
    .toUpperCase();
  let rncEmisor = String(parts[2] ?? "").replace(/\D/g, "");

  if (!ncf || ncf.length < 5) {
    await sendWhatsAppTextMessage(
      from,
      "Uso: *ESTADO* <NCF> [RNC emisor]\nEjemplo: ESTADO E320000000001\nO: ESTADO E320000000001 131098193",
    );
    return;
  }

  const userId = getBotUserId();
  if (!rncEmisor) {
    rncEmisor = await resolveDefaultEmisorRnc(userId);
  }

  if (rncEmisor.length !== 9 && rncEmisor.length !== 11) {
    await sendWhatsAppTextMessage(
      from,
      "Falta el RNC del emisor. Usa:\n*ESTADO* <NCF> <RNC emisor>\nO configura WHATSAPP_BOT_USER_ID / WHATSAPP_BOT_RNC_EMISOR.",
    );
    return;
  }

  await sendWhatsAppTextMessage(
    from,
    `Consultando estatus de ${ncf} (RNC ${rncEmisor})…`,
  );

  try {
    const result = await consultarEstatusDocumentoLogic(
      { ncf, rnc: rncEmisor },
      { userId },
    );
    const payload = result.data ?? {};

    if (payload.status !== "success" || !payload.data) {
      await sendWhatsAppTextMessage(
        from,
        `*Estatus e-CF*\nNCF: ${ncf}\nNo se pudo consultar.\n${payload.message || ""}\n${payload.details || ""}`.trim(),
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
