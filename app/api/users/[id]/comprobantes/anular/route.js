import { NextResponse } from "next/server";
import User from "@/app/models/user";
import { anularComprobantesLogic } from "@/app/controllers/comprobantes";
import { requireAdmin } from "@/lib/adminAuth";

/**
 * POST /api/users/[id]/comprobantes/anular
 * Anula NCF no usados de esa empresa ante The Factory. El userId es el de la
 * empresa, no el del administrador que opera.
 */
export async function POST(request, { params }) {
  const check = await requireAdmin();
  if (check.error) return check.error;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  try {
    const user = await User.findById(id).select("empresa.rnc").lean();
    if (!user) {
      return NextResponse.json({ error: "Empresa no encontrada" }, { status: 404 });
    }
    const rnc = String(user.empresa?.rnc || "").replace(/\D/g, "");
    if (!rnc) {
      return NextResponse.json(
        { error: "La empresa no tiene RNC. Complételo antes de anular comprobantes." },
        { status: 400 },
      );
    }

    const result = await anularComprobantesLogic({ ...body, rnc }, { userId: id });
    return NextResponse.json(result.data, { status: result.status });
  } catch (err) {
    console.error("POST /api/users/[id]/comprobantes/anular:", err);
    return NextResponse.json({ error: "Error al anular comprobantes" }, { status: 500 });
  }
}
