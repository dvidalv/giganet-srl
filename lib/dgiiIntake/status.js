/**
 * Completion checklist for the DGII e-CF intake form.
 * Secrets are reported as filled when an encrypted payload exists (never decrypted here).
 */

export const INVOICE_SLOTS = [1, 2, 3, 4, 5];

export function buildCompletionStatus(doc = {}) {
  const empresa = doc.empresa || {};
  const rep = doc.representante || {};
  const files = doc.files || {};
  const secrets = doc.secrets || {};

  const fields = {
    empresaRnc: Boolean(String(empresa.rnc || "").trim()),
    empresaNombre: Boolean(String(empresa.nombre || "").trim()),
    empresaRazonSocial: Boolean(String(empresa.razonSocial || "").trim()),
    empresaTelefono: Boolean(String(empresa.telefono || "").trim()),
    empresaDireccion: Boolean(String(empresa.direccion || "").trim()),
    representanteNombre: Boolean(String(rep.nombre || "").trim()),
    representanteEmail: Boolean(String(rep.email || "").trim()),
    representanteTelefono: Boolean(String(rep.telefono || "").trim()),
    representanteDireccion: Boolean(String(rep.direccion || "").trim()),
    cedula: Boolean(files.cedula?.url),
    factura1: Boolean(files.factura1?.url),
    factura2: Boolean(files.factura2?.url),
    factura3: Boolean(files.factura3?.url),
    factura4: Boolean(files.factura4?.url),
    factura5: Boolean(files.factura5?.url),
    certificadoP12: Boolean(files.certificadoP12?.url),
    certPassword: Boolean(secrets.certPasswordEnc),
    dgiiPortalRnc: Boolean(secrets.dgiiPortalRncEnc),
    dgiiPortalPassword: Boolean(secrets.dgiiPortalPasswordEnc),
  };

  const entries = Object.entries(fields);
  const completed = entries.filter(([, ok]) => ok).length;
  const total = entries.length;
  const missing = entries.filter(([, ok]) => !ok).map(([key]) => key);

  return {
    fields,
    completed,
    total,
    missing,
    percent: total ? Math.round((completed / total) * 100) : 0,
    isComplete: missing.length === 0,
  };
}

export const FIELD_LABELS = {
  empresaRnc: "RNC de la empresa",
  empresaNombre: "Nombre de la empresa",
  empresaRazonSocial: "Razón social",
  empresaTelefono: "Teléfono de la empresa",
  empresaDireccion: "Dirección de la empresa",
  representanteNombre: "Nombre del representante legal",
  representanteEmail: "Correo del representante",
  representanteTelefono: "Teléfono del representante",
  representanteDireccion: "Dirección de residencia",
  cedula: "Cédula (archivo)",
  factura1: "Factura 1",
  factura2: "Factura 2",
  factura3: "Factura 3",
  factura4: "Factura 4",
  factura5: "Factura 5",
  certificadoP12: "Certificado P-12",
  certPassword: "Contraseña del certificado",
  dgiiPortalRnc: "RNC portal DGII",
  dgiiPortalPassword: "Contraseña portal DGII",
};
