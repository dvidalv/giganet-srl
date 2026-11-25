import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { transformarFacturaParaTheFactory } from "@/app/controllers/comprobantes";
import {
  aplicarRetencionItbisEnDocumento,
  aplicarRetencionIsrEnDocumento45,
  isrRetenidoSolicitado,
  itbisRetenidoSolicitado,
} from "@/lib/ecf/retencionItbis";
import { facturaE31Daymond } from "./fixtures/facturaE31";
import ecfAntes from "./fixtures/facturaE31.ecf-antes.json";
import { notaCreditoE34Daymond } from "./fixtures/notaCreditoE34";
import ecfE34Antes from "./fixtures/notaCreditoE34.ecf-antes.json";

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

  it("E34 sin itbisRetenido es idéntico al e-CF generado antes de la retención opcional", () => {
    const out = transformarFacturaParaTheFactory(structuredClone(notaCreditoE34Daymond), "TOKEN");
    expect(out).toEqual(ecfE34Antes);
  });

  it("E34 (NC total de factura FBJ) revierte 137.29 retenido con MontoTotal 900.00", () => {
    const body = structuredClone(notaCreditoE34Daymond);
    body.factura.itbisRetenido = "137.29";
    const out = transformarFacturaParaTheFactory(body, "TOKEN");
    const totales = out.DocumentoElectronico.Encabezado.Totales;
    const totalesAntes = ecfE34Antes.DocumentoElectronico.Encabezado.Totales;

    expect(totales).toEqual({
      ...totalesAntes,
      totalITBISRetenido: "137.29",
      totalISRRetencion: "0.00",
    });
    expect(totales.montoTotal).toBe("900.00");
    expect(out.DocumentoElectronico.DetallesItems[0].retencion.montoITBIS).toBe("137.29");
    const sinRetencion = structuredClone(out);
    delete sinRetencion.DocumentoElectronico.DetallesItems[0].retencion;
    sinRetencion.DocumentoElectronico.Encabezado.Totales = totalesAntes;
    expect(sinRetencion).toEqual(ecfE34Antes);
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

  it("solo aplica a E31 y E34", () => {
    expect(itbisRetenidoSolicitado({ tipo: "32", itbisRetenido: "137.29" })).toBe(0);
    expect(itbisRetenidoSolicitado({ tipo: "33", itbisRetenido: "137.29" })).toBe(0);
    expect(itbisRetenidoSolicitado({ tipo: "41", itbisRetenido: "137.29" })).toBe(0);
    expect(itbisRetenidoSolicitado({ tipo: "46", itbisRetenido: "137.29" })).toBe(0);
    expect(itbisRetenidoSolicitado({ tipo: "47", itbisRetenido: "137.29" })).toBe(0);
    expect(itbisRetenidoSolicitado({ tipo: "31", itbisRetenido: "137.29" })).toBe(137.29);
    expect(itbisRetenidoSolicitado({ tipo: "34", itbisRetenido: "137.29" })).toBe(137.29);
    expect(itbisRetenidoSolicitado({ tipo: "34" })).toBe(0);
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

describe("retención de ISR opcional en E45", () => {
  it("sin isrRetenido no se activa, y otros tipos lo ignoran", () => {
    expect(isrRetenidoSolicitado({ tipo: "45" })).toBe(0);
    expect(isrRetenidoSolicitado({ tipo: "45", isrRetenido: 0 })).toBe(0);
    expect(isrRetenidoSolicitado({ tipo: "31", isrRetenido: "33.94" })).toBe(0);
    expect(isrRetenidoSolicitado({ tipo: "32", isrRetenido: "33.94" })).toBe(0);
  });

  it("anota totalISRRetencion y baja ValorPagar sin tocar MontoTotal", () => {
    const doc = {
      DocumentoElectronico: {
        Encabezado: { Totales: { MontoTotal: "801.00", ValorPagar: "801.00" } },
        DetallesItems: [{ NumeroLinea: "1" }],
      },
    };
    aplicarRetencionIsrEnDocumento45(doc, 33.94);
    expect(doc.DocumentoElectronico.Encabezado.Totales.MontoTotal).toBe("801.00");
    expect(doc.DocumentoElectronico.Encabezado.Totales.ValorPagar).toBe("767.06");
    expect(doc.DocumentoElectronico.Encabezado.Totales.totalISRRetencion).toBe("33.94");
    expect(doc.DocumentoElectronico.DetallesItems[0].retencion).toBeUndefined();
  });
});
