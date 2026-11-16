import { NextResponse } from "next/server";
import {
  deleteDgiiIntakeFile,
  uploadDgiiIntakeFile,
} from "@/utils/cloudinary";
import { serializeIntakeForClient } from "@/lib/dgiiIntake/serialize";
import { syncIntakeToUserEmpresa } from "@/lib/dgiiIntake/syncToUserEmpresa";
import {
  ALLOWED_SLOTS,
  acceptForSlot,
  isTooLargeForSlot,
  loadOpenIntakeForUpload as loadOpenIntake,
  resourceTypeForUpload,
  sizeErrorForSlot,
  typeErrorForSlot,
  validateSlotForUpload,
} from "@/lib/dgiiIntake/uploadRules";

/**
 * POST multipart: field "file" + "slot".
 * Limited to ~4.5 MB on Vercel; the form uploads via /upload/sign + /upload/complete.
 */
export async function POST(request, { params }) {
  const { token } = await params;
  const loaded = await loadOpenIntake(token);
  if (loaded.error) return loaded.error;
  const intake = loaded.intake;

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Formulario inválido" }, { status: 400 });
  }

  const slot = String(formData.get("slot") || "").trim();
  const file = formData.get("file");

  const slotError = validateSlotForUpload(intake, slot);
  if (slotError) return slotError;
  if (!file || typeof file === "string" || !file.arrayBuffer) {
    return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
  }

  const mime = file.type || "application/octet-stream";
  const originalName = file.name || slot;
  if (!acceptForSlot(slot, mime, originalName)) {
    return NextResponse.json(
      { error: typeErrorForSlot(slot) },
      { status: 400 }
    );
  }

  const tooLarge = (n) => isTooLargeForSlot(slot, n);
  if (typeof file.size === "number" && tooLarge(file.size)) {
    return NextResponse.json(
      { error: sizeErrorForSlot(slot) },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (tooLarge(buffer.length)) {
    return NextResponse.json(
      { error: sizeErrorForSlot(slot) },
      { status: 400 }
    );
  }

  const b64 = buffer.toString("base64");
  const dataUri = `data:${mime};base64,${b64}`;
  const publicId = `${intake._id}_${slot}_${Date.now()}`;
  const resourceType = resourceTypeForUpload(slot, mime, originalName);

  let uploaded;
  try {
    uploaded = await uploadDgiiIntakeFile(dataUri, {
      publicId,
      folder: `dgii-intake/${intake._id}`,
      resourceType,
    });
  } catch (err) {
    console.error("DGII intake upload failed:", err?.message || "upload error");
    return NextResponse.json(
      { error: "No se pudo subir el archivo. Intente de nuevo." },
      { status: 500 }
    );
  }

  intake.files[slot] = {
    url: uploaded.url,
    publicId: uploaded.publicId,
    originalName: String(originalName).slice(0, 200),
    mimeType: mime,
    bytes: uploaded.bytes || buffer.length,
    uploadedAt: new Date(),
  };
  intake.lastSavedAt = new Date();
  await intake.save();

  if (slot === "logo") {
    try {
      await syncIntakeToUserEmpresa(intake);
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
      originalName: intake.files[slot].originalName,
      mimeType: mime,
      bytes: intake.files[slot].bytes,
      uploadedAt: intake.files[slot].uploadedAt,
      url: uploaded.url,
    },
    intake: serializeIntakeForClient(intake),
  });
}

function emptyFileMeta() {
  return {
    url: "",
    publicId: "",
    originalName: "",
    mimeType: "",
    bytes: 0,
    uploadedAt: null,
  };
}

function resourceTypeForStoredFile(meta) {
  const mime = String(meta?.mimeType || "").toLowerCase();
  const name = String(meta?.originalName || "").toLowerCase();
  if (
    mime.includes("pkcs12") ||
    name.endsWith(".p12") ||
    name.endsWith(".pfx") ||
    mime === "application/pdf" ||
    name.endsWith(".pdf")
  ) {
    return "raw";
  }
  return "image";
}

/** DELETE ?slot=cedulaReverso — remove Cloudinary asset and clear the intake slot */
export async function DELETE(request, { params }) {
  const { token } = await params;
  const loaded = await loadOpenIntake(token);
  if (loaded.error) return loaded.error;
  const intake = loaded.intake;

  const { searchParams } = new URL(request.url);
  const slot = String(searchParams.get("slot") || "").trim();
  if (!ALLOWED_SLOTS.has(slot)) {
    return NextResponse.json(
      { error: "Tipo de archivo no permitido" },
      { status: 400 },
    );
  }

  const current = intake.files?.[slot];
  const publicId = current?.publicId || "";
  if (publicId) {
    try {
      await deleteDgiiIntakeFile(publicId, {
        resourceType: resourceTypeForStoredFile(current),
      });
    } catch (err) {
      console.error(
        "DGII intake delete failed:",
        err?.message || "delete error",
      );
      return NextResponse.json(
        { error: "No se pudo eliminar el archivo. Intente de nuevo." },
        { status: 500 },
      );
    }
  }

  intake.files[slot] = emptyFileMeta();

  // Clearing frente also clears legacy single-slot `cedula` if present
  if (slot === "cedulaFrente" || slot === "cedula") {
    const legacy = intake.files?.cedula;
    if (slot === "cedulaFrente" && legacy?.publicId && legacy.publicId !== publicId) {
      try {
        await deleteDgiiIntakeFile(legacy.publicId, {
          resourceType: resourceTypeForStoredFile(legacy),
        });
      } catch {
        /* best-effort */
      }
    }
    intake.files.cedula = emptyFileMeta();
    if (slot === "cedula") {
      intake.files.cedulaFrente = emptyFileMeta();
    }
  }

  intake.lastSavedAt = new Date();
  if (intake.status !== "complete") {
    intake.status = "open";
  }
  await intake.save();

  return NextResponse.json({
    slot,
    deleted: true,
    intake: serializeIntakeForClient(intake),
  });
}
