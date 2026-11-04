import { afterEach, describe, expect, it, vi } from "vitest";
import { correoParaTheFactory } from "@/lib/ecf/correoConsumo";

describe("correo en E32 menor a DOP$250000", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("no reenvía un correo inválido", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(correoParaTheFactory("no-es-correo", true, "correo del comprador")).toBeNull();
    expect(correoParaTheFactory("cliente@", true)).toBeNull();
    expect(correoParaTheFactory("cliente@empresa", true)).toBeNull();
    expect(warn).toHaveBeenCalled();
  });

  it("sí reenvía un correo válido, recortado", () => {
    expect(correoParaTheFactory("  cliente@empresa.com  ", true)).toBe("cliente@empresa.com");
  });

  it("un correo vacío no se envía y no se trata como inválido", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(correoParaTheFactory("", true)).toBeNull();
    expect(correoParaTheFactory("   ", true)).toBeNull();
    expect(correoParaTheFactory(null, true)).toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });

  it("fuera de ese caso el correo inválido se conserva", () => {
    expect(correoParaTheFactory("no-es-correo", false)).toBe("no-es-correo");
    expect(correoParaTheFactory("  cliente@empresa.com ", false)).toBe("cliente@empresa.com");
  });
});
