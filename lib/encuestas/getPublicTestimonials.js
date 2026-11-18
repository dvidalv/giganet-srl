import { unstable_noStore as noStore } from "next/cache";
import Encuesta from "@/app/models/encuesta";

const DEFAULT_LIMIT = 9;
const MIN_QUOTE_LEN = 8;
/** Empty / placeholder answers clients often type when skipping free text */
const REJECT_QUOTES = new Set([
  "n/a",
  "na",
  "ninguno",
  "ninguna",
  "nada",
  "no",
  "si",
  "sí",
  "-",
  ".",
  "ok",
]);

/**
 * Public testimonials from responded + published client surveys.
 * Only exposes safe display fields (no email, RNC, tokens, IPs).
 * Uses noStore so new publishes/submits show without a rebuild.
 *
 * Only publishOnHome === true appears. Legacy docs without the field are ignored
 * (new schema default is false; older backfilled ones already have true/false set).
 */
export async function getPublicTestimonials(limit = DEFAULT_LIMIT) {
  noStore();

  const safeLimit = Math.min(Math.max(1, Number(limit) || DEFAULT_LIMIT), 24);

  try {
    const rows = await Encuesta.find({
      status: "responded",
      publishOnHome: true,
      $or: [
        { "answers.comentarios": { $exists: true, $type: "string", $ne: "" } },
        { "answers.loQueMasGusta": { $exists: true, $type: "string", $ne: "" } },
      ],
    })
      .sort({ respondedAt: -1, updatedAt: -1 })
      .limit(60)
      .select({
        empresa: 1,
        answers: 1,
        respondedAt: 1,
        publishOnHome: 1,
      })
      .lean()
      .exec();

    const mapped = [];

    for (const row of rows) {
      const answers = row.answers || {};
      const quote = pickQuote(answers);
      if (!quote) continue;

      const nps = Number(answers.nps);
      const satisfaccion = Number(answers.satisfaccionGeneral);

      const looksPositive =
        (Number.isFinite(nps) && nps >= 7) ||
        (Number.isFinite(satisfaccion) && satisfaccion >= 4) ||
        (!Number.isFinite(nps) && !Number.isFinite(satisfaccion));

      if (!looksPositive) continue;

      const company =
        cleanText(row.empresa?.razonSocial) ||
        cleanText(row.empresa?.nombre) ||
        "Cliente Giganet";
      const person = cleanText(answers.nombreRespondiente);
      const service = cleanText(answers.referenciaServicio);

      mapped.push({
        id: String(row._id),
        quote,
        company,
        person: person || null,
        service: service || null,
        nps: Number.isFinite(nps) ? nps : null,
        satisfaccion: Number.isFinite(satisfaccion) ? satisfaccion : null,
        respondedAt: row.respondedAt
          ? new Date(row.respondedAt).toISOString()
          : null,
      });

      if (mapped.length >= safeLimit) break;
    }

    return mapped;
  } catch (err) {
    console.error("getPublicTestimonials:", err);
    return [];
  }
}

function cleanText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function isUsableQuote(text) {
  if (!text || text.length < MIN_QUOTE_LEN) return false;
  const normalized = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (REJECT_QUOTES.has(normalized)) return false;
  return true;
}

function pickQuote(answers) {
  const comments = cleanText(answers?.comentarios);
  const likes = cleanText(answers?.loQueMasGusta);

  // Prefer "lo que más gusta" for homepage tone; fall back to comentarios
  const ordered = [likes, comments].filter(isUsableQuote);
  if (ordered.length === 0) return null;

  const best = ordered[0];
  return best.length > 320 ? `${best.slice(0, 317).trimEnd()}…` : best;
}
