import {
  consultarEstatusDocumentoLogic,
  consultarRncLogic,
} from "@/app/controllers/comprobantes";
import { sendWhatsAppTextMessage } from "@/lib/whatsapp";
import {
  clearWhatsAppSession,
  getWhatsAppSession,
  setWhatsAppSession,
} from "@/lib/whatsappSession";

const MENU_TEXT = `*Giganet Systems — Facturación electrónica*

No necesitas API key.

*MENU* — este menú
*ESTADO* — consultar estatus de un e-CF (te iré pidiendo los datos)
*RNC* <número> — consultar un contribuyente
*CANCELAR* — salir del flujo actual

También puedes enviar todo junto:
ESTADO E320000000001 131098193`;

function digitsOnly(value) {
  return String(value ?? "").replace(/\D/g, "");
}

function envEmisorRnc() {
  return digitsOnly(
    process.env.WHATSAPP_BOT_RNC_EMISOR || process.env.THEFACTORY_RNC || "",
  );
}

function isValidRnc(rnc) {
  const d = digitsOnly(rnc);
  return d.length === 9 || d.length === 11;
}

function looksLikeNcf(value) {
  const v = String(value ?? "")
    .trim()
    .toUpperCase();
  return /^E\d{2}\d+$/i.test(v) || (v.length >= 11 && /[A-Z]/i.test(v));
}

/**
 * Busca el usuario Giganet cuya empresa.rnc coincide (credenciales TheFactory).
 * @param {string} rnc
 * @returns {Promise<string | null>}
 */
async function findUserIdByEmpresaRnc(rnc) {
  const rncNorm = digitsOnly(rnc);
  if (!isValidRnc(rncNorm)) return null;

  try {
    const mod = await import("@/app/models/user");
    const User = mod.default;

    let user = await User.findOne({ "empresa.rnc": rncNorm })
      .select("_id")
      .lean();
    if (user?._id) return user._id.toString();

    const loose = new RegExp(`^${rncNorm.split("").join("\\D*")}$`);
    user = await User.findOne({ "empresa.rnc": loose }).select("_id").lean();
    return user?._id?.toString() ?? null;
  } catch (error) {
    console.error("WHATSAPP BOT: findUserIdByEmpresaRnc failed", error);
    return null;
  }
}

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

  if (isCancelCommand(upper)) {
    await clearWhatsAppSession(from);
    await sendWhatsAppTextMessage(from, "Listo, cancelé el flujo actual.\n\n" + MENU_TEXT);
    return;
  }

  if (!raw || isMenuCommand(upper)) {
    await clearWhatsAppSession(from);
    await sendWhatsAppTextMessage(from, MENU_TEXT);
    return;
  }

  // Continuar flujo interactivo pendiente (antes que otros comandos sueltos)
  const session = await getWhatsAppSession(from);
  if (session?.intent === "estado") {
    await continueEstadoFlow(from, normalized, session);
    return;
  }

  if (upper.startsWith("RNC ") || upper === "RNC") {
    await handleRncCommand(from, normalized);
    return;
  }

  if (upper.startsWith("ESTADO") || upper === "2") {
    await startOrHandleEstado(from, normalized);
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

function isCancelCommand(upper) {
  return (
    upper === "CANCELAR" ||
    upper === "CANCEL" ||
    upper === "SALIR" ||
    upper === "STOP"
  );
}

async function startOrHandleEstado(from, normalized) {
  const parts = normalized.split(" ").filter(Boolean);
  // ESTADO | ESTADO <ncf> <rnc> | ESTADO <rnc> (solo rnc de 9/11 dígitos)
  const a = String(parts[1] ?? "").trim();
  const b = String(parts[2] ?? "").trim();
  const aDigits = digitsOnly(a);
  const bDigits = digitsOnly(b);

  // Atajo: todo en un mensaje
  if (looksLikeNcf(a) && isValidRnc(bDigits)) {
    await clearWhatsAppSession(from);
    await runEstadoConsulta(from, a.toUpperCase(), bDigits);
    return;
  }

  // Atajo: ESTADO <rnc> → saltar a pedir NCF
  if (!b && isValidRnc(aDigits) && !looksLikeNcf(a)) {
    const auth = await resolveAuthForEmisor(aDigits);
    if (!auth.userId) {
      await sendWhatsAppTextMessage(
        from,
        `No encontré en Giganet una empresa con RNC *${auth.emisorRnc}*.\n\nEse emisor debe tener cuenta en Giganet con The Factory en Mi Empresa.\n\nEscribe *ESTADO* para intentar con otro RNC, o *MENU*.`,
      );
      return;
    }
    await setWhatsAppSession(from, {
      intent: "estado",
      step: "awaiting_ncf",
      rnc: auth.emisorRnc,
    });
    await sendWhatsAppTextMessage(
      from,
      `RNC emisor *${auth.emisorRnc}* encontrado.\n\nAhora envía el *número de comprobante (NCF)*.\nEjemplo: E320000000001\n\nEscribe *CANCELAR* para salir.`,
    );
    return;
  }

  // Flujo interactivo: pedir RNC primero
  await setWhatsAppSession(from, {
    intent: "estado",
    step: "awaiting_rnc",
    rnc: "",
  });
  await sendWhatsAppTextMessage(
    from,
    "Vamos a consultar el estatus de un e-CF.\n\n1️⃣ Envía el *RNC del emisor* (9 u 11 dígitos).\nEs el RNC de la empresa que aparece en la factura.\n\nEscribe *CANCELAR* para salir.",
  );
}

async function continueEstadoFlow(from, normalized, session) {
  if (session.step === "awaiting_rnc") {
    const rnc = digitsOnly(normalized);
    if (!isValidRnc(rnc)) {
      await sendWhatsAppTextMessage(
        from,
        "Ese RNC no es válido. Envía 9 u 11 dígitos.\nEjemplo: 131098193\n\nO escribe *CANCELAR*.",
      );
      return;
    }

    const auth = await resolveAuthForEmisor(rnc);
    if (!auth.userId) {
      await clearWhatsAppSession(from);
      await sendWhatsAppTextMessage(
        from,
        `No encontré en Giganet una empresa con RNC *${rnc}*.\n\nEse emisor debe tener cuenta en Giganet con The Factory en Mi Empresa.\n\nEscribe *ESTADO* para intentar de nuevo, o *MENU*.`,
      );
      return;
    }

    await setWhatsAppSession(from, {
      intent: "estado",
      step: "awaiting_ncf",
      rnc: auth.emisorRnc,
    });
    await sendWhatsAppTextMessage(
      from,
      `Perfecto. RNC *${auth.emisorRnc}* OK.\n\n2️⃣ Ahora envía el *número de comprobante (NCF)*.\nEjemplo: E320000000001\n\nEscribe *CANCELAR* para salir.`,
    );
    return;
  }

  if (session.step === "awaiting_ncf") {
    const ncf = normalized.split(" ")[0].trim().toUpperCase();
    if (!ncf || ncf.length < 5) {
      await sendWhatsAppTextMessage(
        from,
        "Envía el NCF del comprobante.\nEjemplo: E320000000001\n\nO escribe *CANCELAR*.",
      );
      return;
    }

    const rnc = digitsOnly(session.rnc);
    await clearWhatsAppSession(from);
    await runEstadoConsulta(from, ncf, rnc);
    return;
  }

  await clearWhatsAppSession(from);
  await sendWhatsAppTextMessage(from, MENU_TEXT);
}

async function runEstadoConsulta(from, ncf, rncEmisor) {
  const auth = await resolveAuthForEmisor(rncEmisor);

  if (!auth.userId) {
    await sendWhatsAppTextMessage(
      from,
      `No encontré en Giganet una empresa con RNC *${auth.emisorRnc}*.\n\nEse emisor debe tener cuenta en Giganet con The Factory configurado en Mi Empresa.`,
    );
    return;
  }

  await sendWhatsAppTextMessage(
    from,
    `Consultando estatus de *${ncf}* (RNC ${auth.emisorRnc})…`,
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
      "",
      "Escribe *ESTADO* para otra consulta, o *MENU*.",
    ].filter((line) => line !== null);

    await sendWhatsAppTextMessage(from, lines.join("\n"));
  } catch (error) {
    console.error("WHATSAPP BOT ESTADO error:", error);
    await sendWhatsAppTextMessage(
      from,
      "No pude consultar el estatus en este momento. Intenta más tarde.",
    );
  }
}

async function handleRncCommand(from, normalized) {
  await clearWhatsAppSession(from);
  const parts = normalized.split(" ");
  const rncConsultar = digitsOnly(parts[1]);

  if (!isValidRnc(rncConsultar)) {
    await sendWhatsAppTextMessage(
      from,
      "Uso: *RNC* <9 u 11 dígitos>\nEjemplo: RNC 101609921",
    );
    return;
  }

  const service = await resolveServiceAuth();
  if (
    !service.emisorRnc ||
    (service.emisorRnc.length !== 9 && service.emisorRnc.length !== 11)
  ) {
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
