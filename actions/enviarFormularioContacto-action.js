"use server";

import { headers } from "next/headers";
import { sendEmail } from "@/api-mail_brevo";
import { verifyTurnstileToken } from "@/lib/verifyTurnstile";
import {
  assertContactFormRateLimit,
  CONTACT_SUBMISSIONS_PER_HOUR,
} from "@/lib/contactFormRateLimit";

const HONEYPOT_FIELD = "website";

const LIMITS = {
  nombreMax: 120,
  emailMax: 254,
  telefonoMax: 32,
  mensajeMax: 5000,
  mensajeMin: 10,
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

async function getClientIp() {
  const h = await headers();
  const xff = h.get("x-forwarded-for");
  if (xff) {
    return xff.split(",")[0].trim();
  }
  return h.get("x-real-ip")?.trim() || "";
}

function fakeSuccessPayload() {
  return {
    errors: null,
    success:
      "¡Mensaje enviado con éxito! Nos pondremos en contacto contigo pronto.",
    values: { nombre: "", email: "", telefono: "", mensaje: "" },
  };
}

export async function enviarFormularioContacto(prevState, formData) {
  const honeypot = String(formData.get(HONEYPOT_FIELD) || "").trim();
  if (honeypot.length > 0) {
    return fakeSuccessPayload();
  }

  const email = String(formData.get("email") || "").trim();
  const nombre = String(formData.get("nombre") || "").trim();
  const telefono = String(formData.get("telefono") || "").trim();
  const mensaje = String(formData.get("mensaje") || "").trim();
  const turnstileToken = String(
    formData.get("cf-turnstile-response") || ""
  ).trim();

  const formValues = { nombre, email, telefono, mensaje };
  const fieldErrors = {};

  if (!nombre) {
    fieldErrors.nombre = "El nombre es requerido.";
  } else if (nombre.length > LIMITS.nombreMax) {
    fieldErrors.nombre = `El nombre no puede superar ${LIMITS.nombreMax} caracteres.`;
  }

  if (!email) {
    fieldErrors.email = "El email es requerido.";
  } else if (email.length > LIMITS.emailMax) {
    fieldErrors.email = "El email es demasiado largo.";
  } else if (!EMAIL_REGEX.test(email)) {
    fieldErrors.email = "El email no es válido.";
  }

  if (!telefono) {
    fieldErrors.telefono = "El teléfono es requerido.";
  } else if (telefono.length > LIMITS.telefonoMax) {
    fieldErrors.telefono = "El teléfono no es válido.";
  } else {
    const cleanedPhone = telefono.replace(/\D/g, "");
    if (cleanedPhone.length !== 10) {
      fieldErrors.telefono = "El teléfono debe tener 10 dígitos.";
    }
  }

  if (!mensaje) {
    fieldErrors.mensaje = "El mensaje es requerido.";
  } else if (mensaje.length < LIMITS.mensajeMin) {
    fieldErrors.mensaje = `El mensaje debe tener al menos ${LIMITS.mensajeMin} caracteres.`;
  } else if (mensaje.length > LIMITS.mensajeMax) {
    fieldErrors.mensaje = `El mensaje no puede superar ${LIMITS.mensajeMax} caracteres.`;
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      errors: fieldErrors,
      success: null,
      values: formValues,
    };
  }

  const contactToEmail =
    process.env.CONTACT_FORM_TO_EMAIL ||
    process.env.BREVO_FROM_EMAIL ||
    process.env.EMAIL_FROM;

  if (!contactToEmail) {
    return {
      errors: {
        general:
          "No se pudo enviar el formulario porque falta configurar el correo de destino.",
      },
      success: null,
      values: formValues,
    };
  }

  const clientIp = await getClientIp();
  const turnstileOk = await verifyTurnstileToken(turnstileToken, clientIp);
  if (!turnstileOk) {
    return {
      errors: {
        general:
          "No pudimos validar el envío. Recarga la página, completa la verificación de seguridad e inténtalo de nuevo.",
      },
      success: null,
      values: formValues,
    };
  }

  try {
    await assertContactFormRateLimit(clientIp);
  } catch (e) {
    if (e?.code === "CONTACT_RATE_LIMIT") {
      return {
        errors: {
          general: `Has enviado demasiados mensajes. Espera una hora o contáctanos por otro canal. (máx. ${CONTACT_SUBMISSIONS_PER_HOUR} por hora)`,
        },
        success: null,
        values: formValues,
      };
    }
    console.error("Error en rate limit del formulario de contacto:", e);
    return {
      errors: {
        general:
          "No pudimos procesar tu solicitud en este momento. Inténtalo más tarde.",
      },
      success: null,
      values: formValues,
    };
  }

  try {
    await sendEmail({
      to: contactToEmail,
      subject: `Nuevo mensaje de contacto - ${nombre}`,
      htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
          <h2 style="margin-bottom: 16px;">Nuevo formulario de contacto</h2>
          <p><strong>Nombre:</strong> ${escapeHtml(nombre)}</p>
          <p><strong>Email:</strong> ${escapeHtml(email)}</p>
          <p><strong>Teléfono:</strong> ${escapeHtml(telefono)}</p>
          <hr style="margin: 16px 0;" />
          <p><strong>Mensaje:</strong></p>
          <p style="white-space: pre-wrap;">${escapeHtml(mensaje)}</p>
        </div>
      `,
      textContent: `Nuevo formulario de contacto

Nombre: ${nombre}
Email: ${email}
Teléfono: ${telefono}

Mensaje:
${mensaje}`,
    });

    return {
      errors: null,
      success:
        "¡Mensaje enviado con éxito! Nos pondremos en contacto contigo pronto.",
      values: { nombre: "", email: "", telefono: "", mensaje: "" },
    };
  } catch (error) {
    console.error("Error al enviar formulario de contacto:", error);
    return {
      errors: {
        general:
          "No pudimos enviar tu mensaje en este momento. Inténtalo nuevamente en unos minutos.",
      },
      success: null,
      values: formValues,
    };
  }
}
