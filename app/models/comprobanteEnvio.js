import mongoose from 'mongoose';
import { connectDB } from '@/lib/mongoDB';

let connectionPromise = null;

const ensureConnection = async () => {
  const mongooseModule = await import('mongoose');
  if (mongooseModule.default.connection.readyState === 1) {
    return;
  }
  if (!connectionPromise) {
    connectionPromise = connectDB();
  }
  await connectionPromise;
};

/**
 * Schema para registrar envíos de comprobantes electrónicos (e-CF) a TheFactoryHKA/DGII.
 * Guarda tanto envíos exitosos como fallidos para poder analizar errores.
 */
const comprobanteEnvioSchema = new mongoose.Schema({
  // Identificación del comprobante
  ncf: {
    type: String,
    required: true,
    index: true,
    uppercase: true,
    trim: true,
  },
  rnc: {
    type: String,
    required: true,
    index: true,
    validate: {
      validator: function (v) {
        return /^\d{9,11}$/.test(v);
      },
      message: 'El RNC debe contener solo números de 9 a 11 dígitos',
    },
  },
  tipoComprobante: {
    type: String,
    required: true,
    enum: ['31', '32', '33', '34', '41', '43', '44', '45', '46', '47'],
  },

  // Resultado del envío
  exitoso: {
    type: Boolean,
    required: true,
    default: false,
  },
  codigoRespuesta: {
    type: Number,
    required: false,
  },
  mensajeRespuesta: {
    type: String,
    required: false,
    maxlength: 2000,
  },
  
  // Datos completos de la respuesta de TheFactory/DGII
  respuestaCompleta: {
    type: mongoose.Schema.Types.Mixed,
    required: false,
  },

  // Datos de error (si aplica)
  tipoError: {
    type: String,
    enum: ['negocio', 'tecnico', 'validacion', 'timeout', 'autenticacion', null],
    required: false,
  },
  detallesError: {
    type: mongoose.Schema.Types.Mixed,
    required: false,
  },
  
  // Error normalizado (estructura procesada de theFactoryErrorHandler)
  errorNormalizado: {
    type: mongoose.Schema.Types.Mixed,
    required: false,
  },

  // Datos adicionales para contexto
  codigoSeguridad: {
    type: String,
    required: false,
  },
  fechaEmision: {
    type: Date,
    required: false,
  },
  montoTotal: {
    type: Number,
    required: false,
  },

  // Usuario que realizó el envío
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
    required: true,
    index: true,
  },

  // Ambiente (demo vs producción)
  ambiente: {
    type: String,
    enum: ['demo', 'production'],
    default: 'production',
  },

  // Auditoría
  fechaCreacion: {
    type: Date,
    default: Date.now,
    index: true,
  },
  ip: {
    type: String,
    required: false,
  },
});

// Índice compuesto para búsquedas rápidas
comprobanteEnvioSchema.index({ rnc: 1, ncf: 1, fechaCreacion: -1 });
comprobanteEnvioSchema.index({ usuario: 1, fechaCreacion: -1 });
comprobanteEnvioSchema.index({ exitoso: 1, fechaCreacion: -1 });

const ComprobanteEnvio =
  mongoose.models.ComprobanteEnvio ||
  mongoose.model('ComprobanteEnvio', comprobanteEnvioSchema, 'comprobantes_envios');

/**
 * Wrapper para asegurar conexión antes de usar el modelo.
 */
function wrapComprobanteEnvioModel(Model, ensureConn) {
  if (Model._connectionWrapped) {
    return;
  }
  Model._connectionWrapped = true;

  const originalCreate = Model.create.bind(Model);
  const originalFind = Model.find.bind(Model);
  const originalFindOne = Model.findOne.bind(Model);
  const originalFindById = Model.findById.bind(Model);

  const wrapQuery = (query) => {
    const originalExec = query.exec?.bind(query);
    if (originalExec) {
      query.exec = async function (...execArgs) {
        await ensureConn();
        return originalExec(...execArgs);
      };
    }
    const originalThen = query.then?.bind(query);
    if (originalThen) {
      query.then = async function (...thenArgs) {
        await ensureConn();
        return originalThen(...thenArgs);
      };
    }
    return query;
  };

  Model.create = async function (...args) {
    await ensureConn();
    return originalCreate(...args);
  };
  Model.find = function (...args) {
    return wrapQuery(originalFind(...args));
  };
  Model.findOne = function (...args) {
    return wrapQuery(originalFindOne(...args));
  };
  Model.findById = function (...args) {
    return wrapQuery(originalFindById(...args));
  };
}

wrapComprobanteEnvioModel(ComprobanteEnvio, ensureConnection);

export { ComprobanteEnvio };
export default ComprobanteEnvio;
