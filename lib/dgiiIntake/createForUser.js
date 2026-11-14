import crypto from "crypto";
import DgiiIntake from "@/app/models/dgiiIntake";
import User from "@/app/models/user";
export {
  buildAgentPublicUrl,
  buildIntakePublicUrl,
  resolveDgiiIntakePublicBaseUrl,
} from "@/lib/dgiiIntake/urls";

const TOKEN_BYTES = 32;
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function generateIntakeToken() {
  return crypto.randomBytes(TOKEN_BYTES).toString("hex");
}

export function intakeExpiresAt(from = new Date()) {
  return new Date(from.getTime() + TTL_MS);
}

/**
 * Issue or rotate a 30-day The Factory agent link (does not touch client token).
 * Uses atomic $set + reload so the token is actually in Mongo (document.save()
 * can silently drop paths if a stale Mongoose model was cached without them).
 * @param {import("mongoose").Document} intake
 * @param {{ email?: string }} [opts]
 */
export async function issueOrRotateAgentAccess(intake, opts = {}) {
  const email = String(opts.email || "").trim().toLowerCase().slice(0, 254);
  const id = intake._id || intake.id;
  if (!id) throw new Error("intake id is required");

  const agentToken = generateIntakeToken();
  const agentExpiresAt = intakeExpiresAt();
  const agentSentAt = new Date();
  const $set = {
    agentToken,
    agentExpiresAt,
    agentSentAt,
    updatedAt: new Date(),
  };
  if (email) $set.agentEmail = email;

  // Ensure mongoose connection, then write/read via the native collection so a
  // stale compiled schema (HMR) cannot strip agent* paths under strict mode.
  await DgiiIntake.findById(id).select("_id").lean();
  const result = await DgiiIntake.collection.updateOne({ _id: id }, { $set });
  if (result.matchedCount !== 1) {
    throw new Error("No se pudo guardar el acceso de agente");
  }

  const verified = await DgiiIntake.collection.findOne(
    { _id: id },
    {
      projection: {
        agentToken: 1,
        agentExpiresAt: 1,
        agentEmail: 1,
        agentSentAt: 1,
      },
    }
  );
  if (!verified?.agentToken || verified.agentToken !== agentToken) {
    throw new Error("El token de agente no se persistió en la base de datos");
  }

  intake.agentToken = verified.agentToken;
  intake.agentExpiresAt = verified.agentExpiresAt;
  intake.agentEmail = verified.agentEmail || email;
  intake.agentSentAt = verified.agentSentAt;
  return intake;
}

/** Revoke agent link only (client token untouched). */
export async function revokeAgentAccess(intake) {
  const id = intake._id || intake.id;
  if (!id) throw new Error("intake id is required");

  const agentExpiresAt = new Date();
  await DgiiIntake.findById(id).select("_id").lean();
  await DgiiIntake.collection.updateOne(
    { _id: id },
    { $set: { agentToken: "", agentExpiresAt, updatedAt: new Date() } }
  );

  intake.agentToken = "";
  intake.agentExpiresAt = agentExpiresAt;
  return intake;
}

/**
 * Create a new 30-day intake link for a user, or rotate an existing active one.
 * @param {{ userId: string, clientEmail?: string, clientName?: string, regenerate?: boolean }} opts
 */
export async function createOrRotateIntakeForUser({
  userId,
  clientEmail = "",
  clientName = "",
  regenerate = false,
}) {
  if (!userId) throw new Error("userId is required");

  const existing = await DgiiIntake.findOne({ userId }).sort({ createdAt: -1 });

  if (existing && !regenerate) {
    const stillValid =
      existing.expiresAt && new Date(existing.expiresAt) > new Date();
    if (stillValid) {
      return existing;
    }
  }

  const token = generateIntakeToken();
  const expiresAt = intakeExpiresAt();

  const user = await User.findById(userId)
    .select("empresa.rnc empresa.nombre empresa.razonSocial empresa.telefono empresa.direccion")
    .lean();
  const emp = user?.empresa || {};
  const empresaSeed = {
    rnc: String(emp.rnc || "")
      .replace(/\D/g, "")
      .slice(0, 11),
    nombre: String(emp.nombre || "").trim().slice(0, 200),
    razonSocial: String(emp.razonSocial || "").trim().slice(0, 200),
    telefono: String(emp.telefono || "").trim().slice(0, 32),
    direccion: String(emp.direccion || "").trim().slice(0, 400),
  };

  if (existing && regenerate) {
    existing.token = token;
    existing.expiresAt = expiresAt;
    existing.status = "open";
    if (clientEmail) existing.clientEmail = clientEmail;
    if (clientName) existing.clientName = clientName;
    await existing.save();
    return existing;
  }

  return DgiiIntake.create({
    userId,
    token,
    expiresAt,
    status: "open",
    clientEmail: clientEmail || "",
    clientName: clientName || "",
    empresa: empresaSeed,
  });
}
