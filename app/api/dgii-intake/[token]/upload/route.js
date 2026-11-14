import { NextResponse } from "next/server";
import DgiiIntake from "@/app/models/dgiiIntake";
import { uploadDgiiIntakeFile } from "@/utils/cloudinary";
import { serializeIntakeForClient } from "@/lib/dgiiIntake/serialize";

const ALLOWED_SLOTS = new Set([
  "cedula",
  "cedulaFrente",
  "cedulaReverso",
  "factura1",
  "factura2",
  "factura3",
  "factura4",
  "factura5",
  "certificadoP12",
]);

const MAX_BYTES = 8 * 1024 * 1024;

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

function acceptForSlot(slot, mime, name) {
  const lower = String(name || "").toLowerCase();
  if (slot === "certificadoP12") {
    return (
      P12_TYPES.has(mime) ||
      lower.endsWith(".p12") ||
      lower.endsWith(".pfx")
    );
  }
  return DOC_TYPES.has(mime) || lower.endsWith(".pdf");
}

async function loadOpenIntake(token) {
  if (!token || typeof token !== "string" || token.length < 32) {
    return { error: NextResponse.json({ error: "Enlace no válido" }, { status: 404 }) };
  }
  const intake = await DgiiIntake.findOne({ token });
  if (!intake) {
    return { error: NextResponse.json({ error: "Enlace no válido" }, { status: 404 }) };
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

/** POST multipart: field "file" + "slot" */
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

  if (!ALLOWED_SLOTS.has(slot)) {
    return NextResponse.json({ error: "Tipo de archivo no permitido" }, { status: 400 });
  }
  if (!file || typeof file === "string" || !file.arrayBuffer) {
    return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
  }

  const mime = file.type || "application/octet-stream";
  const originalName = file.name || slot;
  if (!acceptForSlot(slot, mime, originalName)) {
    return NextResponse.json(
      {
        error:
          slot === "certificadoP12"
            ? "Suba un certificado .p12 o .pfx"
            : "Suba PDF o imagen (JPG/PNG/WebP)",
      },
      { status: 400 }
    );
  }

  if (typeof file.size === "number" && file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "El archivo supera el máximo de 8 MB" },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length > MAX_BYTES) {
    return NextResponse.json(
      { error: "El archivo supera el máximo de 8 MB" },
      { status: 400 }
    );
  }

  const b64 = buffer.toString("base64");
  const dataUri = `data:${mime};base64,${b64}`;
  const publicId = `${intake._id}_${slot}_${Date.now()}`;
  const resourceType =
    slot === "certificadoP12"
      ? "raw"
      : mime === "application/pdf"
        ? "raw"
        : "image";

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
