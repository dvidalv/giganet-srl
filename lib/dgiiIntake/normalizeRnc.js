/** Strip dashes and spaces so "123-45678-9" and "123456789" compare equal. */
export function normalizeRnc(value) {
  return String(value || "").replace(/[\s-]/g, "");
}
