import { NextResponse } from "next/server";
import { auth } from "@/auth";
import User from "@/app/models/user";
import { passwordHash } from "@/utils/utils";

const SELECT =
  "-password -verificationToken -verificationTokenExpires -resetPasswordToken -resetPasswordExpires";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return {
      error: NextResponse.json({ error: "No autorizado" }, { status: 403 }),
    };
  }
  return { session };
}

/** GET /api/users/[id] - Obtener un usuario */
export async function GET(request, { params }) {
  const check = await requireAdmin();
  if (check.error) return check.error;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  try {
    const user = await User.findById(id).select(SELECT).lean();
    if (!user)
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 },
      );
    user.id = user._id.toString();
    return NextResponse.json({ user });
  } catch (err) {
    console.error("GET /api/users/[id]:", err);
    return NextResponse.json(
      { error: "Error al obtener usuario" },
      { status: 500 },
    );
  }
}

/** PUT /api/users/[id] - Actualizar usuario */
export async function PUT(request, { params }) {
  const check = await requireAdmin();
  if (check.error) return check.error;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const { name, email, role, isActive, isVerified, password } = body;

  try {
    const user = await User.findById(id);
    if (!user)
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 },
      );

    if (name !== undefined) user.name = String(name).trim();
    if (email !== undefined) user.email = String(email).trim().toLowerCase();
    if (role !== undefined) user.role = role === "admin" ? "admin" : "user";
    if (typeof isActive === "boolean") user.isActive = isActive;
    if (typeof isVerified === "boolean") user.isVerified = isVerified;
    if (password !== undefined && password !== "") {
      if (password.length < 8) {
        return NextResponse.json(
          { error: "La contraseña debe tener al menos 8 caracteres" },
          { status: 400 },
        );
      }
      user.password = passwordHash(password);
    }

    await user.save();

    const u = user.toObject();
    delete u.password;
    delete u.verificationToken;
    delete u.verificationTokenExpires;
    u.id = u._id.toString();

    return NextResponse.json({ user: u });
  } catch (err) {
    if (err.name === "ValidationError") {
      const details = Object.values(err.errors).map((e) => e.message);
      return NextResponse.json(
        { error: "Error de validación", details },
        { status: 400 },
      );
    }
    if (err.code === 11000) {
      return NextResponse.json(
        { error: "El email ya está en uso" },
        { status: 400 },
      );
    }
    console.error("PUT /api/users/[id]:", err);
    return NextResponse.json(
      { error: "Error al actualizar usuario" },
      { status: 500 },
    );
  }
}

/** DELETE /api/users/[id] - Eliminar usuario */
export async function DELETE(request, { params }) {
  const check = await requireAdmin();
  if (check.error) return check.error;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  const session = check.session;
  if (session.user.id === id) {
    return NextResponse.json(
      { error: "No puedes eliminar tu propia cuenta" },
      { status: 400 },
    );
  }

  try {
    const user = await User.findByIdAndDelete(id);
    if (!user)
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 },
      );
    return NextResponse.json({ message: "Usuario eliminado" });
  } catch (err) {
    console.error("DELETE /api/users/[id]:", err);
    return NextResponse.json(
      { error: "Error al eliminar usuario" },
      { status: 500 },
    );
  }
}
