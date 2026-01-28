import { NextResponse } from "next/server";
import User from "@/app/models/user";
import { passwordHash } from "@/utils/utils";

export async function POST(request) {
  try {
    const { token, password } = await request.json();

    if (!token) {
      return NextResponse.json(
        { error: "Token es requerido" },
        { status: 400 }
      );
    }

    if (!password) {
      return NextResponse.json(
        { error: "Contraseña es requerida" },
        { status: 400 }
      );
    }

    // Validar longitud mínima de contraseña
    if (password.length < 8) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 8 caracteres" },
        { status: 400 }
      );
    }

    // Buscar usuario con el token válido y no expirado
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    }).select("+resetPasswordToken +resetPasswordExpires"); 

    if (!user) {
      return NextResponse.json(
        { error: "Token inválido o expirado" },
        { status: 400 }
      );
    }

    // Hashear la nueva contraseña
    const hashedPassword = passwordHash(password);

    // Actualizar contraseña y limpiar tokens de reseteo
    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    return NextResponse.json(
      { message: "Contraseña actualizada correctamente" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error al resetear contraseña:", error);
    return NextResponse.json(
      { error: "Error al resetear la contraseña" },
      { status: 500 }
    );
  }
}
