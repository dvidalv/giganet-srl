import {
  consultarEstatusDocumentoLogic,
  consultarRncLogic,
} from "@/app/controllers/comprobantes";
import { sendWhatsAppTextMessage } from "@/lib/whatsapp";
import { interpretWhatsAppMessage } from "@/lib/whatsappBotAi";
import {
  buildAssistantGreeting,
  buildCancelMessage,
  buildFarewellMessage,
  buildOutOfScopeMessage,
} from "@/lib/whatsappBotCapabilities";
import {
  clearWhatsAppSession,
  getWhatsAppSession,
  setWhatsAppSession,
} from "@/lib/whatsappSession";
import {
  buscarErrorComprobante,
  explicarErrorConAI,
  explicarErrorSinAI,
} from "@/lib/whatsappExplicarError";
import { isWhatsAppBotAiConfigured } from "@/lib/whatsappBotAi";

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
  // e-CF típico: E + 2 dígitos de tipo + secuencia numérica (ej. E320000000001)
  return /^E\d{10,}$/i.test(v);
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

  if (isFarewellCommand(upper) || isFarewellPhrase(normalized)) {
    await clearWhatsAppSession(from);
    await sendWhatsAppTextMessage(from, buildFarewellMessage());
    return;
  }

  if (isCancelCommand(upper)) {
    await clearWhatsAppSession(from);
    await sendWhatsAppTextMessage(from, buildCancelMessage());
    return;
  }

  if (!raw || isGreetingCommand(upper)) {
    await clearWhatsAppSession(from);
    await sendWhatsAppTextMessage(from, buildAssistantGreeting());
    return;
  }

  // Continuar flujo interactivo pendiente (antes que otros comandos sueltos)
  const session = await getWhatsAppSession(from);
  if (session?.intent === "estado") {
    await continueEstadoFlow(from, normalized, session);
    return;
  }

  // Comandos legacy (siguen funcionando)
  if (upper.startsWith("RNC ") || upper === "RNC") {
    await handleRncCommand(from, normalized);
    return;
  }

  if (upper.startsWith("ESTADO") || upper === "2") {
    await startOrHandleEstado(from, normalized);
    return;
  }

  // Lenguaje natural → IA / heurística
  const interpretation = await interpretWhatsAppMessage(normalized);
  await dispatchInterpretation(from, interpretation);
}

/**
 * @param {string} from
 * @param {{ intent: string, ncf: string | null, rnc: string | null, errorMessage: string | null }} interpretation
 */
async function dispatchInterpretation(from, interpretation) {
  const { intent, ncf, rnc, errorMessage } = interpretation;

  if (intent === "despedida") {
    await clearWhatsAppSession(from);
    await sendWhatsAppTextMessage(from, buildFarewellMessage());
    return;
  }

  if (intent === "cancelar") {
    await clearWhatsAppSession(from);
    await sendWhatsAppTextMessage(from, buildCancelMessage());
    return;
  }

  if (intent === "ayuda") {
    await clearWhatsAppSession(from);
    await sendWhatsAppTextMessage(from, buildAssistantGreeting());
    return;
  }

  if (intent === "consultar_rnc") {
    if (rnc && isValidRnc(rnc)) {
      await handleRncCommand(from, `RNC ${rnc}`);
      return;
    }
    await clearWhatsAppSession(from);
    await sendWhatsAppTextMessage(
      from,
      "Claro. Para consultar un contribuyente necesito el *RNC* (9 u 11 dígitos).\nEjemplo: 101609921",
    );
    return;
  }

  if (intent === "consultar_estatus") {
    await beginEstadoFromSlots(from, { ncf, rnc });
    return;
  }

  if (intent === "explicar_error") {
    await handleExplicarError(from, { ncf, rnc, errorMessage });
    return;
  }

  await sendWhatsAppTextMessage(from, buildOutOfScopeMessage());
}

/**
 * Inicia consulta de estatus con los datos que ya traiga el usuario.
 * @param {string} from
 * @param {{ ncf?: string | null, rnc?: string | null }} slots
 */
async function beginEstadoFromSlots(from, slots) {
  const ncf = slots.ncf ? String(slots.ncf).trim().toUpperCase() : "";
  const rnc = slots.rnc ? digitsOnly(slots.rnc) : "";

  if (ncf && looksLikeNcf(ncf) && isValidRnc(rnc)) {
    await clearWhatsAppSession(from);
    await runEstadoConsulta(from, ncf, rnc);
    return;
  }

  if (isValidRnc(rnc) && !ncf) {
    const auth = await resolveAuthForEmisor(rnc);
    if (!auth.userId) {
      await sendWhatsAppTextMessage(
        from,
        `No encontré en Giganet una empresa con RNC *${auth.emisorRnc}*.\n\nEse emisor debe tener cuenta en Giganet con The Factory en Mi Empresa.\n\n${buildOutOfScopeMessage()}`,
      );
      return;
    }
    await setWhatsAppSession(from, {
      intent: "estado",
      step: "awaiting_ncf",
      rnc: auth.emisorRnc,
      ncf: "",
    });
    await sendWhatsAppTextMessage(
      from,
      `Perfecto. RNC emisor *${auth.emisorRnc}* encontrado.\n\nAhora envíame el *número de comprobante (NCF)*.\nEjemplo: E320000000001\n\nEscribe *cancelar* para salir.`,
    );
    return;
  }

  if (ncf && looksLikeNcf(ncf) && !isValidRnc(rnc)) {
    await setWhatsAppSession(from, {
      intent: "estado",
      step: "awaiting_rnc",
      rnc: "",
      ncf,
    });
    await sendWhatsAppTextMessage(
      from,
      `Ok, consultaré el comprobante *${ncf}*.\n\nNecesito el *RNC del emisor* (9 u 11 dígitos), el de la empresa que aparece en la factura.\n\nEscribe *cancelar* para salir.`,
    );
    return;
  }

  await setWhatsAppSession(from, {
    intent: "estado",
    step: "awaiting_rnc",
    rnc: "",
    ncf: "",
  });
  await sendWhatsAppTextMessage(
    from,
    "Claro, te ayudo con el estatus del e-CF.\n\nPrimero envíame el *RNC del emisor* (9 u 11 dígitos).\nEs el RNC de la empresa que aparece en la factura.\n\nEscribe *cancelar* para salir.",
  );
}

function isGreetingCommand(upper) {
  return (
    upper === "MENU" ||
    upper === "MENÚ" ||
    upper === "AYUDA" ||
    upper === "HELP" ||
    upper === "HOLA" ||
    upper === "HI" ||
    upper === "HELLO" ||
    upper === "START" ||
    upper === "1" ||
    upper === "BUENAS" ||
    upper === "BUENOS DIAS" ||
    upper === "BUENOS DÍAS" ||
    upper === "BUENAS TARDES" ||
    upper === "BUENAS NOCHES"
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

function isFarewellCommand(upper) {
  return (
    upper === "ADIÓS" ||
    upper === "ADIOS" ||
    upper === "BYE" ||
    upper === "CHAO" ||
    upper === "CHAU" ||
    upper === "HASTA LUEGO" ||
    upper === "NOS VEMOS" ||
    upper === "HASTA PRONTO"
  );
}

/** Frases tipo "ok adiós", "ok gracias", "muchas gracias". */
function isFarewellPhrase(normalized) {
  const lower = String(normalized ?? "")
    .trim()
    .toLowerCase();
  if (
    /\b(adi[oó]s|adios|bye|chao|chau|hasta\s+luego|nos\s+vemos|hasta\s+pronto)\b/i.test(
      lower,
    )
  ) {
    return true;
  }
  return /^(ok|okei|okay|vale|listo)?\s*(gracias|muchas\s+gracias|thank\s*you|ty)\.?$/i.test(
    lower,
  );
}

async function startOrHandleEstado(from, normalized) {
  const parts = normalized.split(" ").filter(Boolean);
  // ESTADO | ESTADO <ncf> <rnc> | ESTADO <rnc> (solo rnc de 9/11 dígitos)
  const a = String(parts[1] ?? "").trim();
  const b = String(parts[2] ?? "").trim();
  const aDigits = digitsOnly(a);
  const bDigits = digitsOnly(b);

  if (looksLikeNcf(a) && isValidRnc(bDigits)) {
    await beginEstadoFromSlots(from, { ncf: a.toUpperCase(), rnc: bDigits });
    return;
  }

  if (!b && isValidRnc(aDigits) && !looksLikeNcf(a)) {
    await beginEstadoFromSlots(from, { ncf: null, rnc: aDigits });
    return;
  }

  if (!b && looksLikeNcf(a)) {
    await beginEstadoFromSlots(from, { ncf: a.toUpperCase(), rnc: null });
    return;
  }

  await beginEstadoFromSlots(from, { ncf: null, rnc: null });
}

async function continueEstadoFlow(from, normalized, session) {
  if (session.step === "awaiting_rnc") {
    const rnc = digitsOnly(normalized);
    if (!isValidRnc(rnc)) {
      await sendWhatsAppTextMessage(
        from,
        "Ese RNC no es válido. Envía 9 u 11 dígitos.\nEjemplo: 131098193\n\nO escribe *cancelar*.",
      );
      return;
    }

    const auth = await resolveAuthForEmisor(rnc);
    if (!auth.userId) {
      await clearWhatsAppSession(from);
      await sendWhatsAppTextMessage(
        from,
        `No encontré en Giganet una empresa con RNC *${rnc}*.\n\nEse emisor debe tener cuenta en Giganet con The Factory en Mi Empresa.\n\n${buildAssistantGreeting()}`,
      );
      return;
    }

    const pendingNcf = String(session.ncf || "").trim().toUpperCase();
    if (pendingNcf && looksLikeNcf(pendingNcf)) {
      await clearWhatsAppSession(from);
      await runEstadoConsulta(from, pendingNcf, auth.emisorRnc);
      return;
    }

    await setWhatsAppSession(from, {
      intent: "estado",
      step: "awaiting_ncf",
      rnc: auth.emisorRnc,
      ncf: "",
    });
    await sendWhatsAppTextMessage(
      from,
      `Perfecto. RNC *${auth.emisorRnc}* OK.\n\nAhora envíame el *número de comprobante (NCF)*.\nEjemplo: E320000000001\n\nEscribe *cancelar* para salir.`,
    );
    return;
  }

  if (session.step === "awaiting_ncf") {
    const tokens = normalized.split(" ").filter(Boolean);
    let ncf = "";
    for (const token of tokens) {
      if (looksLikeNcf(token)) {
        ncf = token.trim().toUpperCase();
        break;
      }
    }
    if (!ncf) {
      ncf = String(tokens[0] ?? "")
        .trim()
        .toUpperCase();
    }
    if (!ncf || ncf.length < 5) {
      await sendWhatsAppTextMessage(
        from,
        "Envía el NCF del comprobante.\nEjemplo: E320000000001\n\nO escribe *cancelar*.",
      );
      return;
    }

    const rnc = digitsOnly(session.rnc);
    await clearWhatsAppSession(from);
    await runEstadoConsulta(from, ncf, rnc);
    return;
  }

  await clearWhatsAppSession(from);
  await sendWhatsAppTextMessage(from, buildAssistantGreeting());
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
      "Puedes pedirme otra consulta cuando quieras.",
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
      "Para consultar un contribuyente necesito el *RNC* (9 u 11 dígitos).\nEjemplo: 101609921",
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

/**
 * Maneja la explicación de errores de comprobantes.
 * @param {string} from
 * @param {{ ncf: string | null, rnc: string | null, errorMessage: string | null }} params
 */
async function handleExplicarError(from, params) {
  const { ncf, rnc, errorMessage } = params;

  if (!ncf) {
    await sendWhatsAppTextMessage(
      from,
      "Para explicarte un error necesito el *NCF del comprobante*.\nEjemplo: E320000000001\n\nTambién puedes copiarme el mensaje de error completo.",
    );
    return;
  }

  await sendWhatsAppTextMessage(
    from,
    `Buscando información sobre el error del comprobante *${ncf}*…`,
  );

  try {
    let auth = null;
    if (rnc && isValidRnc(rnc)) {
      auth = await resolveAuthForEmisor(rnc);
    } else {
      const service = await resolveServiceAuth();
      auth = service;
    }

    if (!auth || !auth.userId) {
      await sendWhatsAppTextMessage(
        from,
        "No encontré información de esa empresa en el sistema. Necesito el *RNC del emisor* para buscar el error.\n\nEjemplo: ¿Por qué dio error E320000000005 del RNC 101609921?",
      );
      return;
    }

    const errorDB = await buscarErrorComprobante(ncf, auth.userId);

    let explicacion = "";
    if (isWhatsAppBotAiConfigured() && (errorDB || errorMessage)) {
      explicacion = await explicarErrorConAI({
        errorMongoDB: errorDB,
        errorUsuario: errorMessage,
        ncf,
      });
    } else {
      explicacion = explicarErrorSinAI(errorDB);
    }

    await sendWhatsAppTextMessage(from, explicacion);

    if (!errorDB && !errorMessage) {
      await sendWhatsAppTextMessage(
        from,
        "\n\n💡 *Tip:* Si tienes el mensaje de error, cópialo completo y envíamelo para darte una explicación más precisa.",
      );
    }
  } catch (error) {
    console.error("WHATSAPP BOT EXPLICAR ERROR:", error);
    await sendWhatsAppTextMessage(
      from,
      "No pude analizar el error en este momento. Intenta más tarde o contacta a soporte técnico.",
    );
  }
}

