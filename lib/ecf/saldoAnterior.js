/**
 * El saldo anterior no entra al monto gravado ni al ITBIS.
 * Valor a pagar = monto total del servicio + saldo anterior.
 */
export function aplicarSaldoAnteriorEnTotales(totales, saldoAnterior) {
  if (!totales || typeof totales !== "object") return totales;
  const saldo =
    Math.round(Number(String(saldoAnterior ?? "").replace(/,/g, "")) * 100) / 100;
  if (!(saldo > 0)) return totales;

  const pascal = totales.MontoTotal != null && totales.montoTotal == null;
  const raw = pascal ? totales.MontoTotal : totales.montoTotal;
  const monto =
    Math.round(Number(String(raw ?? "").replace(/,/g, "")) * 100) / 100;
  if (!Number.isFinite(monto)) return totales;

  const valor = (Math.round((monto + saldo) * 100) / 100).toFixed(2);
  const saldoTxt = saldo.toFixed(2);
  if (pascal) {
    return { ...totales, SaldoAnterior: saldoTxt, ValorPagar: valor };
  }
  return { ...totales, saldoAnterior: saldoTxt, valorPagar: valor };
}
