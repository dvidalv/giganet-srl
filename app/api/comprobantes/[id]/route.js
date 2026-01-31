import { NextResponse } from "next/server";
import { auth } from "@/auth";

async function getComprobante() {
  const mod = await import("@/app/models/comprobante");
  const def = mod.default;
  const Comprobante =
    mod.Comprobante ??
    (def && typeof def.Comprobante !== "undefined" ? def.Comprobante : null) ??
    (def && typeof def.create === "function" ? def : null);
  if (!Comprobante || typeof Comprobante.create !== "function") {
    throw new Error("Comprobante model not available");
  }
  return Comprobante;
}

/** GET /api/comprobantes/[id] - Obtener una secuencia del usuario actual */
export async function GET(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  }

  try {
    const Comprobante = await getComprobante();
    const rango = await Comprobante.findOne({
      _id: id,
      usuario: session.user.id,
    }).lean();

    if (!rango) {
      return NextResponse.json(
        { error: "Secuencia no encontrada" },
        { status: 404 },
      );
    }
    return NextResponse.json({ data: rango });
  } catch (err) {
    console.error("GET /api/comprobantes/[id]:", err);
    return NextResponse.json(
      { error: "Error al obtener la secuencia" },
      { status: 500 },
    );
  }
}

/** PATCH /api/comprobantes/[id] - Actualizar una secuencia del usuario actual */
export async function PATCH(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

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
    const Comprobante = await getComprobante();
    const rango = await Comprobante.findOne({ _id: id, usuario: session.user.id });
    if (!rango) {
      return NextResponse.json(
        { error: "Secuencia no encontrada" },
        { status: 404 },
      );
    }

    if (body.numero_inicial != null) rango.numero_inicial = Number(body.numero_inicial);
    if (body.numero_final != null) rango.numero_final = Number(body.numero_final);
    if (body.fecha_autorizacion != null) rango.fecha_autorizacion = new Date(body.fecha_autorizacion);
    if (body.fecha_vencimiento !== undefined) {
      rango.fecha_vencimiento =
        body.fecha_vencimiento && String(body.fecha_vencimiento).trim()
          ? new Date(body.fecha_vencimiento)
          : null;
    }
    if (body.estado !== undefined) rango.estado = String(body.estado).trim();
    if (body.comentario !== undefined) rango.comentario = String(body.comentario).trim().slice(0, 500);
    if (body.alerta_minima_restante != null) rango.alerta_minima_restante = Number(body.alerta_minima_restante);

    await rango.save();
    const updated = rango.toObject ? rango.toObject() : rango;
    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error("PATCH /api/comprobantes/[id]:", err);
    if (err.name === "ValidationError") {
      const details = Object.values(err.errors || {}).map((e) => e.message).join(" ");
      return NextResponse.json(
        { error: "Datos inválidos", details },
        { status: 400 },
      );
    }
    if (err.message && err.message.includes("superpuestos")) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    return NextResponse.json(
      { error: "Error al actualizar la secuencia" },
      { status: 500 },
    );
  }
}

/** DELETE /api/comprobantes/[id] - Eliminar una secuencia del usuario actual */
export async function DELETE(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  }

  try {
    const Comprobante = await getComprobante();
    const rango = await Comprobante.findOneAndDelete({
      _id: id,
      usuario: session.user.id,
    });

    if (!rango) {
      return NextResponse.json(
        { error: "Secuencia no encontrada" },
        { status: 404 },
      );
    }
    return NextResponse.json({
      message: "Secuencia eliminada correctamente",
    });
  } catch (err) {
    console.error("DELETE /api/comprobantes/[id]:", err);
    return NextResponse.json(
      { error: "Error al eliminar la secuencia" },
      { status: 500 },
    );
  }
}
