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
import { eliminarDatosDeEmpresa } from "@/lib/eliminarEmpresa";
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
  "registroMercantil",
  "logo",
  "certificadoP12",
];

/** PDFs and P-12 are uploaded as Cloudinary `raw`; images as `image`. */
function resourceTypeForFileMeta(slot, meta) {
  const mime = String(meta?.mimeType || "").toLowerCase();
  const name = String(meta?.originalName || "").toLowerCase();
  const isRaw =
    slot === "certificadoP12" ||
    mime.includes("pdf") ||
    mime.includes("pkcs12") ||
    name.endsWith(".pdf") ||
    name.endsWith(".p12") ||
    name.endsWith(".pfx");
  return isRaw ? "raw" : "image";
}

/** Best-effort: a missing or invalid asset never blocks deleting the intake. */
async function deleteIntakeCloudinaryFiles(intake) {
  const files = intake?.files || {};
  await Promise.all(
    FILE_SLOT_KEYS.map(async (slot) => {
      const meta = files[slot];
      const publicId = String(meta?.publicId || "").trim();
      if (!publicId) return;
      try {
        const result = await deleteDgiiIntakeFile(publicId, {
          resourceType: resourceTypeForFileMeta(slot, meta),
        });
        if (result?.result !== "ok" && result?.result !== "not found") {
          console.error(
            `DGII intake delete file ${slot}: unexpected result`,
            result?.result
          );
        }
      } catch (err) {
        console.error(
          `DGII intake delete file ${slot}:`,
          err?.message || err
        );
      }
    })
  );
}

const ORPHAN_CONFIRM_WORD = "ELIMINAR";

/**
 * What the admin must type to confirm deletion.
 * Linked user → User.empresa.rnc. Orphan (no userId or user gone) →
 * intake.empresa.rnc, or ORPHAN_CONFIRM_WORD when the intake has no RNC.
 */
async function resolveDeleteConfirmation(intake) {
  const linkedUser = intake.userId
    ? await User.findById(intake.userId).select("role empresa.rnc")
    : null;
  if (linkedUser) {
    return {
      linkedUser,
      orphan: false,
      expected: normalizeRnc(linkedUser.empresa?.rnc),
    };
  }
  const intakeRnc = normalizeRnc(intake.empresa?.rnc);
  return {
    linkedUser: null,
    orphan: true,
    expected: intakeRnc || ORPHAN_CONFIRM_WORD,
  };
}

function confirmationMatches(typed, expected) {
  const t = normalizeRnc(typed).toUpperCase();
  return Boolean(expected) && t === String(expected).toUpperCase();
}

/** Admin payload + delete confirmation value for the modal. */
async function adminIntakePayload(intake, root) {
  const payload = buildIntakeViewPayload(intake, root);
  const confirm = await resolveDeleteConfirmation(intake);
  payload.userEmpresaRnc = confirm.orphan ? "" : confirm.expected;
  payload.orphan = confirm.orphan;
  payload.deleteConfirmValue = confirm.expected;
  return payload;
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
    intake: await adminIntakePayload(intake, root),
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
      intake: await adminIntakePayload(intake, root),
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
      intake: await adminIntakePayload(rotated, root),
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
      intake: await adminIntakePayload(intake, root),
    });
  }

  return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
}

/**
 * DELETE — permanent remove. Body: { rnc }
 * Requires typed RNC to match the linked User.empresa.rnc (not intake.empresa.rnc).
 * Also deletes that User when safe: not admin, not self.
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

  const userId = intake.userId;
  const { linkedUser, orphan, expected } =
    await resolveDeleteConfirmation(intake);

  if (!orphan && !expected) {
    return NextResponse.json(
      {
        error:
          "El usuario asociado no tiene RNC. No se puede confirmar la eliminación.",
      },
      { status: 400 }
    );
  }

  if (!confirmationMatches(body?.rnc, expected)) {
    return NextResponse.json(
      {
        error: orphan
          ? `La confirmación no coincide. Escriba ${expected} para eliminar este formulario huérfano.`
          : "El RNC no coincide. Escriba el RNC del usuario (empresa) para confirmar.",
      },
      { status: 400 }
    );
  }

  await deleteIntakeCloudinaryFiles(intake);
  await DgiiIntake.findByIdAndDelete(id);

  if (orphan) {
    return NextResponse.json({
      ok: true,
      userDeleted: false,
      message: "Formulario DGII huérfano eliminado",
    });
  }

  let userDeleted = false;
  try {
    const sessionUserId = check.session.user.id;
    const canDeleteUser =
      linkedUser.role !== "admin" &&
      String(linkedUser._id) !== String(sessionUserId);

    if (canDeleteUser) {
      const remaining = await DgiiIntake.find({ userId });
      for (const other of remaining) {
        await deleteIntakeCloudinaryFiles(other);
      }
      if (remaining.length) {
        await DgiiIntake.deleteMany({ userId });
      }
      await eliminarDatosDeEmpresa(userId);
      await User.findByIdAndDelete(userId);
      userDeleted = true;
    }
  } catch (err) {
    console.error("DGII intake cascade user delete:", err?.message || err);
  }

  return NextResponse.json({
    ok: true,
    userDeleted,
    message: userDeleted
      ? "Formulario DGII y usuario asociado eliminados"
      : "Formulario DGII eliminado",
  });
}
