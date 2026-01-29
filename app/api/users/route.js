import { NextResponse } from "next/server";
import { auth } from "@/auth";
import User, { getAllUsers, countUsers } from "@/app/models/user";
import { passwordHash } from "@/utils/utils";
import crypto from "crypto";

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

/** GET /api/users - Listar usuarios (búsqueda, filtro estado, paginación) */
export async function GET(request) {
  const check = await requireAdmin();
  if (check.error) return check.error;

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim() || "";
  const status = searchParams.get("status") || "all"; // all | active | inactive | pending
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(
    50,
    Math.max(5, parseInt(searchParams.get("limit") || "10", 10)),
  );
  const skip = (page - 1) * limit;

  try {
    const filter = {};

    if (search) {
      filter.$or = [
        { email: { $regex: search, $options: "i" } },
        { name: { $regex: search, $options: "i" } },
      ];
    }

    if (status === "active") filter.isActive = true;
    else if (status === "inactive") filter.isActive = false;
    else if (status === "pending") filter.isVerified = false;

    const [users, total] = await Promise.all([
      getAllUsers({
        filter,
        sort: { createdAt: -1 },
        limit,
        skip,
        select: SELECT,
      }),
      countUsers(filter),
    ]);

    return NextResponse.json({
      users: users.map((u) => ({
        ...(u.toObject?.() ?? u),
        id: u._id?.toString?.() ?? u.id,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("GET /api/users:", err);
    return NextResponse.json(
      { error: "Error al listar usuarios" },
      { status: 500 },
    );
  }
}

/** POST /api/users - Crear usuario (solo admin) */
export async function POST(request) {
  const check = await requireAdmin();
  if (check.error) return check.error;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const { email, password, name, role = "user", isActive = true } = body;

  if (!email || !password || !name) {
    return NextResponse.json(
      { error: "Faltan campos requeridos: email, password, name" },
      { status: 400 },
    );
  }

  const emailNorm = String(email).trim().toLowerCase();
  if (typeof password !== "string" || password.length < 8) {
    return NextResponse.json(
      { error: "La contraseña debe tener al menos 8 caracteres" },
      { status: 400 },
    );
  }

  try {
    const existing = await User.findOne({ email: emailNorm });
    if (existing) {
      return NextResponse.json(
        { error: "El email ya está registrado" },
        { status: 400 },
      );
    }

    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const user = await User.create({
      email: emailNorm,
      password: passwordHash(password),
      name: String(name).trim(),
      role: role === "admin" ? "admin" : "user",
      isActive: !!isActive,
      isVerified: false,
      verificationToken,
      verificationTokenExpires,
    });

    const u = user.toObject();
    delete u.password;
    delete u.verificationToken;
    delete u.verificationTokenExpires;
    u.id = u._id.toString();

    return NextResponse.json({ user: u }, { status: 201 });
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
        { error: "El email ya está registrado" },
        { status: 400 },
      );
    }
    console.error("POST /api/users:", err);
    return NextResponse.json(
      { error: "Error al crear usuario" },
      { status: 500 },
    );
  }
}
