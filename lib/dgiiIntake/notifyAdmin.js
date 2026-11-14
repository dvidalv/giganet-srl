import { sendEmail } from "@/api-mail_brevo";
import {
  buildCompletionStatus,
  FIELD_LABELS,
} from "@/lib/dgiiIntake/status";
import {
  buildIntakePublicUrl,
  resolveDgiiIntakePublicBaseUrl,
} from "@/lib/dgiiIntake/createForUser";

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

/**
 * Email admin about an intake save / completion. Never includes decrypted secrets.
 */
export async function notifyAdminDgiiIntake({
  intake,
  event = "update",
  publicUrl = "",
}) {
  const to =
    process.env.CONTACT_FORM_TO_EMAIL ||
    process.env.BREVO_FROM_EMAIL ||
    process.env.EMAIL_FROM ||
    process.env.FACTURA_ERROR_TO_EMAIL;

  if (!to) {
    throw new Error("No admin email configured for DGII intake notifications");
  }

  const status = buildCompletionStatus(intake);
  const empresa = intake.empresa || {};
  const rep = intake.representante || {};
  const link =
    publicUrl ||
    (intake.token
      ? buildIntakePublicUrl(resolveDgiiIntakePublicBaseUrl(), intake.token)
      : "");

  const missingList = status.missing
    .map((k) => FIELD_LABELS[k] || k)
    .map((label) => `<li>${escapeHtml(label)}</li>`)
    .join("");

  const isCompleteEvent = event === "complete" || event === "submit";

  const title = isCompleteEvent
    ? "Cliente marcó el formulario DGII e-CF como completado"
    : "Progreso en formulario DGII e-CF";

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
      <h2 style="color:#111;">${escapeHtml(title)}</h2>
      <p>El cliente <strong>${escapeHtml(intake.clientName || empresa.nombre || "—")}</strong>
         (${escapeHtml(intake.clientEmail || "sin email")}) ha enviado datos del formulario de admisión DGII.</p>
      <p>Progreso: <strong>${status.completed}/${status.total}</strong> (${status.percent}%)</p>
      <h3>Empresa</h3>
      <ul>
        <li>RNC: ${escapeHtml(empresa.rnc || "—")}</li>
        <li>Nombre: ${escapeHtml(empresa.nombre || "—")}</li>
        <li>Razón social: ${escapeHtml(empresa.razonSocial || "—")}</li>
        <li>Teléfono: ${escapeHtml(empresa.telefono || "—")}</li>
        <li>Dirección: ${escapeHtml(empresa.direccion || "—")}</li>
      </ul>
      <h3>Representante legal</h3>
      <ul>
        <li>Nombre: ${escapeHtml(rep.nombre || "—")}</li>
        <li>Email: ${escapeHtml(rep.email || "—")}</li>
        <li>Teléfono: ${escapeHtml(rep.telefono || "—")}</li>
        <li>Dirección: ${escapeHtml(rep.direccion || "—")}</li>
      </ul>
      ${
        link
          ? `<p><strong>Enlace del formulario (token):</strong><br/>
             <a href="${escapeHtml(link)}">${escapeHtml(link)}</a></p>
             <p style="color:#666;font-size:13px;">Token: <code>${escapeHtml(intake.token || "")}</code></p>`
          : ""
      }
      <p><em>Las contraseñas del certificado y del portal DGII están cifradas en el servidor y no se incluyen en este correo.</em></p>
      ${
        isCompleteEvent
          ? `<p style="color:#166534;"><strong>Estado en base de datos: complete.</strong></p>`
          : missingList
            ? `<h3>Pendiente</h3><ul>${missingList}</ul>`
            : `<p style="color:#166534;"><strong>Todos los campos requeridos están completos.</strong></p>`
      }
    </div>
  `;

  await sendEmail({
    to,
    subject: isCompleteEvent
      ? `[DGII completado] ${empresa.nombre || intake.clientName || "Cliente"} · RNC ${empresa.rnc || "—"}`
      : `[DGII intake] ${empresa.nombre || intake.clientName || "Cliente"} · ${status.percent}%`,
    htmlContent,
    textContent: `${title}. Cliente: ${intake.clientName || ""}. RNC: ${empresa.rnc || ""}. Link: ${link}. Secretos no incluidos.`,
  });
}
