/**
 * WhatsApp phone for Dominican Republic (NANP).
 * UI: user types 10 local digits (e.g. 8095551234 or 6825602093).
 * Storage: E.164 with country code +1 → +18095551234
 */

const LOCAL_DIGITS = 10;

/** Strip to digits only, max 10. */
export function digitsOnlyLocal(raw) {
  return String(raw ?? "")
    .replace(/\D/g, "")
    .slice(0, LOCAL_DIGITS);
}

/**
 * Progressive display while typing: (809) 555-1234
 */
export function formatWhatsappPhoneRealtime(raw) {
  const digits = digitsOnlyLocal(raw);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  }
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/**
 * Normalize any input (local 10 digits or already E.164 +1…) to +1XXXXXXXXXX.
 */
export function normalizeWhatsappPhone(raw) {
  if (raw == null) return "";
  let value = String(raw).trim();
  if (!value) return "";

  // Already E.164 +1 + 10 digits
  if (/^\+1\d{10}$/.test(value.replace(/[\s\-().]/g, ""))) {
    return value.replace(/[\s\-().]/g, "");
  }

  // +1809… style with optional formatting
  const withPlus = value.replace(/[\s\-().]/g, "");
  if (/^\+1\d{10}$/.test(withPlus)) return withPlus;

  const digits = value.replace(/\D/g, "");

  // 11 digits starting with 1 → national with country code
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  // 10 local digits → +1XXXXXXXXXX (e.g. 8095551234 → +18095551234)
  if (digits.length === LOCAL_DIGITS) {
    return `+1${digits}`;
  }

  return "";
}

export function isValidWhatsappPhone(raw) {
  const normalized = normalizeWhatsappPhone(raw);
  return /^\+1\d{10}$/.test(normalized);
}

/** Digits only for wa.me path (no +). */
export function whatsappPhoneDigits(raw) {
  const normalized = normalizeWhatsappPhone(raw);
  return normalized.replace(/\D/g, "");
}

/**
 * Display value for inputs: show local 10-digit formatting from stored E.164.
 */
export function toLocalDisplay(raw) {
  const normalized = normalizeWhatsappPhone(raw);
  if (normalized && normalized.startsWith("+1") && normalized.length === 12) {
    return formatWhatsappPhoneRealtime(normalized.slice(2));
  }
  return formatWhatsappPhoneRealtime(raw);
}

export function buildWhatsappIntakeLink(phone, intakeUrl, clientName = "") {
  const digits = whatsappPhoneDigits(phone);
  if (!digits || !intakeUrl) return "";
  const greeting = clientName ? `Hola ${clientName}, ` : "Hola, ";
  const text = `${greeting}complete su formulario de admisión DGII e-CF aquí: ${intakeUrl}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
