import { describe, it, expect } from "vitest";
import {
  isAcceptedDgiiImageFile,
  classifyDgiiImageFiles,
  describeDgiiImageSelection,
} from "@/lib/comprobantes/dgiiImportFiles";

function fakeFile({ name, type = "", size = 100, lastModified = 1 }) {
  return { name, type, size, lastModified };
}

describe("dgiiImportFiles", () => {
  it("acepta por MIME y por extensión cuando el tipo está vacío", () => {
    expect(
      isAcceptedDgiiImageFile(
        fakeFile({ name: "a.jpg", type: "image/jpeg" }),
      ),
    ).toBe(true);
    expect(
      isAcceptedDgiiImageFile(fakeFile({ name: "b.PNG", type: "image/png" })),
    ).toBe(true);

    // Drag-and-drop: MIME vacío → caer a extensión
    expect(
      isAcceptedDgiiImageFile(fakeFile({ name: "foto1.jpg", type: "" })),
    ).toBe(true);
    expect(
      isAcceptedDgiiImageFile(fakeFile({ name: "foto2.jpeg", type: "" })),
    ).toBe(true);
    expect(
      isAcceptedDgiiImageFile(fakeFile({ name: "foto3.png", type: "" })),
    ).toBe(true);
    expect(
      isAcceptedDgiiImageFile(fakeFile({ name: "foto4.webp", type: "" })),
    ).toBe(true);

    expect(
      isAcceptedDgiiImageFile(fakeFile({ name: "doc.pdf", type: "" })),
    ).toBe(true);
    expect(
      isAcceptedDgiiImageFile(
        fakeFile({ name: "autorizacion.pdf", type: "application/pdf" }),
      ),
    ).toBe(true);
    expect(
      isAcceptedDgiiImageFile(
        fakeFile({ name: "portal-dgii.pdf", type: "application/octet-stream" }),
      ),
    ).toBe(true);
    expect(
      isAcceptedDgiiImageFile(
        fakeFile({ name: "x.heic", type: "image/heic" }),
      ),
    ).toBe(false);
  });

  it("clasifica tres fotos con MIME vacío como aceptadas", () => {
    const { accepted, rejected } = classifyDgiiImageFiles([
      fakeFile({ name: "1.jpg", type: "", size: 10 }),
      fakeFile({ name: "2.jpg", type: "", size: 20 }),
      fakeFile({ name: "3.png", type: "", size: 30 }),
    ]);
    expect(accepted).toHaveLength(3);
    expect(rejected).toHaveLength(0);
  });

  it("reporta rechazos y no pierde las válidas del mismo lote", () => {
    const { accepted, rejected } = classifyDgiiImageFiles([
      fakeFile({ name: "ok.jpg", type: "" }),
      fakeFile({ name: "autorizacion.pdf", type: "" }),
      fakeFile({ name: "also.webp", type: "image/webp" }),
      fakeFile({ name: "bad.heic", type: "image/heic" }),
    ]);
    expect(accepted.map((f) => f.name)).toEqual([
      "ok.jpg",
      "autorizacion.pdf",
      "also.webp",
    ]);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].name).toBe("bad.heic");

    const msg = describeDgiiImageSelection({
      acceptedCount: accepted.length,
      totalCount: accepted.length,
      rejected,
      skippedDuplicate: 0,
    });
    expect(msg).toContain("3 archivos aceptados");
    expect(msg).toContain("1 rechazada");
    expect(msg).toContain("bad.heic");
  });
});
