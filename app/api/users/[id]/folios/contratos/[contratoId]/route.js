import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { actualizarContrato, obtenerDetalleContrato } from "@/lib/folios/foliosService";
import { leerJson, respuestaErrorFolios } from "@/lib/folios/http";

/** GET /api/users/[id]/folios/contratos/[contratoId] - Detalle, asignaciones, consumo y auditoría */
export async function GET(request, { params }) {
  const check = await requireAdmin();
  if (check.error) return check.error;
  const { id, contratoId } = await params;
  const { searchParams } = new URL(request.url);
  try {
    const detalle = await obtenerDetalleContrato({
      empresaId: id,
      contratoId,
      pagina: searchParams.get("pagina"),
      porPagina: searchParams.get("porPagina"),
    });
    return NextResponse.json(detalle);
  } catch (err) {
    return respuestaErrorFolios(err, "GET /api/users/[id]/folios/contratos/[contratoId]");
  }
}

/** PATCH /api/users/[id]/folios/contratos/[contratoId] - Editar fechas, cantidad, saldo o estado */
export async function PATCH(request, { params }) {
  const check = await requireAdmin();
  if (check.error) return check.error;
  const { id, contratoId } = await params;
  try {
    const body = await leerJson(request);
    const permitidos = [
      "cantidadContratada",
      "fechaInicio",
      "fechaVencimiento",
      "consumoPrevio",
      "observaciones",
      "saldoTheFactory",
      "estado",
      "motivo",
    ];
    const cambios = Object.fromEntries(
      Object.entries(body).filter(([k]) => permitidos.includes(k)),
    );
    const contrato = await actualizarContrato({
      empresaId: id,
      contratoId,
      cambios,
      admin: check.admin,
    });
    return NextResponse.json({ contrato });
  } catch (err) {
    return respuestaErrorFolios(err, "PATCH /api/users/[id]/folios/contratos/[contratoId]");
  }
}
