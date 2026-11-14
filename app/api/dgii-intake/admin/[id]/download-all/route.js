import { NextResponse } from "next/server";
import { auth } from "@/auth";
import DgiiIntake from "@/app/models/dgiiIntake";
import { buildIntakeDocumentsZip } from "@/lib/dgiiIntake/zipDocuments";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return {
      error: NextResponse.json({ error: "No autorizado" }, { status: 403 }),
    };
  }
  return { session };
}

/** GET — ZIP of all intake documents (admin only). */
export async function GET(_request, { params }) {
  const check = await requireAdmin();
  if (check.error) return check.error;

  const { id } = await params;
  const intake = await DgiiIntake.findById(id);
  if (!intake) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  try {
    const { buffer, filename } = await buildIntakeDocumentsZip(intake);
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buffer.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const status = err?.status || 500;
    console.error("DGII admin download-all:", err?.message || err);
    return NextResponse.json(
      {
        error:
          status === 404
            ? "No hay documentos para descargar"
            : "No se pudo generar el ZIP",
      },
      { status }
    );
  }
}
