import { NextResponse } from "next/server";
import { passwordHash } from "@/utils/utils";
import User from "@/app/models/user";
import { sendEmail } from "@/api-mail_brevo";
import crypto from "crypto";
import { headers } from "next/headers";

export async function POST(request) {
  const body = await request.json();
  let { email, password, name } = body;

  try {
    if (!email || !password || !name) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Normalizar email: trim y minúsculas para evitar duplicados por formato
    email = String(email).trim().toLowerCase();

    // Validar que password sea un string
    if (typeof password !== "string") {
      return NextResponse.json(
        { error: "Password must be a string" },
        { status: 400 },
      );
    }

    // Validar longitud de la contraseña ANTES de hashearla
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters long" },
        { status: 400 },
      );
    }

    // Comprobar si el email ya existe (usando el email normalizado)
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return NextResponse.json(
        { error: "Email already exists" },
        { status: 400 },
      );
    }

    const hashedPassword = passwordHash(password);

    // El primer usuario registrado será administrador
    const isFirstUser = (await User.countDocuments()) === 0;

    // Generar token de verificación
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

    const user = await User.create({
      email,
      password: hashedPassword,
      name: name.trim(),
      role: isFirstUser ? "admin" : "user",
      verificationToken,
      verificationTokenExpires,
    });

    const h = await headers();
    const host = h.get("host");
    const proto = h.get("x-forwarded-proto") ?? "http";
    const baseUrl =
      (process.env.APP_URL || process.env.NEXTAUTH_URL || "").replace(
        /\/$/,
        "",
      ) || `${proto}://${host}`;

    // Enviar email de verificación
    try {
      const verificationUrl = `${baseUrl}/api/auth/verify-email?token=${verificationToken}`;

      await sendEmail({
        to: email,
        subject: "Verifica tu cuenta",
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">¡Bienvenido ${name}!</h2>
            <p>Gracias por registrarte. Por favor, verifica tu correo electrónico haciendo clic en el siguiente enlace:</p>
            <a href="${verificationUrl}" 
               style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0;">
              Verificar Email
            </a>
            <p style="color: #666; font-size: 14px;">
              Este enlace expirará en 24 horas.
            </p>
            <p style="color: #666; font-size: 14px;">
              Si no creaste esta cuenta, puedes ignorar este email.
            </p>
          </div>
        `,
        textContent: `Bienvenido ${name}! Por favor verifica tu email visitando: ${verificationUrl}`,
      });
    } catch (emailError) {
      console.error("Error al enviar email de verificación:", emailError);
      // No fallar el registro si el email falla, solo loggear el error
    }

    // Convertir a objeto y eliminar el password antes de retornar
    const userObject = user.toObject(); // Convertir a objeto
    delete userObject.password; // Eliminar el password antes de retornar
    delete userObject.verificationToken; // No exponer el token
    delete userObject.verificationTokenExpires;

    return NextResponse.json(
      {
        message: "Usuario creado correctamente. Por favor verifica tu email.",
        user: userObject,
      },
      { status: 201 },
    );
  } catch (error) {
    // Manejar errores de validación de Mongoose
    if (error.name === "ValidationError") {
      const validationErrors = Object.values(error.errors).map(
        (err) => err.message,
      );
      return NextResponse.json(
        {
          error: "Validation error",
          details: validationErrors,
        },
        { status: 400 },
      );
    }
    // Manejar errores de duplicado (email único), p. ej. condición de carrera
    if (error.code === 11000) {
      return NextResponse.json(
        { error: "Email already exists" },
        { status: 400 },
      );
    }
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
