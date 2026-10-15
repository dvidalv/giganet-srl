import { NextResponse } from "next/server";
import User from "@/app/models/user";
import { consultarEstatusDocumentoLogic } from "@/app/controllers/comprobantes";
import { buildTheFactoryUrls, THEFACTORY_BASE_URL } from "@/utils/constants";
import {
  evaluarAlertas,
  reconciliarReservasPendientes,
  reintentarEmailsAlertas,
} from "@/lib/folios/foliosService";

/**
 * Consulta en The Factory (producción) si el e-NCF de una reserva sin respuesta llegó.
 * @returns {Promise<"existe"|"no_existe"|null>}
 */
async function verificarEnTheFactory(consumo) {
  const user = await User.findById(consumo.empresa).select("empresa.rnc").lean();
  const rnc = String(user?.empresa?.rnc || "").replace(/\D/g, "");
  if (!rnc) return null;
  const result = await consultarEstatusDocumentoLogic(
    { ncf: consumo.ncf, rnc },
    {
      userId: String(consumo.empresa),
      theFactoryUrls: { ambienteKey: "production", ...buildTheFactoryUrls(THEFACTORY_BASE_URL) },
    },
  );
  if (result.status !== 200) return null;
  const estado = result.data?.data?.estado;
  if (!estado) return null;
  return estado === "NO_ENCONTRADO" ? "no_existe" : "existe";
}

/**
 * GET /api/cron/folios
 * Diario: genera alertas de vencimiento/consumo/mínimo, reconcilia reservas de folios sin
 * respuesta y reintenta los emails de alerta mínima que fallaron.
 * Autorización: Authorization: Bearer CRON_SECRET (Vercel Cron lo envía automáticamente).
 */
export async function GET(request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[cron/folios] CRON_SECRET no está definido");
    return NextResponse.json({ error: "Cron no configurado" }, { status: 500 });
  }
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (token !== cronSecret) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const alertas = await evaluarAlertas();
    const reconciliacion = await reconciliarReservasPendientes({
      verificar: verificarEnTheFactory,
    });
    const emails = await reintentarEmailsAlertas();
    console.log("[cron/folios]", { alertas, reconciliacion, emails });
    return NextResponse.json({ ok: true, alertas, reconciliacion, emails });
  } catch (error) {
    console.error("[cron/folios] Error:", error);
    return NextResponse.json({ error: "Error al ejecutar el cron de folios" }, { status: 500 });
  }
}
