import FolioAuditoria from "@/app/models/folioAuditoria";

/**
 * @param {{ accion: string, empresa: unknown, contrato?: unknown, admin?: { id?: string, email?: string } | null, antes?: unknown, despues?: unknown, motivo?: string }} entrada
 */
export async function registrarAuditoria({
  accion,
  empresa,
  contrato = null,
  admin = null,
  antes = null,
  despues = null,
  motivo = "",
}) {
  await FolioAuditoria.create({
    accion,
    empresa,
    contrato,
    admin: admin?.id ?? null,
    adminEmail: admin?.email ?? "",
    antes,
    despues,
    motivo: String(motivo || "").slice(0, 500),
  });
}
