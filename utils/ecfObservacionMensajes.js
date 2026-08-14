/**
 * Textos de ayuda cuando TheFactory/DGII solo devuelve un código corto
 * y el detalle (p. ej. postulación) aparece en el portal pero no en el JSON.
 */

/** @type {Record<string, string>} */
const MENSAJES_OBS_POR_CODIGO = {
  7777:
    "Secuencia reutilizable. En TheFactory esto suele indicar que el RNC emisor no tiene postulación activa o el rango e-NCF no es válido en este ambiente; revise postulación y secuencia antes de pedir otro número.",
};

/**
 * @param {unknown} codigo
 * @param {unknown} mensajeApi
 * @returns {string}
 */
export function mensajeObservacionEcfUi(codigo, mensajeApi) {
  const cod = String(codigo ?? "").trim();
  const msg = String(mensajeApi ?? "").trim();
  const interpretado = MENSAJES_OBS_POR_CODIGO[cod];
  if (!interpretado) return msg;
  if (/postulaci/i.test(msg)) return msg;
  return interpretado;
}

/**
 * Enriquece `observaciones` dentro de un bloque de estatus TheFactory/DGII.
 * @param {Record<string, unknown> | null | undefined} datosEstatus
 * @returns {Record<string, unknown> | null | undefined}
 */
export function enriquecerDatosEstatusObservaciones(datosEstatus) {
  if (!datosEstatus || typeof datosEstatus !== "object") return datosEstatus;
  const obs = datosEstatus.observaciones;
  if (!Array.isArray(obs) || obs.length === 0) return datosEstatus;

  return {
    ...datosEstatus,
    observaciones: obs.map((row) => {
      if (!row || typeof row !== "object") return row;
      const o = /** @type {Record<string, unknown>} */ (row);
      return {
        ...o,
        mensaje: mensajeObservacionEcfUi(o.codigo, o.mensaje),
      };
    }),
  };
}
