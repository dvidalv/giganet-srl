import { NextResponse } from "next/server";
import { auth } from "@/auth";
import Encuesta from "@/app/models/encuesta";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongoDB";
import {
  revalidateEncuestaAdmin,
  revalidateHomepageTestimonials,
} from "@/lib/encuestas/revalidateHomepageTestimonials";

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
        publishOnHome: e.publishOnHome === true,
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

/**
 * PATCH /api/encuestas/[id]
 * Body: { publishOnHome: boolean }
 * Toggles whether the response may appear on the public homepage.
 */
export async function PATCH(request, { params }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  if (!id || !Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "ID no válido" }, { status: 400 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON no válido" }, { status: 400 });
  }

  if (typeof body?.publishOnHome !== "boolean") {
    return NextResponse.json(
      { error: "publishOnHome (boolean) es obligatorio." },
      { status: 400 }
    );
  }

  const wanted = body.publishOnHome === true;
  const objectId = new Types.ObjectId(id);

  try {
    await connectDB();

    // Use the native collection update so boolean `false` is never stripped by
    // a stale/strict Mongoose schema that might omit publishOnHome.
    const result = await Encuesta.collection.updateOne(
      { _id: objectId },
      { $set: { publishOnHome: wanted } }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 });
    }

    const fresh = await Encuesta.collection.findOne(
      { _id: objectId },
      { projection: { publishOnHome: 1, status: 1 } }
    );

    if (!fresh) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 });
    }

    const publishOnHome = fresh.publishOnHome === true;

    if (publishOnHome !== wanted) {
      console.error("PATCH /api/encuestas/[id]: publishOnHome mismatch after native update", {
        id,
        wanted,
        stored: fresh.publishOnHome,
        result,
      });
      return NextResponse.json(
        {
          error: "No se pudo guardar el estado de publicación",
          details: { wanted, stored: fresh.publishOnHome },
        },
        { status: 500 }
      );
    }

    try {
      revalidateHomepageTestimonials();
      revalidateEncuestaAdmin(id);
    } catch (revalErr) {
      // Persist succeeded; cache revalidation must not fail the toggle.
      console.error("PATCH /api/encuestas/[id]: revalidate warning", revalErr);
    }

    return NextResponse.json({
      encuesta: {
        id: String(fresh._id),
        status: fresh.status,
        publishOnHome,
      },
    });
  } catch (err) {
    console.error("PATCH /api/encuestas/[id]:", err);
    return NextResponse.json(
      {
        error: "Error al actualizar la encuesta",
        details: err?.message || String(err),
      },
      { status: 500 }
    );
  }
}
