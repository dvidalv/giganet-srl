import { NextResponse } from "next/server";
import { auth } from "@/auth";
import Encuesta from "@/app/models/encuesta";
import { Types } from "mongoose";

/** GET /api/encuestas/[id] — detalle (solo admin) */
export async function GET(_request, { params }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  if (!id || !Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "ID no válido" }, { status: 400 });
  }

  try {
    const e = await Encuesta.findById(id).lean().exec();
    if (!e) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 });
    }

    return NextResponse.json({
      encuesta: {
        id: e._id.toString(),
        userId: e.userId?.toString?.() ?? String(e.userId),
        empresa: e.empresa || {},
        token: e.token,
        status: e.status,
        expiresAt: e.expiresAt,
        sentAt: e.sentAt,
        respondedAt: e.respondedAt,
        responderIpHash: e.responderIpHash || "",
        answers: e.answers || null,
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
      },
    });
  } catch (err) {
    console.error("GET /api/encuestas/[id]:", err);
    return NextResponse.json(
      { error: "Error al cargar la encuesta" },
      { status: 500 }
    );
  }
}
