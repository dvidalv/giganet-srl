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

const answersSchema = new Schema(
  {
    nps: { type: Number, min: 0, max: 10 },
    satisfaccionGeneral: { type: Number, min: 1, max: 5 },
    facilidadIntegracion: { type: Number, min: 1, max: 5 },
    calidadSoporte: { type: Number, min: 1, max: 5 },
    tiempoRespuesta: { type: Number, min: 1, max: 5 },
    loQueMasGusta: { type: String, default: "", maxlength: 1000 },
    loQueMejorar: { type: String, default: "", maxlength: 1000 },
    comentarios: { type: String, default: "", maxlength: 2000 },
    /** Paso 1 opcional (quien responde) */
    nombreRespondiente: { type: String, default: "", maxlength: 120 },
    emailRespondiente: { type: String, default: "", maxlength: 254 },
    referenciaServicio: { type: String, default: "", maxlength: 200 },
  },
  { _id: false }
);

const encuestaSchema = new Schema(
  {
    userId: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    empresa: {
      rnc: { type: String, default: "" },
      razonSocial: { type: String, default: "" },
      nombre: { type: String, default: "" },
      email: { type: String, default: "" },
    },
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "responded", "expired"],
      default: "pending",
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    sentAt: { type: Date, default: null },
    respondedAt: { type: Date, default: null },
    responderIpHash: { type: String, default: "" },
    answers: { type: answersSchema, default: undefined },
  },
  {
    timestamps: true,
    collection: "encuestas",
  }
);

const Encuesta = models.Encuesta || model("Encuesta", encuestaSchema);

if (!Encuesta._connectionWrapped) {
  Encuesta._connectionWrapped = true;

  const originalCreate = Encuesta.create.bind(Encuesta);
  const originalFind = Encuesta.find.bind(Encuesta);
  const originalFindOne = Encuesta.findOne.bind(Encuesta);
  const originalFindById = Encuesta.findById.bind(Encuesta);
  const originalFindOneAndUpdate = Encuesta.findOneAndUpdate.bind(Encuesta);
  const originalDeleteOne = Encuesta.deleteOne.bind(Encuesta);
  const originalCountDocuments = Encuesta.countDocuments.bind(Encuesta);

  Encuesta.create = async function (...args) {
    await ensureConnection();
    return originalCreate(...args);
  };

  Encuesta.find = function (...args) {
    const query = originalFind(...args);
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

  Encuesta.findOne = function (...args) {
    const query = originalFindOne(...args);
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

  Encuesta.findById = function (...args) {
    const query = originalFindById(...args);
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

  Encuesta.findOneAndUpdate = async function (...args) {
    await ensureConnection();
    return originalFindOneAndUpdate(...args);
  };

  Encuesta.deleteOne = async function (...args) {
    await ensureConnection();
    return originalDeleteOne(...args);
  };

  Encuesta.countDocuments = function (...args) {
    const query = originalCountDocuments(...args);
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
}

export default Encuesta;
