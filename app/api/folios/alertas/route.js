import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { evaluarAlertas, listarAlertas } from "@/lib/folios/foliosService";
import { respuestaErrorFolios } from "@/lib/folios/http";

/** GET /api/folios/alertas - Alertas activas (evalúa vencimientos de forma idempotente antes de listar) */
export async function GET(request) {
  const check = await requireAdmin();
  if (check.error) return check.error;
  const { searchParams } = new URL(request.url);
  try {
    await evaluarAlertas();
    const alertas = await listarAlertas({
      incluirAtendidas: searchParams.get("incluirAtendidas") === "1",
    });
    return NextResponse.json({ alertas });
  } catch (err) {
    return respuestaErrorFolios(err, "GET /api/folios/alertas");
  }
}
