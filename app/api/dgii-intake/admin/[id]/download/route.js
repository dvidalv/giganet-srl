import { NextResponse } from "next/server";
import { auth } from "@/auth";
import DgiiIntake from "@/app/models/dgiiIntake";
import { getCloudinary } from "@/utils/cloudinary";

const SLOTS = new Set([
  "cedula",
  "factura1",
  "factura2",
  "factura3",
  "factura4",
  "factura5",
  "certificadoP12",
]);

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return {
      error: NextResponse.json({ error: "No autorizado" }, { status: 403 }),
    };
  }
  return { session };
}

/** GET ?slot=cedula — signed download URL for authenticated Cloudinary asset */
export async function GET(request, { params }) {
  const check = await requireAdmin();
  if (check.error) return check.error;

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const slot = searchParams.get("slot") || "";

  if (!SLOTS.has(slot)) {
    return NextResponse.json({ error: "Slot inválido" }, { status: 400 });
  }

  const intake = await DgiiIntake.findById(id);
  if (!intake) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const meta = intake.files?.[slot];
  if (!meta?.publicId && !meta?.url) {
    return NextResponse.json(
      { error: "Archivo no subido todavía" },
      { status: 404 }
    );
  }

  try {
    if (meta.publicId) {
      const cloudinary = await getCloudinary();
      const isRaw =
        slot === "certificadoP12" ||
        (meta.mimeType || "").includes("pdf") ||
        (meta.originalName || "").toLowerCase().endsWith(".pdf") ||
        (meta.originalName || "").toLowerCase().endsWith(".p12") ||
        (meta.originalName || "").toLowerCase().endsWith(".pfx");

      const resourceType = isRaw ? "raw" : "image";
      const url = cloudinary.url(meta.publicId, {
        resource_type: resourceType,
        type: "authenticated",
        sign_url: true,
        secure: true,
        expires_at: Math.floor(Date.now() / 1000) + 60 * 10,
      });

      return NextResponse.json({
        url,
        originalName: meta.originalName || slot,
        mimeType: meta.mimeType || "",
      });
    }

    return NextResponse.json({
      url: meta.url,
      originalName: meta.originalName || slot,
      mimeType: meta.mimeType || "",
    });
  } catch (err) {
    console.error("DGII intake download URL:", err?.message || err);
    return NextResponse.json(
      { error: "No se pudo generar el enlace de descarga" },
      { status: 500 }
    );
  }
}
