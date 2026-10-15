import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { registrarAsignacion } from "@/lib/folios/foliosService";
import { leerJson, respuestaErrorFolios } from "@/lib/folios/http";

/** POST .../contratos/[contratoId]/asignaciones - Registrar asignación parcial hecha en The Factory */
export async function POST(request, { params }) {
  const check = await requireAdmin();
  if (check.error) return check.error;
  const { id, contratoId } = await params;
  try {
    const body = await leerJson(request);
    const resultado = await registrarAsignacion({
      empresaId: id,
      contratoId,
      cantidad: body.cantidad,
      fecha: body.fecha || undefined,
      observaciones: body.observaciones,
      admin: check.admin,
    });
    return NextResponse.json(resultado, { status: 201 });
  } catch (err) {
    return respuestaErrorFolios(err, "POST .../folios/contratos/[contratoId]/asignaciones");
  }
}
