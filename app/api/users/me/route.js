import { NextResponse } from "next/server";
import { auth } from "@/auth";
import User from "@/app/models/user";
import { passwordCompare, passwordHash } from "@/utils/utils";

const SELECT =
  "-password -verificationToken -verificationTokenExpires -resetPasswordToken -resetPasswordExpires -apiKeyHash";

function toPublicUser(user) {
  const u = typeof user.toObject === "function" ? user.toObject() : { ...user };
  delete u.password;
  delete u.verificationToken;
  delete u.verificationTokenExpires;
  delete u.resetPasswordToken;
  delete u.resetPasswordExpires;
  delete u.apiKeyHash;
  u.id = (u._id ?? u.id)?.toString?.() ?? String(u._id ?? u.id);
  return {
    id: u.id,
    name: u.name ?? "",
    email: u.email ?? "",
    image: u.image ?? "",
    role: u.role ?? "user",
  };
}

/** GET /api/users/me - Perfil del usuario autenticado */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const user = await User.findById(session.user.id).select(SELECT).lean();
    if (!user) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 },
      );
    }
    return NextResponse.json({ user: toPublicUser(user) });
  } catch (err) {
    console.error("GET /api/users/me:", err);
    return NextResponse.json(
      { error: "Error al obtener el perfil" },
      { status: 500 },
    );
  }
}

/** PATCH /api/users/me - Actualizar perfil del usuario autenticado */
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

  const { name, email, image, currentPassword, newPassword } = body;

  try {
    const user = await User.findById(session.user.id).select("+password");
    if (!user) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 },
      );
    }

    const nextEmail =
      email !== undefined ? String(email).trim().toLowerCase() : undefined;
    const emailChanging =
      nextEmail !== undefined && nextEmail !== user.email.toLowerCase();
    const wantsPasswordChange =
      typeof newPassword === "string" && newPassword.length > 0;

    if (emailChanging || wantsPasswordChange) {
      if (!currentPassword || typeof currentPassword !== "string") {
        return NextResponse.json(
          {
            error:
              "Debes indicar tu contraseña actual para cambiar el email o la clave",
          },
          { status: 400 },
        );
      }
      if (!passwordCompare(currentPassword, user.password)) {
        return NextResponse.json(
          { error: "La contraseña actual es incorrecta" },
          { status: 400 },
        );
      }
    }

    if (name !== undefined) {
      const trimmed = String(name).trim();
      if (trimmed.length < 3 || trimmed.length > 50) {
        return NextResponse.json(
          { error: "El nombre debe tener entre 3 y 50 caracteres" },
          { status: 400 },
        );
      }
      user.name = trimmed;
    }

    if (emailChanging) {
      if (!nextEmail || !/^\S+@\S+\.\S+$/.test(nextEmail)) {
        return NextResponse.json(
          { error: "Email inválido" },
          { status: 400 },
        );
      }
      user.email = nextEmail;
    }

    if (image !== undefined) {
      user.image = String(image).trim();
    }

    if (wantsPasswordChange) {
      if (newPassword.length < 8) {
        return NextResponse.json(
          { error: "La contraseña nueva debe tener al menos 8 caracteres" },
          { status: 400 },
        );
      }
      user.password = passwordHash(newPassword);
    }

    await user.save();

    return NextResponse.json({ user: toPublicUser(user) });
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
    console.error("PATCH /api/users/me:", err);
    return NextResponse.json(
      { error: "Error al actualizar el perfil" },
      { status: 500 },
    );
  }
}
