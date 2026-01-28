import { NextResponse } from "next/server";
import User from "@/app/models/user";
import { sendEmail } from "@/api-mail_brevo";
import crypto from "crypto";

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

    if (!user) {
      // Por seguridad, no revelar si el usuario existe o no
      return NextResponse.json(
        { message: "Si el email existe, se enviará un correo de verificación" },
        { status: 200 }
      );
    }

    // Si el usuario ya está verificado, no enviar otro email
    if (user.isVerified) {
      return NextResponse.json(
        { message: "Este email ya está verificado" },
        { status: 200 }
      );
    }

    // Generar nuevo token de verificación
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

    // Actualizar el usuario con el nuevo token
    user.verificationToken = verificationToken;
    user.verificationTokenExpires = verificationTokenExpires;
    await user.save();

    // Enviar email de verificación
    const verificationUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/auth/verify-email?token=${verificationToken}`;
    
    await sendEmail({
      to: user.email,
      subject: "Verifica tu cuenta",
      htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">¡Hola ${user.name}!</h2>
          <p>Has solicitado un nuevo enlace de verificación. Por favor, verifica tu correo electrónico haciendo clic en el siguiente enlace:</p>
          <a href="${verificationUrl}" 
             style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0;">
            Verificar Email
          </a>
          <p style="color: #666; font-size: 14px;">
            Este enlace expirará en 24 horas.
          </p>
          <p style="color: #666; font-size: 14px;">
            Si no solicitaste este email, puedes ignorarlo.
          </p>
        </div>
      `,
      textContent: `Hola ${user.name}! Por favor verifica tu email visitando: ${verificationUrl}`,
    });

    return NextResponse.json(
      { message: "Email de verificación enviado correctamente" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error al reenviar email de verificación:", error);
    return NextResponse.json(
      { error: "Error al enviar el email de verificación" },
      { status: 500 }
    );
  }
}
