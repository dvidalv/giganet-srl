import crypto from "crypto";
import DgiiIntake from "@/app/models/dgiiIntake";
import User from "@/app/models/user";

const TOKEN_BYTES = 32;
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function generateIntakeToken() {
  return crypto.randomBytes(TOKEN_BYTES).toString("hex");
}

export function intakeExpiresAt(from = new Date()) {
  return new Date(from.getTime() + TTL_MS);
}

/**
 * Public site origin for client-facing DGII intake links.
 * Prefer NEXT_PUBLIC_APP_URL, then APP_URL; NEXTAUTH_URL only as last env fallback (auth stays separate).
 */
export function resolveDgiiIntakePublicBaseUrl(fallback = "") {
  const fromEnv = (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.NEXTAUTH_URL ||
    ""
  ).replace(/\/$/, "");
  return fromEnv || String(fallback || "").replace(/\/$/, "");
}

export function buildIntakePublicUrl(baseUrl, token) {
  const root = resolveDgiiIntakePublicBaseUrl(baseUrl);
  return `${root}/dgii-intake/${token}`;
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
