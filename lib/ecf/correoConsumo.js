/**
 * Formato usado también al reenviar el e-CF por correo.
 * Un valor que no cumple esto hace que The Factory rechace el comprobante (código 0102).
 */
const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const mensajeCorreoOmitido = (campo) =>
  `⚠️ E32 menor a DOP$250000: ${campo} inválido. No se envía a The Factory.`;

/**
 * Correo que se incluye en el documento enviado a The Factory.
 *
 * En una E32 de consumo menor a DOP$250,000 (consumidor final), un correo
 * con formato inválido se omite. The Factory rechazaría toda la factura
 * por ese dato, y el comprobante debe emitirse igual, sin envío por correo.
 * En los demás tipos el valor se reenvía tal cual (recortado si es texto).
 *
 * @param {unknown} valor
 * @param {boolean} omitirSiInvalido Solo true en E32 bajo el umbral de DOP$250,000.
 * @param {string} [campo] Nombre del campo, para el aviso en el log.
 * @returns {string | null | unknown}
 */
export function correoParaTheFactory(valor, omitirSiInvalido, campo = "correo") {
  if (valor == null) return null;

  if (typeof valor !== "string") {
    if (!omitirSiInvalido) return valor;
    const texto = String(valor).trim();
    if (!texto || !EMAIL_VALIDO.test(texto)) {
      console.warn(mensajeCorreoOmitido(campo));
      return null;
    }
    return texto;
  }

  const limpio = valor.trim();
  if (!limpio) return null;
  if (omitirSiInvalido && !EMAIL_VALIDO.test(limpio)) {
    console.warn(mensajeCorreoOmitido(campo));
    return null;
  }
  return limpio;
}
