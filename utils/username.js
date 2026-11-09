/** Nombre de usuario opcional: 3–30 caracteres, minúsculas, sin espacios. */
const USERNAME_RE = /^[a-z0-9._-]{3,30}$/;

/**
 * Normaliza un username: trim + minúsculas. Vacío → "".
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeUsername(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

/**
 * Valida un username ya normalizado.
 * @param {string} username
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function validateUsername(username) {
  if (!username) {
    return { ok: true };
  }
  if (username.includes("@")) {
    return {
      ok: false,
      error: "El nombre de usuario no puede ser un correo electrónico",
    };
  }
  if (!USERNAME_RE.test(username)) {
    return {
      ok: false,
      error:
        "El nombre de usuario debe tener 3 a 30 caracteres (letras, números, punto, guion o guion bajo)",
    };
  }
  return { ok: true };
}

/**
 * Prepara el valor a guardar: string válido o `undefined` (campo omitido).
 * @param {unknown} value
 * @returns {{ ok: true, username?: string } | { ok: false, error: string }}
 */
export function prepareOptionalUsername(value) {
  const username = normalizeUsername(value);
  if (!username) return { ok: true };
  const check = validateUsername(username);
  if (!check.ok) return check;
  return { ok: true, username };
}
