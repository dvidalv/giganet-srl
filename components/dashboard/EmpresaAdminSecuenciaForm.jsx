"use client";

import { useMemo, useState } from "react";
import styles from "./EmpresaAdminForm.module.css";
import CampoNumero from "./CampoNumero";

const TIPOS_COMPROBANTE = [
  { value: "31", label: "31 — Factura de Crédito Fiscal Electrónica" },
  { value: "32", label: "32 — Factura de Consumo Electrónica" },
  { value: "33", label: "33 — Nota de Débito Electrónica" },
  { value: "34", label: "34 — Nota de Crédito Electrónica" },
  { value: "41", label: "41 — Compras Electrónicas" },
  { value: "43", label: "43 — Gastos Menores Electrónico" },
  { value: "44", label: "44 — Régimenes Especiales Electrónico" },
  { value: "45", label: "45 — Gubernamental Electrónico" },
];

const TIPOS_SIN_FECHA_VENCIMIENTO = ["32", "34"];

function getTodayISO() {
  return new Date().toISOString().slice(0, 10);
}

function getEndOfNextYearISO() {
  const y = new Date().getFullYear() + 1;
  return `${y}-12-31`;
}

function getDescripcionByTipo(tipo) {
  const item = TIPOS_COMPROBANTE.find((t) => t.value === tipo);
  if (!item) return "";
  return item.label.replace(/^\d+\s*[—-]\s*/, "").trim();
}

function emptyForm() {
  return {
    tipo_comprobante: "",
    prefijo: "E",
    numero_inicial: "",
    numero_final: "",
    proximo_numero: "",
    fecha_autorizacion: getTodayISO(),
    fecha_vencimiento: getEndOfNextYearISO(),
    alerta_minima_restante: "10",
    comentario: "",
  };
}

/** Empty → undefined so mongoose `required` can reject; otherwise parse as number. */
function parseOptionalInt(value) {
  if (value === "" || value == null) return undefined;
  const n = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

/** Drop mongoose Cast/NaN noise; keep Spanish required-field messages, one per line. */
function formatCreateSequenceError(data) {
  const chunks = [];
  if (data?.error && data.error !== "Datos del rango inválidos") {
    chunks.push(String(data.error));
  }
  if (data?.details) {
    chunks.push(String(data.details));
  }
  if (data?.theFactorySync?.message) {
    chunks.push(String(data.theFactorySync.message));
  }
  const raw = chunks.join(" ").replace(/\s+/g, " ").trim();
  if (!raw) return "Error al crear la secuencia";

  const parts = raw
    .split(
      /(?=(?:El |La |Los |Ya |Cast to |Path `|The Factory))/u,
    )
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => !/Cast to Number|value ["']?NaN["']?/i.test(s))
    .filter((s) => s !== "Datos del rango inválidos");

  const unique = [...new Set(parts)];
  if (unique.length === 0) {
    return "Datos del rango inválidos. Revise los campos requeridos.";
  }
  return unique.join("\n");
}

export default function EmpresaAdminSecuenciaForm({
  userId,
  empresa,
  onCancel,
  onCreated,
}) {
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);

  const rnc = String(empresa?.rnc ?? "").replace(/\D/g, "");
  const razonSocial = String(empresa?.razonSocial ?? "").trim();
  const requiereFechaVencimiento =
    form.tipo_comprobante &&
    !TIPOS_SIN_FECHA_VENCIMIENTO.includes(form.tipo_comprobante);

  const rncOk = rnc.length >= 9 && rnc.length <= 11;
  const razonOk = razonSocial.length >= 2;

  const handleChange = (field, value) => {
    setForm((f) => {
      const next = { ...f, [field]: value };
      if (field === "numero_inicial" && (f.proximo_numero === "" || f.proximo_numero === f.numero_inicial)) {
        next.proximo_numero = value;
      }
      return next;
    });
    if (message) setMessage(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);

    setSubmitting(true);
    try {
      const payload = {
        rnc,
        razon_social: razonSocial,
        tipo_comprobante: form.tipo_comprobante,
        descripcion_tipo: getDescripcionByTipo(form.tipo_comprobante),
        prefijo: (form.prefijo || "E").trim().toUpperCase().slice(0, 1) || "E",
        numero_inicial: parseOptionalInt(form.numero_inicial),
        numero_final: parseOptionalInt(form.numero_final),
        fecha_autorizacion: form.fecha_autorizacion || undefined,
        fecha_vencimiento: requiereFechaVencimiento
          ? form.fecha_vencimiento || undefined
          : "",
        alerta_minima_restante:
          form.alerta_minima_restante === ""
            ? undefined
            : Number(form.alerta_minima_restante),
        comentario: (form.comentario || "").trim(),
      };
      const proximo = parseOptionalInt(form.proximo_numero);
      if (proximo !== undefined) {
        payload.proximo_numero = proximo;
      }
      const res = await fetch(`/api/users/${userId}/comprobantes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({
          type: "error",
          text: formatCreateSequenceError(data),
        });
        return;
      }
      setForm(emptyForm());
      if (typeof onCreated === "function") onCreated(data);
    } catch {
      setMessage({ type: "error", text: "Error de conexión. Intente de nuevo." });
    } finally {
      setSubmitting(false);
    }
  };

  const hintEmpresa = useMemo(() => {
    if (!rncOk) return "Falta el RNC de la empresa para crear la secuencia.";
    if (!razonOk) return "Falta la razón social de la empresa.";
    return `Se creará para RNC ${rnc} · ${razonSocial}.`;
  }, [rnc, rncOk, razonOk, razonSocial]);

  return (
    <form className={styles.compCreate} onSubmit={handleSubmit} noValidate>
      <div className={styles.compCreateHead}>
        <h3 className={styles.compCreateTitle}>Agregar secuencia</h3>
        <p className={styles.compCreateHint}>{hintEmpresa}</p>
      </div>

      <div className={styles.compEditorGrid}>
        <label>
          Tipo de comprobante
          <select
            value={form.tipo_comprobante}
            onChange={(e) => handleChange("tipo_comprobante", e.target.value)}
            disabled={submitting}
          >
            <option value="">Seleccione…</option>
            {TIPOS_COMPROBANTE.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Prefijo
          <input
            type="text"
            maxLength={1}
            value={form.prefijo}
            onChange={(e) =>
              handleChange("prefijo", e.target.value.toUpperCase().slice(0, 1))
            }
            disabled={submitting}
          />
        </label>
        <label>
          Número inicial
          <CampoNumero
            value={form.numero_inicial}
            onChange={(v) => handleChange("numero_inicial", v)}
            disabled={submitting}
          />
        </label>
        <label>
          Número final
          <CampoNumero
            value={form.numero_final}
            onChange={(v) => handleChange("numero_final", v)}
            disabled={submitting}
          />
        </label>
        <label>
          Próximo a emitir
          <CampoNumero
            value={form.proximo_numero}
            onChange={(v) => handleChange("proximo_numero", v)}
            disabled={submitting}
            placeholder="Igual al inicial si está vacío"
          />
        </label>
        <label>
          Alerta mínima restante
          <CampoNumero
            value={form.alerta_minima_restante}
            onChange={(v) => handleChange("alerta_minima_restante", v)}
            disabled={submitting}
          />
        </label>
        <label>
          Fecha de autorización
          <input
            type="date"
            value={form.fecha_autorizacion}
            onChange={(e) => handleChange("fecha_autorizacion", e.target.value)}
            disabled={submitting}
          />
        </label>
        <label>
          Fecha de vencimiento{requiereFechaVencimiento ? " *" : ""}
          <input
            type="date"
            value={form.fecha_vencimiento}
            onChange={(e) => handleChange("fecha_vencimiento", e.target.value)}
            disabled={submitting}
          />
        </label>
        <label className={styles.compEditorFull}>
          Comentario
          <input
            type="text"
            maxLength={500}
            value={form.comentario}
            onChange={(e) => handleChange("comentario", e.target.value)}
            disabled={submitting}
          />
        </label>
      </div>

      <div className={styles.compEditorActions}>
        <button
          type="submit"
          className={styles.compBtnPrimary}
          disabled={submitting}
        >
          {submitting ? "Creando…" : "Crear secuencia"}
        </button>
        <button
          type="button"
          className={styles.compBtn}
          onClick={onCancel}
          disabled={submitting}
        >
          Cancelar
        </button>
      </div>

      {message && (
        <p
          className={
            message.type === "error"
              ? `${styles.compMsgError} ${styles.compMsgMultiline}`
              : `${styles.compMsgWarning} ${styles.compMsgMultiline}`
          }
          role="alert"
        >
          {message.text}
        </p>
      )}
    </form>
  );
}
