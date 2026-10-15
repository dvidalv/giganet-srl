import { diasEntre, hoyRD } from "./fechasRD";

export const MODALIDAD_ILIMITADO = "ILIMITADO";
export const MODALIDAD_CONTROLADO = "CONTROLADO";
export const MODALIDADES = [MODALIDAD_ILIMITADO, MODALIDAD_CONTROLADO];
export const UMBRAL_POR_VENCER_DIAS = 30;
export const ALERTA_MINIMA_PCT_DEFECTO = 10;
export const ALERTA_MINIMA_PCT_MAX = 90;

/** Empresas sin el subdocumento `folios` (clientes previos) son ILIMITADO. */
export function modalidadEmpresa(empresa) {
  return empresa?.folios?.modalidad === MODALIDAD_CONTROLADO
    ? MODALIDAD_CONTROLADO
    : MODALIDAD_ILIMITADO;
}

/** Máximo emitible: no se puede emitir más de lo asignado en The Factory ni de lo contratado. */
export function limiteEmision(contrato) {
  return Math.min(contrato.asignados || 0, contrato.cantidadContratada || 0);
}

export function disponibleContrato(contrato) {
  return Math.max(
    0,
    limiteEmision(contrato) - (contrato.consumidos || 0) - (contrato.reservados || 0),
  );
}

/** % de alerta mínima de la empresa; las que nunca lo configuraron usan el valor por defecto. */
export function alertaMinimaPctEmpresa(empresa) {
  const pct = empresa?.folios?.alertaMinimaPct;
  if (pct === undefined) return ALERTA_MINIMA_PCT_DEFECTO;
  return typeof pct === "number" && pct > 0 ? pct : null;
}

/** Folios disponibles en o bajo los cuales se dispara la alerta mínima; null si no aplica. */
export function umbralMinimo(contrato, pct) {
  const limite = limiteEmision(contrato);
  if (!pct || limite <= 0) return null;
  return Math.ceil((limite * pct) / 100);
}

function compararPrioridad(a, b) {
  return (
    a.fechaVencimiento.localeCompare(b.fechaVencimiento) ||
    a.fechaInicio.localeCompare(b.fechaInicio) ||
    new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
  );
}

export function esVigente(contrato, hoy) {
  return (
    contrato.estado === "activo" &&
    contrato.fechaInicio <= hoy &&
    hoy <= contrato.fechaVencimiento
  );
}

/** Contratos vigentes hoy, en orden de uso: primero el que vence antes. */
export function contratosVigentes(contratos, hoy) {
  return contratos.filter((c) => esVigente(c, hoy)).sort(compararPrioridad);
}

export function estadoContrato(contrato, hoy = hoyRD()) {
  if (contrato.estado === "cancelado") return "CANCELADO";
  if (hoy < contrato.fechaInicio) return "PROGRAMADO";
  if (hoy > contrato.fechaVencimiento) return "VENCIDO";
  if ((contrato.consumidos || 0) >= contrato.cantidadContratada) return "AGOTADO";
  if (disponibleContrato(contrato) === 0) return "SIN_SALDO_ASIGNADO";
  if (diasEntre(hoy, contrato.fechaVencimiento) <= UMBRAL_POR_VENCER_DIAS) {
    return "POR_VENCER";
  }
  return "VIGENTE";
}

export function resumenContrato(contrato, hoy = hoyRD()) {
  const cantidad = contrato.cantidadContratada || 0;
  const consumidos = contrato.consumidos || 0;
  return {
    id: String(contrato._id),
    codigo: contrato.codigo,
    empresa: String(contrato.empresa),
    cantidadContratada: cantidad,
    asignados: contrato.asignados || 0,
    pendienteAsignar: Math.max(0, cantidad - (contrato.asignados || 0)),
    consumidos,
    reservados: contrato.reservados || 0,
    consumoPrevio: contrato.consumoPrevio || 0,
    ajusteConsumo: contrato.ajusteConsumo || 0,
    disponible: disponibleContrato(contrato),
    porcentajeConsumo: cantidad ? Math.min(100, Math.round((consumidos / cantidad) * 1000) / 10) : 0,
    fechaInicio: contrato.fechaInicio,
    fechaVencimiento: contrato.fechaVencimiento,
    diasRestantes: diasEntre(hoy, contrato.fechaVencimiento),
    estado: contrato.estado,
    estadoCalculado: estadoContrato(contrato, hoy),
    motivoCancelacion: contrato.motivoCancelacion || "",
    renovacionDe: contrato.renovacionDe ? String(contrato.renovacionDe) : null,
    saldoTheFactory: {
      cantidad: contrato.saldoTheFactory?.cantidad ?? null,
      fecha: contrato.saldoTheFactory?.fecha ?? null,
      nota: contrato.saldoTheFactory?.nota || "",
    },
    observaciones: contrato.observaciones || "",
    createdAt: contrato.createdAt ?? null,
  };
}

/**
 * Contrato que representa a la empresa hoy: el vigente con saldo que vence primero;
 * si ninguno tiene saldo, el vigente que vence primero; si no hay vigentes, el próximo
 * programado o el último vencido.
 */
export function seleccionarContratoActual(contratos, hoy = hoyRD()) {
  const vigentes = contratosVigentes(contratos, hoy);
  if (vigentes.length) {
    return vigentes.find((c) => disponibleContrato(c) > 0) ?? vigentes[0];
  }
  const activos = contratos.filter((c) => c.estado === "activo");
  const programado = activos
    .filter((c) => hoy < c.fechaInicio)
    .sort((a, b) => a.fechaInicio.localeCompare(b.fechaInicio))[0];
  if (programado) return programado;
  return (
    activos
      .filter((c) => hoy > c.fechaVencimiento)
      .sort((a, b) => b.fechaVencimiento.localeCompare(a.fechaVencimiento))[0] ?? null
  );
}

/**
 * Motivo de bloqueo previo a reservar (independiente del saldo).
 * @returns {null | "FOLIOS_CONFIGURACION_INCOMPLETA" | "FOLIOS_VENCIDOS" | "FOLIOS_SIN_CONTRATO_VIGENTE"}
 */
export function motivoBloqueoPorVigencia(contratos, hoy = hoyRD()) {
  const activos = contratos.filter((c) => c.estado === "activo");
  if (!activos.length) return "FOLIOS_CONFIGURACION_INCOMPLETA";
  if (contratosVigentes(activos, hoy).length) return null;
  return activos.some((c) => hoy > c.fechaVencimiento)
    ? "FOLIOS_VENCIDOS"
    : "FOLIOS_SIN_CONTRATO_VIGENTE";
}

export function estadoEmpresa(modalidad, contratos, hoy = hoyRD()) {
  if (modalidad !== MODALIDAD_CONTROLADO) return "ILIMITADO";
  if (!contratos.some((c) => c.estado === "activo")) return "SIN_CONTRATO";
  const actual = seleccionarContratoActual(contratos, hoy);
  return actual ? estadoContrato(actual, hoy) : "SIN_CONTRATO";
}
