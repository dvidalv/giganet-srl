import { buildCompletionStatus } from "@/lib/dgiiIntake/status";
import { hasEncryptedSecret } from "@/lib/dgiiIntake/crypto";

function filePublic(meta) {
  if (!meta?.url) return { uploaded: false };
  return {
    uploaded: true,
    originalName: meta.originalName || "",
    mimeType: meta.mimeType || "",
    bytes: meta.bytes || 0,
    uploadedAt: meta.uploadedAt || null,
    // Authenticated Cloudinary URLs may still work for the uploader session;
    // expose only for preview of images when present.
    url: meta.url || "",
  };
}

/**
 * Safe client payload: never returns decrypted passwords.
 */
export function serializeIntakeForClient(doc) {
  const plain = typeof doc.toObject === "function" ? doc.toObject() : doc;
  const secrets = plain.secrets || {};
  const completion = buildCompletionStatus({
    ...plain,
    secrets: {
      certPasswordEnc: secrets.certPasswordEnc,
      dgiiPortalRncEnc: secrets.dgiiPortalRncEnc,
      dgiiPortalPasswordEnc: secrets.dgiiPortalPasswordEnc,
    },
  });

  return {
    id: String(plain._id),
    status: plain.status,
    expiresAt: plain.expiresAt,
    clientName: plain.clientName || "",
    clientEmail: plain.clientEmail || "",
    empresa: {
      rnc: plain.empresa?.rnc || "",
      nombre: plain.empresa?.nombre || "",
      telefono: plain.empresa?.telefono || "",
      direccion: plain.empresa?.direccion || "",
    },
    representante: {
      nombre: plain.representante?.nombre || "",
      email: plain.representante?.email || "",
      telefono: plain.representante?.telefono || "",
      direccion: plain.representante?.direccion || "",
    },
    files: {
      cedula: filePublic(plain.files?.cedula),
      factura1: filePublic(plain.files?.factura1),
      factura2: filePublic(plain.files?.factura2),
      factura3: filePublic(plain.files?.factura3),
      factura4: filePublic(plain.files?.factura4),
      factura5: filePublic(plain.files?.factura5),
      certificadoP12: filePublic(plain.files?.certificadoP12),
    },
    secretsStatus: {
      certPassword: hasEncryptedSecret(secrets.certPasswordEnc),
      dgiiPortalRnc: hasEncryptedSecret(secrets.dgiiPortalRncEnc),
      dgiiPortalPassword: hasEncryptedSecret(secrets.dgiiPortalPasswordEnc),
    },
    completion,
    lastSavedAt: plain.lastSavedAt || null,
  };
}
