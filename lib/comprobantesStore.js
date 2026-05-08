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
 * Modelo Mongoose Comprobante (producción o BD demo según perfil de empresa).
 * @param {string|null|undefined} userId
 */
export async function getComprobanteModelForUserId(userId) {
  const useDemo = await userUsesComprobantesDevMongo(userId);
  return getComprobanteModel(useDemo);
}
