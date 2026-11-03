import { config } from "dotenv";
config({ path: ".env.local" });
import { readFileSync } from "fs";
import { describe, it, expect } from "vitest";
import {
  extraerSeriesEDesdeImagenes,
  fusionarExtraccionesPorImagen,
  isDgiiVisionConfigured,
} from "@/lib/comprobantes/dgiiImport";

const ASSETS =
  "/Users/dvidalv/.cursor/projects/Users-dvidalv-giganet-SRL/assets";

const PHOTOS = [
  {
    label: "photo3",
    path: `${ASSETS}/WhatsApp_Image_2026-11-03_at_10.47.33__2_-18c1244e-30c1-440e-8c11-4f442f9dcdf6.jpg`,
    expectedHint: "E43 + E45 (primary asset)",
  },
  {
    label: "photo3_alt",
    path: `${ASSETS}/WhatsApp_Image_2026-11-03_at_10.47.33__2_-a10e382f-b301-44ff-b89c-435e293ad8df.jpg`,
    expectedHint: "E43 + E45 (smoke-test asset)",
  },
];

function summarize(filas) {
  return filas.map((f) => ({
    tipo: f.tipo_comprobante,
    ini: f.numero_inicial,
    fin: f.numero_final,
    qty: f.cantidad,
    sol: f.no_solicitud,
    aut: f.no_autorizacion,
  }));
}

describe("dgii vision per-photo diagnosis", () => {
  it(
    "extracts each of the three photos alone, then merges",
    async () => {
      expect(isDgiiVisionConfigured()).toBe(true);
      const porImagen = [];
      for (const photo of PHOTOS) {
        const buf = readFileSync(photo.path);
        const filas = await extraerSeriesEDesdeImagenes([
          { mediaType: "image/jpeg", data: buf },
        ]);
        porImagen.push(filas);
        console.log(
          `\n=== ${photo.label} (${photo.expectedHint}) ===\n`,
          JSON.stringify(summarize(filas), null, 2),
        );
      }
      const merged = fusionarExtraccionesPorImagen(porImagen);
      console.log(
        "\n=== MERGED ===\n",
        JSON.stringify(summarize(merged), null, 2),
      );
      expect(porImagen).toHaveLength(3);
    },
    300000,
  );
});
