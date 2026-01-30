import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { uploadLogoEmpresa } from "@/utils/cloudinary";

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

/** POST /api/upload/logo - Subir logo de empresa a Cloudinary con transformación para logo */
export async function POST(request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json(
      { error: "Se requiere un archivo de imagen" },
      { status: 400 },
    );
  }

  const type = file.type || "";
  if (!ALLOWED_TYPES.includes(type)) {
    return NextResponse.json(
      { error: "Formato no permitido. Use JPEG, PNG, GIF o WebP." },
      { status: 400 },
    );
  }

  const bytes = await file.arrayBuffer();
  if (bytes.byteLength > MAX_SIZE) {
    return NextResponse.json(
      { error: "La imagen no puede superar 5 MB" },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(bytes);
  const b64 = buffer.toString("base64");
  const dataUri = `data:${type};base64,${b64}`;
  const publicId = `logo_${session.user.id}_${Date.now()}`;

  try {
    const { url } = await uploadLogoEmpresa(dataUri, publicId);
    return NextResponse.json({ url });
  } catch (err) {
    if (err.message === "Configuración de Cloudinary incompleta") {
      console.error(
        "[upload/logo] Configuración de Cloudinary incompleta. Definir CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET en las variables de entorno.",
      );
      return NextResponse.json(
        { error: "Configuración de Cloudinary incompleta" },
        { status: 500 },
      );
    }
    console.error("Upload logo:", err);
    return NextResponse.json(
      { error: err.message || "Error al subir la imagen" },
      { status: 500 },
    );
  }
}
