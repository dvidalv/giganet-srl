import mongoose from "mongoose";

export const TIPOS_ALERTA_FOLIOS = [
  "VENCE_30",
  "VENCE_15",
  "VENCE_7",
  "VENCIDO",
  "CONSUMO_80",
  "CONSUMO_100",
  "MINIMO",
];

/** Alerta administrativa de folios. Una sola por contrato y tipo (sin duplicados). */
const folioAlertaSchema = new mongoose.Schema(
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
    },
    tipo: {
      type: String,
      enum: TIPOS_ALERTA_FOLIOS,
      required: true,
    },
    mensaje: { type: String, default: "" },
    /** Solo alertas que notifican por email (MINIMO). */
    emailEnviadoEn: { type: Date, default: null },
    emailError: { type: String, default: "" },
    emailIntentos: { type: Number, default: 0 },
    atendida: { type: Boolean, default: false, index: true },
    atendidaEn: { type: Date, default: null },
    atendidaPor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true, collection: "folios_alertas" },
);

folioAlertaSchema.index({ contrato: 1, tipo: 1 }, { unique: true });

const FolioAlerta =
  mongoose.models.FolioAlerta || mongoose.model("FolioAlerta", folioAlertaSchema);

export default FolioAlerta;
