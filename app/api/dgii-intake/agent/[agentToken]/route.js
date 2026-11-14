import { NextResponse } from "next/server";
import { headers } from "next/headers";
import DgiiIntake from "@/app/models/dgiiIntake";
import { resolveDgiiIntakePublicBaseUrl } from "@/lib/dgiiIntake/createForUser";
import { buildIntakeViewPayload } from "@/lib/dgiiIntake/viewPayload";

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

async function baseUrl() {
  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return resolveDgiiIntakePublicBaseUrl(`${proto}://${host}`);
}

/**
 * GET — public agent view (NO session). Gated only by agentToken + agentExpiresAt.
 * Client token status is ignored.
 */
export async function GET(_request, { params }) {
  const { agentToken } = await params;
  const loaded = await loadAgentIntake(agentToken);
  if (loaded.error) return loaded.error;

  const root = await baseUrl();
  return NextResponse.json({
    intake: buildIntakeViewPayload(loaded.intake, root),
  });
}
