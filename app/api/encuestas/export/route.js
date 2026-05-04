import { NextResponse } from "next/server";
import { auth } from "@/auth";
import Encuesta from "@/app/models/encuesta";

function csvCell(value) {
  const s = String(value ?? "");
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** GET /api/encuestas/export — CSV (solo admin) */
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const rows = await Encuesta.find({})
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    const header = [
      "id",
      "userId",
      "status",
      "rnc",
      "razonSocial",
      "empresaNombre",
      "empresaEmail",
      "sentAt",
      "respondedAt",
      "expiresAt",
      "nombreRespondiente",
      "emailRespondiente",
      "referenciaServicio",
      "nps",
      "satisfaccionGeneral",
      "facilidadIntegracion",
      "calidadSoporte",
      "tiempoRespuesta",
      "loQueMasGusta",
      "loQueMejorar",
      "comentarios",
    ];

    const lines = [header.join(",")];

    for (const e of rows) {
      const emp = e.empresa || {};
      const a = e.answers || {};
      lines.push(
        [
          csvCell(e._id.toString()),
          csvCell(e.userId?.toString?.()),
          csvCell(e.status),
          csvCell(emp.rnc),
          csvCell(emp.razonSocial),
          csvCell(emp.nombre),
          csvCell(emp.email),
          csvCell(e.sentAt?.toISOString?.() ?? ""),
          csvCell(e.respondedAt?.toISOString?.() ?? ""),
          csvCell(e.expiresAt?.toISOString?.() ?? ""),
          csvCell(a.nombreRespondiente ?? ""),
          csvCell(a.emailRespondiente ?? ""),
          csvCell(a.referenciaServicio ?? ""),
          csvCell(a.nps ?? ""),
          csvCell(a.satisfaccionGeneral ?? ""),
          csvCell(a.facilidadIntegracion ?? ""),
          csvCell(a.calidadSoporte ?? ""),
          csvCell(a.tiempoRespuesta ?? ""),
          csvCell(a.loQueMasGusta ?? ""),
          csvCell(a.loQueMejorar ?? ""),
          csvCell(a.comentarios ?? ""),
        ].join(",")
      );
    }

    const csv = lines.join("\r\n");
    const filename = `encuestas-${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("GET /api/encuestas/export:", err);
    return NextResponse.json(
      { error: "Error al exportar" },
      { status: 500 }
    );
  }
}
