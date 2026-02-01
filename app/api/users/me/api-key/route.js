import { NextResponse } from "next/server";
import { auth } from "@/auth";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongoDB";
import User from "@/app/models/user";
import { generateApiKey, hashApiKey } from "@/utils/apiKey";

/** GET /api/users/me/api-key - Indica si el usuario tiene API Key configurada (no devuelve la key) */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const user = await User.findById(session.user.id)
      .select("+apiKeyHash")
      .lean();
    if (!user) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }
    const configured = Boolean(user.apiKeyHash);
    return NextResponse.json({ configured });
  } catch (err) {
    console.error("GET /api/users/me/api-key:", err);
    return NextResponse.json(
      { error: "Error al verificar API Key" },
      { status: 500 }
    );
  }
}

/** POST /api/users/me/api-key - Generar o regenerar API Key. Devuelve la key en claro UNA SOLA VEZ. */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const plainKey = generateApiKey();
    const keyHash = hashApiKey(plainKey);
    if (!keyHash) {
      return NextResponse.json(
        { error: "Error al generar API Key" },
        { status: 500 }
      );
    }

    // Escribir apiKeyHash con el driver nativo para evitar que un modelo
    // Mongoose cacheado (sin el campo en el schema) ignore el $set
    await connectDB();
    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json(
        { error: "Error de conexión a la base de datos" },
        { status: 500 }
      );
    }
    const userId = new mongoose.Types.ObjectId(session.user.id);
    const result = await db.collection("users").updateOne(
      { _id: userId },
      { $set: { apiKeyHash: keyHash } }
    );
    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message:
        "API Key generada. Guárdala en un lugar seguro; no se volverá a mostrar.",
      apiKey: plainKey,
    });
  } catch (err) {
    console.error("POST /api/users/me/api-key:", err);
    return NextResponse.json(
      { error: "Error al generar API Key" },
      { status: 500 }
    );
  }
}
