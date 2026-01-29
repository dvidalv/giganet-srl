import { NextResponse } from "next/server";
import User from "@/app/models/user";

/**
 * GET /api/auth/has-admin
 * Comprueba si existe al menos un usuario con role "admin" en MongoDB.
 * Útil para ocultar el enlace de registro cuando ya hay administrador.
 */
export async function GET() {
  try {
    const admin = await User.exists({ role: "admin" });
    return NextResponse.json({ hasAdmin: !!admin });
  } catch (error) {
    console.error("Error al comprobar si hay admin:", error);
    return NextResponse.json(
      { error: "Error al comprobar administrador", hasAdmin: false },
      { status: 500 },
    );
  }
}
