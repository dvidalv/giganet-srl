import { NextResponse } from "next/server";
import ComprobanteEnvio from "@/app/models/comprobanteEnvio";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const ncf = searchParams.get('ncf') || 'E320000006398';
    
    const error = await ComprobanteEnvio.findOne({
      ncf: ncf.toUpperCase(),
      exitoso: false,
    }).sort({ fechaCreacion: -1 }).lean();
    
    if (!error) {
      return NextResponse.json({ error: 'No se encontró el error' }, { status: 404 });
    }
    
    return NextResponse.json({
      ncf: error.ncf,
      codigoRespuesta: error.codigoRespuesta,
      mensajeRespuesta: error.mensajeRespuesta,
      respuestaCompleta: error.respuestaCompleta,
      errorNormalizado: error.errorNormalizado,
      detallesError: error.detallesError,
      tipoError: error.tipoError,
    });
  } catch (error) {
    console.error('Error al consultar:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
