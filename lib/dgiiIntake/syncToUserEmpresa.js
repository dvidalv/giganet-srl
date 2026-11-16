import User from "@/app/models/user";
import { normalizeRnc } from "@/lib/dgiiIntake/normalizeRnc";

/**
 * Field mapping: DgiiIntake → User.empresa
 * - empresa.rnc            → empresa.rnc (only if empresa.rnc is empty)
 * - empresa.nombre         → empresa.nombre
 * - empresa.razonSocial    → empresa.razonSocial
 * - empresa.telefono       → empresa.telefono
 * - empresa.direccion      → empresa.direccion
 * - empresa.ciudad         → empresa.ciudad
 * - representante.email    → empresa.email
 * - files.logo.url         → empresa.logo
 */

function trimStr(value, max) {
  const s = String(value || "").trim();
  return max ? s.slice(0, max) : s;
}

function fileUrl(meta) {
  if (!meta) return "";
  const plain = typeof meta.toObject === "function" ? meta.toObject() : meta;
  return String(plain.url || "").trim();
}

/**
 * Build a patch of User.empresa fields from an intake document.
 * Only includes non-empty intake values. Caller decides overwrite policy.
 */
export function buildEmpresaPatchFromIntake(intake) {
  const plain = typeof intake.toObject === "function" ? intake.toObject() : intake;
  const emp = plain.empresa || {};
  const rep = plain.representante || {};
  const patch = {};

  const rnc = normalizeRnc(emp.rnc);
  if (/^(\d{9}|\d{11})$/.test(rnc)) patch.rnc = rnc;

  const nombre = trimStr(emp.nombre, 100);
  if (nombre) patch.nombre = nombre;

  const razonSocial = trimStr(emp.razonSocial, 100);
  if (razonSocial) patch.razonSocial = razonSocial;

  const telefono = trimStr(emp.telefono, 20);
  if (telefono) patch.telefono = telefono;

  const direccion = trimStr(emp.direccion);
  if (direccion) patch.direccion = direccion;

  const ciudad = trimStr(emp.ciudad, 120);
  if (ciudad) patch.ciudad = ciudad;

  const email = trimStr(rep.email, 254).toLowerCase();
  if (email) patch.email = email;

  const logo =
    fileUrl(plain.files?.logo) ||
    fileUrl(plain.files?.logo?.url ? plain.files.logo : null);
  if (logo) patch.logo = logo;

  return patch;
}

/**
 * Apply intake → User.empresa.
 * Never writes empty intake values over existing empresa data.
 * Overwrites a filled empresa field only when intake has a non-empty different value,
 * except `rnc`, which is only set when the empresa has none.
 *
 * @param {object} intake
 * @returns {Promise<{ synced: boolean, userId?: string, changes?: Record<string, { from: string, to: string }> }>}
 */
export async function syncIntakeToUserEmpresa(intake) {
  const plain = typeof intake.toObject === "function" ? intake.toObject() : intake;
  const userId = plain.userId;
  if (!userId) return { synced: false, reason: "no_userId" };

  const patch = buildEmpresaPatchFromIntake(plain);
  if (!Object.keys(patch).length) return { synced: false, reason: "empty_patch", userId: String(userId) };

  const user = await User.findById(userId);
  if (!user) return { synced: false, reason: "user_not_found", userId: String(userId) };

  if (!user.empresa) user.empresa = {};

  const changes = {};
  for (const [key, next] of Object.entries(patch)) {
    const prev = String(user.empresa[key] ?? "").trim();
    const nextNorm = key === "rnc" ? normalizeRnc(next) : String(next).trim();
    const prevNorm = key === "rnc" ? normalizeRnc(prev) : prev;
    if (!nextNorm) continue;
    if (prevNorm === nextNorm) continue;
    // RNC is client-typed in the intake; never let it replace the registered RNC
    // (admin delete confirmation and identity checks rely on User.empresa.rnc).
    if (key === "rnc" && prevNorm) continue;
    // Policy: update when empty OR when intake has non-empty different value
    changes[key] = { from: prev, to: nextNorm };
    user.empresa[key] = nextNorm;
  }

  if (!Object.keys(changes).length) {
    return { synced: false, reason: "no_changes", userId: String(userId) };
  }

  user.markModified("empresa");
  await user.save();
  return { synced: true, userId: String(userId), changes };
}
