import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import User from "@/app/models/user";
import {
  extraerSeriesEDesdeImagenes,
  fusionarExtraccionesPorImagen,
  isDgiiVisionConfigured,
} from "@/lib/comprobantes/dgiiImport";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_FILES = 8;
const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

/** POST /api/users/[id]/comprobantes/importar-dgii/extraer — OCR/visión de fotos DGII (admin) */
export async function POST(request, { params }) {
  const check = await requireAdmin();
  if (check.error) return check.error;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  }

  if (!isDgiiVisionConfigured()) {
    return NextResponse.json(
      {
        error:
          "No hay clave de IA configurada. Defina AI_GATEWAY_API_KEY u OPENAI_API_KEY.",
      },
      { status: 503 },
    );
  }

  try {
    const user = await User.findById(id)
      .select("empresa.rnc empresa.razonSocial empresa.nombre")
      .lean();
    if (!user) {
      return NextResponse.json({ error: "Empresa no encontrada" }, { status: 404 });
    }
    const rnc = String(user.empresa?.rnc || "").replace(/\D/g, "");
    if (!rnc) {
      return NextResponse.json(
        { error: "La empresa no tiene RNC configurado" },
        { status: 400 },
      );
    }

    const form = await request.formData();
    const files = form
      .getAll("images")
      .filter((f) => f && typeof f === "object" && typeof f.arrayBuffer === "function");

    if (!files.length) {
      return NextResponse.json(
        { error: "Suba al menos una imagen de la autorización DGII" },
        { status: 400 },
      );
    }
    if (files.length > MAX_FILES) {
      return NextResponse.json(
        { error: `Máximo ${MAX_FILES} imágenes por análisis` },
        { status: 400 },
      );
    }

    const images = [];
    for (const file of files) {
      const mediaType = String(file.type || "image/jpeg").toLowerCase();
      if (!ALLOWED.has(mediaType)) {
        return NextResponse.json(
          { error: `Tipo de archivo no permitido: ${mediaType || "desconocido"}` },
          { status: 400 },
        );
      }
      if (file.size > MAX_BYTES) {
        return NextResponse.json(
          { error: `Cada imagen debe pesar menos de ${MAX_BYTES / (1024 * 1024)} MB` },
          { status: 400 },
        );
      }
      const buf = Buffer.from(await file.arrayBuffer());
      images.push({ mediaType, data: buf });
    }

    // Una llamada de visión por foto (evita que el modelo solo lea la primera),
    // luego se fusionan y deduplican por solicitud+autorización.
    const porImagen = [];
    for (const img of images) {
      porImagen.push(await extraerSeriesEDesdeImagenes([img]));
    }
    const filas = fusionarExtraccionesPorImagen(porImagen);
    return NextResponse.json({
      empresa: {
        id: String(user._id),
        rnc,
        razonSocial:
          user.empresa?.razonSocial || user.empresa?.nombre || "",
      },
      filas,
      imagenesProcesadas: images.length,
      omitidasSerieNoE: true,
    });
  } catch (err) {
    console.error("POST importar-dgii/extraer:", err);
    return NextResponse.json(
      {
        error:
          err?.message ||
          "No se pudieron leer las imágenes. Intente con fotos más nítidas.",
      },
      { status: 500 },
    );
  }
}
