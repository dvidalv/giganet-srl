import JSZip from "jszip";
import { DGII_FILE_SLOTS } from "@/lib/dgiiIntake/fileSlots";
import { signedDownloadForFileMeta } from "@/lib/dgiiIntake/signedDownload";

export function resolveIntakeFileMeta(intake, slot) {
  if (slot === "cedulaFrente") {
    const frente = intake.files?.cedulaFrente;
    if (frente?.publicId || frente?.url) return frente;
    return intake.files?.cedula;
  }
  if (slot === "cedula") {
    return intake.files?.cedulaFrente?.publicId || intake.files?.cedulaFrente?.url
      ? intake.files.cedulaFrente
      : intake.files?.cedula;
  }
  return intake.files?.[slot];
}

function sanitizeZipBaseName(intake) {
  const rnc = String(intake.empresa?.rnc || "").replace(/\D/g, "");
  const name = String(
    intake.empresa?.nombre || intake.clientName || "cliente"
  )
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  const base = rnc || name || "cliente";
  return `admision-${base}`;
}

function uniqueEntryName(used, preferred, fallback) {
  let name = preferred || fallback;
  name = String(name).replace(/[\\/]+/g, "_").trim() || fallback;
  if (!used.has(name.toLowerCase())) {
    used.add(name.toLowerCase());
    return name;
  }
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  let i = 2;
  let candidate = `${stem}-${i}${ext}`;
  while (used.has(candidate.toLowerCase())) {
    i += 1;
    candidate = `${stem}-${i}${ext}`;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

/**
 * Build a ZIP buffer of all uploaded intake documents.
 * @param {object} intake
 * @returns {Promise<{ buffer: Buffer, filename: string, count: number }>}
 */
export async function buildIntakeDocumentsZip(intake) {
  const zip = new JSZip();
  const usedNames = new Set();
  let count = 0;

  for (const { key, label } of DGII_FILE_SLOTS) {
    const meta = resolveIntakeFileMeta(intake, key);
    if (!meta?.publicId && !meta?.url) continue;

    let signed;
    try {
      signed = await signedDownloadForFileMeta(meta, key, {
        asAttachment: true,
      });
    } catch (err) {
      console.error(`DGII zip skip ${key}:`, err?.message || err);
      continue;
    }

    try {
      const res = await fetch(signed.url);
      if (!res.ok) {
        console.error(`DGII zip fetch ${key}: HTTP ${res.status}`);
        continue;
      }
      const ab = await res.arrayBuffer();
      const fallback = `${key}${guessExt(meta, label)}`;
      const entry = uniqueEntryName(
        usedNames,
        signed.originalName || meta.originalName,
        fallback
      );
      zip.file(entry, Buffer.from(ab));
      count += 1;
    } catch (err) {
      console.error(`DGII zip fetch ${key}:`, err?.message || err);
    }
  }

  if (count === 0) {
    const err = new Error("No hay documentos para descargar");
    err.status = 404;
    throw err;
  }

  const buffer = Buffer.from(
    await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    })
  );

  return {
    buffer,
    filename: `${sanitizeZipBaseName(intake)}.zip`,
    count,
  };
}

function guessExt(meta, label) {
  const name = String(meta?.originalName || "").toLowerCase();
  const mime = String(meta?.mimeType || "").toLowerCase();
  if (name.includes(".")) return name.slice(name.lastIndexOf("."));
  if (mime.includes("pdf")) return ".pdf";
  if (mime.includes("png")) return ".png";
  if (mime.includes("jpeg") || mime.includes("jpg")) return ".jpg";
  if (mime.includes("pkcs12") || /p-?12|pfx/i.test(label)) return ".p12";
  return "";
}
