import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/auth";
import DgiiIntake from "@/app/models/dgiiIntake";
import User from "@/app/models/user";
import { sendEmail } from "@/api-mail_brevo";
import {
  buildIntakePublicUrl,
  createOrRotateIntakeForUser,
  resolveDgiiIntakePublicBaseUrl,
} from "@/lib/dgiiIntake/createForUser";
import { buildIntakeViewPayload } from "@/lib/dgiiIntake/viewPayload";
import { normalizeRnc } from "@/lib/dgiiIntake/normalizeRnc";
import { deleteDgiiIntakeFile } from "@/utils/cloudinary";

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

const FILE_SLOT_KEYS = [
  "cedula",
  "cedulaFrente",
  "cedulaReverso",
  "factura1",
  "factura2",
  "factura3",
  "factura4",
  "factura5",
  "certificadoP12",
];

async function deleteIntakeCloudinaryFiles(intake) {
  const files = intake.files || {};
  await Promise.all(
    FILE_SLOT_KEYS.map(async (slot) => {
      const meta = files[slot];
      if (!meta?.publicId) return;
      try {
        await deleteDgiiIntakeFile(meta.publicId, {
          resourceType: slot === "certificadoP12" ? "raw" : "image",
        });
      } catch (err) {
        console.error(
          `DGII intake delete file ${slot}:`,
          err?.message || err
        );
      }
    })
  );
}

/** GET — intake detail (no decrypted passwords); includes agent link fields */
export async function GET(_request, { params }) {
  const check = await requireAdmin();
  if (check.error) return check.error;

  const { id } = await params;
  const intake = await DgiiIntake.findById(id);
  if (!intake) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const root = await baseUrl();
  return NextResponse.json({
    intake: buildIntakeViewPayload(intake, root),
  });
}

/**
 * POST actions: regenerate | revoke | resend
 * Client token only — never clears agentToken / agentExpiresAt / agentEmail.
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
      message: "Enlace del cliente revocado",
      intake: buildIntakeViewPayload(intake, root),
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
      message: "Nuevo enlace de cliente generado (30 días)",
      url,
      expiresAt: rotated.expiresAt,
      token: rotated.token,
      intakeId: String(rotated._id),
      intake: buildIntakeViewPayload(rotated, root),
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
    return NextResponse.json({
      ok: true,
      message: `Enlace reenviado a ${to}`,
      url,
      intake: buildIntakeViewPayload(intake, root),
    });
  }

  return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
}

/**
 * DELETE — permanent remove. Body: { rnc }
 * Requires typed RNC to match empresa.rnc after normalizing dashes/spaces.
 */
export async function DELETE(request, { params }) {
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

  const typed = normalizeRnc(body?.rnc);
  const stored = normalizeRnc(intake.empresa?.rnc);

  if (!stored) {
    return NextResponse.json(
      {
        error:
          "Este formulario no tiene RNC de empresa. No se puede confirmar la eliminación.",
      },
      { status: 400 }
    );
  }

  if (!typed || typed !== stored) {
    return NextResponse.json(
      { error: "El RNC no coincide. Escriba el RNC de la empresa para confirmar." },
      { status: 400 }
    );
  }

  await deleteIntakeCloudinaryFiles(intake);
  await DgiiIntake.findByIdAndDelete(id);

  return NextResponse.json({
    ok: true,
    message: "Formulario DGII eliminado",
  });
}
