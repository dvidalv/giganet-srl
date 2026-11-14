import { buildCompletionStatus } from "@/lib/dgiiIntake/status";
import {
  decryptDgiiSecret,
  hasEncryptedSecret,
} from "@/lib/dgiiIntake/crypto";
import { DGII_FILE_SLOTS } from "@/lib/dgiiIntake/fileSlots";
import {
  buildAgentPublicUrl,
  buildIntakePublicUrl,
  resolveDgiiIntakePublicBaseUrl,
} from "@/lib/dgiiIntake/urls";

export { DGII_FILE_SLOTS };

function fileSummary(meta) {
  if (!meta?.url && !meta?.publicId) return null;
  return {
    originalName: meta.originalName || "",
    mimeType: meta.mimeType || "",
    bytes: meta.bytes || 0,
    uploadedAt: meta.uploadedAt || null,
    publicId: meta.publicId || "",
    hasFile: Boolean(meta.publicId || meta.url),
  };
}

function tryDecryptSecret(enc) {
  if (!hasEncryptedSecret(enc)) return null;
  try {
    return decryptDgiiSecret(enc);
  } catch (err) {
    console.error("DGII secret decrypt failed:", err?.message || err);
    return null;
  }
}

/**
 * Decrypt intake secrets for The Factory agent view only.
 * Never call from admin or client form serializers.
 */
export function decryptSecretsForAgent(doc) {
  const plain = typeof doc.toObject === "function" ? doc.toObject() : doc;
  const secrets = plain.secrets || {};
  return {
    certPassword: tryDecryptSecret(secrets.certPasswordEnc),
    dgiiPortalRnc: tryDecryptSecret(secrets.dgiiPortalRncEnc),
    dgiiPortalPassword: tryDecryptSecret(secrets.dgiiPortalPasswordEnc),
  };
}

/**
 * Safe view payload for admin detail (no decrypted secrets).
 * @param {object} doc - lean or toObject intake
 * @param {string} [baseUrl]
 */
export function buildIntakeViewPayload(doc, baseUrl = "") {
  const plain = typeof doc.toObject === "function" ? doc.toObject() : doc;
  const root = resolveDgiiIntakePublicBaseUrl(baseUrl);
  const secrets = plain.secrets || {};
  const frente =
    plain.files?.cedulaFrente?.url || plain.files?.cedulaFrente?.publicId
      ? plain.files.cedulaFrente
      : plain.files?.cedula;

  const agentToken = String(plain.agentToken || "");
  const agentExpiresAt = plain.agentExpiresAt || null;
  const agentActive =
    Boolean(agentToken) &&
    agentExpiresAt &&
    new Date(agentExpiresAt) > new Date();

  return {
    id: String(plain._id),
    userId: String(plain.userId),
    clientName: plain.clientName || "",
    clientEmail: plain.clientEmail || "",
    status: plain.status,
    createdAt: plain.createdAt,
    expiresAt: plain.expiresAt,
    completedAt: plain.completedAt,
    lastSavedAt: plain.lastSavedAt,
    url: buildIntakePublicUrl(root, plain.token),
    token: plain.token,
    agentUrl: agentActive ? buildAgentPublicUrl(root, agentToken) : "",
    agentExpiresAt,
    agentEmail: plain.agentEmail || "",
    agentSentAt: plain.agentSentAt || null,
    agentActive,
    empresa: plain.empresa || {},
    representante: plain.representante || {},
    files: {
      cedula: fileSummary(plain.files?.cedula),
      cedulaFrente: fileSummary(frente),
      cedulaReverso: fileSummary(plain.files?.cedulaReverso),
      factura1: fileSummary(plain.files?.factura1),
      factura2: fileSummary(plain.files?.factura2),
      factura3: fileSummary(plain.files?.factura3),
      factura4: fileSummary(plain.files?.factura4),
      factura5: fileSummary(plain.files?.factura5),
      certificadoP12: fileSummary(plain.files?.certificadoP12),
    },
    secretsStatus: {
      certPassword: hasEncryptedSecret(secrets.certPasswordEnc),
      dgiiPortalRnc: hasEncryptedSecret(secrets.dgiiPortalRncEnc),
      dgiiPortalPassword: hasEncryptedSecret(secrets.dgiiPortalPasswordEnc),
    },
    completion: buildCompletionStatus(plain),
  };
}

/**
 * Agent-only payload: same as safe view + decrypted secret values.
 * Must only be returned from the agentToken-gated API.
 */
export function buildAgentIntakeViewPayload(doc, baseUrl = "") {
  return {
    ...buildIntakeViewPayload(doc, baseUrl),
    secretsReveal: decryptSecretsForAgent(doc),
  };
}
