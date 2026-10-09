import { NextResponse } from "next/server";
import { auth } from "@/auth";
import User from "@/app/models/user";
import {
  syncTheFactoryActualizarSeriesFromComprobante,
  syncTheFactoryBorrarSeriesFromComprobante,
} from "@/app/controllers/comprobantes";
import { getComprobanteModelForUserId } from "@/lib/comprobantesStore";
import { applyComprobantePatch } from "@/lib/comprobanteMutations";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return {
      error: NextResponse.json({ error: "No autorizado" }, { status: 403 }),
    };
  }
  return { session };
}

async function loadOwnedRango(userId, comprobanteId) {
  const user = await User.findById(userId).select("_id").lean();
  if (!user) return { error: "Usuario no encontrado", status: 404 };
  const Comprobante = await getComprobanteModelForUserId(userId);
  const rango = await Comprobante.findOne({
    _id: comprobanteId,
    usuario: userId,
  });
  if (!rango) return { error: "Secuencia no encontrada", status: 404 };
  return { Comprobante, rango };
}

/** PATCH /api/users/[id]/comprobantes/[comprobanteId] */
export async function PATCH(request, { params }) {
  const check = await requireAdmin();
  if (check.error) return check.error;

  const { id, comprobanteId } = await params;
  if (!id || !comprobanteId) {
    return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  try {
    const loaded = await loadOwnedRango(id, comprobanteId);
    if (loaded.error) {
      return NextResponse.json(
        { error: loaded.error },
        { status: loaded.status },
      );
    }

    const applied = applyComprobantePatch(loaded.rango, body);
    if (!applied.ok) {
      return NextResponse.json(
        { error: applied.error },
        { status: applied.status },
      );
    }

    await loaded.rango.save();
    const updated = loaded.rango.toObject
      ? loaded.rango.toObject()
      : loaded.rango;

    const theFactorySync = await syncTheFactoryActualizarSeriesFromComprobante(
      updated,
      id,
    );

    return NextResponse.json({ data: updated, theFactorySync });
  } catch (err) {
    console.error("PATCH /api/users/[id]/comprobantes/[comprobanteId]:", err);
    if (err.name === "ValidationError") {
      const details = Object.values(err.errors || {})
        .map((e) => e.message)
        .join(" ");
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

/** DELETE /api/users/[id]/comprobantes/[comprobanteId] */
export async function DELETE(_request, { params }) {
  const check = await requireAdmin();
  if (check.error) return check.error;

  const { id, comprobanteId } = await params;
  if (!id || !comprobanteId) {
    return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  }

  try {
    const loaded = await loadOwnedRango(id, comprobanteId);
    if (loaded.error) {
      return NextResponse.json(
        { error: loaded.error },
        { status: loaded.status },
      );
    }

    const snapshot = loaded.rango.toObject
      ? loaded.rango.toObject()
      : { ...loaded.rango };
    const theFactorySync = await syncTheFactoryBorrarSeriesFromComprobante(
      snapshot,
      id,
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

    await loaded.Comprobante.deleteOne({ _id: comprobanteId, usuario: id });

    return NextResponse.json({
      message: theFactorySync.skipped
        ? "Secuencia eliminada en Giganet (no existía en The Factory para este RNC)."
        : "Secuencia eliminada correctamente en Giganet y The Factory",
      theFactorySync,
    });
  } catch (err) {
    console.error("DELETE /api/users/[id]/comprobantes/[comprobanteId]:", err);
    return NextResponse.json(
      { error: "Error al eliminar la secuencia" },
      { status: 500 },
    );
  }
}
