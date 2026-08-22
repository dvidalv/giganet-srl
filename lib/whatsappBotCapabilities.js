/**
 * Capacidades del asistente virtual de WhatsApp.
 * Añadir items aquí; el saludo y la IA los usan automáticamente.
 */
export const BOT_CAPABILITIES = [
  {
    id: "consultar_estatus",
    label: "Consultar el estatus de un comprobante electrónico (e-CF)",
    example: "Quiero saber el estado del comprobante E320000000001",
    requiredSlots: ["ncf", "rnc"],
  },
  {
    id: "consultar_rnc",
    label: "Consultar un contribuyente por su RNC",
    example: "Consulta el RNC 101609921",
    requiredSlots: ["rnc"],
  },
  {
    id: "explicar_error",
    label: "Explicar por qué un comprobante devolvió error",
    example: "¿Por qué me dio error el comprobante E320000000005?",
    requiredSlots: ["ncf"],
  },
];

export const BOT_INTENT_IDS = [
  ...BOT_CAPABILITIES.map((c) => c.id),
  "ayuda",
  "cancelar",
  "despedida",
  "unknown",
];

/** Respuesta corta al despedirse (sin repetir el menú). */
export function buildFarewellMessage() {
  return "¡Hasta luego! Cuando necesites otra consulta, aquí estoy.";
}

/** Respuesta corta al cancelar un flujo (sin repetir el menú). */
export function buildCancelMessage() {
  return "Listo, cancelé el flujo actual. Cuando quieras otra consulta, escríbeme.";
}

/**
 * Saludo inicial: simple y directo.
 */
export function buildAssistantGreeting() {
  return "¿Cómo te puedo ayudar?";
}

/**
 * Texto cuando la petición está fuera de alcance.
 * Ahora muestra las capacidades disponibles.
 */
export function buildOutOfScopeMessage() {
  const lines = [
    "Lo siento, no te puedo ayudar con eso.",
    "",
    "Puedo ayudarte con:",
    ...BOT_CAPABILITIES.map((c) => `• ${c.label}`),
    "",
    "Ejemplos:",
    ...BOT_CAPABILITIES.map((c) => `_${c.example}_`),
  ];
  return lines.join("\n");
}
