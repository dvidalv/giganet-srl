import { NextResponse } from "next/server";
import { auth } from "@/auth";
import User from "@/app/models/user";
import { sendEmail } from "@/api-mail_brevo";
import {
  PLANES_FOLIOS,
  formatPrecioRD,
  formatTransacciones,
  getPlanBySlug,
} from "@/lib/folios/planesCatalogo";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function destinatarioDavid() {
  return (
    process.env.FOLIOS_ALERTAS_TO_EMAIL ||
    process.env.CONTACT_FORM_TO_EMAIL ||
    process.env.BREVO_FROM_EMAIL ||
    process.env.EMAIL_FROM ||
    "dvidalv@giganet-srl.com"
  );
}

/**
 * POST /api/users/me/folios/solicitar-planes
 * El cliente solicita uno o más planes del tarifario público; se notifica a David por email.
 */
export async function POST(request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (session.user.role === "admin") {
    return NextResponse.json(
      { error: "Esta solicitud es solo para clientes" },
      { status: 403 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const slugsRaw = Array.isArray(body?.planSlugs) ? body.planSlugs : [];
  const slugs = [
    ...new Set(
      slugsRaw
        .map((s) => String(s ?? "").trim())
        .filter(Boolean)
    ),
  ];
  const nota = String(body?.nota ?? "").trim().slice(0, 1000);

  if (slugs.length === 0) {
    return NextResponse.json(
      { error: "Seleccione al menos un plan" },
      { status: 400 }
    );
  }

  const planes = [];
  for (const slug of slugs) {
    const plan = getPlanBySlug(slug);
    if (!plan) {
      return NextResponse.json(
        { error: `Plan no válido: ${slug}` },
        { status: 400 }
      );
    }
    planes.push(plan);
  }

  const user = await User.findById(session.user.id)
    .select("name email empresa.nombre empresa.razonSocial empresa.rnc")
    .lean();
  if (!user) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  const empresaNombre =
    user.empresa?.razonSocial ||
    user.empresa?.nombre ||
    user.name ||
    "Empresa";
  const rnc = user.empresa?.rnc || "—";
  const to = destinatarioDavid();
  if (!to) {
    return NextResponse.json(
      { error: "No hay correo de destino configurado" },
      { status: 500 }
    );
  }

  const listaTexto = planes
    .map((p) => {
      const mensual =
        p.precioMensual == null
          ? "solo anual"
          : `${formatPrecioRD(p.precioMensual)} / mes`;
      return `- ${p.nombre}: ${formatTransacciones(p.transacciones)} transacciones · ${formatPrecioRD(p.precioAnual)} / año (${mensual})`;
    })
    .join("\n");

  const filasHtml = planes
    .map((p) => {
      const mensual =
        p.precioMensual == null
          ? "Solo anual"
          : formatPrecioRD(p.precioMensual);
      return `
        <tr>
          <td style="padding:8px 12px;border:1px solid #e2e8f0;">${escapeHtml(p.nombre)}</td>
          <td style="padding:8px 12px;border:1px solid #e2e8f0;text-align:right;">${escapeHtml(formatTransacciones(p.transacciones))}</td>
          <td style="padding:8px 12px;border:1px solid #e2e8f0;text-align:right;">${escapeHtml(formatPrecioRD(p.precioAnual))}</td>
          <td style="padding:8px 12px;border:1px solid #e2e8f0;text-align:right;">${escapeHtml(mensual)}</td>
        </tr>`;
    })
    .join("");

  const subject = `Solicitud de planes de folios — ${empresaNombre}`;
  const htmlContent = `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#0f172a;">
      <div style="background:#0f766e;padding:24px;color:#fff;border-radius:8px 8px 0 0;">
        <p style="margin:0;font-size:13px;opacity:0.85;">Giganet · Dashboard cliente</p>
        <h1 style="margin:6px 0 0;font-size:20px;">Solicitud de planes de folios</h1>
      </div>
      <div style="padding:24px;background:#f8fafc;border:1px solid #e2e8f0;border-top:0;border-radius:0 0 8px 8px;">
        <p style="margin:0 0 16px;">
          <strong>${escapeHtml(empresaNombre)}</strong> solicitó renovar o comprar planes del tarifario público.
        </p>
        <table style="width:100%;border-collapse:collapse;background:#fff;margin:0 0 16px;">
          <tr>
            <td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;">Empresa</td>
            <td style="padding:8px 12px;border:1px solid #e2e8f0;">${escapeHtml(empresaNombre)}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;">RNC</td>
            <td style="padding:8px 12px;border:1px solid #e2e8f0;">${escapeHtml(rnc)}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;">Contacto</td>
            <td style="padding:8px 12px;border:1px solid #e2e8f0;">${escapeHtml(user.name || "")} &lt;${escapeHtml(user.email || "")}&gt;</td>
          </tr>
        </table>
        <h2 style="margin:0 0 8px;font-size:16px;">Planes seleccionados</h2>
        <table style="width:100%;border-collapse:collapse;background:#fff;margin:0 0 16px;">
          <thead>
            <tr style="background:#f1f5f9;">
              <th style="padding:8px 12px;border:1px solid #e2e8f0;text-align:left;">Plan</th>
              <th style="padding:8px 12px;border:1px solid #e2e8f0;text-align:right;">Transacciones</th>
              <th style="padding:8px 12px;border:1px solid #e2e8f0;text-align:right;">Anual</th>
              <th style="padding:8px 12px;border:1px solid #e2e8f0;text-align:right;">Mensual</th>
            </tr>
          </thead>
          <tbody>${filasHtml}</tbody>
        </table>
        ${
          nota
            ? `<p style="margin:0;"><strong>Nota del cliente:</strong><br/>${escapeHtml(nota).replace(/\n/g, "<br/>")}</p>`
            : ""
        }
        <p style="margin:20px 0 0;font-size:12px;color:#64748b;">
          Catálogo: ${PLANES_FOLIOS.length} planes públicos. Este mensaje se generó desde Mis folios en el dashboard.
        </p>
      </div>
    </div>
  `;

  const textContent = `Solicitud de planes de folios

Empresa: ${empresaNombre}
RNC: ${rnc}
Contacto: ${user.name || ""} <${user.email || ""}>

Planes seleccionados:
${listaTexto}
${nota ? `\nNota del cliente:\n${nota}\n` : ""}
`;

  try {
    await sendEmail({
      to,
      subject,
      htmlContent,
      textContent,
    });
  } catch (err) {
    console.error("POST /api/users/me/folios/solicitar-planes:", err);
    return NextResponse.json(
      { error: "No se pudo enviar la solicitud. Intente de nuevo más tarde." },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: "Solicitud enviada. Giganet se pondrá en contacto con usted.",
    planes: planes.map((p) => p.slug),
  });
}
