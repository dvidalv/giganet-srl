/**
 * URLs del portal DGII para el QR (ConsultaTimbre / ConsultaTimbreFC).
 * E32: fc.dgii.gov.do — E31+: ecf.dgii.gov.do (el segmento de ruta es testecf | certecf | ecf).
 */

const DEMO_TRUTHY = new Set(["1", "true", "yes", "on"]);

/**
 * Demo / pre-prod: las URLs DGII deben usar **testecf** (no el segmento **ecf** de producción).
 * Alineado con La Época (`giganetEnv`: demo flags, Giganet en localhost).
 *
 * Si el ambiente QR está fijado a **producción**, nunca devuelve true (rutas `/ecf/`, sin `testecf`).
 */
export function isDgiiQrDemoLike() {
  const forceProd = String(
    process.env.LA_EPOCA_DGII_QR_AMBIENTE ??
      process.env.DGII_QR_AMBIENTE ??
      process.env.DGII_AMBIENTE ??
      "",
  )
    .trim()
    .toLowerCase();
  if (["produccion", "prod", "ecf", "production"].includes(forceProd)) return false;

  const a = String(process.env.GIGANET_ECF_DEMO ?? "").trim().toLowerCase();
  const b = String(process.env.LA_EPOCA_DGII_DEMO ?? "").trim().toLowerCase();
  const d = String(process.env.DGII_QR_DEMO ?? "").trim().toLowerCase();
  if (DEMO_TRUTHY.has(a) || DEMO_TRUTHY.has(b) || DEMO_TRUTHY.has(d)) return true;
  const base = String(process.env.GIGANET_BASE_URL ?? "").trim().toLowerCase();
  if (base.includes("localhost") || base.includes("127.0.0.1")) return true;
  const demoBase = String(process.env.GIGANET_DEMO_BASE_URL ?? "").trim().toLowerCase();
  if (demoBase && (demoBase.includes("localhost") || demoBase.includes("127.0.0.1"))) return true;
  const qrAmbOnlyDemo = String(
    process.env.LA_EPOCA_DGII_QR_AMBIENTE ?? process.env.DGII_QR_AMBIENTE ?? "",
  )
    .trim()
    .toLowerCase();
  if (["desarrollo", "demo", "test", "testecf", "precertificacion"].includes(qrAmbOnlyDemo)) return true;
  return false;
}

/** `produccion` → ruta `/ecf/` (DGII real); `desarrollo` → `/testecf/`; `certificacion` → `/certecf/`. */
const URLS_DGII_QR = {
  desarrollo: {
    ConsultaTimbreFC: "https://fc.dgii.gov.do/testecf/ConsultaTimbreFC",
    ConsultaTimbre: "https://ecf.dgii.gov.do/testecf/ConsultaTimbre",
  },
  certificacion: {
    ConsultaTimbreFC: "https://fc.dgii.gov.do/certecf/ConsultaTimbreFC",
    ConsultaTimbre: "https://ecf.dgii.gov.do/certecf/ConsultaTimbre",
  },
  produccion: {
    ConsultaTimbreFC: "https://fc.dgii.gov.do/ecf/ConsultaTimbreFC",
    ConsultaTimbre: "https://ecf.dgii.gov.do/ecf/ConsultaTimbre",
  },
};

/**
 * @param {unknown} ambienteBody
 * @param {unknown} [envFallback]
 * @returns {"desarrollo" | "certificacion" | "produccion"}
 */
export function resolveAmbienteQr(ambienteBody, envFallback = process.env.DGII_AMBIENTE) {
  const raw = String(ambienteBody ?? envFallback ?? "").trim().toLowerCase();
  /** Producción DGII: segmento de ruta `ecf` (sin `testecf`). */
  if (["produccion", "prod", "ecf", "production"].includes(raw)) {
    return "produccion";
  }
  if (
    raw === "desarrollo" ||
    raw === "demo" ||
    raw === "test" ||
    raw === "testecf" ||
    raw === "precertificacion"
  ) {
    return "desarrollo";
  }
  if (raw === "certificacion" || raw === "certecf" || raw === "cert") {
    return "certificacion";
  }
  if (raw === "") {
    if (isDgiiQrDemoLike()) return "desarrollo";
    return process.env.NODE_ENV === "production" ? "produccion" : "desarrollo";
  }
  return "produccion";
}

/** RNC solo dígitos (9 u 11) para URLs de consulta timbre DGII. */
export function rncDigitsParaQr(rnc) {
  return String(rnc ?? "").replace(/\D/g, "");
}

/**
 * MontoTotal con 2 decimales (valor ya confiable del backend / factura).
 * @param {unknown} n
 * @returns {string | null}
 */
export function formatMontoTotalTwoDecimals(n) {
  const x =
    typeof n === "number" && Number.isFinite(n)
      ? n
      : Number.parseFloat(String(n ?? "").replace(/,/g, ".").trim());
  if (!Number.isFinite(x)) return null;
  return x.toFixed(2);
}

const RE_FECHA_EMISION = /^\d{2}-\d{2}-\d{4}$/;
const RE_FECHA_FIRMA = /^\d{2}-\d{2}-\d{4} \d{2}:\d{2}:\d{2}$/;

/**
 * @param {unknown} input
 * @returns {{ ok: true; value: string } | { ok: false; message: string }}
 */
export function normalizeFechaEmisionDdMmYyyy(input) {
  const s = String(input ?? "").trim();
  if (!s) return { ok: false, message: "FechaEmision vacía." };
  if (RE_FECHA_EMISION.test(s)) return { ok: true, value: s };
  const d = new Date(s);
  if (!Number.isFinite(d.getTime())) return { ok: false, message: "FechaEmision inválida." };
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return { ok: true, value: `${dd}-${mm}-${yyyy}` };
}

/**
 * Formato DGII: DD-MM-YYYY HH:mm:ss
 * @param {unknown} input
 * @returns {{ ok: true; value: string } | { ok: false; message: string }}
 */
export function normalizeFechaFirmaDdMmYyyyHhMmSs(input) {
  const s = String(input ?? "").trim();
  if (!s) return { ok: false, message: "FechaFirma vacía." };
  if (RE_FECHA_FIRMA.test(s)) return { ok: true, value: s };
  if (RE_FECHA_EMISION.test(s)) {
    return { ok: true, value: `${s} 00:00:00` };
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/);
  if (iso) {
    const [, y, mo, da, h, mi, se] = iso;
    return { ok: true, value: `${da}-${mo}-${y} ${h}:${mi}:${se}` };
  }
  const d = new Date(s);
  if (!Number.isFinite(d.getTime())) return { ok: false, message: "FechaFirma inválida." };
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return { ok: true, value: `${dd}-${mm}-${yyyy} ${hh}:${mi}:${ss}` };
}

/**
 * Construye la URL de consulta timbre DGII con encoding correcto (URLSearchParams).
 *
 * @param {{
 *   tipo: string;
 *   rncEmisor: string;
 *   rncComprador?: string;
 *   encf: string;
 *   fechaEmision?: string;
 *   montoTotal: number | string;
 *   fechaFirma?: string;
 *   codigoSeguridad: string;
 *   ambiente: "desarrollo" | "certificacion" | "produccion";
 * }} data
 * @returns {{ ok: true; url: string } | { ok: false; message: string }}
 */
export function generateDGIIQRUrl(data) {
  const tipo = String(data.tipo ?? "");
  const codigo = String(data.codigoSeguridad ?? "").trim();
  if (!codigo) return { ok: false, message: "CodigoSeguridad requerido (respuesta proveedor)." };

  const encf = String(data.encf ?? "").trim();
  if (!encf) return { ok: false, message: "ENCF requerido." };

  const rncEmisorDigits = rncDigitsParaQr(data.rncEmisor);
  if (rncEmisorDigits.length !== 9 && rncEmisorDigits.length !== 11) {
    return { ok: false, message: "RncEmisor inválido (9 u 11 dígitos)." };
  }

  const ambiente = data.ambiente;
  const urls = URLS_DGII_QR[ambiente];
  if (!urls) return { ok: false, message: "Ambiente DGII inválido." };

  const montoStr = formatMontoTotalTwoDecimals(data.montoTotal);
  if (montoStr == null) return { ok: false, message: "MontoTotal inválido." };

  if (tipo === "32") {
    const sp = new URLSearchParams();
    sp.set("RncEmisor", rncEmisorDigits);
    sp.set("ENCF", encf);
    sp.set("MontoTotal", montoStr);
    sp.set("CodigoSeguridad", codigo);
    return { ok: true, url: `${urls.ConsultaTimbreFC}?${sp.toString()}` };
  }

  const rncCompradorDigits = rncDigitsParaQr(data.rncComprador ?? "");
  if (rncCompradorDigits.length !== 9 && rncCompradorDigits.length !== 11) {
    return { ok: false, message: "RncComprador inválido (9 u 11 dígitos)." };
  }

  const fechaEm = normalizeFechaEmisionDdMmYyyy(data.fechaEmision);
  if (!fechaEm.ok) return fechaEm;

  const fechaFi = normalizeFechaFirmaDdMmYyyyHhMmSs(data.fechaFirma);
  if (!fechaFi.ok) return fechaFi;

  const sp = new URLSearchParams();
  sp.set("RncEmisor", rncEmisorDigits);
  sp.set("RncComprador", rncCompradorDigits);
  sp.set("ENCF", encf);
  sp.set("FechaEmision", fechaEm.value);
  sp.set("MontoTotal", montoStr);
  sp.set("FechaFirma", fechaFi.value);
  sp.set("CodigoSeguridad", codigo);
  return { ok: true, url: `${urls.ConsultaTimbre}?${sp.toString()}` };
}

/**
 * Tras `enviar-factura`: arma la URL desde respuesta + body enviado.
 * @param {{ responseData: Record<string, unknown>; facturaOriginal: Record<string, unknown> }}
 * @returns {{ ok: true; url: string } | { ok: false; message: string }}
 */
export function generateDGIIQRUrlFromEnvioResponse({ responseData, facturaOriginal }) {
  const fact = facturaOriginal?.factura && typeof facturaOriginal.factura === "object"
    ? /** @type {Record<string, unknown>} */ (facturaOriginal.factura)
    : {};
  const montoTotalConItbis = Number.parseFloat(String(fact.total ?? "0").replace(/,/g, "."));
  const subParsed = Number.parseFloat(String(fact.subtotalSinItbis ?? "").replace(/,/g, "."));
  const montoSubSinItbis = Number.isFinite(subParsed) ? subParsed : montoTotalConItbis;
  const tipoComprobante = String(fact.tipo ?? "");
  const ambiente = resolveAmbienteQr(facturaOriginal.ambiente);

  const codigo = String(responseData?.codigoSeguridad ?? "").trim();
  if (!codigo) return { ok: false, message: "Sin codigoSeguridad en la respuesta del proveedor." };

  const encf = String(fact.ncf ?? "").trim();
  if (!encf) return { ok: false, message: "Sin NCF en la factura enviada." };

  const rncEmisor =
    facturaOriginal.emisor && typeof facturaOriginal.emisor === "object"
      ? /** @type {Record<string, unknown>} */ (facturaOriginal.emisor).rnc
      : "";

  if (String(tipoComprobante) === "32") {
    return generateDGIIQRUrl({
      tipo: "32",
      rncEmisor,
      encf,
      montoTotal: montoSubSinItbis,
      codigoSeguridad: codigo,
      ambiente,
    });
  }

  const fechaEmisionRaw =
    responseData.fechaEmision != null
      ? String(responseData.fechaEmision)
      : fact.fecha != null
        ? String(fact.fecha)
        : "";
  const fechaFirmaRaw =
    responseData.fechaFirma != null
      ? String(responseData.fechaFirma)
      : responseData.fechaEmision != null
        ? String(responseData.fechaEmision)
        : "";

  const rncComprador =
    facturaOriginal.comprador && typeof facturaOriginal.comprador === "object"
      ? /** @type {Record<string, unknown>} */ (facturaOriginal.comprador).rnc
      : "";

  return generateDGIIQRUrl({
    tipo: tipoComprobante || "31",
    rncEmisor,
    rncComprador: String(rncComprador ?? ""),
    encf,
    fechaEmision: fechaEmisionRaw,
    montoTotal: montoTotalConItbis,
    fechaFirma: fechaFirmaRaw,
    codigoSeguridad: codigo,
    ambiente,
  });
}

/**
 * Re-serializa query string de una URL DGII externa para corregir espacios/caracteres sin encode.
 * @param {string} raw
 * @returns {{ ok: true; url: string } | { ok: false; message: string }}
 */
export function normalizeExternalDgiiQrUrl(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return { ok: false, message: "URL vacía." };
  let u;
  try {
    u = new URL(s);
  } catch {
    return {
      ok: false,
      message:
        "La URL del QR no es válida (encoding o caracteres). Omita `url` y envíe rnc, ncf, codigo, fecha, monto, etc.",
    };
  }
  const params = new URLSearchParams(u.searchParams);
  return { ok: true, url: `${u.origin}${u.pathname}?${params.toString()}` };
}
