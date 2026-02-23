import mongoose from 'mongoose';
import { connectDB } from '@/lib/mongoDB';

// Promesa compartida: todos los callers esperan la misma conexión (evita race)
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

// Schema de mongoose para rangos de numeración de e-CF
const comprobanteSchema = new mongoose.Schema({
  rnc: {
    type: String,
    required: [true, 'El RNC es requerido'],
    minlength: [9, 'El RNC debe tener al menos 9 caracteres'],
    maxlength: [11, 'El RNC debe tener máximo 11 caracteres'],
    validate: {
      validator: function (v) {
        return /^\d{9,11}$/.test(v);
      },
      message: 'El RNC debe contener solo números de 9 a 11 dígitos',
    },
  },
  razon_social: {
    type: String,
    required: [true, 'La razón social es requerida'],
    trim: true,
    minlength: [2, 'La razón social debe tener al menos 2 caracteres'],
    maxlength: [200, 'La razón social no puede exceder 200 caracteres'],
  },
  tipo_comprobante: {
    type: String,
    required: [true, 'El tipo de comprobante es requerido'],
    enum: {
      values: ['31', '32', '33', '34', '41', '43', '44', '45'],
      message:
        'Tipo de comprobante inválido. Debe ser: 31, 32, 33, 34, 41, 43, 44, 45',
    },
    /* Tipos de e-CF:
     * 31: Factura de Crédito Fiscal Electrónica
     * 32: Factura de Consumo Electrónica
     * 33: Nota de Débito Electrónica
     * 34: Nota de Crédito Electrónica
     * 41: Compras Electrónicas
     * 43: Gastos Menores Electrónico
     * 44: Régimenes Especiales Electrónico
     * 45: Gubernamental Electrónico
     */
  },
  descripcion_tipo: {
    type: String,
    default: '',
    maxlength: [100, 'La descripción no puede exceder 100 caracteres'],
  },
  prefijo: {
    type: String,
    default: 'E',
    validate: {
      validator: function (v) {
        return /^[A-Z]$/.test(v);
      },
      message: 'El prefijo debe ser una letra mayúscula',
    },
  },
  numero_inicial: {
    type: Number,
    required: [true, 'El número inicial es requerido'],
    min: [0, 'El número inicial no puede ser negativo'],
    validate: {
      validator: Number.isInteger,
      message: 'El número inicial debe ser un entero',
    },
  },
  numero_final: {
    type: Number,
    required: [true, 'El número final es requerido'],
    min: [0, 'El número final no puede ser negativo'],
    validate: [
      {
        validator: Number.isInteger,
        message: 'El número final debe ser un entero',
      },
      {
        validator: function (v) {
          return v > this.numero_inicial;
        },
        message: 'El número final debe ser mayor que el número inicial',
      },
    ],
  },
  cantidad_numeros: {
    type: Number,
    default: function () {
      return this.numero_final - this.numero_inicial + 1;
    },
    min: [1, 'La cantidad de números debe ser mayor a 0'],
  },
  numeros_utilizados: {
    type: Number,
    default: 0,
    min: [0, 'Los números utilizados no pueden ser negativos'],
    validate: {
      validator: function (v) {
        return v <= this.cantidad_numeros;
      },
      message: 'Los números utilizados no pueden exceder la cantidad total',
    },
  },
  numeros_disponibles: {
    type: Number,
    default: function () {
      return this.cantidad_numeros - this.numeros_utilizados;
    },
    min: [0, 'Los números disponibles no pueden ser negativos'],
  },
  fecha_autorizacion: {
    type: Date,
    required: [true, 'La fecha de autorización es requerida'],
    validate: {
      validator: function (v) {
        return v instanceof Date && !isNaN(v);
      },
      message: 'La fecha de autorización debe ser una fecha válida',
    },
  },
  fecha_vencimiento: {
    type: Date,
    required: [
      function () {
        // Fecha de vencimiento es OPCIONAL para tipos 32 (Consumo) y 34 (Nota de Crédito)
        // Es OBLIGATORIA para todos los demás tipos
        return !['32', '34'].includes(this.tipo_comprobante);
      },
      'La fecha de vencimiento es requerida para este tipo de comprobante',
    ],
    validate: [
      {
        validator: function (v) {
          // Si no hay fecha (tipos 32 o 34), no validar
          if (!v) return true;
          return v instanceof Date && !isNaN(v);
        },
        message: 'La fecha de vencimiento debe ser una fecha válida',
      },
      {
        validator: function (v) {
          // Si no hay fecha (tipos 32 o 34), no validar
          if (!v) return true;
          return v > this.fecha_autorizacion;
        },
        message:
          'La fecha de vencimiento debe ser posterior a la fecha de autorización',
      },
    ],
  },
  alerta_minima_restante: {
    type: Number,
    required: [true, 'La alerta mínima restante es requerida'],
    min: [1, 'La alerta mínima debe ser mayor a 0'],
    validate: {
      validator: Number.isInteger,
      message: 'La alerta mínima debe ser un entero',
    },
  },
  estado: {
    type: String,
    enum: {
      values: ['activo', 'inactivo', 'vencido', 'agotado', 'alerta'],
      message:
        'El estado debe ser: activo, inactivo, vencido, agotado o alerta',
    },
    default: 'activo',
  },
  comentario: {
    type: String,
    default: '',
    maxlength: [500, 'El comentario no puede exceder 500 caracteres'],
  },
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
    required: [true, 'El usuario es requerido'],
  },

  // Campos de auditoría
  fechaCreacion: {
    type: Date,
    default: Date.now,
  },
  fechaActualizacion: {
    type: Date,
    default: Date.now,
  },
});

// Índices compuestos - permitir múltiples rangos para diferentes tipos
comprobanteSchema.index(
  {
    rnc: 1,
    tipo_comprobante: 1,
    usuario: 1,
  },
  {
    unique: false,
    name: 'rango_por_tipo',
  },
);

// Middleware pre-save para validaciones y cálculos
// En middlewares async Mongoose no pasa next: se usa return o throw
comprobanteSchema.pre('save', async function () {
  // Actualizar fecha de modificación
  this.fechaActualizacion = Date.now();

  // Calcular cantidad de números
  this.cantidad_numeros = this.numero_final - this.numero_inicial + 1;

  // Calcular números disponibles
  this.numeros_disponibles = this.cantidad_numeros - this.numeros_utilizados;

  // Auto-actualizar estado basado en fechas y números disponibles
  // SOLO si el estado no es 'inactivo' (estado manual que debe respetarse)
  if (this.estado !== 'inactivo') {
    const hoy = new Date();

    // Verificar vencimiento solo si hay fecha de vencimiento (tipos 32 y 34 pueden no tenerla)
    if (this.fecha_vencimiento && this.fecha_vencimiento < hoy) {
      this.estado = 'vencido';
    } else if (this.numeros_disponibles === 0) {
      this.estado = 'agotado'; // Completamente agotado
    } else if (this.numeros_disponibles <= this.alerta_minima_restante) {
      this.estado = 'alerta'; // Quedan pocos números
    } else if (
      this.estado !== 'activo' &&
      this.numeros_disponibles > this.alerta_minima_restante &&
      (!this.fecha_vencimiento || this.fecha_vencimiento >= hoy)
    ) {
      // Si no hay fecha de vencimiento O si la fecha no ha pasado, puede ser activo
      this.estado = 'activo';
    }
  }

  // Validar que no haya rangos superpuestos solo para el mismo RNC y mismo tipo_comprobante (distintos tipos pueden compartir rango)
  const query = {
    rnc: String(this.rnc),
    tipo_comprobante: String(this.tipo_comprobante),
    usuario: this.usuario,
  };

  // Si estamos actualizando (no creando), excluir el documento actual
  if (!this.isNew) {
    query._id = { $ne: this._id };
  }

  const rangosExistentes = await this.constructor.find(query);

  // Verificar superposición de rangos
  for (const rango of rangosExistentes) {
    // Verificar si los rangos se superponen
    const superposicion = !(
      this.numero_final < rango.numero_inicial ||
      this.numero_inicial > rango.numero_final
    );

    if (superposicion) {
      throw new Error(
        `Ya existe un rango con números superpuestos para este RNC y tipo de comprobante. ` +
          `Rango existente: ${rango.numero_inicial}-${rango.numero_final}, ` +
          `Rango nuevo: ${this.numero_inicial}-${this.numero_final}`,
      );
    }
  }
});

// Middleware pre-update para actualizaciones
// Usar async evita problemas con la firma de next en findOneAndUpdate con updatePipeline
comprobanteSchema.pre(
  ['findOneAndUpdate', 'updateOne', 'updateMany'],
  async function () {
    this.set({ fechaActualizacion: Date.now() });
  },
);

// Métodos del esquema
comprobanteSchema.methods.consumirNumero = function () {
  if (this.numeros_disponibles > 0) {
    this.numeros_utilizados += 1;
    this.numeros_disponibles = this.cantidad_numeros - this.numeros_utilizados;

    // Verificar si se debe cambiar el estado
    if (this.numeros_disponibles === 0) {
      this.estado = 'agotado'; // Completamente agotado
    } else if (this.numeros_disponibles <= this.alerta_minima_restante) {
      this.estado = 'alerta'; // Quedan pocos números
    }

    return this.save();
  } else {
    throw new Error('No hay números disponibles en este rango');
  }
};

comprobanteSchema.methods.esValido = function () {
  const hoy = new Date();

  // Para tipos 32 y 34, la fecha de vencimiento es opcional
  const fechaValida = ['32', '34'].includes(this.tipo_comprobante)
    ? !this.fecha_vencimiento || this.fecha_vencimiento >= hoy // Si no hay fecha O no ha vencido
    : this.fecha_vencimiento && this.fecha_vencimiento >= hoy; // Para otros tipos, debe existir y no haber vencido

  return (
    (this.estado === 'activo' || this.estado === 'alerta') &&
    fechaValida &&
    this.numeros_disponibles > 0
  );
};

/**
 * Marca números como anulados en los rangos locales después de una anulación exitosa en DGII.
 * Actualiza numeros_utilizados para que el sistema no intente usar esos NCF de nuevo.
 * @param {string} rnc - RNC del emisor
 * @param {string} tipoDocumento - Tipo de comprobante (31, 32, etc.)
 * @param {number} secuenciaDesde - Secuencia inicial anulada (parte numérica del NCF)
 * @param {number} secuenciaHasta - Secuencia final anulada
 * @param {string} usuarioId - ID del usuario dueño de los comprobantes
 */
comprobanteSchema.statics.marcarNumerosComoAnulados = async function (
  rnc,
  tipoDocumento,
  secuenciaDesde,
  secuenciaHasta,
  usuarioId,
) {
  const mongoose = await import('mongoose');
  const rncLimpio = String(rnc ?? '').replace(/\D/g, '').trim();
  const query = {
    usuario: new mongoose.default.Types.ObjectId(usuarioId),
    rnc: rncLimpio,
    tipo_comprobante: String(tipoDocumento),
    numero_inicial: { $lte: secuenciaHasta },
    numero_final: { $gte: secuenciaDesde }, 
  };
  const rangos = await this.find(query);
  for (const rango of rangos) {
    const hastaEnRango = Math.min(rango.numero_final, secuenciaHasta);
    const nuevosUtilizados = hastaEnRango - rango.numero_inicial + 1;
    if (nuevosUtilizados > rango.numeros_utilizados) {
      rango.numeros_utilizados = nuevosUtilizados;
      rango.estado = 'inactivo'; // Excluir de solicitar-numero; pre-save respeta 'inactivo'
      await rango.save();
    }
  }
};

// Método estático para obtener rangos disponibles por RNC y tipo (FileMaker)
comprobanteSchema.statics.obtenerRangosPorRnc = function (
  rnc,
  tipo_comprobante,
) {
  const query = {
    rnc,
    tipo_comprobante,
    estado: { $in: ['activo', 'alerta'] }, // Incluir rangos activos y en alerta
    numeros_disponibles: { $gt: 0 },
  };

  // Para tipos 32 y 34, la fecha de vencimiento es opcional
  if (!['32', '34'].includes(tipo_comprobante)) {
    query.$or = [
      { fecha_vencimiento: { $gte: new Date() } },
      { fecha_vencimiento: null },
    ];
  }

  return this.find(query).sort({ fechaCreacion: 1 }); // Usar rangos más antiguos primero
};

// Virtual para obtener el próximo número disponible
comprobanteSchema.virtual('proximoNumero').get(function () {
  if (this.numeros_disponibles > 0) {
    return this.numero_inicial + this.numeros_utilizados;
  }
  return null;
});

// Virtual para obtener el próximo número formateado según estructura e-CF
comprobanteSchema.virtual('proximoNumeroFormateado').get(function () {
  if (this.numeros_disponibles > 0) {
    const secuencial = this.numero_inicial + this.numeros_utilizados;
    return this.formatearNumeroECF(secuencial);
  }
  return null;
});

// Método para formatear cualquier número secuencial al formato e-CF
comprobanteSchema.methods.formatearNumeroECF = function (numeroSecuencial) {
  // Formatear secuencial a 10 dígitos con ceros a la izquierda
  const secuencialFormateado = numeroSecuencial.toString().padStart(10, '0');

  // Estructura: [Serie][TipoComprobante][Secuencial]
  return `${this.prefijo}${this.tipo_comprobante}${secuencialFormateado}`;
};

// Método estático para formatear número e-CF desde componentes
comprobanteSchema.statics.formatearECF = function (
  prefijo,
  tipoComprobante,
  numeroSecuencial,
) {
  const secuencialFormateado = numeroSecuencial.toString().padStart(10, '0');
  return `${prefijo}${tipoComprobante}${secuencialFormateado}`;
};

// Asegurar que los virtuals se incluyan en JSON
// Asegurar que los virtuals se incluyan en JSON
comprobanteSchema.set('toJSON', {
  virtuals: true,
  transform: function (doc, ret) {
    delete ret.id; // Eliminar el virtual id automático
    delete ret.__v; // Eliminar version key (opcional)
    return ret;
  },
});

const Comprobante = mongoose.models.Comprobante || mongoose.model('Comprobante', comprobanteSchema, 'comprobantes');

// Asegurar que marcarNumerosComoAnulados exista (evita problemas con modelo cacheado en Next.js/Turbopack)
if (typeof Comprobante.marcarNumerosComoAnulados !== 'function') {
  Comprobante.marcarNumerosComoAnulados = async function (
    rnc,
    tipoDocumento,
    secuenciaDesde,
    secuenciaHasta,
    usuarioId,
  ) {
    const mongooseMod = await import('mongoose');
    const rncLimpio = String(rnc ?? '').replace(/\D/g, '').trim();
    const query = {
      usuario: new mongooseMod.default.Types.ObjectId(usuarioId),
      rnc: rncLimpio,
      tipo_comprobante: String(tipoDocumento),
      numero_inicial: { $lte: secuenciaHasta },
      numero_final: { $gte: secuenciaDesde },
    };
    const rangos = await this.find(query);
    for (const rango of rangos) {
      const hastaEnRango = Math.min(rango.numero_final, secuenciaHasta);
      const nuevosUtilizados = hastaEnRango - rango.numero_inicial + 1;
      if (nuevosUtilizados > rango.numeros_utilizados) {
        rango.numeros_utilizados = nuevosUtilizados;
        rango.estado = 'inactivo';
        await rango.save();
      }
    }
  };
}

// Asegurar conexión a MongoDB antes de cada operación (Next.js/serverless)
if (!Comprobante._connectionWrapped) {
  Comprobante._connectionWrapped = true;
  const originalCreate = Comprobante.create.bind(Comprobante);
  const originalFind = Comprobante.find.bind(Comprobante);
  const originalFindOne = Comprobante.findOne.bind(Comprobante);
  const originalFindById = Comprobante.findById.bind(Comprobante);
  const originalFindOneAndUpdate = Comprobante.findOneAndUpdate.bind(Comprobante);
  const originalFindByIdAndUpdate = Comprobante.findByIdAndUpdate.bind(Comprobante);
  const originalFindByIdAndDelete = Comprobante.findByIdAndDelete.bind(Comprobante);
  const originalCountDocuments = Comprobante.countDocuments.bind(Comprobante);
  const originalAggregate = Comprobante.aggregate.bind(Comprobante);

  const wrapQuery = (query) => {
    const originalExec = query.exec?.bind(query);
    if (originalExec) {
      query.exec = async function (...execArgs) {
        await ensureConnection();
        return originalExec(...execArgs);
      };
    }
    const originalThen = query.then?.bind(query);
    if (originalThen) {
      query.then = async function (...thenArgs) {
        await ensureConnection();
        return originalThen(...thenArgs);
      };
    }
    return query;
  };

  Comprobante.create = async function (...args) {
    await ensureConnection();
    return originalCreate(...args);
  };
  Comprobante.find = function (...args) {
    return wrapQuery(originalFind(...args));
  };
  Comprobante.findOne = function (...args) {
    return wrapQuery(originalFindOne(...args));
  };
  Comprobante.findById = function (...args) {
    return wrapQuery(originalFindById(...args));
  };
  Comprobante.findOneAndUpdate = async function (...args) {
    await ensureConnection();
    return originalFindOneAndUpdate(...args);
  };
  Comprobante.findByIdAndUpdate = async function (...args) {
    await ensureConnection();
    return originalFindByIdAndUpdate(...args);
  };
  Comprobante.findByIdAndDelete = async function (...args) {
    await ensureConnection();
    return originalFindByIdAndDelete(...args);
  };
  Comprobante.countDocuments = function (...args) {
    const query = originalCountDocuments(...args);
    return wrapQuery(query);
  };
  Comprobante.aggregate = async function (...args) {
    await ensureConnection();
    return originalAggregate(...args);
  };
}

module.exports = {
  Comprobante,
};
export { Comprobante };
