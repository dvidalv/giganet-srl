import { NextResponse } from "next/server";
import DgiiIntake from "@/app/models/dgiiIntake";
import { buildIntakeDocumentsZip } from "@/lib/dgiiIntake/zipDocuments";

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

/** GET — ZIP of all intake documents (agent token gate, no session). */
export async function GET(_request, { params }) {
  const { agentToken } = await params;
  const loaded = await loadAgentIntake(agentToken);
  if (loaded.error) return loaded.error;

  try {
    const { buffer, filename } = await buildIntakeDocumentsZip(loaded.intake);
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buffer.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const status = err?.status || 500;
    console.error("DGII agent download-all:", err?.message || err);
    return NextResponse.json(
      {
        error:
          status === 404
            ? "No hay documentos para descargar"
            : "No se pudo generar el ZIP",
      },
      { status }
    );
  }
}
