import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { hashApiKey } from "@/utils/apiKey";
import { enviarFacturaElectronicaLogic } from "@/app/controllers/comprobantes";

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
 * POST /api/comprobantes/enviar-factura
 *
 * Recibe el JSON de la factura (emisor, comprador, factura, items, DescuentosORecargos, etc.)
 * y la envía a TheFactoryHKA para emisión del e-CF.
 *
 * Autorización: sesión (cookie) O API Key (Authorization: Bearer <api_key> o X-API-Key).
 * Body: ver docs/filemaker-envio-datos-api.md
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

  const result = await enviarFacturaElectronicaLogic(body);
  return NextResponse.json(result.data, { status: result.status });
}
