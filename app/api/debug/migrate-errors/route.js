import { NextResponse } from "next/server";
import ComprobanteEnvio from "@/app/models/comprobanteEnvio";
import { normalizeTheFactoryError } from "@/utils/theFactoryErrorHandler";

/**
 * Endpoint para reprocesar TODOS los errores sin errorNormalizado.
 * Migración de datos para errores guardados antes de implementar errorNormalizado.
 * 
 * POST /api/debug/migrate-errors
 * Body: { limit: 100, dryRun: true }
 */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const limit = body.limit || 100;
    const dryRun = body.dryRun !== false; // Por defecto true (no modifica)
    
    // Buscar errores sin errorNormalizado
    const errorsToMigrate = await ComprobanteEnvio.find({
      exitoso: false,
      errorNormalizado: { $exists: false },
      respuestaCompleta: { $exists: true },
    })
    .limit(limit)
    .lean();
    
    if (errorsToMigrate.length === 0) {
      return NextResponse.json({
        message: 'No hay errores para migrar',
        total: 0,
      });
    }
    
    const results = [];
    let processed = 0;
    let failed = 0;
    
    for (const errorDoc of errorsToMigrate) {
      try {
        const simulatedError = {
          response: {
            status: errorDoc.codigoRespuesta || 400,
            data: errorDoc.respuestaCompleta,
          },
          message: errorDoc.mensajeRespuesta || "Error",
        };
        
        const normalized = normalizeTheFactoryError(simulatedError);
        
        const update = {
          errorNormalizado: normalized,
          detallesError: {
            codigo: normalized.codigo || normalized.httpStatus,
            mensaje: normalized.message,
            observaciones: normalized.observaciones || [],
            validationErrors: normalized.validationErrors || [],
            type: normalized.type,
          }
        };
        
        // Actualizar tipoError si es necesario
        if (normalized.type?.includes('VALIDATION')) {
          update.tipoError = 'validacion';
        } else if (normalized.httpStatus >= 500) {
          update.tipoError = 'tecnico';
        } else if (normalized.httpStatus === 401 || normalized.httpStatus === 403) {
          update.tipoError = 'autenticacion';
        } else if (normalized.codigo === 108 || normalized.codigo === 109 || normalized.codigo === 110 || normalized.codigo === 111) {
          update.tipoError = 'negocio';
        }
        
        if (!dryRun) {
          await ComprobanteEnvio.updateOne(
            { _id: errorDoc._id },
            { $set: update }
          );
        }
        
        processed++;
        results.push({
          ncf: errorDoc.ncf,
          status: 'success',
          hasValidationErrors: (normalized.validationErrors?.length || 0) > 0,
          validationErrorsCount: normalized.validationErrors?.length || 0,
        });
      } catch (err) {
        failed++;
        results.push({
          ncf: errorDoc.ncf,
          status: 'error',
          error: err.message,
        });
      }
    }
    
    return NextResponse.json({
      message: dryRun ? 'Dry run completado (no se modificó nada)' : 'Migración completada',
      dryRun,
      total: errorsToMigrate.length,
      processed,
      failed,
      results,
    });
    
  } catch (error) {
    console.error('Error en migración:', error);
    return NextResponse.json({ 
      error: 'Error interno',
      details: error.message 
    }, { status: 500 });
  }
}
