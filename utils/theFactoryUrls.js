import User from "@/app/models/user";
import {
  buildTheFactoryUrls,
  THEFACTORY_BASE_URL,
  THEFACTORY_BASE_URL_DEMO,
} from "@/utils/constants";

const productionUrlsCached = () => buildTheFactoryUrls(THEFACTORY_BASE_URL);
const demoUrlsCached = () => buildTheFactoryUrls(THEFACTORY_BASE_URL_DEMO);

/**
 * Resuelve URLs de The Factory HKA según el usuario (empresa.theFactoryAmbiente).
 * Sin userId usa siempre producción (mismo comportamiento que credenciales solo en .env).
 * @param {string|null|undefined} userId
 * @returns {Promise<{ ambienteKey: 'production'|'demo', baseUrl: string, authUrl: string, enviarUrl: string, estatusUrl: string, emailUrl: string, anulacionUrl: string, descargaUrl: string }>}
 */
export async function resolveTheFactoryUrlsForUser(userId) {
  if (!userId) {
    const u = productionUrlsCached();
    return { ambienteKey: "production", ...u };
  }

  const user = await User.findById(userId)
    .select("empresa.theFactoryAmbiente")
    .lean();

  const isDemo = user?.empresa?.theFactoryAmbiente === "demo";
  const built = isDemo ? demoUrlsCached() : productionUrlsCached();
  return { ambienteKey: isDemo ? "demo" : "production", ...built };
}
