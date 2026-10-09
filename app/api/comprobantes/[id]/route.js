import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  syncTheFactoryActualizarSeriesFromComprobante,
  syncTheFactoryBorrarSeriesFromComprobante,
} from "@/app/controllers/comprobantes";
import { getComprobanteModelForUserId } from "@/lib/comprobantesStore";
import { applyComprobantePatch } from "@/lib/comprobanteMutations";

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
    const Comprobante = await getComprobanteModelForUserId(session.user.id);
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
    const Comprobante = await getComprobanteModelForUserId(session.user.id);
    const rango = await Comprobante.findOne({ _id: id, usuario: session.user.id });
    if (!rango) {
      return NextResponse.json(
        { error: "Secuencia no encontrada" },
        { status: 404 },
      );
    }

    const applied = applyComprobantePatch(rango, body);
    if (!applied.ok) {
      return NextResponse.json(
        { error: applied.error },
        { status: applied.status },
      );
    }

    await rango.save();
    const updated = rango.toObject ? rango.toObject() : rango;

    const theFactorySync = await syncTheFactoryActualizarSeriesFromComprobante(
      updated,
      session.user.id
    );

    return NextResponse.json({ data: updated, theFactorySync });
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
    const Comprobante = await getComprobanteModelForUserId(session.user.id);
    const rango = await Comprobante.findOne({
      _id: id,
      usuario: session.user.id,
    });

    if (!rango) {
      return NextResponse.json(
        { error: "Secuencia no encontrada" },
        { status: 404 },
      );
    }

    const snapshot = rango.toObject ? rango.toObject() : { ...rango };
    const theFactorySync = await syncTheFactoryBorrarSeriesFromComprobante(
      snapshot,
      session.user.id
    );

    if (!theFactorySync.ok) {
      return NextResponse.json(
        {
          error:
            theFactorySync.message ||
            "No se pudo eliminar la serie en The Factory. Revise credenciales y datos.",
          theFactorySync,
        },
        { status: 502 },
      );
    }

    await Comprobante.deleteOne({ _id: id, usuario: session.user.id });

    return NextResponse.json({
      message: theFactorySync.skipped
        ? "Secuencia eliminada en Giganet (no existía en The Factory para este RNC)."
        : "Secuencia eliminada correctamente en Giganet y The Factory",
      theFactorySync,
    });
  } catch (err) {
    console.error("DELETE /api/comprobantes/[id]:", err);
    return NextResponse.json(
      { error: "Error al eliminar la secuencia" },
      { status: 500 },
    );
  }
}
