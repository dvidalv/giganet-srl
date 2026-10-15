import { NextResponse } from "next/server";
import { auth } from "@/auth";

/**
 * Exige sesión de administrador de Giganet.
 * @returns {Promise<{ error: NextResponse } | { session: object, admin: { id: string, email: string } }>}
 */
export async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return {
      error: NextResponse.json({ error: "No autorizado" }, { status: 403 }),
    };
  }
  return {
    session,
    admin: { id: session.user.id, email: session.user.email || "" },
  };
}
