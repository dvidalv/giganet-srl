"use server";

import crypto from "crypto";
import { auth } from "@/auth";
import User from "@/app/models/user";
import Encuesta from "@/app/models/encuesta";
import { sendEmail } from "@/api-mail_brevo";

const EXPIRY_DAYS = 30;

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

function baseUrl() {
  const u = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!u) return "";
  return u.replace(/\/$/, "");
}

/**
 * Admin: crea encuesta pendiente y envía email con enlace único.
 * @param {string} userId - ID del usuario (empresa) en MongoDB
 */
export async function crearEncuesta(userId) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false, error: "No autorizado." };
  }

  if (!userId || typeof userId !== "string") {
    return { ok: false, error: "Empresa no válida." };
  }

  const appBase = baseUrl();
  if (!appBase) {
    return {
      ok: false,
      error:
        "Falta NEXT_PUBLIC_APP_URL en el entorno para generar el enlace de la encuesta.",
    };
  }

  try {
    const user = await User.findById(userId).lean();
    if (!user) {
      return { ok: false, error: "Usuario no encontrado." };
    }

    const emp = user.empresa || {};
    const rnc = String(emp.rnc || "").trim();
    if (!rnc) {
      return {
        ok: false,
        error:
          "La empresa debe tener RNC registrado antes de enviar la encuesta.",
      };
    }

    const empresaEmail = String(emp.email || "").trim();
    const accountEmail = String(user.email || "").trim();
    const toEmail = empresaEmail || accountEmail;
    if (!toEmail || !/^\S+@\S+\.\S+$/.test(toEmail)) {
      return {
        ok: false,
        error:
          "No hay un correo válido para la empresa. Añade el email de la empresa o del usuario.",
      };
    }

    if (!process.env.BREVO_API_KEY) {
      return {
        ok: false,
        error: "BREVO_API_KEY no está configurada; no se puede enviar el correo.",
      };
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(
      Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000
    );

    const razonSocial = String(emp.razonSocial || "").trim();
    const nombre = String(emp.nombre || "").trim();
    const displayName = razonSocial || nombre || "su empresa";

    const doc = await Encuesta.create({
      userId: user._id,
      empresa: {
        rnc,
        razonSocial: razonSocial || nombre,
        nombre,
        email: empresaEmail,
      },
      token,
      status: "pending",
      expiresAt,
      sentAt: new Date(),
    });

    const surveyUrl = `${appBase}/encuesta/${token}`;

    try {
    await sendEmail({
      to: toEmail,
      subject: "Tu opinión sobre Giganet — encuesta rápida",
      htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
          <h2 style="margin-bottom: 16px;">Encuesta de satisfacción</h2>
          <p>Hola,</p>
          <p>Gracias por integrar <strong>Giganet</strong> con <strong>${escapeHtml(displayName)}</strong>.</p>
          <p>Nos gustaría conocer su experiencia. La encuesta solo toma unos minutos:</p>
          <p style="margin: 24px 0;">
            <a href="${escapeHtml(surveyUrl)}" style="display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600;">
              Responder encuesta
            </a>
          </p>
          <p style="font-size: 14px; color: #666;">O copie este enlace en su navegador:<br />
          <span style="word-break: break-all;">${escapeHtml(surveyUrl)}</span></p>
          <p style="font-size: 13px; color: #888;">El enlace vence en ${EXPIRY_DAYS} días.</p>
        </div>
      `,
      textContent: `Encuesta de satisfacción — Giganet

Hola,

Gracias por integrar Giganet con ${displayName}.

Responda la encuesta en este enlace (válido ${EXPIRY_DAYS} días):
${surveyUrl}`,
    });
    } catch (mailErr) {
      await Encuesta.deleteOne({ _id: doc._id }).catch(() => {});
      throw mailErr;
    }

    return {
      ok: true,
      surveyUrl,
      message: `Encuesta enviada a ${toEmail}.`,
    };
  } catch (e) {
    console.error("crearEncuesta:", e);
    return {
      ok: false,
      error:
        e?.message ||
        "No se pudo crear o enviar la encuesta. Inténtelo de nuevo.",
    };
  }
}
