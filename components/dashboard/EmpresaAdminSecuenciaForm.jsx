"use client";

import { useMemo, useState } from "react";
import styles from "./EmpresaAdminForm.module.css";

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

export default function EmpresaAdminSecuenciaForm({
  userId,
  empresa,
  onCancel,
  onCreated,
}) {
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
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
    if (errors[field]) setErrors((e) => ({ ...e, [field]: null }));
    if (message) setMessage(null);
  };

  const validate = () => {
    const next = {};
    if (!rncOk) {
      next._form = "Configure el RNC de la empresa antes de crear una secuencia.";
    }
    if (!razonOk) {
      next._form =
        next._form ||
        "Configure la razón social de la empresa antes de crear una secuencia.";
    }
    if (!form.tipo_comprobante) {
      next.tipo_comprobante = "Seleccione el tipo de comprobante.";
    }
    const ni = Number(form.numero_inicial);
    const nf = Number(form.numero_final);
    if (form.numero_inicial === "" || !Number.isInteger(ni) || ni < 0) {
      next.numero_inicial = "Debe ser un entero mayor o igual a 0.";
    }
    if (form.numero_final === "" || !Number.isInteger(nf) || nf < 0) {
      next.numero_final = "Debe ser un entero mayor o igual a 0.";
    }
    if (!next.numero_inicial && !next.numero_final && nf <= ni) {
      next.numero_final = "El número final debe ser mayor que el inicial.";
    }
    if (form.proximo_numero !== "") {
      const proximo = Number(form.proximo_numero);
      if (!Number.isInteger(proximo)) {
        next.proximo_numero = "Debe ser un entero.";
      } else if (!next.numero_inicial && proximo < ni) {
        next.proximo_numero = "No puede ser menor que el inicial.";
      } else if (!next.numero_final && proximo > nf + 1) {
        next.proximo_numero = "No puede superar el final del rango.";
      }
    }
    if (!form.fecha_autorizacion) {
      next.fecha_autorizacion = "La fecha de autorización es requerida.";
    }
    if (requiereFechaVencimiento && !form.fecha_vencimiento) {
      next.fecha_vencimiento = "La fecha de vencimiento es requerida para este tipo.";
    }
    if (
      form.fecha_autorizacion &&
      form.fecha_vencimiento &&
      new Date(form.fecha_autorizacion) >= new Date(form.fecha_vencimiento)
    ) {
      next.fecha_vencimiento = "Debe ser posterior a la fecha de autorización.";
    }
    if (form.prefijo && !/^[A-Z]$/.test(form.prefijo)) {
      next.prefijo = "Una sola letra mayúscula (ej. E).";
    }
    const alerta = Number(form.alerta_minima_restante);
    if (
      form.alerta_minima_restante !== "" &&
      (!Number.isInteger(alerta) || alerta < 1)
    ) {
      next.alerta_minima_restante = "Debe ser un entero mayor a 0.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      const payload = {
        rnc,
        razon_social: razonSocial,
        tipo_comprobante: form.tipo_comprobante,
        descripcion_tipo: getDescripcionByTipo(form.tipo_comprobante),
        prefijo: (form.prefijo || "E").trim().toUpperCase().slice(0, 1) || "E",
        numero_inicial: Number(form.numero_inicial),
        numero_final: Number(form.numero_final),
        fecha_autorizacion: form.fecha_autorizacion,
        fecha_vencimiento: requiereFechaVencimiento ? form.fecha_vencimiento : "",
        alerta_minima_restante: form.alerta_minima_restante
          ? Number(form.alerta_minima_restante)
          : 10,
        comentario: (form.comentario || "").trim(),
      };
      if (form.proximo_numero !== "") {
        payload.proximo_numero = Number(form.proximo_numero);
      }
      const res = await fetch(`/api/users/${userId}/comprobantes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const extra =
          data.theFactorySync?.message != null
            ? ` ${data.theFactorySync.message}`
            : data.details
              ? ` ${data.details}`
              : "";
        setMessage({
          type: "error",
          text: (data.error || "Error al crear la secuencia") + extra,
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

  const disabled = submitting || !rncOk || !razonOk;
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

      {(errors._form || message) && (
        <p
          className={
            message?.type === "error" || errors._form
              ? styles.compMsgError
              : styles.compMsgSuccess
          }
          role="alert"
        >
          {message?.text || errors._form}
        </p>
      )}

      <div className={styles.compEditorGrid}>
        <label>
          Tipo de comprobante
          <select
            value={form.tipo_comprobante}
            onChange={(e) => handleChange("tipo_comprobante", e.target.value)}
            disabled={submitting}
            aria-invalid={!!errors.tipo_comprobante}
          >
            <option value="">Seleccione…</option>
            {TIPOS_COMPROBANTE.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          {errors.tipo_comprobante && (
            <span className={styles.compFieldError}>{errors.tipo_comprobante}</span>
          )}
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
          {errors.prefijo && (
            <span className={styles.compFieldError}>{errors.prefijo}</span>
          )}
        </label>
        <label>
          Número inicial
          <input
            type="number"
            min={0}
            step={1}
            value={form.numero_inicial}
            onChange={(e) => handleChange("numero_inicial", e.target.value)}
            disabled={submitting}
          />
          {errors.numero_inicial && (
            <span className={styles.compFieldError}>{errors.numero_inicial}</span>
          )}
        </label>
        <label>
          Número final
          <input
            type="number"
            min={0}
            step={1}
            value={form.numero_final}
            onChange={(e) => handleChange("numero_final", e.target.value)}
            disabled={submitting}
          />
          {errors.numero_final && (
            <span className={styles.compFieldError}>{errors.numero_final}</span>
          )}
        </label>
        <label>
          Próximo a emitir
          <input
            type="number"
            min={0}
            step={1}
            value={form.proximo_numero}
            onChange={(e) => handleChange("proximo_numero", e.target.value)}
            disabled={submitting}
            placeholder="Igual al inicial si está vacío"
          />
          {errors.proximo_numero && (
            <span className={styles.compFieldError}>{errors.proximo_numero}</span>
          )}
        </label>
        <label>
          Alerta mínima restante
          <input
            type="number"
            min={1}
            step={1}
            value={form.alerta_minima_restante}
            onChange={(e) => handleChange("alerta_minima_restante", e.target.value)}
            disabled={submitting}
          />
          {errors.alerta_minima_restante && (
            <span className={styles.compFieldError}>{errors.alerta_minima_restante}</span>
          )}
        </label>
        <label>
          Fecha de autorización
          <input
            type="date"
            value={form.fecha_autorizacion}
            onChange={(e) => handleChange("fecha_autorizacion", e.target.value)}
            disabled={submitting}
          />
          {errors.fecha_autorizacion && (
            <span className={styles.compFieldError}>{errors.fecha_autorizacion}</span>
          )}
        </label>
        <label>
          Fecha de vencimiento{requiereFechaVencimiento ? " *" : ""}
          <input
            type="date"
            value={form.fecha_vencimiento}
            onChange={(e) => handleChange("fecha_vencimiento", e.target.value)}
            disabled={submitting}
          />
          {errors.fecha_vencimiento && (
            <span className={styles.compFieldError}>{errors.fecha_vencimiento}</span>
          )}
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
          disabled={disabled}
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
    </form>
  );
}
