/**
 * Utilidad de Cloudinary. Configura el SDK y exporta funciones de subida.
 * Usa CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET.
 */

/** Obtiene la instancia configurada de Cloudinary (carga perezosa para evitar error al importar). */
export async function getCloudinary() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Configuración de Cloudinary incompleta");
  }

  // El SDK valida CLOUDINARY_URL al importar; construimos la URL correcta antes de cargarlo
  if (!process.env.CLOUDINARY_URL?.startsWith("cloudinary://")) {
    process.env.CLOUDINARY_URL = `cloudinary://${apiKey}:${encodeURIComponent(apiSecret)}@${cloudName}`;
  }

  const { v2: cloudinary } = await import("cloudinary");
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  });

  return cloudinary;
}

/** Transformación eager para logo: recorte cuadrado optimizado. */
const LOGO_EAGER = "c_fill,g_auto,w_256,h_256,q_auto,f_auto";

/**
 * Sube una imagen como logo de empresa (recorte y optimización para logo).
 * @param {string} dataUri - Imagen en data URI (data:image/...;base64,...)
 * @param {string} publicId - ID público del recurso (ej: logo_userId_timestamp)
 * @returns {Promise<{ url: string }>} - URL de la versión optimizada
 */
export async function uploadLogoEmpresa(dataUri, publicId) {
  const cloudinary = await getCloudinary();
  const result = await cloudinary.uploader.upload(dataUri, {
    folder: "empresa-logos",
    resource_type: "image",
    eager: [LOGO_EAGER],
    public_id: publicId,
  });
  const url = result.eager?.[0]?.secure_url || result.secure_url;
  return { url };
}
