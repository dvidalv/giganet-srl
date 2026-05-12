import { postDescargarArchivoHandler } from "@/app/api/comprobantes/internal/postDescargarArchivoHandler";

/**
 * POST /api/comprobantes/descargar
 *
 * Descarga el archivo PDF o XML de un comprobante electrónico desde TheFactoryHKA.
 * Body: { rnc: string, documento: string (e-NCF), extension: "pdf" | "xml" }
 *
 * Autorización: SOLO API Key (Authorization: Bearer <api_key> o X-API-Key).
 * Pensado para ser llamado desde FileMaker / backend.
 */
export const POST = postDescargarArchivoHandler;
