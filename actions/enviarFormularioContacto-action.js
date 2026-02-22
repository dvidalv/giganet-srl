"use server";

import { sendEmail } from "@/api-mail_brevo";

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

export async function enviarFormularioContacto(prevState, formData) {
  const email = String(formData.get("email") || "").trim();
  const nombre = String(formData.get("nombre") || "").trim();
  const telefono = String(formData.get("telefono") || "").trim();
  const mensaje = String(formData.get("mensaje") || "").trim();

  const formValues = { nombre, email, telefono, mensaje };
  const fieldErrors = {};

  if (!nombre) {
    fieldErrors.nombre = "El nombre es requerido.";
  }

  if (!email) {
    fieldErrors.email = "El email es requerido.";
  } else if (!email.includes("@")) {
    fieldErrors.email = "El email no es válido.";
  }

  if (!telefono) {
    fieldErrors.telefono = "El teléfono es requerido.";
  } else {
    const cleanedPhone = telefono.replace(/\D/g, "");
    if (cleanedPhone.length !== 10) {
      fieldErrors.telefono = "El teléfono debe tener 10 dígitos.";
    }
  }

  if (!mensaje) {
    fieldErrors.mensaje = "El mensaje es requerido.";
  } else if (mensaje.length < 10) {
    fieldErrors.mensaje = "El mensaje debe tener al menos 10 caracteres.";
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
