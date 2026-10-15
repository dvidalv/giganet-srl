import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { listarPanelFolios } from "@/lib/folios/foliosService";
import { respuestaErrorFolios } from "@/lib/folios/http";

/** GET /api/folios - Tabla de control de folios de todas las empresas (solo admin) */
export async function GET(request) {
  const check = await requireAdmin();
  if (check.error) return check.error;
  const { searchParams } = new URL(request.url);
  try {
    const data = await listarPanelFolios({
      q: searchParams.get("q") || "",
      modalidad: searchParams.get("modalidad") || "",
      estado: searchParams.get("estado") || "",
      vencDesde: searchParams.get("vencDesde") || "",
      vencHasta: searchParams.get("vencHasta") || "",
      pagina: searchParams.get("pagina"),
      porPagina: searchParams.get("porPagina"),
    });
    return NextResponse.json(data);
  } catch (err) {
    return respuestaErrorFolios(err, "GET /api/folios");
  }
}
