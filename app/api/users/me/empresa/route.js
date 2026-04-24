import { NextResponse } from "next/server";
import { auth } from "@/auth";
import User from "@/app/models/user";
import { encryptTheFactoryPassword } from "@/utils/thefactoryCredentials";

const EMPRESA_DEFAULTS = {
  nombre: "",
  logo: "",
  rnc: "",
  razonSocial: "",
  direccion: "",
  ciudad: "",
  telefono: "",
  email: "",
  theFactoryUsuario: "",
  theFactoryClaveConfigured: false,
};

function sanitizeEmpresa(empresa = {}, hasClaveEnc = false) {
  const safe = { ...EMPRESA_DEFAULTS, ...(empresa || {}) };
  delete safe.theFactoryClaveEnc;
  safe.theFactoryClaveConfigured = !!hasClaveEnc;
  return safe;
}

async function hasTheFactoryClaveStored(userId) {
  const row = await User.findById(userId)
    .select("+empresa.theFactoryClaveEnc")
    .lean();
  return !!(row?.empresa?.theFactoryClaveEnc?.trim());
}

/** GET /api/users/me/empresa - Obtener datos de empresa del usuario actual */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const user = await User.findById(session.user.id).select("empresa").lean();
    if (!user) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 },
      );
    }
    const hasClave = await hasTheFactoryClaveStored(session.user.id);
    const empresa = sanitizeEmpresa(user.empresa || {}, hasClave);
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
    theFactoryUsuario,
    theFactoryClave,
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
  if (theFactoryUsuario !== undefined) {
    updates["empresa.theFactoryUsuario"] = String(theFactoryUsuario)
      .trim()
      .slice(0, 100);
  }
  if (theFactoryClave !== undefined) {
    const val = String(theFactoryClave).trim();
    if (val) {
      try {
        updates["empresa.theFactoryClaveEnc"] = encryptTheFactoryPassword(val);
      } catch (error) {
        console.error("PATCH /api/users/me/empresa encryption error:", error);
        return NextResponse.json(
          { error: "No se pudo proteger la clave de The Factory" },
          { status: 500 },
        );
      }
      updates["empresa.theFactoryCredsUpdatedAt"] = new Date();
    } else {
      updates["empresa.theFactoryClaveEnc"] = "";
      updates["empresa.theFactoryCredsUpdatedAt"] = null;
    }
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
      {
        new: true,
        runValidators: true,
        select: "empresa",
        lean: true,
      },
    );
    if (!user) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 },
      );
    }
    const hasClave = await hasTheFactoryClaveStored(session.user.id);
    const empresa = sanitizeEmpresa(user.empresa || {}, hasClave);
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
