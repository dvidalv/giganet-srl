const ALLOWED_MIME = /^image\/(jpeg|jpg|png|webp)$/i;
const ALLOWED_EXT = /\.(jpe?g|png|webp)$/i;
export const DGII_IMPORT_MAX_FILES = 8;

export function fileKey(file) {
  return `${file?.name}:${file?.size}:${file?.lastModified}`;
}

/**
 * Acepta por MIME conocido, o por extensión si el tipo viene vacío/ausente
 * (frecuente al arrastrar archivos en algunos SO/navegadores).
 */
export function isAcceptedDgiiImageFile(file) {
  if (!file) return false;
  const type = String(file.type ?? "").trim();
  if (type) return ALLOWED_MIME.test(type);
  const name = String(file.name ?? "");
  return ALLOWED_EXT.test(name);
}

/**
 * Clasifica una lista de File-like para el dropzone de import DGII.
 * @returns {{
 *   accepted: object[],
 *   rejected: { name: string, reason: string }[],
 *   skippedDuplicate: number,
 *   skippedLimit: number,
 * }}
 */
export function classifyDgiiImageFiles(list, { existing = [], maxFiles = DGII_IMPORT_MAX_FILES } = {}) {
  const seen = new Set((existing || []).map(fileKey));
  const accepted = [];
  const rejected = [];
  let skippedDuplicate = 0;
  let skippedLimit = 0;

  for (const file of Array.from(list || [])) {
    const name = String(file?.name || "archivo").trim() || "archivo";
    if (!isAcceptedDgiiImageFile(file)) {
      const type = String(file?.type ?? "").trim();
      rejected.push({
        name,
        reason: type
          ? `tipo no permitido (${type})`
          : "extensión no permitida (use JPG, PNG o WebP)",
      });
      continue;
    }
    const key = fileKey(file);
    if (seen.has(key)) {
      skippedDuplicate += 1;
      continue;
    }
    if (existing.length + accepted.length >= maxFiles) {
      skippedLimit += 1;
      rejected.push({
        name,
        reason: `límite de ${maxFiles} imágenes`,
      });
      continue;
    }
    seen.add(key);
    accepted.push(file);
  }

  return { accepted, rejected, skippedDuplicate, skippedLimit };
}

/** Mensaje corto de feedback tras clasificar archivos. */
export function describeDgiiImageSelection({
  acceptedCount,
  totalCount,
  rejected,
  skippedDuplicate,
}) {
  const parts = [];
  parts.push(
    `${acceptedCount} foto${acceptedCount === 1 ? "" : "s"} aceptada${acceptedCount === 1 ? "" : "s"}`,
  );
  if (rejected?.length) {
    const detail = rejected
      .slice(0, 3)
      .map((r) => `${r.name} (${r.reason})`)
      .join("; ");
    const more =
      rejected.length > 3 ? ` y ${rejected.length - 3} más` : "";
    parts.push(
      `${rejected.length} rechazada${rejected.length === 1 ? "" : "s"}: ${detail}${more}`,
    );
  }
  if (skippedDuplicate > 0) {
    parts.push(
      `${skippedDuplicate} duplicada${skippedDuplicate === 1 ? "" : "s"} omitida${skippedDuplicate === 1 ? "" : "s"}`,
    );
  }
  if (typeof totalCount === "number" && totalCount > 0) {
    return `${parts.join(". ")}. Total en cola: ${totalCount}.`;
  }
  return `${parts.join(". ")}.`;
}
