import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { atenderAlerta } from "@/lib/folios/foliosService";
import { respuestaErrorFolios } from "@/lib/folios/http";

/** PATCH /api/folios/alertas/[id] - Marcar alerta como atendida (solo admin) */
export async function PATCH(request, { params }) {
  const check = await requireAdmin();
  if (check.error) return check.error;
  const { id } = await params;
  try {
    const alerta = await atenderAlerta({ alertaId: id, admin: check.admin });
    return NextResponse.json({ alerta });
  } catch (err) {
    return respuestaErrorFolios(err, "PATCH /api/folios/alertas/[id]");
  }
}
