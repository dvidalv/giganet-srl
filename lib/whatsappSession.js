import { Schema, models, model } from "mongoose";
import { connectDB } from "@/lib/mongoDB";

const SESSION_TTL_MS = 15 * 60 * 1000;

let connectionPromise = null;

async function ensureConnection() {
  const mongoose = await import("mongoose");
  if (mongoose.default.connection.readyState === 1) return;
  if (!connectionPromise) connectionPromise = connectDB();
  await connectionPromise;
}

const whatsappSessionSchema = new Schema(
  {
    phone: { type: String, required: true, unique: true, index: true },
    intent: { type: String, default: "" },
    step: { type: String, default: "" },
    rnc: { type: String, default: "" },
    updatedAt: { type: Date, default: Date.now },
  },
  { collection: "whatsapp_sessions" },
);

const WhatsAppSession =
  models.WhatsAppSession || model("WhatsAppSession", whatsappSessionSchema);

/**
 * @param {string} phone
 * @returns {Promise<{ phone: string, intent: string, step: string, rnc: string } | null>}
 */
export async function getWhatsAppSession(phone) {
  await ensureConnection();
  const doc = await WhatsAppSession.findOne({ phone: String(phone) }).lean();
  if (!doc) return null;

  const age = Date.now() - new Date(doc.updatedAt).getTime();
  if (age > SESSION_TTL_MS) {
    await WhatsAppSession.deleteOne({ phone: String(phone) });
    return null;
  }

  return {
    phone: doc.phone,
    intent: doc.intent || "",
    step: doc.step || "",
    rnc: doc.rnc || "",
  };
}

/**
 * @param {string} phone
 * @param {{ intent?: string, step?: string, rnc?: string }} data
 */
export async function setWhatsAppSession(phone, data) {
  await ensureConnection();
  await WhatsAppSession.findOneAndUpdate(
    { phone: String(phone) },
    {
      $set: {
        intent: data.intent ?? "",
        step: data.step ?? "",
        rnc: data.rnc ?? "",
        updatedAt: new Date(),
      },
    },
    { upsert: true, new: true },
  );
}

/**
 * @param {string} phone
 */
export async function clearWhatsAppSession(phone) {
  await ensureConnection();
  await WhatsAppSession.deleteOne({ phone: String(phone) });
}
