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

/** POST { email } — issue/rotate agent token (24h), optional email; client token untouched */
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

  try {
    await issueOrRotateAgentAccess(intake, { email });
  } catch (err) {
    console.error("DGII agent issue token:", err?.message || err);
    return NextResponse.json(
      {
        error:
          err?.message ||
          "No se pudo generar el enlace de agente. Intente de nuevo.",
      },
      { status: 500 }
    );
  }

  const agentUrl = buildAgentPublicUrl(root, intake.agentToken);

  try {
    const name =
      intake.clientName || intake.empresa?.nombre || intake.empresa?.rnc || "cliente";
    const expiresLabel = new Date(intake.agentExpiresAt).toLocaleString("es-DO");
    await sendEmail({
      to: email,
      subject: `Urgente: acceso The Factory (válido 24 h) — DGII (${name}) — Giganet`,
      htmlContent: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:#fef2f2;border:2px solid #dc2626;border-radius:10px;padding:16px 18px;margin:0 0 20px;">
            <p style="margin:0 0 6px;color:#991b1b;font-size:18px;font-weight:700;line-height:1.3;">
              ⏱ Este enlace solo es válido por 24 horas
            </p>
            <p style="margin:0;color:#7f1d1d;font-size:15px;line-height:1.45;">
              Debe abrir la ficha <strong>antes de ${expiresLabel}</strong>.
              Después de ese plazo el acceso caduca y tendrá que solicitar uno nuevo.
            </p>
          </div>
          <h2 style="color:#0f172a;">Acceso de agente — The Factory</h2>
          <p>Se le ha otorgado acceso de solo lectura a la admisión DGII e-CF de <strong>${name}</strong>.</p>
          <p><a href="${agentUrl}" style="display:inline-block;padding:12px 20px;background:#ff4d00;color:#fff;text-decoration:none;border-radius:8px;">Abrir ficha ahora</a></p>
          <p style="color:#991b1b;font-size:14px;font-weight:600;">Vence: ${expiresLabel} (24 horas desde el envío).</p>
          <p style="color:#666;font-size:13px;">Si el botón no funciona, copie esta URL:<br/>${agentUrl}</p>
        </div>
      `,
      textContent: `URGENTE: este enlace de The Factory solo es válido 24 horas. Vence el ${expiresLabel}. Ábralo cuanto antes.\n\nAcceso The Factory (DGII) — ${name}:\n${agentUrl}\n\nDespués de esa fecha el enlace caduca.`,
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
