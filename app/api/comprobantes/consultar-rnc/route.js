import { NextResponse } from "next/server";
import { consultarRncLogic } from "@/app/controllers/comprobantes";
import { hashApiKey } from "@/utils/apiKey";

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
 * POST /api/comprobantes/consultar-rnc
 * Body: { rncConsultar: string, rnc?: string }
 * Autorización: API Key (Authorization: Bearer o X-API-Key).
 */
export async function POST(request) {
  const apiKey = getApiKeyFromRequest(request);
  if (!apiKey) {
    return NextResponse.json({ ok: false, message: "No autorizado." }, { status: 401 });
  }

  const userId = await getUserIdByApiKey(apiKey);
  if (!userId) {
    return NextResponse.json({ ok: false, message: "No autorizado." }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Cuerpo inválido." }, { status: 400 });
  }

  const result = await consultarRncLogic(body, { userId });
  return NextResponse.json(result.data, { status: result.status });
}
