import mongoose from "mongoose";

/** Historial de auditoría de toda acción administrativa sobre folios. */
const folioAuditoriaSchema = new mongoose.Schema(
  {
    accion: { type: String, required: true },
    empresa: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    contrato: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FolioContrato",
      default: null,
      index: true,
    },
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    adminEmail: { type: String, default: "" },
    antes: { type: mongoose.Schema.Types.Mixed, default: null },
    despues: { type: mongoose.Schema.Types.Mixed, default: null },
    motivo: { type: String, default: "" },
  },
  { timestamps: true, collection: "folios_auditoria" },
);

folioAuditoriaSchema.index({ empresa: 1, createdAt: -1 });

const FolioAuditoria =
  mongoose.models.FolioAuditoria ||
  mongoose.model("FolioAuditoria", folioAuditoriaSchema);

export default FolioAuditoria;
