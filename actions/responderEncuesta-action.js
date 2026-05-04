"use server";

import { headers } from "next/headers";
import Encuesta from "@/app/models/encuesta";
import { verifyTurnstileToken } from "@/lib/verifyTurnstile";
import {
  assertEncuestaFormRateLimit,
  ENCUESTA_SUBMISSIONS_PER_HOUR,
  hashResponderIp,
} from "@/lib/encuestaFormRateLimit";
import { sendEmail } from "@/api-mail_brevo";

const HONEYPOT_FIELD = "website";

const LIMITS = {
  loQueMasGusta: 1000,
  loQueMejorar: 1000,
  comentarios: 2000,
  nombreRespondiente: 120,
  emailRespondiente: 254,
  referenciaServicio: 200,
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

function parseIntField(formData, name, min, max) {
  const raw = String(formData.get(name) ?? "").trim();
  if (raw === "") return { ok: false, error: "Este campo es obligatorio." };
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < min || n > max) {
    return { ok: false, error: `Debe ser un número entre ${min} y ${max}.` };
  }
  return { ok: true, value: n };
}

function fakeSuccessPayload() {
  return {
    errors: null,
    success:
      "¡Gracias! Su respuesta ha sido registrada correctamente.",
    values: emptyValues(),
  };
}

function emptyValues() {
  return {
    nps: "",
    satisfaccionGeneral: "",
    facilidadIntegracion: "",
    calidadSoporte: "",
    tiempoRespuesta: "",
    loQueMasGusta: "",
    loQueMejorar: "",
    comentarios: "",
    nombreRespondiente: "",
    emailRespondiente: "",
    referenciaServicio: "",
  };
}

export async function responderEncuesta(prevState, formData) {
  const honeypot = String(formData.get(HONEYPOT_FIELD) || "").trim();
  if (honeypot.length > 0) {
    return fakeSuccessPayload();
  }

  const token = String(formData.get("token") || "").trim();
  const turnstileToken = String(
    formData.get("cf-turnstile-response") || ""
  ).trim();

  const loQueMasGusta = String(formData.get("loQueMasGusta") || "").trim();
  const loQueMejorar = String(formData.get("loQueMejorar") || "").trim();
  const comentarios = String(formData.get("comentarios") || "").trim();
  const nombreRespondiente = String(
    formData.get("nombreRespondiente") || ""
  ).trim();
  const emailRespondiente = String(
    formData.get("emailRespondiente") || ""
  ).trim();
  const referenciaServicio = String(
    formData.get("referenciaServicio") || ""
  ).trim();

  const values = {
    nps: String(formData.get("nps") ?? "").trim(),
    satisfaccionGeneral: String(
      formData.get("satisfaccionGeneral") ?? ""
    ).trim(),
    facilidadIntegracion: String(
      formData.get("facilidadIntegracion") ?? ""
    ).trim(),
    calidadSoporte: String(formData.get("calidadSoporte") ?? "").trim(),
    tiempoRespuesta: String(formData.get("tiempoRespuesta") ?? "").trim(),
    loQueMasGusta,
    loQueMejorar,
    comentarios,
    nombreRespondiente,
    emailRespondiente,
    referenciaServicio,
  };

  const fieldErrors = {};

  if (!token || token.length < 32) {
    return {
      errors: { general: "Enlace de encuesta no válido." },
      success: null,
      values,
    };
  }

  const npsParsed = parseIntField(formData, "nps", 0, 10);
  if (!npsParsed.ok) fieldErrors.nps = npsParsed.error;

  const sg = parseIntField(formData, "satisfaccionGeneral", 1, 5);
  if (!sg.ok) fieldErrors.satisfaccionGeneral = sg.error;

  const fi = parseIntField(formData, "facilidadIntegracion", 1, 5);
  if (!fi.ok) fieldErrors.facilidadIntegracion = fi.error;

  const cs = parseIntField(formData, "calidadSoporte", 1, 5);
  if (!cs.ok) fieldErrors.calidadSoporte = cs.error;

  const tr = parseIntField(formData, "tiempoRespuesta", 1, 5);
  if (!tr.ok) fieldErrors.tiempoRespuesta = tr.error;

  if (loQueMasGusta.length > LIMITS.loQueMasGusta) {
    fieldErrors.loQueMasGusta = `Máximo ${LIMITS.loQueMasGusta} caracteres.`;
  }
  if (loQueMejorar.length > LIMITS.loQueMejorar) {
    fieldErrors.loQueMejorar = `Máximo ${LIMITS.loQueMejorar} caracteres.`;
  }
  if (comentarios.length > LIMITS.comentarios) {
    fieldErrors.comentarios = `Máximo ${LIMITS.comentarios} caracteres.`;
  }

  if (nombreRespondiente.length > LIMITS.nombreRespondiente) {
    fieldErrors.nombreRespondiente = `Máximo ${LIMITS.nombreRespondiente} caracteres.`;
  }
  if (emailRespondiente.length > LIMITS.emailRespondiente) {
    fieldErrors.emailRespondiente = "El correo es demasiado largo.";
  } else if (
    emailRespondiente &&
    !EMAIL_REGEX.test(emailRespondiente)
  ) {
    fieldErrors.emailRespondiente = "Correo electrónico no válido.";
  }
  if (referenciaServicio.length > LIMITS.referenciaServicio) {
    fieldErrors.referenciaServicio = `Máximo ${LIMITS.referenciaServicio} caracteres.`;
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { errors: fieldErrors, success: null, values };
  }

  const clientIp = await getClientIp();
  const turnstileOk = await verifyTurnstileToken(turnstileToken, clientIp);
  if (!turnstileOk) {
    return {
      errors: {
        general:
          "No pudimos validar el envío. Recargue la página, complete la verificación de seguridad e inténtelo de nuevo.",
      },
      success: null,
      values,
    };
  }

  try {
    await assertEncuestaFormRateLimit(clientIp);
  } catch (e) {
    if (e?.code === "ENCUESTA_RATE_LIMIT") {
      return {
        errors: {
          general: `Ha enviado demasiadas respuestas. Espere una hora. (máx. ${ENCUESTA_SUBMISSIONS_PER_HOUR} por hora)`,
        },
        success: null,
        values,
      };
    }
    console.error("Rate limit encuesta:", e);
    return {
      errors: {
        general:
          "No pudimos procesar su solicitud en este momento. Inténtelo más tarde.",
      },
      success: null,
      values,
    };
  }

  const now = new Date();
  const answers = {
    nps: npsParsed.value,
    satisfaccionGeneral: sg.value,
    facilidadIntegracion: fi.value,
    calidadSoporte: cs.value,
    tiempoRespuesta: tr.value,
    loQueMasGusta,
    loQueMejorar,
    comentarios,
    nombreRespondiente,
    emailRespondiente,
    referenciaServicio,
  };

  const updated = await Encuesta.findOneAndUpdate(
    {
      token,
      status: "pending",
      expiresAt: { $gt: now },
    },
    {
      $set: {
        status: "responded",
        respondedAt: now,
        responderIpHash: hashResponderIp(clientIp),
        answers,
      },
    },
    { new: true }
  ).lean();

  if (!updated) {
    const exists = await Encuesta.findOne({ token }).lean();
    if (!exists) {
      return {
        errors: { general: "Esta encuesta no existe o el enlace no es válido." },
        success: null,
        values,
      };
    }
    if (exists.status === "responded") {
      return {
        errors: null,
        success: "Esta encuesta ya fue respondida. ¡Gracias!",
        values: emptyValues(),
      };
    }
    if (exists.expiresAt && new Date(exists.expiresAt) <= now) {
      await Encuesta.findOneAndUpdate(
        { _id: exists._id, status: "pending" },
        { $set: { status: "expired" } }
      ).catch(() => {});
      return {
        errors: {
          general: "Este enlace de encuesta ha expirado. Contacte a su administrador.",
        },
        success: null,
        values,
      };
    }
    return {
      errors: {
        general: "No se pudo registrar la respuesta. Inténtelo de nuevo.",
      },
      success: null,
      values,
    };
  }

  const notifyTo =
    process.env.ENCUESTAS_TO_EMAIL ||
    process.env.CONTACT_FORM_TO_EMAIL ||
    process.env.BREVO_FROM_EMAIL;

  if (notifyTo && process.env.BREVO_API_KEY) {
    const emp = updated.empresa || {};
    const label = emp.razonSocial || emp.nombre || emp.rnc || "Empresa";
    try {
      await sendEmail({
        to: notifyTo,
        subject: `Nueva encuesta respondida — ${label}`,
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 640px;">
            <h2>Encuesta de satisfacción respondida</h2>
            <p><strong>Empresa:</strong> ${escapeHtml(label)}</p>
            <p><strong>RNC:</strong> ${escapeHtml(emp.rnc || "—")}</p>
            ${
              nombreRespondiente || emailRespondiente || referenciaServicio
                ? `<p><strong>Respondiente (opcional):</strong> ${escapeHtml(nombreRespondiente || "—")} · ${escapeHtml(emailRespondiente || "—")} · Ref: ${escapeHtml(referenciaServicio || "—")}</p>`
                : ""
            }
            <p><strong>NPS (0–10):</strong> ${answers.nps}</p>
            <p><strong>Satisfacción general (1–5):</strong> ${answers.satisfaccionGeneral}</p>
            <p><strong>Facilidad de integración (1–5):</strong> ${answers.facilidadIntegracion}</p>
            <p><strong>Calidad del soporte (1–5):</strong> ${answers.calidadSoporte}</p>
            <p><strong>Tiempo de respuesta (1–5):</strong> ${answers.tiempoRespuesta}</p>
            <hr />
            <p><strong>Lo que más gusta:</strong></p>
            <p style="white-space: pre-wrap;">${escapeHtml(loQueMasGusta || "—")}</p>
            <p><strong>Qué mejorar:</strong></p>
            <p style="white-space: pre-wrap;">${escapeHtml(loQueMejorar || "—")}</p>
            <p><strong>Comentarios:</strong></p>
            <p style="white-space: pre-wrap;">${escapeHtml(comentarios || "—")}</p>
          </div>
        `,
        textContent: `Encuesta respondida — ${label}
RNC: ${emp.rnc || "—"}
Respondiente: ${nombreRespondiente || "—"} | ${emailRespondiente || "—"} | Ref: ${referenciaServicio || "—"}
NPS: ${answers.nps}
Satisfacción general: ${answers.satisfaccionGeneral}
Facilidad integración: ${answers.facilidadIntegracion}
Calidad soporte: ${answers.calidadSoporte}
Tiempo respuesta: ${answers.tiempoRespuesta}

Lo que más gusta:
${loQueMasGusta || "—"}

Qué mejorar:
${loQueMejorar || "—"}

Comentarios:
${comentarios || "—"}`,
      });
    } catch (e) {
      console.error("Notificación encuesta al admin:", e);
    }
  }

  return {
    errors: null,
    success:
      "¡Gracias! Su respuesta ha sido registrada correctamente.",
    values: emptyValues(),
  };
}
