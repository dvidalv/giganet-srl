import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/auth";
import DgiiIntake from "@/app/models/dgiiIntake";
import { sendEmail } from "@/api-mail_brevo";
import {
  buildAgentPublicUrl,
  issueOrRotateAgentAccess,
  resolveDgiiIntakePublicBaseUrl,
} from "@/lib/dgiiIntake/createForUser";
import { buildIntakeViewPayload } from "@/lib/dgiiIntake/viewPayload";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

/** POST { email } — issue/rotate agent token (30d), optional email; client token untouched */
export async function POST(request, { params }) {
  const check = await requireAdmin();
  if (check.error) return check.error;

  const { id } = await params;
  const intake = await DgiiIntake.findById(id);
  if (!intake) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const email = String(body?.email || "")
    .trim()
    .toLowerCase()
    .slice(0, 254);
  if (!email || !EMAIL_REGEX.test(email)) {
    return NextResponse.json(
      { error: "Indique un correo válido para The Factory" },
      { status: 400 }
    );
  }

  const root = await baseUrl();
  await issueOrRotateAgentAccess(intake, { email });
  const agentUrl = buildAgentPublicUrl(root, intake.agentToken);

  try {
    const name =
      intake.clientName || intake.empresa?.nombre || intake.empresa?.rnc || "cliente";
    await sendEmail({
      to: email,
      subject: `Acceso The Factory — admisión DGII (${name}) — Giganet`,
      htmlContent: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <h2 style="color:#0f172a;">Acceso de agente — The Factory</h2>
          <p>Se le ha otorgado acceso de solo lectura a la admisión DGII e-CF de <strong>${name}</strong>.</p>
          <p><a href="${agentUrl}" style="display:inline-block;padding:12px 20px;background:#ff4d00;color:#fff;text-decoration:none;border-radius:8px;">Abrir ficha</a></p>
          <p style="color:#666;font-size:13px;">El enlace vence el ${new Date(intake.agentExpiresAt).toLocaleString("es-DO")} (30 días).</p>
          <p style="color:#666;font-size:13px;">Si el botón no funciona, copie esta URL:<br/>${agentUrl}</p>
        </div>
      `,
      textContent: `Acceso The Factory (DGII): ${agentUrl}`,
    });
  } catch (err) {
    console.error("DGII agent send email:", err?.message || err);
    // Token was issued; still return URL so admin can copy/share manually
    return NextResponse.json({
      ok: true,
      warning: "Enlace generado, pero no se pudo enviar el correo",
      agentUrl,
      agentExpiresAt: intake.agentExpiresAt,
      agentEmail: intake.agentEmail,
      intake: buildIntakeViewPayload(intake, root),
    });
  }

  return NextResponse.json({
    ok: true,
    message: `Enlace de agente enviado a ${email}`,
    agentUrl,
    agentExpiresAt: intake.agentExpiresAt,
    agentEmail: intake.agentEmail,
    intake: buildIntakeViewPayload(intake, root),
  });
}
