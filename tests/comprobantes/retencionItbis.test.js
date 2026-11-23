import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { transformarFacturaParaTheFactory } from "@/app/controllers/comprobantes";
import {
  aplicarRetencionItbisEnDocumento,
  itbisRetenidoSolicitado,
} from "@/lib/ecf/retencionItbis";
import { facturaE31Daymond } from "./fixtures/facturaE31";
import ecfAntes from "./fixtures/facturaE31.ecf-antes.json";

describe("e-CF E31 completo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-23T14:00:00Z"));
    vi.spyOn(console, "log").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("sin itbisRetenido es idéntico al e-CF generado antes de este cambio", () => {
    const out = transformarFacturaParaTheFactory(structuredClone(facturaE31Daymond), "TOKEN");
    expect(out).toEqual(ecfAntes);
  });

  it("con itbisRetenido agrega la retención sin tocar MontoTotal ni el resto del documento", () => {
    const body = structuredClone(facturaE31Daymond);
    body.factura.itbisRetenido = "137.29";
    const out = transformarFacturaParaTheFactory(body, "TOKEN");
    const totales = out.DocumentoElectronico.Encabezado.Totales;
    const totalesAntes = ecfAntes.DocumentoElectronico.Encabezado.Totales;

    expect(totales).toEqual({
      ...totalesAntes,
      totalITBISRetenido: "137.29",
      totalISRRetencion: "0.00",
    });
    expect(out.DocumentoElectronico.DetallesItems[0].retencion).toEqual({
      indicadorAgente: "1",
      montoITBIS: "137.29",
      montoISR: "0.00",
    });
    const sinRetencion = structuredClone(out);
    delete sinRetencion.DocumentoElectronico.DetallesItems[0].retencion;
    sinRetencion.DocumentoElectronico.Encabezado.Totales = totalesAntes;
    expect(sinRetencion).toEqual(ecfAntes);
  });
});

function documentoE31() {
  return {
    DocumentoElectronico: {
      Encabezado: {
        Totales: {
          montoGravadoTotal: "762.71",
          totalITBIS: "137.29",
          montoTotal: "900.00",
        },
      },
      DetallesItems: [
        { NumeroLinea: "1", IndicadorFacturacion: "1", Monto: "500.00" },
        { NumeroLinea: "2", IndicadorFacturacion: "1", Monto: "262.71" },
        { NumeroLinea: "3", IndicadorFacturacion: "4", Monto: "50.00" },
      ],
    },
  };
}

describe("retención de ITBIS opcional en E31", () => {
  it("sin itbisRetenido no se activa (otros emisores no cambian)", () => {
    expect(itbisRetenidoSolicitado({ tipo: "31" })).toBe(0);
    expect(itbisRetenidoSolicitado({ tipo: "31", itbisRetenido: "" })).toBe(0);
    expect(itbisRetenidoSolicitado({ tipo: "31", itbisRetenido: 0 })).toBe(0);
  });

  it("solo aplica a E31", () => {
    expect(itbisRetenidoSolicitado({ tipo: "32", itbisRetenido: "137.29" })).toBe(0);
    expect(itbisRetenidoSolicitado({ tipo: "41", itbisRetenido: "137.29" })).toBe(0);
    expect(itbisRetenidoSolicitado({ tipo: "31", itbisRetenido: "137.29" })).toBe(137.29);
  });

  it("reparte la retención en líneas gravadas y la suma cuadra con Totales", () => {
    const doc = aplicarRetencionItbisEnDocumento(documentoE31(), 137.29);
    const items = doc.DocumentoElectronico.DetallesItems;
    const totales = doc.DocumentoElectronico.Encabezado.Totales;

    expect(items[2].retencion).toBeUndefined();
    const suma = items
      .filter((it) => it.retencion)
      .reduce((s, it) => s + Number(it.retencion.montoITBIS), 0);
    expect(suma.toFixed(2)).toBe("137.29");
    expect(items[0].retencion.indicadorAgente).toBe("1");
    expect(totales.totalITBISRetenido).toBe("137.29");
    expect(totales.montoTotal).toBe("900.00");
  });

  it("rechaza retener más ITBIS del facturado", () => {
    expect(() => aplicarRetencionItbisEnDocumento(documentoE31(), 200)).toThrow(/no puede superar/);
  });
});
