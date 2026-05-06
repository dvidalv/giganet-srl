import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listarSeriesTheFactoryLogic } from "@/app/controllers/comprobantes";

/**
 * GET /api/comprobantes/thefactory-series
 *
 * Lista las series autorizadas en The Factory HKA para el RNC de Mi empresa.
 * Requiere sesión. Usa credenciales y ambiente (demo/producción) configurados en el perfil.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const result = await listarSeriesTheFactoryLogic(
    {},
    { userId: session.user.id }
  );
  return NextResponse.json(result.data, { status: result.status });
}
