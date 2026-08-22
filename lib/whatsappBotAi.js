import { createOpenAI } from "@ai-sdk/openai";
import { generateText, Output } from "ai";
import { z } from "zod";
import {
  BOT_CAPABILITIES,
  BOT_INTENT_IDS,
} from "@/lib/whatsappBotCapabilities";

/**
 * @typedef {{ intent: string, ncf: string | null, rnc: string | null }} BotInterpretation
 */

function digitsOnly(value) {
  return String(value ?? "").replace(/\D/g, "");
}

function looksLikeNcf(value) {
  const v = String(value ?? "")
    .trim()
    .toUpperCase();
  // e-CF típico: E + 2 dígitos de tipo + secuencia numérica (ej. E320000000001)
  return /^E\d{10,}$/i.test(v);
}

function isValidRncDigits(rnc) {
  const d = digitsOnly(rnc);
  return d.length === 9 || d.length === 11;
}

export function isWhatsAppBotAiConfigured() {
  return Boolean(
    process.env.AI_GATEWAY_API_KEY?.trim() ||
      process.env.OPENAI_API_KEY?.trim(),
  );
}

function resolveModel() {
  const modelId =
    process.env.WHATSAPP_BOT_AI_MODEL?.trim() || "openai/gpt-4o-mini";

  // Preferir AI Gateway (AI_GATEWAY_API_KEY o OIDC en Vercel)
  if (process.env.AI_GATEWAY_API_KEY?.trim()) {
    return modelId;
  }

  // Fallback: OpenAI directo
  if (process.env.OPENAI_API_KEY?.trim()) {
    const openai = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY.trim(),
    });
    const bare = modelId.includes("/")
      ? modelId.split("/").slice(1).join("/")
      : modelId;
    return openai(bare);
  }

  return modelId;
}

const interpretationSchema = z.object({
  intent: z.enum(BOT_INTENT_IDS),
  ncf: z
    .string()
    .nullable()
    .describe("Número de comprobante e-CF si el usuario lo mencionó"),
  rnc: z
    .string()
    .nullable()
    .describe("RNC de 9 u 11 dígitos si el usuario lo mencionó"),
});

/**
 * Interpreta el mensaje con LLM (capacidades fijas).
 * @param {string} text
 * @returns {Promise<BotInterpretation | null>}
 */
async function interpretWithAi(text) {
  const capabilityLines = BOT_CAPABILITIES.map(
    (c) =>
      `- ${c.id}: ${c.label}. Ejemplo: "${c.example}". Campos: ${c.requiredSlots.join(", ")}`,
  ).join("\n");

  const system = `Eres el clasificador del asistente virtual de Giganet Systems (facturación electrónica en República Dominicana).
Solo puedes asignar una de estas intenciones: ${BOT_INTENT_IDS.join(", ")}.

Capacidades disponibles:
${capabilityLines}
- ayuda: pide el menú o qué puede hacer (hola, menú, ayuda, qué puedes hacer). NO uses ayuda para despedidas.
- cancelar: quiere abortar un flujo en curso (cancelar, cancel, stop, salir del flujo). NO uses cancelar para despedidas.
- despedida: se está despidiendo o cerrando la charla (adiós, bye, hasta luego, nos vemos, chao, ok adiós, gracias / ok gracias sin pedir nada más).
- unknown: cualquier otra cosa fuera de alcance

Reglas:
- Extrae ncf y rnc solo si aparecen en el mensaje (ncf suele empezar con E; rnc son 9 u 11 dígitos).
- No inventes datos. Si no hay ncf/rnc, usa null.
- Si el usuario pregunta por estado/estatus/comprobante/factura/e-CF/NCF → consultar_estatus.
- Si pregunta por contribuyente/razón social/consultar RNC → consultar_rnc.
- "ok adiós", "adios", "bye", "hasta luego" → despedida (NUNCA cancelar ni ayuda).
- Responde SOLO con el objeto estructurado.`;

  const { output } = await generateText({
    model: resolveModel(),
    output: Output.object({
      schema: interpretationSchema,
      name: "whatsapp_bot_intent",
      description: "Intención y datos extraídos del mensaje de WhatsApp",
    }),
    system,
    prompt: `Mensaje del usuario:\n"""${text}"""`,
    temperature: 0,
  });

  if (!output) return null;

  return {
    intent: output.intent,
    ncf: output.ncf ? String(output.ncf).trim().toUpperCase() : null,
    rnc: output.rnc ? digitsOnly(output.rnc) : null,
  };
}

/**
 * Fallback sin API key: heurísticas en español + extracción de NCF/RNC.
 * @param {string} text
 * @returns {BotInterpretation}
 */
function interpretHeuristic(text) {
  const normalized = String(text ?? "").replace(/\s+/g, " ").trim();
  const upper = normalized.toUpperCase();
  const lower = normalized.toLowerCase();

  let ncf = null;
  let rnc = null;

  const tokens = normalized.split(" ").filter(Boolean);
  for (const token of tokens) {
    const cleaned = token.replace(/[^\w]/gi, "");
    if (!ncf && looksLikeNcf(cleaned)) ncf = cleaned.toUpperCase();
    const d = digitsOnly(cleaned);
    if (!rnc && isValidRncDigits(d) && !looksLikeNcf(cleaned)) rnc = d;
  }

  // Buscar RNC suelto en el texto completo
  if (!rnc) {
    const m = normalized.match(/\b(\d[\d\-]{7,14}\d)\b/);
    if (m && isValidRncDigits(m[1])) rnc = digitsOnly(m[1]);
  }

  // Despedida antes que cancelar (evita confundir "adiós" con menú)
  if (
    /\b(adi[oó]s|adios|bye|chao|chau|hasta\s+luego|nos\s+vemos|hasta\s+pronto|me\s+despido)\b/i.test(
      lower,
    ) ||
    /^(ok|okei|okay|vale)?\s*(gracias|thank\s*you|ty)\.?$/i.test(lower)
  ) {
    return { intent: "despedida", ncf: null, rnc: null };
  }

  if (
    /\b(cancelar|cancel|stop)\b/i.test(lower) ||
    upper === "CANCELAR" ||
    upper === "SALIR"
  ) {
    return { intent: "cancelar", ncf: null, rnc: null };
  }

  // Fuera de alcance explícito (antes de matchear consultas)
  if (/\b(anular|cancelar\s+factura|eliminar)\b/i.test(lower)) {
    return { intent: "unknown", ncf, rnc };
  }

  if (
    /\b(estado|estatus|comprobante|e-?cf|\bncf\b)\b/i.test(lower) ||
    upper.startsWith("ESTADO")
  ) {
    return { intent: "consultar_estatus", ncf, rnc };
  }

  if (
    /\b(contribuyente|raz[oó]n social)\b/i.test(lower) ||
    /\bconsult\w*\s+(el\s+|un\s+|mi\s+)?rnc\b/i.test(lower) ||
    /\b(busca(r)?|ver|revisa(r)?)\s+(el\s+)?rnc\b/i.test(lower) ||
    upper.startsWith("RNC ")
  ) {
    return { intent: "consultar_rnc", ncf: null, rnc };
  }

  // Solo un RNC suelto → asumir consulta RNC
  if (rnc && !ncf && tokens.length <= 3) {
    return { intent: "consultar_rnc", ncf: null, rnc };
  }

  // Solo un NCF suelto → estatus
  if (ncf && !rnc) {
    return { intent: "consultar_estatus", ncf, rnc: null };
  }

  if (ncf && rnc) {
    return { intent: "consultar_estatus", ncf, rnc };
  }

  if (
    /\b(ayuda|menu|menú|hola|buenas|buenos|hi|hello|start|qué puedes|que puedes|que haces|qué haces)\b/i.test(
      lower,
    )
  ) {
    return { intent: "ayuda", ncf: null, rnc: null };
  }

  return { intent: "unknown", ncf, rnc };
}

/**
 * Interpreta un mensaje de WhatsApp (IA si hay key; si no, heurística).
 * @param {string} text
 * @returns {Promise<BotInterpretation>}
 */
export async function interpretWhatsAppMessage(text) {
  if (isWhatsAppBotAiConfigured()) {
    try {
      const aiResult = await interpretWithAi(text);
      if (aiResult) {
        // Normalizar slots inválidos
        if (aiResult.ncf && !looksLikeNcf(aiResult.ncf)) aiResult.ncf = null;
        if (aiResult.rnc && !isValidRncDigits(aiResult.rnc)) aiResult.rnc = null;
        return aiResult;
      }
    } catch (error) {
      console.error("WHATSAPP BOT AI interpret failed, using heuristic:", error);
    }
  }

  return interpretHeuristic(text);
}
