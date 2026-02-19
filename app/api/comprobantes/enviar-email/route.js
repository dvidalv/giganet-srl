import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { hashApiKey } from "@/utils/apiKey";
import { enviarEmailDocumentoLogic } from "@/app/api/thefactory-email";

function getApiKeyFromRequest(request) {
  const authHeader = request.headers.get("authorization");
  const bearer = authHeader?.replace(/^Bearer\s+/i, "").trim();
  if (bearer) return bearer;
  return request.headers.get("x-api-key")?.trim() ?? null;
}

async function getUserIdByApiKey(apiKey) {
  if (!apiKey) return null;
  const keyHash = hashApiKey(apiKey);
  if (!keyHash) return null;
  const mod = await import("@/app/models/user");
  const User = mod.default;
  const user = await User.findOne({ apiKeyHash: keyHash }).select("_id").lean();
  return user?._id?.toString() ?? null;
}

/**
 * POST /api/comprobantes/enviar-email
 *
 * Envía el documento electrónico (e-NCF) por email a través de TheFactoryHKA.
 * Body: { rnc: string, documento: string (e-NCF), correos: string[] }
 *
 * Autorización: sesión (cookie) O API Key (Authorization: Bearer <api_key> o X-API-Key).
 * Ver docs/filemaker-envio-datos-api.md sección "Enviar email del documento".
 */
export async function POST(request) {
  const session = await auth();
  if (!session?.user?.id) {
    const apiKey = getApiKeyFromRequest(request);
    if (!apiKey) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const userId = await getUserIdByApiKey(apiKey);
    if (!userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const result = await enviarEmailDocumentoLogic(body);
  return NextResponse.json(result.data, { status: result.status });
}
