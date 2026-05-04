import crypto from "crypto";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongoDB";

const WINDOW_MS = 60 * 60 * 1000;
export const ENCUESTA_SUBMISSIONS_PER_HOUR = 10;
const TTL_SECONDS = 48 * 60 * 60;

const encuestaRateSchema = new mongoose.Schema({
  ipHash: { type: String, required: true, index: true },
  createdAt: { type: Date, default: Date.now },
});

encuestaRateSchema.index({ createdAt: 1 }, { expireAfterSeconds: TTL_SECONDS });

const EncuestaRateLimit =
  mongoose.models.EncuestaRateLimit ||
  mongoose.model(
    "EncuestaRateLimit",
    encuestaRateSchema,
    "encuesta_form_rate_limits"
  );

function hashIp(ip) {
  const salt =
    process.env.ENCUESTA_RATE_LIMIT_SALT || "giganet-encuesta-form-salt";
  return crypto.createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

/**
 * Throws if the client exceeded submissions per hour.
 * @param {string} clientIp
 */
export async function assertEncuestaFormRateLimit(clientIp) {
  if (!clientIp) {
    return;
  }

  await connectDB();
  if (mongoose.connection.readyState !== 1) {
    console.error(
      "[encuesta] Rate limit omitido: MongoDB no está conectado."
    );
    return;
  }

  const ipHash = hashIp(clientIp);
  const since = new Date(Date.now() - WINDOW_MS);
  const count = await EncuestaRateLimit.countDocuments({
    ipHash,
    createdAt: { $gte: since },
  });

  if (count >= ENCUESTA_SUBMISSIONS_PER_HOUR) {
    const err = new Error("ENCUESTA_RATE_LIMIT");
    err.code = "ENCUESTA_RATE_LIMIT";
    throw err;
  }

  await EncuestaRateLimit.create({ ipHash });
}

export function hashResponderIp(ip) {
  return hashIp(ip || "unknown");
}
