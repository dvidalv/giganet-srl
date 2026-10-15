import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { estimarConsumoPrevio } from "@/lib/folios/foliosService";
import { respuestaErrorFolios } from "@/lib/folios/http";

/** GET /api/users/[id]/folios/consumo-previo?desde=YYYY-MM-DD - e-NCF emitidos por Giganet desde una fecha (solo admin) */
export async function GET(request, { params }) {
  const check = await requireAdmin();
  if (check.error) return check.error;
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  try {
    const estimacion = await estimarConsumoPrevio({ empresaId: id, desde: searchParams.get("desde") });
    return NextResponse.json(estimacion);
  } catch (err) {
    return respuestaErrorFolios(err, "GET /api/users/[id]/folios/consumo-previo");
  }
}
