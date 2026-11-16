/** Logo must be strictly under 5 MB. */
export const LOGO_MAX_BYTES = 5 * 1024 * 1024;

/** Max size for every other intake document. */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/** Document slots for admin/agent intake read views (client-safe). */
export const DGII_FILE_SLOTS = [
  { key: "cedulaFrente", label: "Cédula — anverso" },
  { key: "cedulaReverso", label: "Cédula — reverso" },
  { key: "factura1", label: "Factura 1" },
  { key: "factura2", label: "Factura 2" },
  { key: "factura3", label: "Factura 3" },
  { key: "factura4", label: "Factura 4" },
  { key: "factura5", label: "Factura 5" },
  {
    key: "registroMercantil",
    label: "Registro Mercantil",
    /** Shown/required only when tipoPersona === "juridica" */
    whenJuridica: true,
  },
  { key: "logo", label: "Logo", imageOnly: true, maxBytes: LOGO_MAX_BYTES },
  { key: "certificadoP12", label: "Certificado P-12" },
];

/**
 * Slots visible for a given tipo de persona.
 * Registro Mercantil is hidden for persona física.
 * @param {string} [tipoPersona]
 */
export function visibleDgiiFileSlots(tipoPersona) {
  const juridica = String(tipoPersona || "") === "juridica";
  return DGII_FILE_SLOTS.filter((slot) => {
    if (slot.whenJuridica) return juridica;
    return true;
  });
}
