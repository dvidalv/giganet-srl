import { NextResponse } from "next/server";
import { auth } from "@/auth";
import User from "@/app/models/user";
import { listarSeriesTheFactoryLogic } from "@/app/controllers/comprobantes";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return {
      error: NextResponse.json({ error: "No autorizado" }, { status: 403 }),
    };
  }
  return { session };
}

/** GET /api/users/[id]/thefactory-series — series de The Factory de esa empresa. */
export async function GET(_request, { params }) {
  const check = await requireAdmin();
  if (check.error) return check.error;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  }

  try {
    const user = await User.findById(id).select("_id").lean();
    if (!user) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 },
      );
    }

    const result = await listarSeriesTheFactoryLogic({}, { userId: id });
    return NextResponse.json(result.data, { status: result.status });
  } catch (err) {
    console.error("GET /api/users/[id]/thefactory-series:", err);
    return NextResponse.json(
      { error: "Error al consultar las series de The Factory" },
      { status: 500 },
    );
  }
}
