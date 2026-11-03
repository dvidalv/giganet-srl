import { createOpenAI } from "@ai-sdk/openai";
import { generateText, Output } from "ai";
import { z } from "zod";

export const TIPOS_E_CF = [
  { value: "31", label: "Factura de Crédito Fiscal Electrónica" },
  { value: "32", label: "Factura de Consumo Electrónica" },
  { value: "33", label: "Nota de Débito Electrónica" },
  { value: "34", label: "Nota de Crédito Electrónica" },
  { value: "41", label: "Compras Electrónicas" },
  { value: "43", label: "Gastos Menores Electrónico" },
  { value: "44", label: "Régimenes Especiales Electrónico" },
  { value: "45", label: "Gubernamental Electrónico" },
];

export const TIPOS_SIN_VENCIMIENTO = new Set(["32", "34"]);

const NCF_E_REGEX = /^E(\d{2})(\d+)$/i;

export function descripcionTipo(tipo) {
  return TIPOS_E_CF.find((t) => t.value === tipo)?.label || "";
}

/** Extrae tipo y número de secuencia de un e-NCF (solo prefijo E). */
export function parseNcfE(ncf) {
  const raw = String(ncf ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  const m = NCF_E_REGEX.exec(raw);
  if (!m) return null;
  const tipo = m[1];
  const numero = Number(m[2]);
  if (!Number.isInteger(numero) || numero < 0) return null;
  if (!TIPOS_E_CF.some((t) => t.value === tipo)) return null;
  return { tipo, numero, ncf: raw };
}

/** Normaliza fecha visible (dd/mm/aaaa o aaaa-mm-dd) a YYYY-MM-DD. */
export function normalizarFechaDia(valor) {
  const s = String(valor ?? "").trim();
  if (!s || /^n\/?a$/i.test(s) || s === "-" || s === "—") return "";
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/.exec(s);
  if (dmy) {
    const dd = dmy[1].padStart(2, "0");
    const mm = dmy[2].padStart(2, "0");
    return `${dmy[3]}-${mm}-${dd}`;
  }
  return "";
}

/**
 * Parsea cantidad aprobada: número o texto con puntos de miles dominicanos
 * (ej. "10.000.000" → 10000000) o comas anglosajonas.
 * @returns {number | null}
 */
export function parseCantidadAprobada(valor) {
  if (valor == null || valor === "") return null;
  if (typeof valor === "number") {
    return Number.isInteger(valor) && valor > 0 ? valor : null;
  }
  const s = String(valor).trim().replace(/\s/g, "");
  if (!s) return null;

  let normalized = s;
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
    // 10.000.000 o 10.000.000,50 → quitar puntos de miles
    normalized = s.replace(/\./g, "").replace(/,/g, ".");
  } else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) {
    // 10,000,000
    normalized = s.replace(/,/g, "");
  } else if (/^\d+([.,]\d+)?$/.test(s)) {
    normalized = s.replace(",", ".");
  } else {
    return null;
  }

  const n = Number(normalized);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

function formatearNcfE(tipo, numero, anchoSecuencia) {
  const width = Math.max(anchoSecuencia, String(numero).length);
  return `E${tipo}${String(numero).padStart(width, "0")}`;
}

/**
 * Convierte una fila cruda de OCR/visión a propuesta editable para Giganet.
 * Si hay Cantidad Aprobada válida, numero_final = desde + cantidad - 1
 * (prioridad sobre el NCF "hasta", que a veces pierde un dígito en OCR).
 * @returns {null | object}
 */
export function normalizarFilaExtraida(raw) {
  const desde = parseNcfE(raw?.numeroDesde || raw?.ncfDesde || raw?.desde);
  const hasta = parseNcfE(raw?.numeroHasta || raw?.ncfHasta || raw?.hasta);
  if (!desde || !hasta) return null;
  if (desde.tipo !== hasta.tipo) return null;
  if (hasta.numero < desde.numero) return null;

  // El tipo del NCF es la fuente de verdad (el modelo a menudo etiqueta E43 como 31).
  const tipo = desde.tipo;

  const cantidadParsed = parseCantidadAprobada(
    raw?.cantidadAprobada ?? raw?.cantidad,
  );
  const cantidad =
    cantidadParsed != null
      ? cantidadParsed
      : hasta.numero - desde.numero + 1;
  const numero_final =
    cantidadParsed != null
      ? desde.numero + cantidadParsed - 1
      : hasta.numero;

  const fechaAutorizacion =
    normalizarFechaDia(raw?.fechaAutorizacion || raw?.fechaSolicitud) || "";
  const fechaVencimiento = TIPOS_SIN_VENCIMIENTO.has(tipo)
    ? ""
    : normalizarFechaDia(raw?.fechaVencimiento);

  const noSolicitud = String(raw?.noSolicitud || raw?.solicitud || "").trim();
  const noAutorizacion = String(
    raw?.noAutorizacion || raw?.autorizacion || "",
  ).trim();

  const partes = [];
  if (noSolicitud) partes.push(`Solicitud DGII ${noSolicitud}`);
  if (noAutorizacion) partes.push(`Aut. ${noAutorizacion}`);

  const anchoSecuencia = Math.max(desde.ncf.length, hasta.ncf.length) - 3;

  return {
    tipo_comprobante: tipo,
    descripcion_tipo: descripcionTipo(tipo),
    prefijo: "E",
    numero_inicial: desde.numero,
    numero_final,
    cantidad,
    fecha_autorizacion: fechaAutorizacion,
    fecha_vencimiento: fechaVencimiento,
    no_solicitud: noSolicitud,
    no_autorizacion: noAutorizacion,
    comentario: partes.join(" / ").slice(0, 500),
    alerta_minima_restante: 10,
    numero_desde: desde.ncf,
    numero_hasta: formatearNcfE(tipo, numero_final, anchoSecuencia),
  };
}

export function isDgiiVisionConfigured() {
  return Boolean(
    process.env.AI_GATEWAY_API_KEY?.trim() ||
      process.env.OPENAI_API_KEY?.trim(),
  );
}

function resolveVisionModel() {
  const modelId =
    process.env.DGII_IMPORT_AI_MODEL?.trim() ||
    process.env.WHATSAPP_BOT_AI_MODEL?.trim() ||
    "openai/gpt-4o-mini";

  if (process.env.AI_GATEWAY_API_KEY?.trim()) {
    return modelId;
  }

  if (process.env.OPENAI_API_KEY?.trim()) {
    const openai = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY.trim(),
    });
    const bare = modelId.includes("/")
      ? modelId.split("/").slice(1).join("/")
      : modelId;
    return openai(bare);
  }

  return modelId;
}

const extractionSchema = z.object({
  filas: z
    .array(
      z.object({
        tipoComprobante: z
          .string()
          .describe("Código de tipo e-CF de 2 dígitos, ej. 31, 32, 43, 45"),
        numeroDesde: z
          .string()
          .describe("NCF inicial con prefijo E, ej. E31000000001"),
        numeroHasta: z
          .string()
          .describe("NCF final con prefijo E, ej. E31000000100"),
        cantidadAprobada: z
          .union([z.number(), z.string()])
          .nullable()
          .describe(
            "Cantidad Aprobada del portal (número o texto con puntos de miles, ej. 10.000.000). Preferir sobre el tramo NCF si discrepan.",
          ),
        fechaSolicitud: z
          .string()
          .nullable()
          .describe("Fecha solicitud dd/mm/aaaa o aaaa-mm-dd"),
        fechaVencimiento: z
          .string()
          .nullable()
          .describe("Fecha vencimiento o vacío/N/A"),
        noSolicitud: z.string().nullable(),
        noAutorizacion: z.string().nullable(),
      }),
    )
    .describe("Solo autorizaciones de series electrónicas con prefijo E"),
});

const PROMPT_UNA_IMAGEN = `Analiza ESTA captura del portal DGII (autorizaciones de secuencias de comprobantes fiscales).
IMPORTANTE: la imagen puede mostrar VARIOS paneles/bloques con encabezado verde (p. ej. E43 y E45 en la misma foto). Debes devolver UNA fila por CADA panel E visible — nunca te quedes solo con el primero ni con el más legible.
Extrae TODAS las series electrónicas con NCF que empiezan con E (ej. E31…, E32…, E43…, E45…). Cuenta los paneles E antes de responder y asegúrate de que filas.length coincida.
Ignora por completo series B, C u otros prefijos (notas físicas, etc.).
Para cada fila E indica: tipoComprobante (31/32/43/45/…), numeroDesde, numeroHasta, cantidadAprobada, fechaSolicitud, fechaVencimiento, noSolicitud, noAutorizacion.
Copia noSolicitud y noAutorizacion exactamente de cada panel (son distintos aunque compartan la misma solicitud).
Cantidad Aprobada es la fuente de verdad del tamaño del rango: cópiala exactamente (los miles dominicanos usan punto, ej. 10.000.000 = diez millones). Si el tramo NCF (hasta − desde + 1) no coincide con Cantidad Aprobada, prioriza Cantidad Aprobada y no “corrijas” ni inventes dígitos del NCF.
Si un campo no aparece, usa null. No inventes rangos.`;

/**
 * Una llamada de visión por imagen. Devuelve filas ya normalizadas (sin dedup global).
 * @param {{ mediaType: string, data: Buffer }} image
 */
async function extraerFilasDesdeUnaImagen(image) {
  const content = [
    { type: "text", text: PROMPT_UNA_IMAGEN },
    {
      type: "image",
      image: image.data,
      mediaType: image.mediaType || "image/jpeg",
    },
  ];

  const { output } = await generateText({
    model: resolveVisionModel(),
    output: Output.object({
      schema: extractionSchema,
      name: "dgii_series_e",
      description: "Secuencias e-CF (prefijo E) extraídas de una foto DGII",
    }),
    messages: [{ role: "user", content }],
    temperature: 0,
  });

  const propuestas = [];
  for (const fila of output?.filas || []) {
    const normalizada = normalizarFilaExtraida(fila);
    if (!normalizada) continue;
    propuestas.push(normalizada);
  }
  return propuestas;
}

/**
 * Fusiona resultados de varias fotos y deduplica por solicitud+autorización.
 * @param {object[][]} listasPorImagen
 */
export function fusionarExtraccionesPorImagen(listasPorImagen) {
  const flat = [];
  for (const lista of listasPorImagen || []) {
    if (!Array.isArray(lista)) continue;
    for (const fila of lista) {
      if (fila) flat.push(fila);
    }
  }
  return deduplicarFilasPorSolicitud(flat);
}

/**
 * Extrae filas de series E desde una o más fotos de autorizaciones DGII.
 * Una llamada de visión por foto; luego fusiona y deduplica.
 * @param {{ mediaType: string, data: Buffer }[]} images
 */
export async function extraerSeriesEDesdeImagenes(images) {
  if (!isDgiiVisionConfigured()) {
    throw new Error(
      "No hay modelo de visión configurado (AI_GATEWAY_API_KEY u OPENAI_API_KEY).",
    );
  }
  if (!images?.length) {
    throw new Error("Se requiere al menos una imagen");
  }

  const porImagen = [];
  for (const img of images) {
    porImagen.push(await extraerFilasDesdeUnaImagen(img));
  }
  return fusionarExtraccionesPorImagen(porImagen);
}

/**
 * Extrae solicitud/autorización desde el comentario
 * ("Solicitud DGII 6010… / Aut. 6005…").
 * @returns {{ no_solicitud: string, no_autorizacion: string }}
 */
export function parseSolicitudAutorizacionDesdeComentario(comentario) {
  const text = String(comentario ?? "");
  const sol =
    text.match(/Solicitud\s+DGII\s+(\d+)/i)?.[1]?.replace(/\D/g, "") || "";
  const aut =
    text.match(/Aut\.?\s*(\d+)/i)?.[1]?.replace(/\D/g, "") || "";
  return { no_solicitud: sol, no_autorizacion: aut };
}

/**
 * Completa no_solicitud / no_autorizacion desde campos explícitos o comentario.
 */
export function enriquecerFilaConSolicitudAutorizacion(fila) {
  let sol = String(fila?.no_solicitud ?? "")
    .trim()
    .replace(/\D/g, "");
  let aut = String(fila?.no_autorizacion ?? "")
    .trim()
    .replace(/\D/g, "");
  if (!sol || !aut) {
    const parsed = parseSolicitudAutorizacionDesdeComentario(fila?.comentario);
    if (!sol) sol = parsed.no_solicitud;
    if (!aut) aut = parsed.no_autorizacion;
  }
  return {
    ...fila,
    no_solicitud: sol,
    no_autorizacion: aut,
  };
}

/**
 * Clave fija de deduplicación: número de solicitud DGII + número de autorización.
 * Misma solicitud con distintas autorizaciones = series distintas (se conservan).
 * Sin solicitud+autorización, cae al rango tipo:desde:hasta.
 */
export function claveDedupSolicitud(fila) {
  const enriched = enriquecerFilaConSolicitudAutorizacion(fila);
  const sol = enriched.no_solicitud;
  const aut = enriched.no_autorizacion;
  if (sol && aut) return `sol:${sol}::aut:${aut}`;

  const tipo = String(enriched?.tipo_comprobante ?? "")
    .replace(/\D/g, "")
    .padStart(2, "0");
  const ini = Number(enriched?.numero_inicial);
  const fin = Number(enriched?.numero_final);
  if (!tipo || !Number.isInteger(ini) || !Number.isInteger(fin)) return null;
  return `rango:${tipo}:${ini}:${fin}`;
}

/** Tipo leído del NCF (numero_desde / numero_hasta), o null. */
export function tipoDesdeNcfFila(fila) {
  return (
    parseNcfE(fila?.numero_desde)?.tipo ||
    parseNcfE(fila?.numero_hasta)?.tipo ||
    null
  );
}

/** True si tipo_comprobante coincide con los dígitos del NCF. */
export function filaTipoCoincideConNcf(fila) {
  const fromNcf = tipoDesdeNcfFila(fila);
  if (!fromNcf) return false;
  const tipo = String(fila?.tipo_comprobante ?? "")
    .replace(/\D/g, "")
    .padStart(2, "0");
  return tipo === fromNcf;
}

/**
 * Preferir la fila cuyo tipo coincide con el NCF, luego sol/aut completos.
 */
export function preferirFilaMasCompleta(a, b) {
  const score = (f) => {
    const e = enriquecerFilaConSolicitudAutorizacion(f);
    let s = 0;
    if (filaTipoCoincideConNcf(e)) s += 20;
    if (e.no_solicitud && e.no_autorizacion) s += 10;
    else {
      if (e.no_solicitud) s += 3;
      if (e.no_autorizacion) s += 3;
    }
    if (e.comentario) s += 1;
    if (e.fecha_autorizacion) s += 1;
    return s;
  };
  // Empate → conservar la primera (a)
  return score(b) > score(a)
    ? enriquecerFilaConSolicitudAutorizacion(b)
    : enriquecerFilaConSolicitudAutorizacion(a);
}

/**
 * True si conviene fusionar dos filas del mismo tipo con rango solapado:
 * solo cuando falta sol/aut en alguna, o los pares completos coinciden / conflictúan
 * por OCR (mismo sol+aut, o uno incompleto). No fusionar dos pares completos distintos.
 */
export function debenColapsarPorRangoSolapado(a, b) {
  const ea = enriquecerFilaConSolicitudAutorizacion(a);
  const eb = enriquecerFilaConSolicitudAutorizacion(b);
  const aComplete = Boolean(ea.no_solicitud && ea.no_autorizacion);
  const bComplete = Boolean(eb.no_solicitud && eb.no_autorizacion);

  // Alguna incompleta → sí (OCR de la misma serie en varias fotos)
  if (!aComplete || !bComplete) return true;

  // Ambas completas: solo si es el mismo par (o conflicto idéntico ya cubierto arriba)
  if (
    ea.no_solicitud === eb.no_solicitud &&
    ea.no_autorizacion === eb.no_autorizacion
  ) {
    return true;
  }

  // Dos autorizaciones distintas completas → series distintas; no colapsar
  return false;
}

/**
 * Segunda pasada: mismo tipo + rangos solapados → una sola fila,
 * solo si sol/aut falta o no son dos pares completos distintos.
 */
export function colapsarPorTipoYRangoSolapado(filas) {
  const out = [];
  for (const fila of filas || []) {
    const enriched = enriquecerFilaConSolicitudAutorizacion(fila);
    const tipo = String(enriched.tipo_comprobante ?? "")
      .replace(/\D/g, "")
      .padStart(2, "0");
    let merged = false;
    for (let i = 0; i < out.length; i++) {
      const existing = out[i];
      const exTipo = String(existing.tipo_comprobante ?? "")
        .replace(/\D/g, "")
        .padStart(2, "0");
      if (exTipo !== tipo) continue;
      if (
        !rangosSeSolapan(
          existing.numero_inicial,
          existing.numero_final,
          enriched.numero_inicial,
          enriched.numero_final,
        )
      ) {
        continue;
      }
      if (!debenColapsarPorRangoSolapado(existing, enriched)) continue;
      out[i] = preferirFilaMasCompleta(existing, enriched);
      merged = true;
      break;
    }
    if (!merged) out.push(enriched);
  }
  return out;
}

/**
 * Elimina filas repetidas (p. ej. la misma autorización en varias fotos)
 * por solicitud + autorización. Conserva el primer encuentro.
 * Luego colapsa mismo tipo con rangos solapados, prefiriendo sol/aut completos.
 */
export function deduplicarFilasPorSolicitud(filas) {
  /** @type {Map<string, object>} */
  const porClave = new Map();
  const orden = [];
  for (const fila of filas || []) {
    const enriched = enriquecerFilaConSolicitudAutorizacion(fila);
    const key = claveDedupSolicitud(enriched);
    if (!key) continue;
    if (porClave.has(key)) {
      // Misma sol+aut: conservar la de mejor score (p. ej. tipo alineado al NCF)
      porClave.set(key, preferirFilaMasCompleta(porClave.get(key), enriched));
      continue;
    }
    porClave.set(key, enriched);
    orden.push(key);
  }
  const out = orden.map((k) => porClave.get(k));
  return colapsarPorTipoYRangoSolapado(out).sort(
    (a, b) =>
      String(a.tipo_comprobante).localeCompare(String(b.tipo_comprobante)) ||
      Number(a.numero_inicial) - Number(b.numero_inicial),
  );
}

/** True si los rangos inclusivos [aIni,aFin] y [bIni,bFin] se solapan. */
export function rangosSeSolapan(aIni, aFin, bIni, bFin) {
  const ai = Number(aIni);
  const af = Number(aFin);
  const bi = Number(bIni);
  const bf = Number(bFin);
  if (![ai, af, bi, bf].every(Number.isFinite)) return false;
  return !(af < bi || ai > bf);
}

/**
 * Devuelve el rango existente que solapa con la fila (mismo tipo), o null.
 * @param {{ tipo_comprobante?: string, numero_inicial?: number, numero_final?: number }} fila
 * @param {Array<{ tipo_comprobante?: string, numero_inicial?: number, numero_final?: number }>} existentes
 */
export function encontrarSolapeConExistentes(fila, existentes) {
  const tipo = String(fila?.tipo_comprobante ?? "")
    .replace(/\D/g, "")
    .padStart(2, "0");
  const ini = Number(fila?.numero_inicial);
  const fin = Number(fila?.numero_final);
  if (!tipo || !Number.isInteger(ini) || !Number.isInteger(fin)) return null;

  for (const ex of existentes || []) {
    const exTipo = String(ex?.tipo_comprobante ?? "")
      .replace(/\D/g, "")
      .padStart(2, "0");
    if (exTipo !== tipo) continue;
    if (
      rangosSeSolapan(ini, fin, ex.numero_inicial, ex.numero_final)
    ) {
      return ex;
    }
  }
  return null;
}

/**
 * True si ya hay una secuencia de producción con esa solicitud DGII y
 * la misma autorización (comentario típico: "Solicitud DGII X / Aut. Y").
 */
export async function existeSecuenciaPorSolicitud({
  userId,
  rnc,
  noSolicitud,
  noAutorizacion,
}) {
  const sol = String(noSolicitud ?? "")
    .trim()
    .replace(/\D/g, "");
  const aut = String(noAutorizacion ?? "")
    .trim()
    .replace(/\D/g, "");
  const rncNorm = String(rnc ?? "").replace(/\D/g, "");
  if (!sol || !aut || !rncNorm || !userId) return false;

  const { getComprobanteModel } = await import("@/app/models/comprobante");
  const Comprobante = await getComprobanteModel(false);
  const escSol = sol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escAut = aut.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const found = await Comprobante.findOne({
    usuario: userId,
    rnc: rncNorm,
    comentario: {
      $regex: new RegExp(
        `Solicitud\\s+DGII\\s+${escSol}\\b[\\s\\S]*Aut\\.?\\s*${escAut}\\b`,
        "i",
      ),
    },
  })
    .select("_id")
    .lean();
  return !!found;
}

/**
 * True si ya existe en producción un rango del mismo tipo que solapa.
 */
export async function existeSecuenciaSolapada({
  userId,
  rnc,
  tipoComprobante,
  numeroInicial,
  numeroFinal,
}) {
  const rncNorm = String(rnc ?? "").replace(/\D/g, "");
  const tipo = String(tipoComprobante ?? "")
    .replace(/\D/g, "")
    .padStart(2, "0");
  const ini = Number(numeroInicial);
  const fin = Number(numeroFinal);
  if (!userId || !rncNorm || !tipo || !Number.isInteger(ini) || !Number.isInteger(fin)) {
    return false;
  }

  const { getComprobanteModel } = await import("@/app/models/comprobante");
  const Comprobante = await getComprobanteModel(false);
  const existentes = await Comprobante.find({
    usuario: userId,
    rnc: rncNorm,
    tipo_comprobante: tipo,
  })
    .select("tipo_comprobante numero_inicial numero_final")
    .lean();

  return !!encontrarSolapeConExistentes(
    {
      tipo_comprobante: tipo,
      numero_inicial: ini,
      numero_final: fin,
    },
    existentes,
  );
}

/**
 * Valida una fila revisada por el admin antes de crear.
 * @returns {{ ok: true, body: object } | { ok: false, error: string }}
 */
export function validarFilaParaCrear(fila, { rnc, razonSocial }) {
  const tipo = String(fila?.tipo_comprobante ?? "")
    .replace(/\D/g, "")
    .padStart(2, "0");
  if (!TIPOS_E_CF.some((t) => t.value === tipo)) {
    return { ok: false, error: `Tipo de comprobante inválido: ${tipo}` };
  }
  const inicial = Number(fila?.numero_inicial);
  const final = Number(fila?.numero_final);
  if (!Number.isInteger(inicial) || !Number.isInteger(final) || final < inicial) {
    return { ok: false, error: "Rango de números inválido" };
  }
  const fechaAut = normalizarFechaDia(fila?.fecha_autorizacion);
  if (!fechaAut) {
    return { ok: false, error: "La fecha de autorización es requerida" };
  }
  let fechaVenc = normalizarFechaDia(fila?.fecha_vencimiento);
  if (TIPOS_SIN_VENCIMIENTO.has(tipo)) fechaVenc = "";
  else if (!fechaVenc) {
    return {
      ok: false,
      error: `La fecha de vencimiento es requerida para el tipo ${tipo}`,
    };
  }

  const alerta =
    fila?.alerta_minima_restante != null
      ? Number(fila.alerta_minima_restante)
      : 10;
  if (!Number.isInteger(alerta) || alerta < 1) {
    return { ok: false, error: "La alerta mínima debe ser un entero mayor a 0" };
  }

  return {
    ok: true,
    body: {
      rnc,
      razon_social: razonSocial,
      tipo_comprobante: tipo,
      descripcion_tipo:
        String(fila?.descripcion_tipo || "").trim() || descripcionTipo(tipo),
      prefijo: "E",
      numero_inicial: inicial,
      numero_final: final,
      fecha_autorizacion: fechaAut,
      fecha_vencimiento: fechaVenc,
      alerta_minima_restante: alerta,
      comentario: String(fila?.comentario || "").trim().slice(0, 500),
    },
  };
}
