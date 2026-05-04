import { NextResponse } from "next/server";
import { auth } from "@/auth";
import Encuesta from "@/app/models/encuesta";
import { Types } from "mongoose";

const MAX_LIMIT = 200;

/** GET /api/encuestas — listar encuestas (solo admin) */
export async function GET(request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status")?.trim();
  const userId = searchParams.get("userId")?.trim();
  const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10) || 1);
  const limitRaw = Number.parseInt(searchParams.get("limit") || "50", 10) || 50;
  const limit = Math.min(Math.max(1, limitRaw), MAX_LIMIT);
  const skip = (page - 1) * limit;

  const filter = {};
  if (status && ["pending", "responded", "expired"].includes(status)) {
    filter.status = status;
  }
  if (userId && Types.ObjectId.isValid(userId)) {
    filter.userId = new Types.ObjectId(userId);
  }

  try {
    const [items, total] = await Promise.all([
      Encuesta.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      Encuesta.countDocuments(filter).exec(),
    ]);

    const encuestas = items.map((e) => ({
      id: e._id.toString(),
      userId: e.userId?.toString?.() ?? String(e.userId),
      empresa: e.empresa || {},
      token: e.token,
      status: e.status,
      expiresAt: e.expiresAt,
      sentAt: e.sentAt,
      respondedAt: e.respondedAt,
      createdAt: e.createdAt,
      nps: e.answers?.nps ?? null,
    }));

    return NextResponse.json({
      encuestas,
      total,
      page,
      limit,
    });
  } catch (err) {
    console.error("GET /api/encuestas:", err);
    return NextResponse.json(
      { error: "Error al listar encuestas" },
      { status: 500 }
    );
  }
}
