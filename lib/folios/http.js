import { NextResponse } from "next/server";
import { FoliosError } from "./foliosService";

export async function leerJson(request) {
  try {
    return await request.json();
  } catch {
    throw new FoliosError("Cuerpo inválido", 400);
  }
}

export function respuestaErrorFolios(err, contexto) {
  if (err instanceof FoliosError) {
    return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
  }
  if (err?.name === "ValidationError") {
    const details = Object.values(err.errors || {}).map((e) => e.message);
    return NextResponse.json({ error: "Error de validación", details }, { status: 400 });
  }
  if (err?.name === "CastError") {
    return NextResponse.json({ error: "Identificador inválido" }, { status: 400 });
  }
  console.error(`${contexto}:`, err);
  return NextResponse.json({ error: "Error interno en control de folios" }, { status: 500 });
}
