export const ZONA_HORARIA_RD = "America/Santo_Domingo";

const DIA_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_POR_DIA = 24 * 60 * 60 * 1000;

const formatoDiaRD = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA_HORARIA_RD,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Día calendario (YYYY-MM-DD) en República Dominicana para un instante dado. */
export function diaRD(fecha = new Date()) {
  return formatoDiaRD.format(fecha);
}

export function hoyRD(ahora) {
  return diaRD(ahora instanceof Date ? ahora : new Date());
}

/** true si `valor` es un día real con formato YYYY-MM-DD (rechaza 2026-02-30). */
export function esDiaValido(valor) {
  const m = DIA_REGEX.exec(String(valor ?? ""));
  if (!m) return false;
  const [, y, mo, d] = m.map(Number);
  const t = new Date(Date.UTC(y, mo - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
}

function diaAUtcMs(dia) {
  const [, y, mo, d] = DIA_REGEX.exec(dia).map(Number);
  return Date.UTC(y, mo - 1, d);
}

/** Días calendario de `desde` a `hasta` (negativo si `hasta` ya pasó). */
export function diasEntre(desde, hasta) {
  return Math.round((diaAUtcMs(hasta) - diaAUtcMs(desde)) / MS_POR_DIA);
}

/** Instante en que empieza `dia` en República Dominicana (UTC-4 todo el año, sin horario de verano). */
export function inicioDiaRD(dia) {
  return new Date(diaAUtcMs(dia) + 4 * 60 * 60 * 1000);
}

/** Días que faltan para el vencimiento contado desde hoy en RD (0 = último día de vigencia). */
export function diasHastaVencimiento(fechaVencimiento, ahora) {
  return diasEntre(hoyRD(ahora), fechaVencimiento);
}
