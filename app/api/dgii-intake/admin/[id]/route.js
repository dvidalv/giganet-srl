import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/auth";
import DgiiIntake from "@/app/models/dgiiIntake";
import User from "@/app/models/user";
import { sendEmail } from "@/api-mail_brevo";
import { buildCompletionStatus } from "@/lib/dgiiIntake/status";
import {
  buildIntakePublicUrl,
  createOrRotateIntakeForUser,
  resolveDgiiIntakePublicBaseUrl,
} from "@/lib/dgiiIntake/createForUser";
import { hasEncryptedSecret } from "@/lib/dgiiIntake/crypto";

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

function fileSummary(meta) {
  if (!meta?.url && !meta?.publicId) return null;
  return {
    originalName: meta.originalName || "",
    mimeType: meta.mimeType || "",
    bytes: meta.bytes || 0,
    uploadedAt: meta.uploadedAt || null,
    publicId: meta.publicId || "",
    hasFile: Boolean(meta.publicId || meta.url),
  };
}

/** GET — intake detail (no decrypted passwords) */
export async function GET(_request, { params }) {
  const check = await requireAdmin();
  if (check.error) return check.error;

  const { id } = await params;
  const intake = await DgiiIntake.findById(id);
  if (!intake) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const plain = intake.toObject();
  const root = await baseUrl();
  const secrets = plain.secrets || {};

  return NextResponse.json({
    intake: {
      id: String(plain._id),
      userId: String(plain.userId),
      clientName: plain.clientName || "",
      clientEmail: plain.clientEmail || "",
      status: plain.status,
      createdAt: plain.createdAt,
      expiresAt: plain.expiresAt,
      completedAt: plain.completedAt,
      lastSavedAt: plain.lastSavedAt,
      url: buildIntakePublicUrl(root, plain.token),
      token: plain.token,
      empresa: plain.empresa || {},
      representante: plain.representante || {},
      files: {
        cedula: fileSummary(plain.files?.cedula),
        factura1: fileSummary(plain.files?.factura1),
        factura2: fileSummary(plain.files?.factura2),
        factura3: fileSummary(plain.files?.factura3),
        factura4: fileSummary(plain.files?.factura4),
        factura5: fileSummary(plain.files?.factura5),
        certificadoP12: fileSummary(plain.files?.certificadoP12),
      },
      secretsStatus: {
        certPassword: hasEncryptedSecret(secrets.certPasswordEnc),
        dgiiPortalRnc: hasEncryptedSecret(secrets.dgiiPortalRncEnc),
        dgiiPortalPassword: hasEncryptedSecret(secrets.dgiiPortalPasswordEnc),
      },
      completion: buildCompletionStatus(plain),
    },
  });
}

/**
 * POST actions: regenerate | revoke | resend
 * body: { action }
 */
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

  const action = body.action;
  const root = await baseUrl();

  if (action === "revoke") {
    intake.status = "expired";
    intake.expiresAt = new Date();
    await intake.save();
    return NextResponse.json({
      ok: true,
      message: "Enlace revocado",
      intake: {
        id: String(intake._id),
        status: intake.status,
        expiresAt: intake.expiresAt,
      },
    });
  }

  if (action === "regenerate") {
    const user = await User.findById(intake.userId).select("name email");
    const rotated = await createOrRotateIntakeForUser({
      userId: intake.userId,
      clientEmail: user?.email || intake.clientEmail,
      clientName: user?.name || intake.clientName,
      regenerate: true,
    });
    const url = buildIntakePublicUrl(root, rotated.token);
    return NextResponse.json({
      ok: true,
      message: "Nuevo enlace generado (30 días)",
      url,
      expiresAt: rotated.expiresAt,
      token: rotated.token,
      intakeId: String(rotated._id),
    });
  }

  if (action === "resend") {
    const to = intake.clientEmail;
    if (!to) {
      return NextResponse.json(
        { error: "El cliente no tiene email para reenviar el enlace" },
        { status: 400 }
      );
    }
    if (intake.status === "expired" || new Date(intake.expiresAt) <= new Date()) {
      return NextResponse.json(
        { error: "El enlace está expirado. Regenérelo antes de reenviar." },
        { status: 400 }
      );
    }
    const url = buildIntakePublicUrl(root, intake.token);
    const name = intake.clientName || intake.empresa?.nombre || "cliente";
    try {
      await sendEmail({
        to,
        subject: "Formulario de admisión DGII e-CF — Giganet",
        htmlContent: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
            <h2>Hola ${name}</h2>
            <p>Use este enlace seguro para completar o actualizar su información de facturación electrónica DGII:</p>
            <p><a href="${url}" style="display:inline-block;padding:12px 20px;background:#ff4d00;color:#fff;text-decoration:none;border-radius:8px;">Abrir formulario</a></p>
            <p style="color:#666;font-size:13px;">El enlace vence el ${new Date(intake.expiresAt).toLocaleString("es-DO")}.</p>
            <p style="color:#666;font-size:13px;">Si el botón no funciona, copie esta URL:<br/>${url}</p>
          </div>
        `,
        textContent: `Complete su formulario DGII: ${url}`,
      });
    } catch (err) {
      console.error("DGII intake resend email:", err?.message || err);
      return NextResponse.json(
        { error: "No se pudo enviar el correo" },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true, message: `Enlace reenviado a ${to}`, url });
  }

  return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
}
