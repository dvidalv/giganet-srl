import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createComprobanteSequence } from "@/lib/createComprobanteSequence";
import { getComprobanteModelForUserId } from "@/lib/comprobantesStore";

/** GET /api/comprobantes - Listar secuencias del usuario actual */
export async function GET(request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const tipo = searchParams.get("tipo_comprobante") || "";
    const estado = searchParams.get("estado") || "";

    const filters = { usuario: session.user.id };
    if (tipo) filters.tipo_comprobante = tipo;
    if (estado) filters.estado = estado;

    const skip = (page - 1) * limit;
    const Comprobante = await getComprobanteModelForUserId(session.user.id);
    const [rangos, total] = await Promise.all([
      Comprobante.find(filters).sort({ fechaCreacion: -1 }).skip(skip).limit(limit).lean(),
      Comprobante.countDocuments(filters),
    ]);

    return NextResponse.json({
      data: rangos,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("GET /api/comprobantes:", err);
    return NextResponse.json(
      { error: "Error al listar secuencias" },
      { status: 500 },
    );
  }
}

/** POST /api/comprobantes - Crear nueva secuencia (rango de numeración) */
export async function POST(request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const result = await createComprobanteSequence(session.user.id, body);
  return NextResponse.json(result.json, { status: result.status });
}
