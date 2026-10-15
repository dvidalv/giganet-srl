import mongoose from "mongoose";

const DIA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Contrato comercial de folios e-CF vendido por Giganet a una empresa.
 * Las fechas son días calendario de República Dominicana (YYYY-MM-DD): la empresa
 * emite durante todo `fechaVencimiento` y queda bloqueada desde las 00:00 del día siguiente.
 * Los contadores están desnormalizados para la reserva atómica y se pueden recalcular
 * desde `folios_asignaciones` y `folios_consumos`.
 */
const folioContratoSchema = new mongoose.Schema(
  {
    codigo: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    empresa: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    cantidadContratada: {
      type: Number,
      required: [true, "La cantidad contratada es requerida"],
      min: [1, "La cantidad contratada debe ser mayor a 0"],
      validate: {
        validator: Number.isInteger,
        message: "La cantidad contratada debe ser un entero",
      },
    },
    fechaInicio: {
      type: String,
      required: [true, "La fecha de inicio es requerida"],
      match: [DIA_REGEX, "Fecha de inicio inválida (YYYY-MM-DD)"],
    },
    fechaVencimiento: {
      type: String,
      required: [true, "La fecha de vencimiento es requerida"],
      match: [DIA_REGEX, "Fecha de vencimiento inválida (YYYY-MM-DD)"],
    },
    asignados: { type: Number, default: 0, min: 0 },
    consumidos: { type: Number, default: 0, min: 0 },
    reservados: { type: Number, default: 0, min: 0 },
    /** Folios emitidos antes de activar el control (empresas que ya venían emitiendo); incluido en `consumidos`. */
    consumoPrevio: { type: Number, default: 0, min: 0 },
    /** Suma de ajustes administrativos de consumo (incluida en `consumidos`). */
    ajusteConsumo: { type: Number, default: 0 },
    estado: {
      type: String,
      enum: ["activo", "cancelado"],
      default: "activo",
    },
    motivoCancelacion: { type: String, default: "", maxlength: 500 },
    renovacionDe: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FolioContrato",
      default: null,
    },
    /** Saldo informado por The Factory (registro manual; no es el consumo interno calculado). */
    saldoTheFactory: {
      cantidad: { type: Number, default: null },
      fecha: { type: Date, default: null },
      nota: { type: String, default: "", maxlength: 500 },
    },
    observaciones: { type: String, default: "", maxlength: 1000 },
    creadoPor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true, collection: "folios_contratos" },
);

folioContratoSchema.index({ empresa: 1, estado: 1, fechaVencimiento: 1 });

const FolioContrato =
  mongoose.models.FolioContrato ||
  mongoose.model("FolioContrato", folioContratoSchema);

export default FolioContrato;
