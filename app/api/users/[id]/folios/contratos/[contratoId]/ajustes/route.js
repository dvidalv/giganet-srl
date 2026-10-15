import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { ajustarConsumo, recalcularContadores } from "@/lib/folios/foliosService";
import { leerJson, respuestaErrorFolios } from "@/lib/folios/http";

/**
 * POST .../contratos/[contratoId]/ajustes
 * Body: { tipo: "consumo", cantidad, motivo } | { tipo: "recalcular" }
 */
export async function POST(request, { params }) {
  const check = await requireAdmin();
  if (check.error) return check.error;
  const { id, contratoId } = await params;
  try {
    const body = await leerJson(request);
    const contrato =
      body.tipo === "recalcular"
        ? await recalcularContadores({ empresaId: id, contratoId, admin: check.admin })
        : await ajustarConsumo({
            empresaId: id,
            contratoId,
            cantidad: body.cantidad,
            motivo: body.motivo,
            admin: check.admin,
          });
    return NextResponse.json({ contrato });
  } catch (err) {
    return respuestaErrorFolios(err, "POST .../folios/contratos/[contratoId]/ajustes");
  }
}
