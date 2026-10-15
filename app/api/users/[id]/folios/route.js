import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import {
  FoliosError,
  cambiarModalidad,
  configurarAlertaMinima,
  obtenerResumenEmpresa,
} from "@/lib/folios/foliosService";
import { leerJson, respuestaErrorFolios } from "@/lib/folios/http";

/** GET /api/users/[id]/folios - Estado de folios de la empresa (solo admin) */
export async function GET(request, { params }) {
  const check = await requireAdmin();
  if (check.error) return check.error;
  const { id } = await params;
  try {
    return NextResponse.json(await obtenerResumenEmpresa(id));
  } catch (err) {
    return respuestaErrorFolios(err, "GET /api/users/[id]/folios");
  }
}

/**
 * PATCH /api/users/[id]/folios - Cambiar modalidad ILIMITADO/CONTROLADO y/o el % de alerta
 * mínima (`alertaMinimaPct`, null para desactivarla). Solo admin.
 */
export async function PATCH(request, { params }) {
  const check = await requireAdmin();
  if (check.error) return check.error;
  const { id } = await params;
  try {
    const body = await leerJson(request);
    const cambiaModalidad = body.modalidad !== undefined;
    const cambiaAlerta = Object.prototype.hasOwnProperty.call(body, "alertaMinimaPct");
    if (!cambiaModalidad && !cambiaAlerta) {
      throw new FoliosError("No hay cambios para guardar");
    }
    let resumen;
    if (cambiaModalidad) {
      resumen = await cambiarModalidad({
        empresaId: id,
        modalidad: String(body.modalidad ?? "").toUpperCase(),
        motivo: body.motivo,
        admin: check.admin,
      });
    }
    if (cambiaAlerta) {
      resumen = await configurarAlertaMinima({
        empresaId: id,
        pct: body.alertaMinimaPct,
        admin: check.admin,
      });
    }
    return NextResponse.json(resumen);
  } catch (err) {
    return respuestaErrorFolios(err, "PATCH /api/users/[id]/folios");
  }
}
