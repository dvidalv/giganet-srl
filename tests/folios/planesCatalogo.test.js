import { describe, expect, it } from "vitest";
import {
  PLANES_FOLIOS,
  formatPrecioRD,
  formatTransacciones,
  getPlanBySlug,
  hrefContactoPlan,
  mensajeInteresPlan,
  planesDestacados,
} from "@/lib/folios/planesCatalogo";

describe("catálogo público de planes de folios", () => {
  it("publica los 14 planes del tarifario en RD$", () => {
    expect(PLANES_FOLIOS).toHaveLength(14);
    expect(PLANES_FOLIOS.map((plan) => plan.slug)).toEqual([
      "pyme",
      "corp-1",
      "corp-2",
      "corp-3",
      "corp-4",
      "corp-5",
      "corp-6",
      "corp-7",
      "corp-8",
      "corp-9",
      "corp-10",
      "corp-11",
      "corp-12",
      "corp-13",
    ]);
  });

  it("respeta precios y transacciones del documento comercial", () => {
    expect(getPlanBySlug("pyme")).toMatchObject({
      transacciones: 200,
      precioAnual: 2600,
      precioMensual: null,
    });
    expect(getPlanBySlug("corp-1")).toMatchObject({
      transacciones: 500,
      precioAnual: 9155.52,
      precioMensual: 762.96,
    });
    expect(getPlanBySlug("corp-4")).toMatchObject({
      transacciones: 3000,
      precioAnual: 15640,
      precioMensual: 1303.33,
    });
    expect(getPlanBySlug("corp-13")).toMatchObject({
      transacciones: 150000,
      precioAnual: 244800,
      precioMensual: 20400,
    });
  });

  it("formatea precios y volúmenes como el tarifario (RD$2.600,00)", () => {
    expect(formatPrecioRD(2600)).toBe("RD$2.600,00");
    expect(formatPrecioRD(9155.52)).toBe("RD$9.155,52");
    expect(formatPrecioRD(1303.33)).toBe("RD$1.303,33");
    expect(formatPrecioRD(null)).toBe("N/A");
    expect(formatTransacciones(1000)).toBe("1.000");
    expect(formatTransacciones(150000)).toBe("150.000");
  });

  it("arma el enlace y el mensaje de solicitud de un plan", () => {
    const pyme = getPlanBySlug("pyme");
    expect(hrefContactoPlan("corp-5")).toBe("/contacto?plan=corp-5");
    expect(mensajeInteresPlan(pyme)).toContain("Plan Pyme");
    expect(mensajeInteresPlan(pyme)).toContain("RD$2.600,00");
    expect(mensajeInteresPlan(pyme)).toContain("sin precio mensual");
    expect(planesDestacados().map((plan) => plan.slug)).toEqual(["pyme", "corp-5", "corp-10"]);
  });
});
