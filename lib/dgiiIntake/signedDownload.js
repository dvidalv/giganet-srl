import { getCloudinary } from "@/utils/cloudinary";

/**
 * Build a short-lived signed Cloudinary URL for an intake file meta.
 * @param {{ publicId?: string, url?: string, mimeType?: string, originalName?: string }} meta
 * @param {string} slot
 * @param {{ asAttachment?: boolean }} [opts]
 */
export async function signedDownloadForFileMeta(meta, slot, opts = {}) {
  if (!meta?.publicId && !meta?.url) {
    const err = new Error("Archivo no subido todavía");
    err.status = 404;
    throw err;
  }

  const originalName = meta.originalName || slot;

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

    const urlOpts = {
      resource_type: isRaw ? "raw" : "image",
      type: "authenticated",
      sign_url: true,
      secure: true,
      expires_at: Math.floor(Date.now() / 1000) + 60 * 10,
    };

    if (opts.asAttachment) {
      // Content-Disposition: attachment so browsers download instead of preview
      urlOpts.flags = "attachment";
      const safeName = String(originalName)
        .replace(/[^\w.\-()+ ]+/g, "_")
        .slice(0, 120);
      if (safeName) urlOpts.attachment = safeName;
    }

    const url = cloudinary.url(meta.publicId, urlOpts);

    return {
      url,
      originalName,
      mimeType: meta.mimeType || "",
    };
  }

  return {
    url: meta.url,
    originalName,
    mimeType: meta.mimeType || "",
  };
}
