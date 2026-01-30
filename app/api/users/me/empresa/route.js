import { NextResponse } from "next/server";
import { auth } from "@/auth";
import User from "@/app/models/user";

const EMPRESA_DEFAULTS = {
  nombre: "",
  logo: "",
  rnc: "",
  razonSocial: "",
  direccion: "",
  ciudad: "",
  telefono: "",
  email: "",
};

/** GET /api/users/me/empresa - Obtener datos de empresa del usuario actual */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const user = await User.findById(session.user.id)
      .select("empresa")
      .lean();
    if (!user) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 },
      );
    }
    const empresa = { ...EMPRESA_DEFAULTS, ...(user.empresa || {}) };
    return NextResponse.json({ empresa });
  } catch (err) {
    console.error("GET /api/users/me/empresa:", err);
    return NextResponse.json(
      { error: "Error al obtener datos de empresa" },
      { status: 500 },
    );
  }
}

/** PATCH /api/users/me/empresa - Actualizar datos de empresa del usuario actual */
export async function PATCH(request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const {
    nombre,
    logo,
    rnc,
    razonSocial,
    direccion,
    ciudad,
    telefono,
    email,
  } = body;

  const updates = {};
  if (nombre !== undefined) updates["empresa.nombre"] = String(nombre).trim().slice(0, 100);
  if (logo !== undefined) updates["empresa.logo"] = String(logo).trim();
  if (rnc !== undefined) updates["empresa.rnc"] = String(rnc).trim().slice(0, 10);
  if (razonSocial !== undefined) updates["empresa.razonSocial"] = String(razonSocial).trim().slice(0, 100);
  if (direccion !== undefined) updates["empresa.direccion"] = String(direccion).trim();
  if (ciudad !== undefined) updates["empresa.ciudad"] = String(ciudad).trim();
  if (telefono !== undefined) updates["empresa.telefono"] = String(telefono).trim().slice(0, 20);
  if (email !== undefined) {
    const val = String(email).trim();
    if (val && !/^\S+@\S+\.\S+$/.test(val)) {
      return NextResponse.json(
        { error: "Email de empresa inválido" },
        { status: 400 },
      );
    }
    updates["empresa.email"] = val;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No hay campos para actualizar" },
      { status: 400 },
    );
  }

  try {
    const user = await User.findByIdAndUpdate(
      session.user.id,
      { $set: updates },
      { new: true, runValidators: true, select: "empresa", lean: true },
    );
    if (!user) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 },
      );
    }
    const empresa = { ...EMPRESA_DEFAULTS, ...(user.empresa || {}) };
    return NextResponse.json({ empresa });
  } catch (err) {
    if (err.name === "ValidationError") {
      const details = Object.values(err.errors).map((e) => e.message);
      return NextResponse.json(
        { error: "Error de validación", details },
        { status: 400 },
      );
    }
    console.error("PATCH /api/users/me/empresa:", err);
    return NextResponse.json(
      { error: "Error al actualizar datos de empresa" },
      { status: 500 },
    );
  }
}
