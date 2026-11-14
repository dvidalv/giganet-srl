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
 * @param {import("mongoose").Document} intake
 * @param {{ email?: string }} [opts]
 */
export async function issueOrRotateAgentAccess(intake, opts = {}) {
  const email = String(opts.email || "").trim().toLowerCase().slice(0, 254);
  intake.agentToken = generateIntakeToken();
  intake.agentExpiresAt = intakeExpiresAt();
  if (email) intake.agentEmail = email;
  intake.agentSentAt = new Date();
  await intake.save();
  return intake;
}

/** Revoke agent link only (client token untouched). */
export async function revokeAgentAccess(intake) {
  intake.agentToken = "";
  intake.agentExpiresAt = new Date();
  await intake.save();
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
