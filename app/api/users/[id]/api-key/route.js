import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongoDB";
import User from "@/app/models/user";
import { requireAdmin } from "@/lib/adminAuth";
import { generateApiKey, hashApiKey } from "@/utils/apiKey";

/** GET /api/users/[id]/api-key - Si la empresa tiene API key (no la devuelve). Solo admin. */
export async function GET(_request, { params }) {
  const check = await requireAdmin();
  if (check.error) return check.error;

  const { id } = await params;
  if (!id || !mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  }

  try {
    const user = await User.findById(id).select("+apiKeyHash").lean();
    if (!user) {
      return NextResponse.json({ error: "Empresa no encontrada" }, { status: 404 });
    }
    return NextResponse.json({ configured: Boolean(user.apiKeyHash) });
  } catch (err) {
    console.error("GET /api/users/[id]/api-key:", err);
    return NextResponse.json({ error: "Error al verificar la API key" }, { status: 500 });
  }
}

/** POST /api/users/[id]/api-key - Genera o regenera la API key. Se muestra una sola vez. Solo admin. */
export async function POST(_request, { params }) {
  const check = await requireAdmin();
  if (check.error) return check.error;

  const { id } = await params;
  if (!id || !mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  }

  try {
    const plainKey = generateApiKey();
    const keyHash = hashApiKey(plainKey);
    if (!keyHash) {
      return NextResponse.json({ error: "Error al generar la API key" }, { status: 500 });
    }

    await connectDB();
    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json({ error: "Error de conexión a la base de datos" }, { status: 500 });
    }
    const result = await db.collection("users").updateOne(
      { _id: new mongoose.Types.ObjectId(id) },
      { $set: { apiKeyHash: keyHash } },
    );
    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Empresa no encontrada" }, { status: 404 });
    }

    return NextResponse.json({
      message: "API key generada. Guárdela en un lugar seguro; no se volverá a mostrar.",
      apiKey: plainKey,
    });
  } catch (err) {
    console.error("POST /api/users/[id]/api-key:", err);
    return NextResponse.json({ error: "Error al generar la API key" }, { status: 500 });
  }
}
