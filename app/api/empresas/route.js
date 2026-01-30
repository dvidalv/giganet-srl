import { NextResponse } from "next/server";
import { auth } from "@/auth";
import User from "@/app/models/user";

const SELECT =
  "-password -verificationToken -verificationTokenExpires -resetPasswordToken -resetPasswordExpires";

/** GET /api/empresas - Listar todas las empresas (solo admin) */
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const users = await User.find({
      "empresa.rnc": { $regex: /\S/ },
    })
      .select(SELECT)
      .sort({ "empresa.razonSocial": 1, "empresa.nombre": 1 })
      .lean();

    const empresas = users.map((u) => ({
      id: u._id.toString(),
      name: u.name,
      email: u.email,
      empresa: {
        nombre: u.empresa?.nombre ?? "",
        logo: u.empresa?.logo ?? "",
        rnc: u.empresa?.rnc ?? "",
        razonSocial: u.empresa?.razonSocial ?? "",
        telefono: u.empresa?.telefono ?? "",
      },
    }));

    return NextResponse.json({ empresas });
  } catch (err) {
    console.error("GET /api/empresas:", err);
    return NextResponse.json(
      { error: "Error al listar empresas" },
      { status: 500 }
    );
  }
}
