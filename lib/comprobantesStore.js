import User from "@/app/models/user";
import { getComprobanteModel } from "@/app/models/comprobante";

/**
 * Empresas con The Factory en demo guardan solo la colección `comprobantes` en MONGODB_URI_DEV.
 * @param {string|null|undefined} userId
 * @returns {Promise<boolean>}
 */
export async function userUsesComprobantesDevMongo(userId) {
  if (!userId) return false;
  const u = await User.findById(userId)
    .select("empresa.theFactoryAmbiente")
    .lean();
  return u?.empresa?.theFactoryAmbiente === "demo";
}

/**
 * @param {unknown} value
 * @returns {'demo'|'production'|null}
 */
export function parseComprobantesAmbiente(value) {
  const v = String(value ?? "")
    .trim()
    .toLowerCase();
  if (v === "demo" || v === "production") return v;
  return null;
}

/**
 * Modelo Mongoose Comprobante (producción o BD demo según perfil de empresa,
 * o forzado con forceAmbiente sin mutar el perfil).
 * @param {string|null|undefined} userId
 * @param {{ forceAmbiente?: 'demo'|'production'|string|null }} [options]
 */
export async function getComprobanteModelForUserId(userId, options = {}) {
  const forced = parseComprobantesAmbiente(options.forceAmbiente);
  let useDemo;
  if (forced === "demo") useDemo = true;
  else if (forced === "production") useDemo = false;
  else useDemo = await userUsesComprobantesDevMongo(userId);
  return getComprobanteModel(useDemo);
}
