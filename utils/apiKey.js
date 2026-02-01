import crypto from "crypto";

const HASH_ALGORITHM = "sha256";
const KEY_BYTES = 32;

/**
 * Genera una API Key aleatoria segura (solo se muestra una vez al usuario).
 * @returns {string} API Key en formato hex (64 caracteres)
 */
export function generateApiKey() {
  return crypto.randomBytes(KEY_BYTES).toString("hex");
}

/**
 * Hashea una API Key para almacenarla (nunca guardar la key en claro).
 * @param {string} plainKey - API Key en texto plano
 * @returns {string} Hash en hex
 */
export function hashApiKey(plainKey) {
  if (!plainKey || typeof plainKey !== "string") return null;
  return crypto.createHash(HASH_ALGORITHM).update(plainKey.trim()).digest("hex");
}

/**
 * Verifica que la key proporcionada coincida con el hash almacenado (comparación a tiempo constante).
 * @param {string} plainKey - API Key enviada por el cliente
 * @param {string} storedHash - Hash guardado en BD
 * @returns {boolean}
 */
export function verifyApiKey(plainKey, storedHash) {
  if (!plainKey || !storedHash) return false;
  const computed = hashApiKey(plainKey);
  if (!computed || computed.length !== storedHash.length) return false;
  try {
    return crypto.timingSafeEqual(
      Buffer.from(computed, "hex"),
      Buffer.from(storedHash, "hex")
    );
  } catch {
    return false;
  }
}
