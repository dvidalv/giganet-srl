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
 * Saludo inicial: presentación + qué puede hacer (desde el arreglo).
 */
export function buildAssistantGreeting() {
  const lines = [
    "Hola, soy el *asistente virtual de Giganet Systems* para facturación electrónica.",
    "",
    "Puedo ayudarte con esto:",
    ...BOT_CAPABILITIES.map((c) => `• ${c.label}`),
    "",
    "Pregúntame en lenguaje natural, por ejemplo:",
    ...BOT_CAPABILITIES.map((c) => `_${c.example}_`),
    "",
    "Si quieres cancelar un flujo en curso, escribe *cancelar*.",
  ];
  return lines.join("\n");
}

/**
 * Texto corto cuando la petición está fuera de alcance.
 */
export function buildOutOfScopeMessage() {
  const lines = [
    "Por ahora solo puedo ayudarte con esto:",
    ...BOT_CAPABILITIES.map((c) => `• ${c.label}`),
    "",
    "Ejemplos:",
    ...BOT_CAPABILITIES.map((c) => `_${c.example}_`),
  ];
  return lines.join("\n");
}
