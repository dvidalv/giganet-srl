const STORAGE_KEY = "giganet:empresas:q";

export function readEmpresasListQ() {
  if (typeof window === "undefined") return "";
  try {
    return String(sessionStorage.getItem(STORAGE_KEY) || "").trim();
  } catch {
    return "";
  }
}

export function writeEmpresasListQ(q) {
  if (typeof window === "undefined") return;
  try {
    const next = String(q || "").trim();
    if (next) sessionStorage.setItem(STORAGE_KEY, next);
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore quota / private mode */
  }
}

/** Href del listado de empresas, con la última búsqueda si existe. */
export function empresasListHref() {
  const q = readEmpresasListQ();
  return q ? `/dashboard/empresas?q=${encodeURIComponent(q)}` : "/dashboard/empresas";
}
