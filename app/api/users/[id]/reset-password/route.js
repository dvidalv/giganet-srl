import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/auth";
import User from "@/app/models/user";
import { sendEmail } from "@/api-mail_brevo";
import crypto from "crypto";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return {
      error: NextResponse.json({ error: "No autorizado" }, { status: 403 }),
    };
  }
  return { session };
}

/** POST /api/users/[id]/reset-password - Enviar email de restablecimiento (solo admin) */
export async function POST(request, { params }) {
  const check = await requireAdmin();
  if (check.error) return check.error;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  try {
    const user = await User.findById(id);
    if (!user) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 },
      );
    }

    const resetPasswordToken = crypto.randomBytes(32).toString("hex");
    const resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);

    const h = await headers();
    const host = h.get("host");
    const proto = h.get("x-forwarded-proto") ?? "http";
    const baseUrl =
      (process.env.APP_URL || process.env.NEXTAUTH_URL || "").replace(
        /\/$/,
        "",
      ) || `${proto}://${host}`;
    const resetUrl = `${baseUrl}/reset-password?token=${resetPasswordToken}`;

    try {
      await sendEmail({
        to: user.email,
        subject: "Resetear tu contraseña",
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">¡Hola ${user.name}!</h2>
            <p>Un administrador ha solicitado el restablecimiento de tu contraseña. Haz clic en el siguiente enlace para crear una nueva contraseña:</p>
            <a href="${resetUrl}" 
              style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0;">
            Resetear Contraseña
          </a>
          <p style="color: #666; font-size: 14px;">
            Este enlace expirará en 1 hora.
          </p>
          <p style="color: #666; font-size: 14px;">
            Si no esperabas este email, puedes ignorarlo y tu contraseña permanecerá sin cambios.
          </p>
          </div>
        `,
        textContent: `Hola ${user.name}! Para resetear tu contraseña, visita: ${resetUrl}`,
      });
    } catch (error) {
      console.error("Error al enviar email de reseteo:", error);
      return NextResponse.json(
        {
          error:
            "Error al enviar el email de restablecimiento. Inténtalo de nuevo.",
        },
        { status: 500 },
      );
    }

    user.resetPasswordToken = resetPasswordToken;
    user.resetPasswordExpires = resetPasswordExpires;
    await user.save();

    return NextResponse.json({
      message: `Se envió el enlace de restablecimiento a ${user.email}`,
    });
  } catch (err) {
    console.error("POST /api/users/[id]/reset-password:", err);
    return NextResponse.json(
      { error: "Error al procesar la solicitud" },
      { status: 500 },
    );
  }
}
