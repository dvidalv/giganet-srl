import { NextResponse } from "next/server";
import { auth } from "@/auth";

async function getComprobante() {
  const mod = await import("@/app/models/comprobante");
  const def = mod.default;
  const Comprobante =
    mod.Comprobante ??
    (def && typeof def.Comprobante !== "undefined" ? def.Comprobante : null) ??
    (def && typeof def.create === "function" ? def : null);
  if (!Comprobante || typeof Comprobante.create !== "function") {
    throw new Error("Comprobante model not available");
  }
  return Comprobante;
}

/** GET /api/comprobantes - Listar secuencias del usuario actual */
export async function GET(request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const tipo = searchParams.get("tipo_comprobante") || "";
    const estado = searchParams.get("estado") || "";

    const filters = { usuario: session.user.id };
    if (tipo) filters.tipo_comprobante = tipo;
    if (estado) filters.estado = estado;

    const skip = (page - 1) * limit;
    const Comprobante = await getComprobante();
    const [rangos, total] = await Promise.all([
      Comprobante.find(filters).sort({ fechaCreacion: -1 }).skip(skip).limit(limit).lean(),
      Comprobante.countDocuments(filters),
    ]);

    return NextResponse.json({
      data: rangos,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("GET /api/comprobantes:", err);
    return NextResponse.json(
      { error: "Error al listar secuencias" },
      { status: 500 },
    );
  }
}

/** POST /api/comprobantes - Crear nueva secuencia (rango de numeración) */
export async function POST(request) {
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
    rnc,
    razon_social,
    tipo_comprobante,
    descripcion_tipo,
    prefijo,
    numero_inicial,
    numero_final,
    fecha_autorizacion,
    fecha_vencimiento,
    alerta_minima_restante,
    comentario,
  } = body;

  const tipoOpcionalesFechaVenc = ["32", "34"];
  const requiereFechaVenc = tipo_comprobante && !tipoOpcionalesFechaVenc.includes(tipo_comprobante);

  const rangoData = {
    rnc: rnc ? String(rnc).replace(/\D/g, "").trim() : "",
    razon_social: razon_social ? String(razon_social).trim() : "",
    tipo_comprobante: tipo_comprobante ? String(tipo_comprobante).trim() : "",
    descripcion_tipo: descripcion_tipo ? String(descripcion_tipo).trim().slice(0, 100) : "",
    prefijo: prefijo && /^[A-Z]$/.test(String(prefijo)) ? String(prefijo) : "E",
    numero_inicial: numero_inicial != null ? Number(numero_inicial) : undefined,
    numero_final: numero_final != null ? Number(numero_final) : undefined,
    fecha_autorizacion: fecha_autorizacion ? new Date(fecha_autorizacion) : undefined,
    fecha_vencimiento:
      fecha_vencimiento && String(fecha_vencimiento).trim()
        ? new Date(fecha_vencimiento)
        : requiereFechaVenc
          ? undefined
          : null,
    alerta_minima_restante:
      alerta_minima_restante != null ? Number(alerta_minima_restante) : undefined,
    comentario: comentario ? String(comentario).trim().slice(0, 500) : "",
    usuario: session.user.id,
  };

  if (rangoData.tipo_comprobante && tipoOpcionalesFechaVenc.includes(rangoData.tipo_comprobante)) {
    delete rangoData.fecha_vencimiento;
  }

  try {
    const Comprobante = await getComprobante();
    const rango = await Comprobante.create(rangoData);
    const created = rango.toObject ? rango.toObject() : rango;
    return NextResponse.json({
      status: "success",
      message: "Secuencia creada correctamente",
      data: created,
    });
  } catch (err) {
    console.error("POST /api/comprobantes:", err);

    if (err.name === "ValidationError") {
      const details = Object.values(err.errors || {}).map((e) => e.message);
      return NextResponse.json(
        { error: "Datos del rango inválidos", details: details.join(" ") },
        { status: 400 },
      );
    }
    if (err.code === 11000) {
      return NextResponse.json(
        { error: "Ya existe un rango con esos números para este RNC y este mismo tipo de comprobante. Otros tipos pueden usar el mismo rango." },
        { status: 409 },
      );
    }
    if (err.message && err.message.includes("superpuestos")) {
      return NextResponse.json(
        { error: "Solo se comprueba superposición con secuencias del mismo tipo de comprobante. " + err.message },
        { status: 409 },
      );
    }
    if (err.message && (err.message.includes("número final") || err.message.includes("vencimiento"))) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Error al crear la secuencia" },
      { status: 500 },
    );
  }
}
