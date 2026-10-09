import { NextResponse } from "next/server";
import { auth } from "@/auth";
import User from "@/app/models/user";
import {
  getComprobanteModelForUserId,
  userUsesComprobantesDevMongo,
} from "@/lib/comprobantesStore";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return {
      error: NextResponse.json({ error: "No autorizado" }, { status: 403 }),
    };
  }
  return { session };
}

/** GET /api/users/[id]/comprobantes — secuencias de la empresa (demo o producción). */
export async function GET(_request, { params }) {
  const check = await requireAdmin();
  if (check.error) return check.error;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  }

  try {
    const user = await User.findById(id).select("empresa.theFactoryAmbiente").lean();
    if (!user) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 },
      );
    }

    const useDemo = await userUsesComprobantesDevMongo(id);
    const Comprobante = await getComprobanteModelForUserId(id);
    const rangos = await Comprobante.find({ usuario: id })
      .sort({ tipo_comprobante: 1, numero_inicial: 1 })
      .lean();

    return NextResponse.json({
      data: rangos,
      ambiente: useDemo ? "demo" : "production",
    });
  } catch (err) {
    console.error("GET /api/users/[id]/comprobantes:", err);
    const msg = String(err?.message ?? "");
    if (msg.includes("MONGODB_URI_DEV")) {
      return NextResponse.json(
        {
          error:
            "La empresa está en demo y no hay base de comprobantes de prueba configurada (MONGODB_URI_DEV).",
        },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: "Error al listar las secuencias de la empresa" },
      { status: 500 },
    );
  }
}
