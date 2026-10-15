import mongoose from "mongoose";

/**
 * Registro administrativo de una asignación parcial realizada manualmente en The Factory.
 * No dispara ninguna operación en The Factory.
 */
const folioAsignacionSchema = new mongoose.Schema(
  {
    empresa: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    contrato: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FolioContrato",
      required: true,
      index: true,
    },
    fecha: {
      type: String,
      required: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, "Fecha de asignación inválida (YYYY-MM-DD)"],
    },
    cantidad: {
      type: Number,
      required: true,
      min: [1, "La cantidad asignada debe ser mayor a 0"],
      validate: {
        validator: Number.isInteger,
        message: "La cantidad asignada debe ser un entero",
      },
    },
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    adminEmail: { type: String, default: "" },
    observaciones: { type: String, default: "", maxlength: 500 },
  },
  { timestamps: true, collection: "folios_asignaciones" },
);

const FolioAsignacion =
  mongoose.models.FolioAsignacion ||
  mongoose.model("FolioAsignacion", folioAsignacionSchema);

export default FolioAsignacion;
