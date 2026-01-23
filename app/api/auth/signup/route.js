import { NextResponse } from "next/server";
import { passwordHash } from "@/utils/utils";
import User from "@/app/models/user";

export async function POST(request) {
  const body = await request.json();
  const { email, password, fullName } = body;
  // console.log(body);
  try {
    if (!email || !password || !fullName) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Validar que password sea un string
    if (typeof password !== "string") {
      return NextResponse.json(
        { error: "Password must be a string" },
        { status: 400 },
      );
    }

    const hashedPassword = passwordHash(password);
    const user = await User.create({
      email,
      password: hashedPassword,
      fullName,
    });
    
    // Convertir a objeto y eliminar el password antes de retornar
    const userObject = user.toObject(); // Convertir a objeto
    delete userObject.password;
    
    return NextResponse.json(
      { message: "User created successfully", user: userObject },
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
    // Manejar errores de duplicado (email único)
    if (error.code === 11000) {
      return NextResponse.json(
        {
          error: "Email already exists",
        },
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
