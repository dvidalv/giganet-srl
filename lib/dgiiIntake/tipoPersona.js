/** @typedef {"fisica" | "juridica" | ""} TipoPersona */

export const TIPO_PERSONA_FISICA = "fisica";
export const TIPO_PERSONA_JURIDICA = "juridica";

/**
 * @param {unknown} value
 * @returns {TipoPersona}
 */
export function normalizeTipoPersona(value) {
  const v = String(value || "")
    .trim()
    .toLowerCase();
  if (v === TIPO_PERSONA_FISICA || v === TIPO_PERSONA_JURIDICA) return v;
  return "";
}

/** @param {unknown} value */
export function isPersonaJuridica(value) {
  return normalizeTipoPersona(value) === TIPO_PERSONA_JURIDICA;
}

/** Registro Mercantil is required only for persona jurídica. */
export function requiresRegistroMercantil(value) {
  return isPersonaJuridica(value);
}

export const TIPO_PERSONA_LABELS = {
  [TIPO_PERSONA_FISICA]: "Persona física",
  [TIPO_PERSONA_JURIDICA]: "Persona jurídica",
};
