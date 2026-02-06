import { NextResponse } from "next/server";
import { hashApiKey } from "@/utils/apiKey";
import { generarCodigoQRLogic } from "@/app/controllers/comprobantes";

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
 * POST /api/comprobantes/generar-qr
 *
 * Genera el código QR de la factura electrónica según especificaciones DGII.
 * Body: { url? } O { rnc, ncf, codigo, monto, tipo?, rncComprador?, fecha?, fechaFirma?, formato?, tamaño?, ambiente? }
 * ambiente: "produccion" (default) | "desarrollo" - URLs DGII a usar (TesteCF para desarrollo).
 *
 * Autorización: SOLO API Key (Authorization: Bearer <api_key> o X-API-Key).
 * Pensado para ser llamado desde FileMaker / backend, no desde el frontend.
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

  const result = await generarCodigoQRLogic(body);
  return NextResponse.json(result.data, { status: result.status });
}
