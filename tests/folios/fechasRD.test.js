import { describe, expect, it } from "vitest";
import { diasEntre, esDiaValido, hoyRD } from "@/lib/folios/fechasRD";

describe("fechas en zona horaria de República Dominicana", () => {
  it("usa el día local de RD, no el de UTC", () => {
    expect(hoyRD(new Date("2027-01-16T03:59:00Z"))).toBe("2027-01-15");
    expect(hoyRD(new Date("2027-01-16T04:00:00Z"))).toBe("2027-01-16");
  });

  it("valida días reales", () => {
    expect(esDiaValido("2026-02-28")).toBe(true);
    expect(esDiaValido("2026-02-30")).toBe(false);
    expect(esDiaValido("15/01/2026")).toBe(false);
  });

  it("cuenta días calendario", () => {
    expect(diasEntre("2026-01-15", "2027-01-15")).toBe(365);
    expect(diasEntre("2027-01-16", "2027-01-15")).toBe(-1);
  });
});
