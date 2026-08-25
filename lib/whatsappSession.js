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
    ncf: { type: String, default: "" },
    /** Último NCF mencionado (se conserva entre turnos de explicar error). */
    lastNcf: { type: String, default: "" },
    lastRnc: { type: String, default: "" },
    updatedAt: { type: Date, default: Date.now },
  },
  { collection: "whatsapp_sessions" },
);

const WhatsAppSession =
  models.WhatsAppSession || model("WhatsAppSession", whatsappSessionSchema);

/**
 * @param {string} phone
 * @returns {Promise<{ phone: string, intent: string, step: string, rnc: string, ncf: string, lastNcf: string, lastRnc: string } | null>}
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
    ncf: doc.ncf || "",
    lastNcf: doc.lastNcf || "",
    lastRnc: doc.lastRnc || "",
  };
}

/**
 * @param {string} phone
 * @param {{ intent?: string, step?: string, rnc?: string, ncf?: string, lastNcf?: string, lastRnc?: string }} data
 */
export async function setWhatsAppSession(phone, data) {
  await ensureConnection();

  /** @type {Record<string, unknown>} */
  const $set = {
    intent: data.intent ?? "",
    step: data.step ?? "",
    rnc: data.rnc ?? "",
    ncf: data.ncf ?? "",
    updatedAt: new Date(),
  };

  // lastNcf / lastRnc solo se tocan si el caller los envía (así no se pierden)
  if (data.lastNcf !== undefined) $set.lastNcf = data.lastNcf ?? "";
  if (data.lastRnc !== undefined) $set.lastRnc = data.lastRnc ?? "";

  await WhatsAppSession.findOneAndUpdate(
    { phone: String(phone) },
    { $set },
    { upsert: true, new: true },
  );
}

/**
 * Actualiza solo el contexto recordado (NCF/RNC) sin cambiar el flujo.
 * @param {string} phone
 * @param {{ lastNcf?: string, lastRnc?: string }} data
 */
export async function touchWhatsAppContext(phone, data) {
  await ensureConnection();
  /** @type {Record<string, unknown>} */
  const $set = { updatedAt: new Date() };
  if (data.lastNcf !== undefined) $set.lastNcf = data.lastNcf ?? "";
  if (data.lastRnc !== undefined) $set.lastRnc = data.lastRnc ?? "";

  await WhatsAppSession.findOneAndUpdate(
    { phone: String(phone) },
    { $set },
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
