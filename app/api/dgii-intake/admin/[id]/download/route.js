import { NextResponse } from "next/server";
import { auth } from "@/auth";
import DgiiIntake from "@/app/models/dgiiIntake";
import { signedDownloadForFileMeta } from "@/lib/dgiiIntake/signedDownload";

const SLOTS = new Set([
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

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return {
      error: NextResponse.json({ error: "No autorizado" }, { status: 403 }),
    };
  }
  return { session };
}

function resolveFileMeta(intake, slot) {
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

  const meta = resolveFileMeta(intake, slot);

  try {
    const result = await signedDownloadForFileMeta(meta, slot);
    return NextResponse.json(result);
  } catch (err) {
    const status = err?.status || 500;
    console.error("DGII intake download URL:", err?.message || err);
    return NextResponse.json(
      {
        error:
          status === 404
            ? "Archivo no subido todavía"
            : "No se pudo generar el enlace de descarga",
      },
      { status }
    );
  }
}
