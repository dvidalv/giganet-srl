import { Schema, model, models, Types } from "mongoose";
import { connectDB } from "@/lib/mongoDB";

let connectionPromise = null;

const ensureConnection = async () => {
  const mongoose = await import("mongoose");
  if (mongoose.default.connection.readyState === 1) {
    return;
  }
  if (!connectionPromise) {
    connectionPromise = connectDB();
  }
  await connectionPromise;
};

const fileMetaSchema = new Schema(
  {
    url: { type: String, default: "" },
    publicId: { type: String, default: "" },
    originalName: { type: String, default: "" },
    mimeType: { type: String, default: "" },
    bytes: { type: Number, default: 0 },
    uploadedAt: { type: Date, default: null },
  },
  { _id: false }
);

const dgiiIntakeSchema = new Schema(
  {
    userId: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["open", "submitted", "complete", "expired"],
      default: "open",
      index: true,
    },
    completedAt: { type: Date, default: null },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    clientEmail: { type: String, default: "", maxlength: 254 },
    clientName: { type: String, default: "", maxlength: 120 },
    empresa: {
      rnc: { type: String, default: "", maxlength: 11 },
      nombre: { type: String, default: "", maxlength: 200 },
      telefono: { type: String, default: "", maxlength: 32 },
      direccion: { type: String, default: "", maxlength: 400 },
    },
    representante: {
      nombre: { type: String, default: "", maxlength: 120 },
      email: { type: String, default: "", maxlength: 254 },
      telefono: { type: String, default: "", maxlength: 32 },
      direccion: { type: String, default: "", maxlength: 400 },
    },
    files: {
      cedula: { type: fileMetaSchema, default: () => ({}) },
      factura1: { type: fileMetaSchema, default: () => ({}) },
      factura2: { type: fileMetaSchema, default: () => ({}) },
      factura3: { type: fileMetaSchema, default: () => ({}) },
      factura4: { type: fileMetaSchema, default: () => ({}) },
      factura5: { type: fileMetaSchema, default: () => ({}) },
      certificadoP12: { type: fileMetaSchema, default: () => ({}) },
    },
    /** Encrypted at rest — never returned decrypted to the client */
    secrets: {
      certPasswordEnc: { type: String, default: "" },
      dgiiPortalRncEnc: { type: String, default: "" },
      dgiiPortalPasswordEnc: { type: String, default: "" },
    },
    lastSavedAt: { type: Date, default: null },
    lastNotifiedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    collection: "dgii_intakes",
  }
);

const DgiiIntake = models.DgiiIntake || model("DgiiIntake", dgiiIntakeSchema);

if (!DgiiIntake._connectionWrapped) {
  DgiiIntake._connectionWrapped = true;

  const wrap =
    (original) =>
    async function (...args) {
      await ensureConnection();
      return original.apply(this, args);
    };

  const wrapQuery = (original) =>
    function (...args) {
      const query = original.apply(this, args);
      const originalExec = query.exec.bind(query);
      query.exec = async function (...execArgs) {
        await ensureConnection();
        return originalExec(...execArgs);
      };
      const originalThen = query.then?.bind(query);
      if (originalThen) {
        query.then = async function (...thenArgs) {
          await ensureConnection();
          return originalThen(...thenArgs);
        };
      }
      return query;
    };

  DgiiIntake.create = wrap(DgiiIntake.create.bind(DgiiIntake));
  DgiiIntake.find = wrapQuery(DgiiIntake.find.bind(DgiiIntake));
  DgiiIntake.findOne = wrapQuery(DgiiIntake.findOne.bind(DgiiIntake));
  DgiiIntake.findById = wrapQuery(DgiiIntake.findById.bind(DgiiIntake));
  DgiiIntake.findOneAndUpdate = wrapQuery(
    DgiiIntake.findOneAndUpdate.bind(DgiiIntake)
  );
  DgiiIntake.countDocuments = wrap(
    DgiiIntake.countDocuments.bind(DgiiIntake)
  );
}

export default DgiiIntake;
