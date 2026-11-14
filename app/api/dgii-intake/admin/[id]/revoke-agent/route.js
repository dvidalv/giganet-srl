import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/auth";
import DgiiIntake from "@/app/models/dgiiIntake";
import {
  revokeAgentAccess,
  resolveDgiiIntakePublicBaseUrl,
} from "@/lib/dgiiIntake/createForUser";
import { buildIntakeViewPayload } from "@/lib/dgiiIntake/viewPayload";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return {
      error: NextResponse.json({ error: "No autorizado" }, { status: 403 }),
    };
  }
  return { session };
}

async function baseUrl() {
  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return resolveDgiiIntakePublicBaseUrl(`${proto}://${host}`);
}

/** POST — revoke agent link only (client token untouched) */
export async function POST(_request, { params }) {
  const check = await requireAdmin();
  if (check.error) return check.error;

  const { id } = await params;
  const intake = await DgiiIntake.findById(id);
  if (!intake) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  await revokeAgentAccess(intake);
  const root = await baseUrl();

  return NextResponse.json({
    ok: true,
    message: "Enlace de agente revocado",
    intake: buildIntakeViewPayload(intake, root),
  });
}
