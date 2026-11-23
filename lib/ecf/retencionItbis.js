/** E31 (crédito fiscal) y E34 (nota de crédito que revierte un E31 con retención). */
const TIPOS_CON_RETENCION_OPCIONAL = new Set(["31", "34"]);

function aMonto(valor) {
  const n = Number(String(valor ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

/**
 * ITBIS retenido solicitado por el emisor en `factura.itbisRetenido`.
 * Solo E31/E34 y solo si el emisor lo envía (> 0); sin el campo, el e-CF no cambia.
 */
export function itbisRetenidoSolicitado(factura) {
  if (!factura || typeof factura !== "object") return 0;
  if (!TIPOS_CON_RETENCION_OPCIONAL.has(String(factura.tipo ?? "").trim())) return 0;
  const monto = aMonto(factura.itbisRetenido);
  return monto > 0 ? monto : 0;
}

/**
 * Reparte el ITBIS retenido entre las líneas gravadas (`Retencion` por ítem) y agrega
 * `totalITBISRetenido` en Totales. El total del documento no cambia: DGII mantiene
 * MontoTotal con ITBIS y la retención va aparte (ver json_41_n1).
 *
 * @param {Record<string, any>} documento — resultado de transformarFacturaParaTheFactory
 * @param {number} montoRetenido
 */
export function aplicarRetencionItbisEnDocumento(documento, montoRetenido) {
  const retenido = aMonto(montoRetenido);
  if (!(retenido > 0)) return documento;

  const doc = documento?.DocumentoElectronico;
  const totales = doc?.Encabezado?.Totales;
  const items = Array.isArray(doc?.DetallesItems) ? doc.DetallesItems : [];
  if (!totales) return documento;

  const totalItbis = aMonto(totales.totalITBIS ?? totales.TotalITBIS);
  if (!(totalItbis > 0)) {
    throw new Error("Retención de ITBIS: se indicó ITBIS retenido pero el comprobante no tiene ITBIS.");
  }
  if (retenido > totalItbis + 0.01) {
    throw new Error(
      `Retención de ITBIS: el ITBIS retenido (${retenido.toFixed(2)}) no puede superar el ITBIS facturado (${totalItbis.toFixed(2)}).`,
    );
  }

  const gravadas = items.filter((it) => String(it.IndicadorFacturacion) === "1");
  if (!gravadas.length) {
    throw new Error("Retención de ITBIS: se indicó ITBIS retenido pero no hay líneas gravadas.");
  }

  const pesos = gravadas.map((it) => aMonto(it.Monto));
  const sumaPesos = pesos.reduce((s, p) => s + p, 0);
  let asignado = 0;
  gravadas.forEach((it, i) => {
    const esUltima = i === gravadas.length - 1;
    const parte = esUltima
      ? Math.round((retenido - asignado) * 100) / 100
      : sumaPesos > 0
        ? Math.round(((retenido * pesos[i]) / sumaPesos) * 100) / 100
        : 0;
    asignado = Math.round((asignado + parte) * 100) / 100;
    it.retencion = {
      indicadorAgente: "1",
      montoITBIS: parte.toFixed(2),
      montoISR: "0.00",
    };
  });

  doc.Encabezado.Totales = {
    ...totales,
    totalITBISRetenido: retenido.toFixed(2),
    totalISRRetencion: "0.00",
  };
  return documento;
}
