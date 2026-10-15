import { sendEmail } from "@/api-mail_brevo";

function escapeHtml(valor) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function numero(n) {
  return Number(n || 0).toLocaleString("es-DO");
}

function fechaDia(dia) {
  if (!dia) return "—";
  const [y, m, d] = String(dia).split("-");
  return `${d}/${m}/${y}`;
}

export function destinatarioAlertasFolios() {
  return (
    process.env.FOLIOS_ALERTAS_TO_EMAIL ||
    process.env.CONTACT_FORM_TO_EMAIL ||
    process.env.BREVO_FROM_EMAIL ||
    process.env.EMAIL_FROM ||
    ""
  );
}

function urlPanelEmpresa(empresaId) {
  const base = (process.env.APP_URL || process.env.NEXTAUTH_URL || "").replace(/\/$/, "");
  return base ? `${base}/dashboard/empresas/${empresaId}` : "";
}

/**
 * Contenido del email de alerta mínima de folios.
 * @param {{ empresa: { id: string, nombre: string, rnc: string }, contrato: object, disponible: number, limite: number, umbral: number, pct: number }} datos
 */
export function construirEmailAlertaMinima({ empresa, contrato, disponible, limite, umbral, pct }) {
  const porcentajeRestante = limite ? Math.round((disponible / limite) * 1000) / 10 : 0;
  const pendienteAsignar = Math.max(0, (contrato.cantidadContratada || 0) - (contrato.asignados || 0));
  const accion =
    pendienteAsignar > 0
      ? `Quedan ${numero(pendienteAsignar)} folios contratados sin asignar: cárguelos en The Factory y registre la asignación en Giganet.`
      : "El contrato ya está asignado por completo: coordine la renovación o un nuevo paquete con el cliente.";
  const url = urlPanelEmpresa(empresa.id);

  const subject = `Folios bajos: ${empresa.nombre} (${numero(disponible)} disponible${disponible === 1 ? "" : "s"})`;

  const filas = [
    ["Empresa", empresa.nombre],
    ["RNC", empresa.rnc || "N/A"],
    ["Contrato", contrato.codigo],
    ["Disponibles", `${numero(disponible)} de ${numero(limite)} (${porcentajeRestante} %)`],
    ["Alerta configurada", `${pct} % (${numero(umbral)} folios)`],
    ["Asignados en The Factory", numero(contrato.asignados)],
    ["Contratados", numero(contrato.cantidadContratada)],
    ["Consumidos", numero(contrato.consumidos)],
    ["Vencimiento", fechaDia(contrato.fechaVencimiento)],
  ];

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #0f172a;">
      <div style="background: #0f766e; padding: 24px; color: #ffffff; border-radius: 8px 8px 0 0;">
        <p style="margin: 0; font-size: 13px; opacity: 0.85;">Giganet · Control de folios</p>
        <h1 style="margin: 6px 0 0; font-size: 20px;">Folios disponibles bajo el mínimo</h1>
      </div>
      <div style="padding: 24px; background: #f8fafc; border: 1px solid #e2e8f0; border-top: 0; border-radius: 0 0 8px 8px;">
        <p style="margin: 0 0 16px;">
          <strong>${escapeHtml(empresa.nombre)}</strong> tiene
          <strong>${escapeHtml(numero(disponible))}</strong> folios disponibles, en o por debajo del
          ${escapeHtml(pct)} % configurado.
        </p>
        <table style="width: 100%; border-collapse: collapse; background: #ffffff; border: 1px solid #e2e8f0;">
          ${filas
            .map(
              ([k, v]) => `
          <tr>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #64748b; width: 45%;">${escapeHtml(k)}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">${escapeHtml(v)}</td>
          </tr>`,
            )
            .join("")}
        </table>
        <p style="margin: 16px 0 0; padding: 12px; background: #fffbeb; border-left: 4px solid #f59e0b;">
          ${escapeHtml(accion)}
        </p>
        ${
          url
            ? `<p style="margin: 20px 0 0;"><a href="${escapeHtml(url)}" style="display: inline-block; background: #14b8a6; color: #ffffff; padding: 10px 16px; border-radius: 6px; text-decoration: none; font-weight: bold;">Abrir control de folios</a></p>`
            : ""
        }
      </div>
    </div>`;

  const textContent = [
    `Folios disponibles bajo el mínimo: ${empresa.nombre}`,
    ...filas.map(([k, v]) => `${k}: ${v}`),
    "",
    accion,
    url,
  ]
    .filter((l) => l !== undefined)
    .join("\n");

  return { subject, htmlContent, textContent };
}

/** Envía el email de alerta mínima; lanza si no hay destinatario o Brevo falla. */
export async function enviarEmailAlertaMinima(datos) {
  const to = destinatarioAlertasFolios();
  if (!to) throw new Error("No hay destinatario configurado (FOLIOS_ALERTAS_TO_EMAIL)");
  const email = construirEmailAlertaMinima(datos);
  await sendEmail({ to, ...email });
  return { to };
}
