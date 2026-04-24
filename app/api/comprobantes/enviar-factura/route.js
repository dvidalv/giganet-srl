import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { hashApiKey } from "@/utils/apiKey";
import { enviarFacturaElectronicaLogic } from "@/app/controllers/comprobantes";

/**
 * Resumen seguro para logs (sin volcar el JSON completo en la ruta).
 * @param {unknown} body
 */
function summarizeEnviarFacturaBody(body) {
  if (!body || typeof body !== "object") {
    return { invalid: true };
  }
  const b = /** @type {Record<string, unknown>} */ (body);
  const emisor = b.emisor && typeof b.emisor === "object" ? /** @type {Record<string, unknown>} */ (b.emisor) : null;
  const factura = b.factura && typeof b.factura === "object" ? /** @type {Record<string, unknown>} */ (b.factura) : null;
  const items = Array.isArray(b.items) ? b.items : [];
  const rncRaw = emisor?.rnc != null ? String(emisor.rnc).replace(/\D/g, "") : "";
  return {
    topLevelKeys: Object.keys(b),
    emisorRncLen: rncRaw.length,
    emisorRncSuffix: rncRaw.length >= 4 ? rncRaw.slice(-4) : rncRaw || null,
    facturaTipo: factura?.tipo != null ? String(factura.tipo) : null,
    facturaNcf: factura?.ncf != null ? String(factura.ncf).trim() : null,
    facturaTotal: factura?.total,
    itemsCount: items.length,
  };
}

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
  const reqId = randomUUID().slice(0, 8);
  const log = (...args) => console.log(`[comprobantes/enviar-factura][${reqId}]`, ...args);
  const logErr = (...args) => console.error(`[comprobantes/enviar-factura][${reqId}]`, ...args);
  const t0 = Date.now();

  log("INICIO");

  try {
    const session = await auth();
    let resolvedUserId = session?.user?.id ?? null;
    let authMode = resolvedUserId ? "session" : "none";

    if (!resolvedUserId) {
      const apiKey = getApiKeyFromRequest(request);
      if (!apiKey) {
        log("FIN 401 — sin sesión ni API key");
        return NextResponse.json({ error: "No autorizado" }, { status: 401 });
      }
      const userId = await getUserIdByApiKey(apiKey);
      if (!userId) {
        log("FIN 401 — API key no resuelve usuario");
        return NextResponse.json({ error: "No autorizado" }, { status: 401 });
      }
      resolvedUserId = userId;
      authMode = "api_key";
    }

    log("auth OK", { authMode, userIdSuffix: String(resolvedUserId).slice(-6) });

    let body;
    try {
      body = await request.json();
    } catch (parseErr) {
      logErr("JSON inválido", parseErr instanceof Error ? parseErr.message : parseErr);
      log(`FIN 400 — cuerpo inválido (${Date.now() - t0}ms)`);
      return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
    }

    log("body resumen", summarizeEnviarFacturaBody(body));

    const result = await enviarFacturaElectronicaLogic(body, { userId: resolvedUserId });
    const ms = Date.now() - t0;
    const data = result.data && typeof result.data === "object" ? /** @type {Record<string, unknown>} */ (result.data) : {};
    const statusStr = data.status != null ? String(data.status) : "";
    const msg = typeof data.message === "string" ? data.message : typeof data.error === "string" ? data.error : "";

    if (result.status >= 400) {
      logErr("lógica devolvió error", {
        httpStatus: result.status,
        status: statusStr || null,
        message: msg || null,
      });
    } else {
      log("lógica OK", { httpStatus: result.status, status: statusStr || null });
    }

    log(`FIN ${result.status} (${ms}ms)`);
    return NextResponse.json(result.data, { status: result.status });
  } catch (err) {
    const ms = Date.now() - t0;
    logErr("excepción no controlada", err instanceof Error ? err.stack || err.message : err);
    log(`FIN 500 — excepción (${ms}ms)`);
    return NextResponse.json({ error: "Error interno al enviar factura" }, { status: 500 });
  }
}
