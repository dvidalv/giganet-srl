import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { crearContrato } from "@/lib/folios/foliosService";
import { leerJson, respuestaErrorFolios } from "@/lib/folios/http";

/** POST /api/users/[id]/folios/contratos - Crear o renovar contrato de folios (solo admin) */
export async function POST(request, { params }) {
  const check = await requireAdmin();
  if (check.error) return check.error;
  const { id } = await params;
  try {
    const body = await leerJson(request);
    const contrato = await crearContrato({
      empresaId: id,
      cantidadContratada: body.cantidadContratada,
      fechaInicio: body.fechaInicio,
      fechaVencimiento: body.fechaVencimiento,
      asignacionInicial: body.asignacionInicial,
      consumoPrevio: body.consumoPrevio,
      saldoTheFactory: body.saldoTheFactory ?? null,
      observaciones: body.observaciones,
      renovacionDe: body.renovacionDe || null,
      admin: check.admin,
    });
    return NextResponse.json({ contrato }, { status: 201 });
  } catch (err) {
    return respuestaErrorFolios(err, "POST /api/users/[id]/folios/contratos");
  }
}
