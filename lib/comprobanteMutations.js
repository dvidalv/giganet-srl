/**
 * Aplica un PATCH de secuencia e-CF sobre un documento Mongoose.
 * @param {import("mongoose").Document} rango
 * @param {Record<string, unknown>} body
 * @returns {{ ok: true } | { ok: false, error: string, status: number }}
 */
export function applyComprobantePatch(rango, body) {
  if (body.numero_inicial != null) rango.numero_inicial = Number(body.numero_inicial);
  if (body.numero_final != null) rango.numero_final = Number(body.numero_final);

  const numeroInicial = Number(rango.numero_inicial);
  const numeroFinal = Number(rango.numero_final);
  const hasProximo =
    body.proximo_numero != null && String(body.proximo_numero).trim() !== "";
  const hasUtilizados =
    body.numeros_utilizados != null &&
    String(body.numeros_utilizados).trim() !== "";

  if (hasProximo || hasUtilizados) {
    const proximo = hasProximo
      ? Number(body.proximo_numero)
      : numeroInicial + Number(body.numeros_utilizados);
    if (!Number.isInteger(proximo)) {
      return {
        ok: false,
        error: "El próximo número debe ser un entero",
        status: 400,
      };
    }
    if (proximo < numeroInicial) {
      return {
        ok: false,
        error:
          "El próximo número no puede ser menor que el número inicial del rango",
        status: 400,
      };
    }
    if (proximo > numeroFinal + 1) {
      return {
        ok: false,
        error: "El próximo número no puede superar el final del rango",
        status: 400,
      };
    }
    rango.numeros_utilizados = proximo - numeroInicial;
  }

  if (body.fecha_autorizacion != null) {
    rango.fecha_autorizacion = new Date(body.fecha_autorizacion);
  }
  if (body.fecha_vencimiento !== undefined) {
    rango.fecha_vencimiento =
      body.fecha_vencimiento && String(body.fecha_vencimiento).trim()
        ? new Date(body.fecha_vencimiento)
        : null;
  }
  if (body.estado !== undefined) rango.estado = String(body.estado).trim();
  if (body.comentario !== undefined) {
    rango.comentario = String(body.comentario).trim().slice(0, 500);
  }
  if (body.alerta_minima_restante != null) {
    rango.alerta_minima_restante = Number(body.alerta_minima_restante);
  }
  if (body.tf_serie !== undefined) {
    rango.tf_serie =
      body.tf_serie != null ? String(body.tf_serie).trim().slice(0, 24) : "";
  }
  if (body.tf_codigo_sucursal !== undefined) {
    rango.tf_codigo_sucursal =
      body.tf_codigo_sucursal != null
        ? String(body.tf_codigo_sucursal).trim().slice(0, 12)
        : "";
  }

  return { ok: true };
}
