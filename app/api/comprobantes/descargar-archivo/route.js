import { postDescargarArchivoHandler } from "@/app/api/comprobantes/internal/postDescargarArchivoHandler";

/**
 * POST /api/comprobantes/descargar-archivo
 *
 * Alias documentado (evita que `POST …/descargar-archivo` caiga en `[id]` y devuelva 405).
 * Mismo contrato que POST /api/comprobantes/descargar.
 */
export const POST = postDescargarArchivoHandler;
