/**
 * Completion checklist for the DGII e-CF intake form.
 * Secrets are reported as filled when an encrypted payload exists (never decrypted here).
 */

import { hasEncryptedSecret } from "@/lib/dgiiIntake/crypto";

export const INVOICE_SLOTS = [1, 2, 3, 4, 5];

function filePresent(meta) {
  if (!meta) return false;
  const plain =
    typeof meta.toObject === "function" ? meta.toObject() : meta;
  return Boolean(
    String(plain.url || "").trim() || String(plain.publicId || "").trim(),
  );
}

export function buildCompletionStatus(doc = {}) {
  const plain = typeof doc.toObject === "function" ? doc.toObject() : doc;
  const empresa = plain.empresa || {};
  const rep = plain.representante || {};
  const files = plain.files || {};
  const secrets = plain.secrets || {};

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
    // Frente: new slot or legacy single `cedula` upload
    cedulaFrente: filePresent(files.cedulaFrente) || filePresent(files.cedula),
    cedulaReverso: filePresent(files.cedulaReverso),
    factura1: filePresent(files.factura1),
    factura2: filePresent(files.factura2),
    factura3: filePresent(files.factura3),
    factura4: filePresent(files.factura4),
    factura5: filePresent(files.factura5),
    certificadoP12: filePresent(files.certificadoP12),
    certPassword: hasEncryptedSecret(secrets.certPasswordEnc),
    dgiiPortalRnc: hasEncryptedSecret(secrets.dgiiPortalRncEnc),
    dgiiPortalPassword: hasEncryptedSecret(secrets.dgiiPortalPasswordEnc),
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
  cedulaFrente: "Cédula — anverso",
  cedulaReverso: "Cédula — reverso",
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
