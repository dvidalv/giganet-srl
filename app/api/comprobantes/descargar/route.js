import { NextResponse } from "next/server";
import { hashApiKey } from "@/utils/apiKey";
import { descargarArchivoLogic } from "@/app/controllers/comprobantes";

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
 * POST /api/comprobantes/descargar
 *
 * Descarga el archivo PDF o XML de un comprobante electrónico desde TheFactoryHKA.
 * Body: { rnc: string, documento: string (e-NCF), extension: "pdf" | "xml" }
 *
 * Autorización: SOLO API Key (Authorization: Bearer <api_key> o X-API-Key).
 * Pensado para ser llamado desde FileMaker / backend.
 */
export async function POST(request) {
  const apiKey = getApiKeyFromRequest(request);
  if (!apiKey) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const userId = await getUserIdByApiKey(apiKey);
  if (!userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const result = await descargarArchivoLogic(body);
  return NextResponse.json(result.data, { status: result.status });
}
