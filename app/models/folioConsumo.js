import mongoose from "mongoose";

/**
 * Consumo de un folio por e-NCF. El índice único {empresa, ncf, ambiente} garantiza
 * que reintentos (secuenciales o simultáneos) del mismo comprobante se cuenten una sola vez.
 * - reservado: el envío está en curso (o terminó sin respuesta y espera reconciliación).
 * - confirmado: cuenta como folio consumido.
 * - liberado: no llegó a The Factory; la reserva se devolvió al contrato.
 */
const folioConsumoSchema = new mongoose.Schema(
  {
    empresa: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    contrato: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FolioContrato",
      default: null,
      index: true,
    },
    ncf: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    tipoComprobante: { type: String, default: "" },
    ambiente: {
      type: String,
      enum: ["demo", "production"],
      default: "production",
    },
    estado: {
      type: String,
      enum: ["reservado", "confirmado", "liberado"],
      required: true,
      index: true,
    },
    intentos: { type: Number, default: 1 },
    pendienteVerificacion: { type: Boolean, default: false },
    resultado: { type: String, default: "" },
    codigoRespuesta: { type: mongoose.Schema.Types.Mixed, default: null },
    motivoLiberacion: { type: String, default: "" },
    reservadoEn: { type: Date, default: null },
    confirmadoEn: { type: Date, default: null },
    liberadoEn: { type: Date, default: null },
    ultimoIntentoEn: { type: Date, default: null },
  },
  { timestamps: true, collection: "folios_consumos" },
);

folioConsumoSchema.index({ empresa: 1, ncf: 1, ambiente: 1 }, { unique: true });
folioConsumoSchema.index({ estado: 1, reservadoEn: 1 });

const FolioConsumo =
  mongoose.models.FolioConsumo ||
  mongoose.model("FolioConsumo", folioConsumoSchema);

export default FolioConsumo;
