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

/** Transformación eager para avatar: recorte centrado en rostros. */
const AVATAR_EAGER = "c_fill,g_face,w_256,h_256,q_auto,f_auto";

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
    overwrite: true,
  });
  const url = result.eager?.[0]?.secure_url || result.secure_url;
  return { url };
}

/**
 * Sube una imagen como avatar de usuario.
 * @param {string} dataUri - Imagen en data URI (data:image/...;base64,...)
 * @param {string} publicId - ID público del recurso (ej: avatar_userId_timestamp)
 * @returns {Promise<{ url: string }>} - URL de la versión optimizada
 */
export async function uploadAvatarUsuario(dataUri, publicId) {
  const cloudinary = await getCloudinary();
  const result = await cloudinary.uploader.upload(dataUri, {
    folder: "user-avatars",
    resource_type: "image",
    eager: [AVATAR_EAGER],
    public_id: publicId,
    overwrite: true,
  });
  const url = result.eager?.[0]?.secure_url || result.secure_url;
  return { url };
}

/**
 * Upload a DGII intake document (cédula, factura, P-12).
 * Uses authenticated access so URLs are not publicly crawlable.
 * @param {string} dataUri
 * @param {{ publicId: string, folder?: string, resourceType?: "image"|"raw"|"auto" }} opts
 */
export async function uploadDgiiIntakeFile(dataUri, opts = {}) {
  const cloudinary = await getCloudinary();
  const {
    publicId,
    folder = "dgii-intake",
    resourceType = "auto",
  } = opts;

  const result = await cloudinary.uploader.upload(dataUri, {
    folder,
    public_id: publicId,
    resource_type: resourceType,
    type: "authenticated",
    overwrite: true,
    invalidate: true,
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
    bytes: result.bytes || 0,
    format: result.format || "",
    resourceType: result.resource_type || resourceType,
  };
}

/**
 * Delete a DGII intake Cloudinary asset (authenticated image or raw).
 * Best-effort: missing assets are treated as already gone.
 * @param {string} publicId
 * @param {{ resourceType?: "image"|"raw"|"auto" }} [opts]
 */
export async function deleteDgiiIntakeFile(publicId, opts = {}) {
  if (!publicId) return { result: "not_found" };
  const cloudinary = await getCloudinary();
  const resourceType = opts.resourceType || "image";
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
      type: "authenticated",
      invalidate: true,
    });
    // Retry as raw if image destroy missed (PDFs / P-12)
    if (result?.result === "not found" && resourceType !== "raw") {
      return cloudinary.uploader.destroy(publicId, {
        resource_type: "raw",
        type: "authenticated",
        invalidate: true,
      });
    }
    return result;
  } catch (err) {
    console.error(
      "deleteDgiiIntakeFile failed:",
      err?.message || "destroy error",
    );
    throw err;
  }
}
