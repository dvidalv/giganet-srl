import { NextResponse } from "next/server";
import User from "@/app/models/user";
import { sendEmail } from "@/api-mail_brevo";
import crypto from "crypto";
import { headers } from "next/headers";

export async function POST(request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email es requerido" },
        { status: 400 }
      );
    }

    // Buscar usuario por email
    const user = await User.findOne({ 
      email: email.toLowerCase().trim() 
    });

    // Por seguridad, siempre retornar el mismo mensaje
    // sin revelar si el usuario existe o no
    if (!user) {
      return NextResponse.json(
        { message: "Si el email existe, recibirás instrucciones para resetear tu contraseña" },
        { status: 200 }
      );
    }

    // Generar token de reseteo de contraseña
    const resetPasswordToken = crypto.randomBytes(32).toString('hex');
    const resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    // Actualizar el usuario con el token de reseteo
    user.resetPasswordToken = resetPasswordToken;
    user.resetPasswordExpires = resetPasswordExpires;
    await user.save();

    const h = await headers();
    const host = h.get("host");
    const proto = h.get("x-forwarded-proto") ?? "http";
    const baseUrl = `${proto}://${host}`;
    // Enviar email con el enlace de reseteo
    const resetUrl = `${baseUrl}/reset-password?token=${resetPasswordToken}`;
    
    await sendEmail({
      to: user.email,
      subject: "Resetear tu contraseña",
      htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">¡Hola ${user.name}!</h2>
          <p>Has solicitado resetear tu contraseña. Haz clic en el siguiente enlace para crear una nueva contraseña:</p>
          <a href="${resetUrl}" 
             style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0;">
            Resetear Contraseña
          </a>
          <p style="color: #666; font-size: 14px;">
            Este enlace expirará en 1 hora.
          </p>
          <p style="color: #666; font-size: 14px;">
            Si no solicitaste resetear tu contraseña, puedes ignorar este email y tu contraseña permanecerá sin cambios.
          </p>
        </div>
      `,
      textContent: `Hola ${user.name}! Para resetear tu contraseña, visita: ${resetUrl}`,
    });

    return NextResponse.json(
      { message: "Si el email existe, recibirás instrucciones para resetear tu contraseña" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error al procesar solicitud de reseteo:", error);
    return NextResponse.json(
      { error: "Error al procesar la solicitud" },
      { status: 500 }
    );
  }
}
