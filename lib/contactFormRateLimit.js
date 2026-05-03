import crypto from "crypto";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongoDB";

const WINDOW_MS = 60 * 60 * 1000;
export const CONTACT_SUBMISSIONS_PER_HOUR = 5;
const TTL_SECONDS = 48 * 60 * 60;

const contactRateSchema = new mongoose.Schema({
  ipHash: { type: String, required: true, index: true },
  createdAt: { type: Date, default: Date.now },
});

contactRateSchema.index({ createdAt: 1 }, { expireAfterSeconds: TTL_SECONDS });

const ContactRateLimit =
  mongoose.models.ContactRateLimit ||
  mongoose.model(
    "ContactRateLimit",
    contactRateSchema,
    "contact_form_rate_limits"
  );

function hashIp(ip) {
  const salt =
    process.env.CONTACT_RATE_LIMIT_SALT || "giganet-contact-form-salt";
  return crypto.createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

/**
 * Throws if the client exceeded submissions per hour.
 * Fails open if MongoDB is unavailable (contact form still works).
 * @param {string} clientIp
 */
export async function assertContactFormRateLimit(clientIp) {
  if (!clientIp) {
    return;
  }

  await connectDB();
  if (mongoose.connection.readyState !== 1) {
    console.error(
      "[contact form] Rate limit omitido: MongoDB no está conectado."
    );
    return;
  }

  const ipHash = hashIp(clientIp);
  const since = new Date(Date.now() - WINDOW_MS);
  const count = await ContactRateLimit.countDocuments({
    ipHash,
    createdAt: { $gte: since },
  });

  if (count >= CONTACT_SUBMISSIONS_PER_HOUR) {
    const err = new Error("CONTACT_RATE_LIMIT");
    err.code = "CONTACT_RATE_LIMIT";
    throw err;
  }

  await ContactRateLimit.create({ ipHash });
}
