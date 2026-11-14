import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/auth";
import User from "@/app/models/user";
import {
  createOrRotateIntakeForUser,
  buildIntakePublicUrl,
  resolveDgiiIntakePublicBaseUrl,
} from "@/lib/dgiiIntake/createForUser";
import { buildCompletionStatus } from "@/lib/dgiiIntake/status";
import DgiiIntake from "@/app/models/dgiiIntake";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return {
      error: NextResponse.json({ error: "No autorizado" }, { status: 403 }),
    };
  }
  return { session };
}

async function resolveBaseUrl() {
  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return resolveDgiiIntakePublicBaseUrl(`${proto}://${host}`);
}

/** POST — generate or rotate a 30-day intake link for a user */
export async function POST(request) {
  const check = await requireAdmin();
  if (check.error) return check.error;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const userId = body.userId;
  const regenerate = body.regenerate === true;
  if (!userId) {
    return NextResponse.json({ error: "userId requerido" }, { status: 400 });
  }

  const user = await User.findById(userId).select("name email role");
  if (!user) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }
  if (user.role === "admin") {
    return NextResponse.json(
      { error: "No se genera formulario DGII para administradores" },
      { status: 400 }
    );
  }

  try {
    const intake = await createOrRotateIntakeForUser({
      userId: user._id,
      clientEmail: user.email,
      clientName: user.name,
      regenerate,
    });
    const baseUrl = await resolveBaseUrl();
    const url = buildIntakePublicUrl(baseUrl, intake.token);
    const completion = buildCompletionStatus(
      await DgiiIntake.findById(intake._id)
    );

    return NextResponse.json({
      intakeId: String(intake._id),
      token: intake.token,
      url,
      expiresAt: intake.expiresAt,
      status: intake.status,
      completion,
    });
  } catch (err) {
    console.error("POST /api/dgii-intake/admin:", err?.message || err);
    return NextResponse.json(
      { error: "No se pudo generar el enlace" },
      { status: 500 }
    );
  }
}

/** GET — lookup latest intake link for a userId */
export async function GET(request) {
  const check = await requireAdmin();
  if (check.error) return check.error;

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId requerido" }, { status: 400 });
  }

  const intake = await DgiiIntake.findOne({ userId }).sort({ createdAt: -1 });

  if (!intake) {
    return NextResponse.json({ intake: null });
  }

  const baseUrl = await resolveBaseUrl();
  return NextResponse.json({
    intake: {
      intakeId: String(intake._id),
      url: buildIntakePublicUrl(baseUrl, intake.token),
      expiresAt: intake.expiresAt,
      status: intake.status,
      completion: buildCompletionStatus(intake),
      lastSavedAt: intake.lastSavedAt,
    },
  });
}
