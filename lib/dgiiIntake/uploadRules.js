import { NextResponse } from "next/server";
import DgiiIntake from "@/app/models/dgiiIntake";
import { LOGO_MAX_BYTES, MAX_UPLOAD_BYTES } from "@/lib/dgiiIntake/fileSlots";
import { requiresRegistroMercantil } from "@/lib/dgiiIntake/tipoPersona";

export const ALLOWED_SLOTS = new Set([
  "cedula",
  "cedulaFrente",
  "cedulaReverso",
  "factura1",
  "factura2",
  "factura3",
  "factura4",
  "factura5",
  "registroMercantil",
  "logo",
  "certificadoP12",
]);

export const MAX_BYTES = MAX_UPLOAD_BYTES;

const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const DOC_TYPES = new Set(["application/pdf", ...IMAGE_TYPES]);
const P12_TYPES = new Set([
  "application/x-pkcs12",
  "application/pkcs12",
  "application/octet-stream",
]);

/** Image formats Cloudinary must recognize when the slot stores an image. */
export const IMAGE_FORMATS = "jpg,jpeg,png,webp,gif";

export function acceptForSlot(slot, mime, name) {
  const lower = String(name || "").toLowerCase();
  if (slot === "certificadoP12") {
    return (
      P12_TYPES.has(mime) ||
      lower.endsWith(".p12") ||
      lower.endsWith(".pfx")
    );
  }
  if (slot === "logo") {
    return (
      IMAGE_TYPES.has(mime) ||
      /\.(jpe?g|png|gif|webp)$/i.test(lower)
    );
  }
  return DOC_TYPES.has(mime) || lower.endsWith(".pdf");
}

export function typeErrorForSlot(slot) {
  if (slot === "certificadoP12") return "Suba un certificado .p12 o .pfx";
  if (slot === "logo") {
    return "El logo debe ser una imagen (JPG, PNG, WebP o GIF)";
  }
  return "Suba PDF o imagen (JPG/PNG/WebP)";
}

export function maxBytesForSlot(slot) {
  if (slot === "logo") return LOGO_MAX_BYTES;
  return MAX_BYTES;
}

/** Logo must be strictly under its limit; other slots may equal it. */
export function isTooLargeForSlot(slot, bytes) {
  const max = maxBytesForSlot(slot);
  return slot === "logo" ? bytes >= max : bytes > max;
}

export function sizeErrorForSlot(slot) {
  if (slot === "logo") {
    return "El logo debe ser una imagen de menos de 5 MB.";
  }
  return "El archivo supera el máximo de 8 MB";
}

/** PDFs and P-12 are stored as Cloudinary `raw`; everything else as `image`. */
export function resourceTypeForUpload(slot, mime, name) {
  const lower = String(name || "").toLowerCase();
  if (slot === "certificadoP12") return "raw";
  if (mime === "application/pdf" || lower.endsWith(".pdf")) return "raw";
  return "image";
}

export function buildIntakeFilePublicId(intakeId, slot, ts = Date.now()) {
  return `dgii-intake/${intakeId}/${intakeId}_${slot}_${ts}`;
}

/**
 * Only public IDs issued by the sign route for this intake + slot are accepted.
 * Cloudinary appends the file extension to `raw` public IDs (e.g. ".pdf").
 */
export function isIntakeFilePublicId(publicId, intakeId, slot) {
  const id = String(intakeId);
  const re = new RegExp(`^dgii-intake/${id}/${id}_${slot}_\\d+(\\.[a-z0-9]{1,5})?$`, "i");
  return re.test(String(publicId || ""));
}

export function slotHasFile(intake, slot) {
  return Boolean(intake.files?.[slot]?.url || intake.files?.[slot]?.publicId);
}

/**
 * Shared pre-upload checks (slot, tipo de persona, empty slot).
 * @returns {NextResponse|null} error response, or null when allowed
 */
export function validateSlotForUpload(intake, slot) {
  if (!ALLOWED_SLOTS.has(slot)) {
    return NextResponse.json(
      { error: "Tipo de archivo no permitido" },
      { status: 400 }
    );
  }
  if (
    slot === "registroMercantil" &&
    !requiresRegistroMercantil(intake.tipoPersona)
  ) {
    return NextResponse.json(
      {
        error:
          "El Registro Mercantil solo aplica a persona jurídica. Seleccione ese tipo primero.",
      },
      { status: 400 }
    );
  }
  if (slotHasFile(intake, slot)) {
    return NextResponse.json(
      {
        error:
          "Ya hay un archivo en esta casilla. Elimínelo antes de subir uno nuevo.",
      },
      { status: 409 }
    );
  }
  return null;
}

export async function loadOpenIntakeForUpload(token) {
  if (!token || typeof token !== "string" || token.length < 32) {
    return {
      error: NextResponse.json({ error: "Enlace no válido" }, { status: 404 }),
    };
  }
  const intake = await DgiiIntake.findOne({ token });
  if (!intake) {
    return {
      error: NextResponse.json({ error: "Enlace no válido" }, { status: 404 }),
    };
  }
  if (intake.expiresAt && new Date(intake.expiresAt) <= new Date()) {
    return {
      error: NextResponse.json(
        { error: "Este enlace ha expirado." },
        { status: 410 }
      ),
    };
  }
  return { intake };
}
