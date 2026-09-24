import { NextResponse } from "next/server";
import { hashApiKey } from "@/utils/apiKey";

function getApiKeyFromRequest(request) {
  const authHeader = request.headers.get("authorization");
  const bearer = authHeader?.replace(/^Bearer\s+/i, "").trim();
  if (bearer) return bearer;
  return request.headers.get("x-api-key")?.trim() ?? null;
}

async function getUserByApiKey(apiKey) {
  if (!apiKey) return null;
  const keyHash = hashApiKey(apiKey);
  if (!keyHash) return null;
  const mod = await import("@/app/models/user");
  const User = mod.default;
  return User.findOne({ apiKeyHash: keyHash })
    .select(
      "empresa.nombre empresa.rnc empresa.razonSocial empresa.direccion empresa.ciudad empresa.telefono empresa.email",
    )
    .lean();
}

/**
 * GET /api/comprobantes/emisor
 * Empresa fiscal del usuario dueño de la API key.
 * Autorización: Authorization: Bearer <api_key> o X-API-Key.
 */
export async function GET(request) {
  const apiKey = getApiKeyFromRequest(request);
  if (!apiKey) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const user = await getUserByApiKey(apiKey);
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const empresa = user.empresa || {};
  const rnc = String(empresa.rnc || "").replace(/\D/g, "");

  return NextResponse.json({
    status: "success",
    emisor: {
      rnc,
      razonSocial: String(empresa.razonSocial || empresa.nombre || "").trim(),
      direccion: String(empresa.direccion || "").trim(),
      municipio: String(empresa.ciudad || "").trim(),
      correo: String(empresa.email || "").trim(),
      telefono: String(empresa.telefono || "").trim(),
    },
  });
}
