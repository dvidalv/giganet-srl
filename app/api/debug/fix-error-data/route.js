import { NextResponse } from "next/server";
import ComprobanteEnvio from "@/app/models/comprobanteEnvio";
import { normalizeTheFactoryError, buildErrorTextForAI } from "@/utils/theFactoryErrorHandler";

/**
 * Endpoint para insertar manualmente la información de error completa de un comprobante.
 * Útil cuando el error original no se guardó correctamente pero tienes el JSON del error de The Factory.
 * 
 * POST /api/debug/fix-error-data
 * Body: {
 *   "ncf": "E320000006398",
 *   "errorData": { ... el JSON completo del error de The Factory ... }
 * }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { ncf, errorData, userId } = body;
    
    if (!ncf || !errorData) {
      return NextResponse.json({ 
        error: 'Faltan parámetros: ncf y errorData son requeridos' 
      }, { status: 400 });
    }
    
    // Buscar el error existente
    const query = {
      ncf: ncf.toUpperCase(),
      exitoso: false,
    };
    
    if (userId) {
      query.usuario = userId;
    }
    
    const errorDoc = await ComprobanteEnvio.findOne(query)
      .sort({ fechaCreacion: -1 });
    
    if (!errorDoc) {
      return NextResponse.json({ 
        error: 'No se encontró el error en MongoDB',
        ncf,
      }, { status: 404 });
    }
    
    // Normalizar el error desde el JSON proporcionado
    const simulatedError = {
      response: {
        status: errorData.status || 400,
        data: errorData,
      },
      message: errorData.message || errorData.title || "Error",
    };
    
    const normalized = normalizeTheFactoryError(simulatedError);
    const textForAI = buildErrorTextForAI(normalized);
    
    // Actualizar con la información correcta
    const update = {
      respuestaCompleta: errorData,
      errorNormalizado: normalized,
      codigoRespuesta: errorData.status || normalized.httpStatus || 400,
      mensajeRespuesta: errorData.title || normalized.message,
      detallesError: {
        codigo: normalized.codigo || normalized.httpStatus,
        mensaje: normalized.message,
        observaciones: normalized.observaciones || [],
        validationErrors: normalized.validationErrors || [],
        type: normalized.type,
      }
    };
    
    // Actualizar tipoError
    if (normalized.type?.includes('VALIDATION')) {
      update.tipoError = 'validacion';
    } else if (normalized.httpStatus >= 500) {
      update.tipoError = 'tecnico';
    } else if (normalized.httpStatus === 401 || normalized.httpStatus === 403) {
      update.tipoError = 'autenticacion';
    } else if (normalized.codigo === 108 || normalized.codigo === 109 || normalized.codigo === 110 || normalized.codigo === 111) {
      update.tipoError = 'negocio';
    }
    
    await ComprobanteEnvio.updateOne(
      { _id: errorDoc._id },
      { $set: update }
    );
    
    return NextResponse.json({
      message: 'Error actualizado correctamente',
      ncf: errorDoc.ncf,
      before: {
        codigoRespuesta: errorDoc.codigoRespuesta,
        mensajeRespuesta: errorDoc.mensajeRespuesta,
        hasErrorNormalizado: !!errorDoc.errorNormalizado,
      },
      after: {
        hasValidationErrors: (normalized.validationErrors?.length || 0) > 0,
        validationErrorsCount: normalized.validationErrors?.length || 0,
        errorNormalizado: normalized,
      },
      textForAI,
    });
    
  } catch (error) {
    console.error('Error al actualizar:', error);
    return NextResponse.json({ 
      error: 'Error interno',
      details: error.message 
    }, { status: 500 });
  }
}
