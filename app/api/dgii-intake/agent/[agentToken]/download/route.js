import { NextResponse } from "next/server";
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

function badToken() {
  return NextResponse.json({ error: "Enlace no válido" }, { status: 404 });
}

async function loadAgentIntake(agentToken) {
  if (!agentToken || typeof agentToken !== "string" || agentToken.length < 32) {
    return { error: badToken() };
  }

  const intake = await DgiiIntake.findOne({ agentToken });
  if (!intake) return { error: badToken() };

  const now = new Date();
  if (!intake.agentExpiresAt || new Date(intake.agentExpiresAt) <= now) {
    return {
      error: NextResponse.json(
        {
          error:
            "Este enlace de agente ha expirado. Solicite uno nuevo al administrador.",
        },
        { status: 410 }
      ),
    };
  }

  return { intake };
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

/**
 * GET ?slot= — public agent download (NO session). Token + expiry only.
 */
export async function GET(request, { params }) {
  const { agentToken } = await params;
  const loaded = await loadAgentIntake(agentToken);
  if (loaded.error) return loaded.error;

  const { searchParams } = new URL(request.url);
  const slot = searchParams.get("slot") || "";
  const disposition = String(searchParams.get("disposition") || "inline")
    .trim()
    .toLowerCase();
  const asAttachment = disposition === "attachment";

  if (!SLOTS.has(slot)) {
    return NextResponse.json({ error: "Slot inválido" }, { status: 400 });
  }

  const meta = resolveFileMeta(loaded.intake, slot);

  try {
    const result = await signedDownloadForFileMeta(meta, slot, {
      asAttachment,
    });
    return NextResponse.json(result);
  } catch (err) {
    const status = err?.status || 500;
    console.error("DGII agent download:", err?.message || err);
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
