import { NextResponse } from "next/server";
import DgiiIntake from "@/app/models/dgiiIntake";
import {
  deleteDgiiIntakeFile,
  getDgiiIntakeFileResource,
} from "@/utils/cloudinary";
import { serializeIntakeForClient } from "@/lib/dgiiIntake/serialize";
import { syncIntakeToUserEmpresa } from "@/lib/dgiiIntake/syncToUserEmpresa";
import {
  ALLOWED_SLOTS,
  isIntakeFilePublicId,
  isTooLargeForSlot,
  loadOpenIntakeForUpload,
  sizeErrorForSlot,
  validateSlotForUpload,
} from "@/lib/dgiiIntake/uploadRules";

async function discardAsset(publicId, resourceType) {
  try {
    await deleteDgiiIntakeFile(publicId, { resourceType });
  } catch {
    /* best-effort */
  }
}

/**
 * POST JSON { slot, publicId, resourceType, originalName, mimeType } after the
 * browser uploaded straight to Cloudinary. Size and URL are read from
 * Cloudinary, never trusted from the client.
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
  const publicId = String(body.publicId || "").trim();
  const resourceType = body.resourceType === "raw" ? "raw" : "image";

  if (!ALLOWED_SLOTS.has(slot) || !isIntakeFilePublicId(publicId, intake._id, slot)) {
    return NextResponse.json({ error: "Subida no válida" }, { status: 400 });
  }

  // A replayed request must not delete the file already stored in the slot.
  const isStoredAsset = intake.files?.[slot]?.publicId === publicId;

  const slotError = validateSlotForUpload(intake, slot);
  if (slotError) {
    if (!isStoredAsset) await discardAsset(publicId, resourceType);
    return slotError;
  }

  let asset;
  try {
    asset = await getDgiiIntakeFileResource(publicId, resourceType);
  } catch (err) {
    console.error("DGII intake verify failed:", err?.message || err);
    return NextResponse.json(
      { error: "No se pudo verificar el archivo. Intente de nuevo." },
      { status: 502 }
    );
  }
  if (!asset) {
    return NextResponse.json(
      { error: "El archivo no llegó a subirse. Intente de nuevo." },
      { status: 400 }
    );
  }
  if (isTooLargeForSlot(slot, asset.bytes)) {
    await discardAsset(publicId, resourceType);
    return NextResponse.json(
      { error: sizeErrorForSlot(slot) },
      { status: 400 }
    );
  }

  const meta = {
    url: asset.url,
    publicId: asset.publicId,
    originalName: String(body.originalName || slot).slice(0, 200),
    mimeType: String(body.mimeType || "application/octet-stream").slice(0, 120),
    bytes: asset.bytes,
    uploadedAt: new Date(),
  };

  // Only claim the slot if it is still empty (concurrent uploads lose here).
  const updated = await DgiiIntake.findOneAndUpdate(
    {
      _id: intake._id,
      [`files.${slot}.publicId`]: { $in: ["", null] },
      [`files.${slot}.url`]: { $in: ["", null] },
    },
    { $set: { [`files.${slot}`]: meta, lastSavedAt: new Date() } },
    { new: true }
  );
  if (!updated) {
    const current = await DgiiIntake.findById(intake._id)
      .select(`files.${slot}.publicId`)
      .lean();
    if (current?.files?.[slot]?.publicId !== publicId) {
      await discardAsset(publicId, resourceType);
    }
    return NextResponse.json(
      {
        error:
          "Ya hay un archivo en esta casilla. Elimínelo antes de subir uno nuevo.",
      },
      { status: 409 }
    );
  }

  if (slot === "logo") {
    try {
      await syncIntakeToUserEmpresa(updated);
    } catch (err) {
      console.error(
        "DGII intake logo → empresa sync failed:",
        err?.message || err
      );
    }
  }

  return NextResponse.json({
    slot,
    file: {
      uploaded: true,
      originalName: meta.originalName,
      mimeType: meta.mimeType,
      bytes: meta.bytes,
      uploadedAt: meta.uploadedAt,
      url: meta.url,
    },
    intake: serializeIntakeForClient(updated),
  });
}
