import { NextResponse } from "next/server";
import { runWithNext } from "@/lib/nextControllerAdapter";
import { enviarFacturaElectronica } from "@/app/controllers/comprobantes";
import { auth } from "@/auth";
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
 * POST /api/comprobantes/enviar-factura
 *
 * Recibe el JSON de la factura (emisor, comprador, factura, items, DescuentosORecargos, etc.)
 * y la envía a TheFactoryHKA para emisión del e-CF.
 *
 * Autorización: sesión (cookie) O API Key (Authorization: Bearer <api_key> o X-API-Key).
 * FileMaker envía la misma API Key que usa en solicitar-numero.
 * Body: ver docs/filemaker-envio-datos-api.md
 */
export async function POST(request) {
  const session = await auth();
  if (session?.user?.id) {
    return runWithNext(enviarFacturaElectronica, request, {
      requireAuth: true,
    });
  }
  const apiKey = getApiKeyFromRequest(request);
  if (!apiKey) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const userId = await getUserIdByApiKey(apiKey);
  if (!userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  return runWithNext(enviarFacturaElectronica, request, { requireAuth: false });
}
