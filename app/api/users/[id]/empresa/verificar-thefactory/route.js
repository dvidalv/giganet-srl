import { NextResponse } from "next/server";
import { auth } from "@/auth";
import User from "@/app/models/user";
import { decryptTheFactoryPassword } from "@/utils/thefactoryCredentials";
import { verificarCredencialesTheFactory } from "@/utils/verificarTheFactory";

/**
 * POST /api/users/[id]/empresa/verificar-thefactory (solo admin)
 * Body: { ambiente: "demo"|"production", usuario?, clave?, rnc? }
 * Si `clave` viene vacía se usa la clave guardada (cifrada) del ambiente.
 */
export async function POST(request, { params }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const ambiente = String(body?.ambiente || "").trim().toLowerCase();
  if (ambiente !== "demo" && ambiente !== "production") {
    return NextResponse.json(
      { error: "ambiente debe ser demo o production" },
      { status: 400 },
    );
  }
  const isDemo = ambiente === "demo";

  const row = await User.findById(id)
    .select(
      "empresa.rnc empresa.theFactoryUsuarioDemo empresa.theFactoryUsuarioProduction empresa.theFactoryUsuario +empresa.theFactoryClaveDemoEnc +empresa.theFactoryClaveProductionEnc +empresa.theFactoryClaveEnc",
    )
    .lean();
  if (!row) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }
  const emp = row.empresa || {};

  const usuarioGuardado = isDemo
    ? emp.theFactoryUsuarioDemo || emp.theFactoryUsuario || ""
    : emp.theFactoryUsuarioProduction || "";
  const usuario = String(body?.usuario ?? usuarioGuardado).trim();
  const rnc = String(body?.rnc || emp.rnc || "").replace(/\D/g, "");

  let clave = String(body?.clave || "").trim();
  let fuenteClave = "formulario";
  if (!clave) {
    const claveEnc = (
      isDemo
        ? emp.theFactoryClaveDemoEnc || emp.theFactoryClaveEnc || ""
        : emp.theFactoryClaveProductionEnc || ""
    ).trim();
    if (claveEnc) {
      try {
        clave = decryptTheFactoryPassword(claveEnc);
        fuenteClave = "guardada";
      } catch (error) {
        console.error("verificar-thefactory decrypt error:", error);
        return NextResponse.json({
          valido: false,
          estado: "CLAVE_NO_DESCIFRABLE",
          mensaje:
            "No se pudo descifrar la clave guardada. Vuelva a ingresarla (THEFACTORY_CREDENTIALS_ENCRYPTION_KEY pudo haber cambiado).",
          ambiente,
        });
      }
    }
  }

  const faltantes = [
    !usuario && "usuario",
    !clave && "clave",
    !rnc && "RNC de la empresa",
  ].filter(Boolean);
  if (faltantes.length) {
    return NextResponse.json({
      valido: false,
      estado: "DATOS_FALTANTES",
      mensaje: `Falta: ${faltantes.join(", ")}.`,
      ambiente,
    });
  }

  const resultado = await verificarCredencialesTheFactory({ usuario, clave, rnc, ambiente });
  return NextResponse.json({
    valido: resultado.valido,
    estado: resultado.estado,
    mensaje: resultado.mensaje,
    codigo: resultado.codigo,
    respondio: resultado.respondio,
    ambiente,
    fuenteClave,
    rnc,
  });
}
