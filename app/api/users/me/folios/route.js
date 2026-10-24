import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { obtenerResumenEmpresa } from "@/lib/folios/foliosService";
import { respuestaErrorFolios } from "@/lib/folios/http";

/**
 * GET /api/users/me/folios
 * Resumen de folios para el cliente: lo contratado y el uso, sin disponibles para emitir
 * ni datos operativos de The Factory / admin.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (session.user.role === "admin") {
    return NextResponse.json(
      { error: "Use el panel de empresas para gestionar folios" },
      { status: 403 }
    );
  }

  try {
    const resumen = await obtenerResumenEmpresa(session.user.id);
    const actual = resumen.contratoActual;
    return NextResponse.json({
      modalidad: resumen.modalidad,
      estado: resumen.estado,
      controlAplica: resumen.controlAplica,
      bloqueoEmision: resumen.bloqueoEmision,
      contratoActual: actual
        ? {
            codigo: actual.codigo,
            cantidadContratada: actual.cantidadContratada,
            consumidos: actual.consumidos,
            porcentajeConsumo: actual.porcentajeConsumo,
            fechaInicio: actual.fechaInicio,
            fechaVencimiento: actual.fechaVencimiento,
            diasRestantes: actual.diasRestantes,
          }
        : null,
    });
  } catch (err) {
    return respuestaErrorFolios(err, "GET /api/users/me/folios");
  }
}
