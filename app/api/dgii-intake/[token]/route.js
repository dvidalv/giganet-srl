import { NextResponse } from "next/server";
import { headers } from "next/headers";
import DgiiIntake from "@/app/models/dgiiIntake";
import { encryptDgiiSecret } from "@/lib/dgiiIntake/crypto";
import { serializeIntakeForClient } from "@/lib/dgiiIntake/serialize";
import { notifyAdminDgiiIntake } from "@/lib/dgiiIntake/notifyAdmin";
import { buildCompletionStatus } from "@/lib/dgiiIntake/status";
import {
  buildIntakePublicUrl,
  resolveDgiiIntakePublicBaseUrl,
} from "@/lib/dgiiIntake/createForUser";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function badToken() {
  return NextResponse.json({ error: "Enlace no válido" }, { status: 404 });
}

async function resolvePublicUrl(token) {
  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  const base = resolveDgiiIntakePublicBaseUrl(`${proto}://${host}`);
  return buildIntakePublicUrl(base, token);
}

async function loadOpenIntake(token) {
  if (!token || typeof token !== "string" || token.length < 32) {
    return { error: badToken() };
  }

  const intake = await DgiiIntake.findOne({ token });
  if (!intake) return { error: badToken() };

  const now = new Date();
  if (intake.expiresAt && new Date(intake.expiresAt) <= now) {
    if (intake.status !== "expired") {
      intake.status = "expired";
      await intake.save().catch(() => {});
    }
    return {
      error: NextResponse.json(
        {
          error:
            "Este enlace ha expirado. Solicite uno nuevo al administrador.",
        },
        { status: 410 }
      ),
    };
  }

  return { intake };
}

/** GET — load form state for the client (no decrypted secrets). */
export async function GET(_request, { params }) {
  const { token } = await params;
  const loaded = await loadOpenIntake(token);
  if (loaded.error) return loaded.error;

  return NextResponse.json({ intake: serializeIntakeForClient(loaded.intake) });
}

/** PATCH — save fields; optional markComplete (Marcar como completado). */
export async function PATCH(request, { params }) {
  const { token } = await params;
  const loaded = await loadOpenIntake(token);
  if (loaded.error) return loaded.error;

  const intake = loaded.intake;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const markComplete = body.markComplete === true;
  const errors = {};

  if (body.empresa && typeof body.empresa === "object") {
    const e = body.empresa;
    if (e.rnc !== undefined) {
      intake.empresa.rnc = String(e.rnc || "").replace(/\D/g, "").slice(0, 11);
    }
    if (e.nombre !== undefined) {
      intake.empresa.nombre = String(e.nombre || "").trim().slice(0, 200);
    }
    if (e.razonSocial !== undefined) {
      intake.empresa.razonSocial = String(e.razonSocial || "")
        .trim()
        .slice(0, 200);
    }
    if (e.telefono !== undefined) {
      intake.empresa.telefono = String(e.telefono || "").trim().slice(0, 32);
    }
    if (e.direccion !== undefined) {
      intake.empresa.direccion = String(e.direccion || "").trim().slice(0, 400);
    }
  }

  if (body.representante && typeof body.representante === "object") {
    const r = body.representante;
    if (r.nombre !== undefined) {
      intake.representante.nombre = String(r.nombre || "").trim().slice(0, 120);
    }
    if (r.email !== undefined) {
      const email = String(r.email || "").trim().toLowerCase().slice(0, 254);
      if (email && !EMAIL_REGEX.test(email)) {
        errors.representanteEmail = "Correo del representante no válido.";
      } else {
        intake.representante.email = email;
      }
    }
    if (r.telefono !== undefined) {
      intake.representante.telefono = String(r.telefono || "")
        .trim()
        .slice(0, 32);
    }
    if (r.direccion !== undefined) {
      intake.representante.direccion = String(r.direccion || "")
        .trim()
        .slice(0, 400);
    }
  }

  const secretsIn =
    body.secrets && typeof body.secrets === "object" ? body.secrets : {};
  try {
    if (
      typeof secretsIn.certPassword === "string" &&
      secretsIn.certPassword.trim()
    ) {
      intake.secrets.certPasswordEnc = encryptDgiiSecret(
        secretsIn.certPassword
      );
    }
    if (
      typeof secretsIn.dgiiPortalRnc === "string" &&
      secretsIn.dgiiPortalRnc.trim()
    ) {
      intake.secrets.dgiiPortalRncEnc = encryptDgiiSecret(
        secretsIn.dgiiPortalRnc.replace(/\D/g, "").slice(0, 11)
      );
    }
    if (
      typeof secretsIn.dgiiPortalPassword === "string" &&
      secretsIn.dgiiPortalPassword.trim()
    ) {
      intake.secrets.dgiiPortalPasswordEnc = encryptDgiiSecret(
        secretsIn.dgiiPortalPassword
      );
    }
  } catch {
    errors.secrets =
      "No se pudieron guardar las credenciales. Contacte a Giganet (falta clave de cifrado en el servidor).";
  }

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ error: "Validación", errors }, { status: 400 });
  }

  intake.lastSavedAt = new Date();
  const completion = buildCompletionStatus(intake);

  if (markComplete) {
    if (!completion.isComplete) {
      return NextResponse.json(
        {
          error:
            "Aún faltan datos o archivos. Complete todos los campos antes de marcar como completado.",
          intake: serializeIntakeForClient(intake),
          completion,
        },
        { status: 400 }
      );
    }

    intake.status = "complete";
    intake.completedAt = new Date();
    await intake.save();

    const publicUrl = await resolvePublicUrl(token);
    try {
      await notifyAdminDgiiIntake({
        intake,
        event: "complete",
        publicUrl,
      });
      intake.lastNotifiedAt = new Date();
      await intake.save();
    } catch (err) {
      console.error("DGII intake complete notify failed:", err?.message || err);
    }

    return NextResponse.json({
      intake: serializeIntakeForClient(intake),
      message:
        "Formulario marcado como completado. Giganet ha sido notificado.",
    });
  }

  // Regular save — do not downgrade "complete"
  if (intake.status !== "complete") {
    if (completion.isComplete) {
      intake.status = "submitted";
    } else {
      intake.status = "open";
    }
  }

  await intake.save();

  if (body.notifyAdmin === true) {
    try {
      await notifyAdminDgiiIntake({
        intake,
        event: "update",
        publicUrl: await resolvePublicUrl(token),
      });
      intake.lastNotifiedAt = new Date();
      await intake.save();
    } catch (err) {
      console.error("DGII intake admin notify failed:", err?.message || err);
    }
  }

  return NextResponse.json({
    intake: serializeIntakeForClient(intake),
    message: completion.isComplete
      ? "Todo está completo. Puede marcar el formulario como completado."
      : "Progreso guardado. Puede volver a este enlace para completar lo pendiente.",
  });
}
