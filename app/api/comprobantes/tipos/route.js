import { NextResponse } from "next/server";
import { hashApiKey } from "@/utils/apiKey";
import { getComprobanteModelForUserId } from "@/lib/comprobantesStore";

const TIPO_LABELS = {
  "31": "Factura de Crédito Fiscal Electrónica",
  "32": "Factura de Consumo Electrónica",
  "33": "Nota de Débito Electrónica",
  "34": "Nota de Crédito Electrónica",
  "41": "Comprobante Electrónico de Compras",
  "43": "Comprobante Electrónico para Gastos Menores",
  "44": "Comprobante Electrónico para Regímenes Especiales",
  "45": "Comprobante Electrónico Gubernamental",
  "46": "Comprobante Electrónico para Exportaciones",
  "47": "Comprobante Electrónico para Pagos al Exterior",
};

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
 * GET /api/comprobantes/tipos
 * Tipos e-CF con rangos configurados para el dueño de la API Key.
 * Auth: Authorization: Bearer <api_key> o X-API-Key.
 */
export async function GET(request) {
  const apiKey = getApiKeyFromRequest(request);
  if (!apiKey) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const userId = await getUserIdByApiKey(apiKey);
  if (!userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const Comprobante = await getComprobanteModelForUserId(userId);
    const rangos = await Comprobante.find({ usuario: userId })
      .select("tipo_comprobante descripcion_tipo estado numeros_disponibles rnc")
      .lean();

    const byTipo = new Map();
    for (const rango of rangos) {
      const tipo = String(rango.tipo_comprobante || "").trim();
      if (!tipo) continue;
      const usable =
        ["activo", "alerta"].includes(String(rango.estado || "")) &&
        Number(rango.numeros_disponibles || 0) > 0;
      const current = byTipo.get(tipo) || {
        tipo,
        code: `E${tipo}`,
        label: TIPO_LABELS[tipo] || String(rango.descripcion_tipo || "").trim() || `Tipo ${tipo}`,
        rangos: 0,
        usable: false,
        disponibles: 0,
      };
      current.rangos += 1;
      current.disponibles += Number(rango.numeros_disponibles || 0);
      current.usable = current.usable || usable;
      if (!current.label && rango.descripcion_tipo) {
        current.label = String(rango.descripcion_tipo).trim();
      }
      byTipo.set(tipo, current);
    }

    const tipos = Array.from(byTipo.values()).sort((a, b) =>
      String(a.tipo).localeCompare(String(b.tipo), undefined, { numeric: true }),
    );

    return NextResponse.json({
      status: "success",
      tipos,
      count: tipos.length,
    });
  } catch (err) {
    console.error("GET /api/comprobantes/tipos:", err);
    return NextResponse.json(
      { error: "Error al listar tipos de comprobante" },
      { status: 500 },
    );
  }
}
