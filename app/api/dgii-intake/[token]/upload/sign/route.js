import { NextResponse } from "next/server";
import { signDgiiIntakeDirectUpload } from "@/utils/cloudinary";
import {
  IMAGE_FORMATS,
  acceptForSlot,
  buildIntakeFilePublicId,
  isTooLargeForSlot,
  loadOpenIntakeForUpload,
  resourceTypeForUpload,
  sizeErrorForSlot,
  typeErrorForSlot,
  validateSlotForUpload,
} from "@/lib/dgiiIntake/uploadRules";

/**
 * POST JSON { slot, fileName, mimeType, size } → signed params for a direct
 * browser → Cloudinary upload (bypasses the 4.5 MB Vercel request body limit).
 */
export async function POST(request, { params }) {
  const { token } = await params;
  const loaded = await loadOpenIntakeForUpload(token);
  if (loaded.error) return loaded.error;
  const intake = loaded.intake;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const slot = String(body.slot || "").trim();
  const slotError = validateSlotForUpload(intake, slot);
  if (slotError) return slotError;

  const fileName = String(body.fileName || slot).slice(0, 200);
  const mimeType = String(body.mimeType || "application/octet-stream");
  const size = Number(body.size);

  if (!acceptForSlot(slot, mimeType, fileName)) {
    return NextResponse.json(
      { error: typeErrorForSlot(slot) },
      { status: 400 }
    );
  }
  if (!Number.isFinite(size) || size <= 0) {
    return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
  }
  if (isTooLargeForSlot(slot, size)) {
    return NextResponse.json(
      { error: sizeErrorForSlot(slot) },
      { status: 400 }
    );
  }

  const resourceType = resourceTypeForUpload(slot, mimeType, fileName);
  const publicId = buildIntakeFilePublicId(intake._id, slot);

  try {
    const signed = await signDgiiIntakeDirectUpload({
      publicId,
      resourceType,
      allowedFormats: resourceType === "image" ? IMAGE_FORMATS : undefined,
    });
    return NextResponse.json({ slot, publicId, resourceType, ...signed });
  } catch (err) {
    console.error("DGII intake sign failed:", err?.message || err);
    return NextResponse.json(
      { error: "No se pudo preparar la subida. Intente de nuevo." },
      { status: 500 }
    );
  }
}
