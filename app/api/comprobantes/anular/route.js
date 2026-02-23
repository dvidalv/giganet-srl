import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { hashApiKey } from "@/utils/apiKey";
import { anularComprobantesLogic } from "@/app/controllers/comprobantes";

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
 * POST /api/comprobantes/anular
 *
 * Anula comprobantes fiscales (NCF) no usados ante TheFactoryHKA/DGII.
 * Útil cuando los comprobantes están vencidos y hay secuencias que nunca se utilizaron
 * (ej. DGII asigna 1-10 para tipo gubernamental, solo se usó el 1; anular 2-10).
 *
 * Autorización: sesión (cookie) O API Key (Authorization: Bearer <api_key> o X-API-Key).
 * Body: { rnc: string, anulaciones: Array, fechaHoraAnulacion?: string }
 * Ver docs/filemaker-envio-datos-api.md
 */
export async function POST(request) {
  const session = await auth();
  let userId = session?.user?.id ?? null;
  if (!userId) {
    const apiKey = getApiKeyFromRequest(request);
    if (!apiKey) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    userId = await getUserIdByApiKey(apiKey);
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

  const result = await anularComprobantesLogic(body, { userId });
  return NextResponse.json(result.data, { status: result.status });
}
