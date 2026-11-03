import { config } from "dotenv";
config({ path: ".env.local" });
import { readFileSync } from "fs";
import { describe, it, expect } from "vitest";
import {
  extraerSeriesEDesdeImagenes,
  isDgiiVisionConfigured,
} from "@/lib/comprobantes/dgiiImport";

const IMG =
  "/Users/dvidalv/.cursor/projects/Users-dvidalv-giganet-SRL/assets/WhatsApp_Image_2026-11-03_at_10.47.33__2_-a10e382f-b301-44ff-b89c-435e293ad8df.jpg";

describe("dgii vision multi-sequence", () => {
  it(
    "extracts E43 and E45 from one multi-row DGII photo",
    async () => {
      expect(isDgiiVisionConfigured()).toBe(true);
      const filas = await extraerSeriesEDesdeImagenes([
        { mediaType: "image/jpeg", data: readFileSync(IMG) },
      ]);
      console.log(
        "SINGLE_IMAGE_ROWS",
        JSON.stringify(
          filas.map((f) => ({
            tipo: f.tipo_comprobante,
            ini: f.numero_inicial,
            fin: f.numero_final,
            qty: f.cantidad,
            aut: f.no_autorizacion,
            sol: f.no_solicitud,
          })),
          null,
          2,
        ),
      );
      expect(filas.length).toBeGreaterThanOrEqual(2);
      const byTipo = Object.fromEntries(
        filas.map((f) => [f.tipo_comprobante, f]),
      );
      expect(byTipo["43"]?.numero_inicial).toBe(1);
      expect(byTipo["43"]?.numero_final).toBe(100);
      expect(byTipo["45"]?.numero_inicial).toBe(1);
      expect(byTipo["45"]?.numero_final).toBe(450);
    },
    120000,
  );
});
