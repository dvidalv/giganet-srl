/**
 * Tarifario público de planes de folios e-CF (pesos dominicanos).
 * Fuente: documento comercial "Planes de folios".
 */

export const PLANES_MONEDA = "DOP";
export const PLANES_MONEDA_ETIQUETA = "RD$";

export const PLANES_FOLIOS = [
  {
    slug: "pyme",
    nombre: "Plan Pyme",
    transacciones: 200,
    precioAnual: 2600,
    precioMensual: null,
    destacado: true,
    badge: "Para pymes",
    resumen: "Paquete de entrada, solo con pago anual.",
  },
  {
    slug: "corp-1",
    nombre: "Plan Corp 1",
    transacciones: 500,
    precioAnual: 9155.52,
    precioMensual: 762.96,
    destacado: false,
    badge: null,
    resumen: "Volumen inicial para empresas que emiten con regularidad.",
  },
  {
    slug: "corp-2",
    nombre: "Plan Corp 2",
    transacciones: 1000,
    precioAnual: 10983.36,
    precioMensual: 915.28,
    destacado: false,
    badge: null,
    resumen: "Más holgura mensual para operaciones en crecimiento.",
  },
  {
    slug: "corp-3",
    nombre: "Plan Corp 3",
    transacciones: 2000,
    precioAnual: 14280,
    precioMensual: 1190,
    destacado: false,
    badge: null,
    resumen: "Capacidad media para equipos que facturan todos los días.",
  },
  {
    slug: "corp-4",
    nombre: "Plan Corp 4",
    transacciones: 3000,
    precioAnual: 15640,
    precioMensual: 1303.33,
    destacado: false,
    badge: null,
    resumen: "Buen equilibrio entre volumen y costo por folio.",
  },
  {
    slug: "corp-5",
    nombre: "Plan Corp 5",
    transacciones: 5000,
    precioAnual: 23800,
    precioMensual: 1983.33,
    destacado: true,
    badge: "Recomendado",
    resumen: "Punto medio para empresas con emisión continua.",
  },
  {
    slug: "corp-6",
    nombre: "Plan Corp 6",
    transacciones: 6000,
    precioAnual: 26180,
    precioMensual: 2181.67,
    destacado: false,
    badge: null,
    resumen: "Un escalón más de capacidad sin saltar a alto volumen.",
  },
  {
    slug: "corp-7",
    nombre: "Plan Corp 7",
    transacciones: 10000,
    precioAnual: 44064,
    precioMensual: 3672,
    destacado: false,
    badge: null,
    resumen: "Para empresas con picos de emisión frecuentes.",
  },
  {
    slug: "corp-8",
    nombre: "Plan Corp 8",
    transacciones: 15000,
    precioAnual: 51000,
    precioMensual: 4250,
    destacado: false,
    badge: null,
    resumen: "Alto volumen con mejor costo unitario.",
  },
  {
    slug: "corp-9",
    nombre: "Plan Corp 9",
    transacciones: 25000,
    precioAnual: 73440,
    precioMensual: 6120,
    destacado: false,
    badge: null,
    resumen: "Pensado para cadenas y operaciones multi-sucursal.",
  },
  {
    slug: "corp-10",
    nombre: "Plan Corp 10",
    transacciones: 40000,
    precioAnual: 81600,
    precioMensual: 6800,
    destacado: true,
    badge: "Alto volumen",
    resumen: "Gran capacidad anual con tarifa competitiva por folio.",
  },
  {
    slug: "corp-11",
    nombre: "Plan Corp 11",
    transacciones: 50000,
    precioAnual: 102000,
    precioMensual: 8500,
    destacado: false,
    badge: null,
    resumen: "Escala corporativa para emisión constante.",
  },
  {
    slug: "corp-12",
    nombre: "Plan Corp 12",
    transacciones: 100000,
    precioAnual: 204000,
    precioMensual: 17000,
    destacado: false,
    badge: null,
    resumen: "Cien mil transacciones para operación masiva.",
  },
  {
    slug: "corp-13",
    nombre: "Plan Corp 13",
    transacciones: 150000,
    precioAnual: 244800,
    precioMensual: 20400,
    destacado: false,
    badge: null,
    resumen: "El paquete de mayor capacidad del tarifario.",
  },
];

/** Formato del tarifario publicado: RD$2.600,00 */
export function formatPrecioRD(valor) {
  if (valor == null || !Number.isFinite(valor)) return "N/A";
  const [entero, decimales] = valor.toFixed(2).split(".");
  const conMiles = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${PLANES_MONEDA_ETIQUETA}${conMiles},${decimales}`;
}

/** Formato del tarifario: 1.000 / 100.000 */
export function formatTransacciones(valor) {
  if (!Number.isFinite(valor)) return "—";
  return Math.trunc(valor)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function getPlanBySlug(slug) {
  if (!slug) return null;
  return PLANES_FOLIOS.find((plan) => plan.slug === String(slug).trim()) ?? null;
}

export function planesDestacados() {
  return PLANES_FOLIOS.filter((plan) => plan.destacado);
}

export function mensajeInteresPlan(plan) {
  if (!plan) return "";
  const mensual =
    plan.precioMensual == null
      ? "sin precio mensual"
      : `${formatPrecioRD(plan.precioMensual)} mensual`;
  return `Hola, estoy interesado en el ${plan.nombre} (${formatTransacciones(plan.transacciones)} transacciones, ${formatPrecioRD(plan.precioAnual)} anual, ${mensual}).`;
}

export function hrefContactoPlan(slug) {
  const plan = getPlanBySlug(slug);
  if (!plan) return "/contacto";
  return `/contacto?plan=${encodeURIComponent(plan.slug)}`;
}

export function hrefWhatsappPlan(plan) {
  const phone = "18298890579";
  const text = mensajeInteresPlan(plan) || "Hola, quiero información sobre los planes de folios e-CF.";
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}
