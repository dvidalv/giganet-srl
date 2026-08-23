import { NextResponse } from "next/server";
import ComprobanteEnvio from "@/app/models/comprobanteEnvio";
import { normalizeTheFactoryError, buildErrorTextForAI } from "@/utils/theFactoryErrorHandler";

/**
 * Endpoint para reprocesar un error guardado en MongoDB.
 * Útil para errores guardados antes de implementar errorNormalizado.
 * 
 * GET /api/debug/reprocess-error?ncf=E320000006398&userId=XXX
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const ncf = searchParams.get('ncf');
    const userId = searchParams.get('userId');
    
    if (!ncf) {
      return NextResponse.json({ error: 'Falta parámetro ncf' }, { status: 400 });
    }
    
    // Buscar el error
    const query = {
      ncf: ncf.toUpperCase(),
      exitoso: false,
    };
    
    if (userId) {
      query.usuario = userId;
    }
    
    const errorDoc = await ComprobanteEnvio.findOne(query)
      .sort({ fechaCreacion: -1 })
      .lean();
    
    if (!errorDoc) {
      return NextResponse.json({ 
        error: 'No se encontró el error',
        ncf,
        userId
      }, { status: 404 });
    }
    
    // Si ya tiene errorNormalizado, no hace falta reprocesar
    if (errorDoc.errorNormalizado) {
      return NextResponse.json({
        message: 'El error ya tiene errorNormalizado',
        errorNormalizado: errorDoc.errorNormalizado,
      });
    }
    
    // Intentar normalizar desde respuestaCompleta
    if (errorDoc.respuestaCompleta) {
      const simulatedError = {
        response: {
          status: errorDoc.codigoRespuesta || 400,
          data: errorDoc.respuestaCompleta,
        },
        message: errorDoc.mensajeRespuesta || "Error",
      };
      
      const normalized = normalizeTheFactoryError(simulatedError);
      const textForAI = buildErrorTextForAI(normalized);
      
      // Actualizar el documento con errorNormalizado
      await ComprobanteEnvio.updateOne(
        { _id: errorDoc._id },
        { 
          $set: { 
            errorNormalizado: normalized,
            tipoError: normalized.type?.includes('VALIDATION') ? 'validacion' 
                      : normalized.httpStatus >= 500 ? 'tecnico'
                      : normalized.httpStatus === 401 || normalized.httpStatus === 403 ? 'autenticacion'
                      : normalized.codigo === 108 || normalized.codigo === 109 ? 'negocio'
                      : errorDoc.tipoError || 'tecnico',
            detallesError: {
              codigo: normalized.codigo || normalized.httpStatus,
              mensaje: normalized.message,
              observaciones: normalized.observaciones || [],
              validationErrors: normalized.validationErrors || [],
              type: normalized.type,
            }
          } 
        }
      );
      
      return NextResponse.json({
        message: 'Error reprocesado y actualizado',
        ncf: errorDoc.ncf,
        errorNormalizado: normalized,
        textForAI,
      });
    }
    
    return NextResponse.json({
      error: 'El error no tiene respuestaCompleta para reprocesar',
      errorDoc,
    }, { status: 400 });
    
  } catch (error) {
    console.error('Error al reprocesar:', error);
    return NextResponse.json({ 
      error: 'Error interno',
      details: error.message 
    }, { status: 500 });
  }
}
