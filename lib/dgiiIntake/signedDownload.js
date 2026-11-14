import { getCloudinary } from "@/utils/cloudinary";

/**
 * Build a short-lived signed Cloudinary URL for an intake file meta.
 * @param {{ publicId?: string, url?: string, mimeType?: string, originalName?: string }} meta
 * @param {string} slot
 */
export async function signedDownloadForFileMeta(meta, slot) {
  if (!meta?.publicId && !meta?.url) {
    const err = new Error("Archivo no subido todavía");
    err.status = 404;
    throw err;
  }

  if (meta.publicId) {
    const cloudinary = await getCloudinary();
    const name = String(meta.originalName || "").toLowerCase();
    const mime = String(meta.mimeType || "").toLowerCase();
    const isRaw =
      slot === "certificadoP12" ||
      mime.includes("pdf") ||
      mime.includes("pkcs12") ||
      name.endsWith(".pdf") ||
      name.endsWith(".p12") ||
      name.endsWith(".pfx");

    const url = cloudinary.url(meta.publicId, {
      resource_type: isRaw ? "raw" : "image",
      type: "authenticated",
      sign_url: true,
      secure: true,
      expires_at: Math.floor(Date.now() / 1000) + 60 * 10,
    });

    return {
      url,
      originalName: meta.originalName || slot,
      mimeType: meta.mimeType || "",
    };
  }

  return {
    url: meta.url,
    originalName: meta.originalName || slot,
    mimeType: meta.mimeType || "",
  };
}
