"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import styles from "./SecuenciaForm.module.css";

const TIPOS_COMPROBANTE = [
  { value: "31", label: "31 - Factura de Crédito Fiscal Electrónica" },
  { value: "32", label: "32 - Factura de Consumo Electrónica" },
  { value: "33", label: "33 - Nota de Débito Electrónica" },
  { value: "34", label: "34 - Nota de Crédito Electrónica" },
  { value: "41", label: "41 - Compras Electrónicas" },
  { value: "43", label: "43 - Gastos Menores Electrónico" },
  { value: "44", label: "44 - Régimenes Especiales Electrónico" },
  { value: "45", label: "45 - Gubernamental Electrónico" },
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
  // Solo la descripción, sin el número (ej. "Factura de Crédito Fiscal Electrónica")
  return item.label.replace(/^\d+\s*-\s*/, "").trim();
}

function getInitialForm(tipoPreseleccionado) {
  const initial = {
    razon_social: "",
    tipo_comprobante: "",
    descripcion_tipo: "",
    prefijo: "E",
    numero_inicial: "",
    numero_final: "",
    fecha_autorizacion: getTodayISO(),
    fecha_vencimiento: getEndOfNextYearISO(),
    alerta_minima_restante: "10",
    comentario: "",
  };
  if (tipoPreseleccionado && String(tipoPreseleccionado).trim()) {
    const tipo = String(tipoPreseleccionado).trim();
    initial.tipo_comprobante = tipo;
    initial.descripcion_tipo = getDescripcionByTipo(tipo);
  }
  return initial;
}

export default function SecuenciaForm({ onSuccess, tipoPreseleccionado }) {
  const [empresa, setEmpresa] = useState({ rnc: "", razonSocial: "" });
  const [form, setForm] = useState(() =>
    getInitialForm(tipoPreseleccionado)
  );
  const [loadingEmpresa, setLoadingEmpresa] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const [errors, setErrors] = useState({});
  const refNumeroInicial = useRef("");
  const refNumeroFinal = useRef("");

  const fetchEmpresa = useCallback(async () => {
    setLoadingEmpresa(true);
    setErrors((e) => ({ ...e, _empresa: null }));
    try {
      const res = await fetch("/api/users/me/empresa");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrors((e) => ({ ...e, _empresa: data.error || "Error al cargar datos de la compañía" }));
        return;
      }
      const emp = data.empresa || {};
      setEmpresa({
        rnc: emp.rnc || "",
        razonSocial: emp.razonSocial || "",
      });
      setForm((f) => ({
        ...f,
        razon_social: emp.razonSocial || f.razon_social,
      }));
    } catch (err) {
      setErrors((e) => ({ ...e, _empresa: "Error de conexión al cargar la compañía" }));
    } finally {
      setLoadingEmpresa(false);
    }
  }, []);

  useEffect(() => {
    fetchEmpresa();
  }, [fetchEmpresa]);

  const requiereFechaVencimiento =
    form.tipo_comprobante && !TIPOS_SIN_FECHA_VENCIMIENTO.includes(form.tipo_comprobante);

  const handleChange = (field, value) => {
    if (field === "numero_inicial") refNumeroInicial.current = value;
    if (field === "numero_final") refNumeroFinal.current = value;
    setForm((f) => {
      const next = { ...f, [field]: value };
      if (field === "tipo_comprobante") {
        next.descripcion_tipo = getDescripcionByTipo(value);
      }
      return next;
    });
    if (errors[field]) setErrors((e) => ({ ...e, [field]: null }));
    if (message) setMessage(null);
  };

  const validate = () => {
    const newErrors = {};
    const rnc = (empresa.rnc || "").replace(/\D/g, "");
    if (!rnc || rnc.length < 9 || rnc.length > 11) {
      newErrors._form = "Configure el RNC de su compañía en Mi Empresa antes de solicitar una secuencia.";
    }
    if (!form.tipo_comprobante) {
      newErrors.tipo_comprobante = "Seleccione el tipo de comprobante.";
    }
    const razon = (form.razon_social || empresa.razonSocial || "").trim();
    if (!razon || razon.length < 2) {
      newErrors.razon_social = "Configure la razón social en Mi Empresa antes de solicitar una secuencia.";
    }
    const ni = form.numero_inicial;
    const nf = form.numero_final;
    if (ni === "" || ni === undefined) {
      newErrors.numero_inicial = "El número inicial es requerido.";
    } else {
      const numInicial = Number(ni);
      if (!Number.isInteger(numInicial) || numInicial < 0) {
        newErrors.numero_inicial = "Debe ser un número entero mayor o igual a 0.";
      }
    }
    if (nf === "" || nf === undefined) {
      newErrors.numero_final = "El número final es requerido.";
    } else {
      const numFinal = Number(nf);
      if (!Number.isInteger(numFinal) || numFinal < 0) {
        newErrors.numero_final = "Debe ser un número entero mayor o igual a 0.";
      }
    }
    if (
      !newErrors.numero_inicial &&
      !newErrors.numero_final &&
      form.numero_inicial !== "" &&
      form.numero_final !== ""
    ) {
      const numInicial = Number(form.numero_inicial);
      const numFinal = Number(form.numero_final);
      if (numFinal <= numInicial) {
        newErrors.numero_final = "El número final debe ser mayor que el número inicial.";
      }
    }
    if (!form.fecha_autorizacion) {
      newErrors.fecha_autorizacion = "La fecha de autorización es requerida.";
    } else {
      const fa = new Date(form.fecha_autorizacion);
      if (isNaN(fa.getTime())) {
        newErrors.fecha_autorizacion = "Fecha de autorización inválida.";
      }
    }
    if (requiereFechaVencimiento) {
      if (!form.fecha_vencimiento) {
        newErrors.fecha_vencimiento = "La fecha de vencimiento es requerida para este tipo.";
      } else {
        const fv = new Date(form.fecha_vencimiento);
        if (isNaN(fv.getTime())) {
          newErrors.fecha_vencimiento = "Fecha de vencimiento inválida.";
        } else if (form.fecha_autorizacion && new Date(form.fecha_autorizacion) >= fv) {
          newErrors.fecha_vencimiento = "Debe ser posterior a la fecha de autorización.";
        }
      }
    }
    const alerta = form.alerta_minima_restante;
    if (alerta !== "" && (Number(alerta) < 1 || !Number.isInteger(Number(alerta)))) {
      newErrors.alerta_minima_restante = "Debe ser un entero mayor a 0.";
    }
    if (form.prefijo && !/^[A-Z]$/.test(form.prefijo)) {
      newErrors.prefijo = "El prefijo debe ser una sola letra mayúscula (ej. E).";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);
    setErrors({});
    if (!validate()) return;

    // Usar refs (actualizados en cada onChange) para evitar estado desactualizado al enviar muy rápido
    const rawInicial = refNumeroInicial.current !== undefined && refNumeroInicial.current !== "" ? String(refNumeroInicial.current) : (typeof document !== "undefined" ? document.getElementById("numero_inicial")?.value : undefined) ?? form.numero_inicial;
    const rawFinal = refNumeroFinal.current !== undefined && refNumeroFinal.current !== "" ? String(refNumeroFinal.current) : (typeof document !== "undefined" ? document.getElementById("numero_final")?.value : undefined) ?? form.numero_final;
    const numeroInicial = rawInicial !== "" && rawInicial !== undefined ? Number(rawInicial) : Number(form.numero_inicial);
    const numeroFinal = rawFinal !== "" && rawFinal !== undefined ? Number(rawFinal) : Number(form.numero_final);

    setSubmitting(true);
    try {
      const rnc = (empresa.rnc || "").replace(/\D/g, "").trim();
      const payload = {
        rnc,
        razon_social: (form.razon_social || empresa.razonSocial || "").trim(),
        tipo_comprobante: (form.tipo_comprobante || "").trim(),
        descripcion_tipo: (form.descripcion_tipo || "").trim(),
        prefijo: (form.prefijo || "E").trim().toUpperCase().slice(0, 1) || "E",
        numero_inicial: numeroInicial,
        numero_final: numeroFinal,
        fecha_autorizacion: form.fecha_autorizacion,
        fecha_vencimiento: requiereFechaVencimiento ? form.fecha_vencimiento : "",
        alerta_minima_restante: form.alerta_minima_restante ? Number(form.alerta_minima_restante) : 10,
        comentario: (form.comentario || "").trim(),
      };
      const res = await fetch("/api/comprobantes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Error al crear la secuencia" });
        if (data.details) setErrors((prev) => ({ ...prev, _form: data.details }));
        return;
      }
      setMessage({ type: "success", text: data.message || "Secuencia creada correctamente" });
      const nextForm = { ...getInitialForm(), razon_social: empresa.razonSocial || "" };
      setForm(nextForm);
      refNumeroInicial.current = nextForm.numero_inicial;
      refNumeroFinal.current = nextForm.numero_final;
      if (typeof onSuccess === "function") onSuccess(data.data);
    } catch (err) {
      setMessage({ type: "error", text: "Error de conexión. Intente de nuevo." });
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingEmpresa) {
    return (
      <div className={styles.wrapper}>
        <p className={styles.loading}>Cargando datos de la compañía...</p>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {errors._empresa && (
        <div className={styles.alertError} role="alert">
          {errors._empresa}
        </div>
      )}
      {errors._form && (
        <div className={styles.alertError} role="alert">
          {errors._form}
        </div>
      )}
      {message && (
        <div
          className={message.type === "success" ? styles.alertSuccess : styles.alertError}
          role="alert"
        >
          {message.text}
        </div>
      )}

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Datos de la compañía</h2>
        <div className={styles.row}>
          <label className={styles.label} htmlFor="rnc">
            RNC
          </label>
          <input
            id="rnc"
            type="text"
            className={styles.input}
            value={empresa.rnc}
            readOnly
            disabled
            maxLength={11}
            aria-describedby={errors._form ? "rnc-help" : undefined}
          />
          <span className={styles.hint}>Obtenido de Mi Empresa (solo lectura)</span>
        </div>
        <div className={styles.row}>
          <label className={styles.label} htmlFor="razon_social">
            Razón social <span className={styles.required}>*</span>
          </label>
          <input
            id="razon_social"
            type="text"
            className={styles.input}
            value={form.razon_social}
            readOnly
            disabled
            placeholder="Obtenido de Mi Empresa"
            maxLength={200}
            aria-describedby="razon_social-hint"
          />
          <span id="razon_social-hint" className={styles.hint}>
            Obtenido de Mi Empresa (solo lectura)
          </span>
          {errors.razon_social && (
            <span id="razon_social-error" className={styles.fieldError}>
              {errors.razon_social}
            </span>
          )}
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Rango de numeración</h2>
        <div className={styles.row}>
          <label className={styles.label} htmlFor="tipo_comprobante">
            Tipo de comprobante <span className={styles.required}>*</span>
          </label>
          <select
            id="tipo_comprobante"
            className={styles.select}
            value={form.tipo_comprobante}
            onChange={(e) => handleChange("tipo_comprobante", e.target.value)}
            aria-invalid={!!errors.tipo_comprobante}
            aria-describedby={errors.tipo_comprobante ? "tipo_comprobante-error" : undefined}
          >
            <option value="">Seleccione...</option>
            {TIPOS_COMPROBANTE.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          {errors.tipo_comprobante && (
            <span id="tipo_comprobante-error" className={styles.fieldError}>
              {errors.tipo_comprobante}
            </span>
          )}
        </div>
        <div className={styles.row}>
          <label className={styles.label} htmlFor="descripcion_tipo">
            Descripción del tipo
          </label>
          <input
            id="descripcion_tipo"
            type="text"
            className={styles.input}
            value={form.descripcion_tipo}
            readOnly
            disabled
            placeholder="Se deriva del tipo seleccionado"
            maxLength={100}
            aria-describedby="descripcion_tipo-hint"
          />
          <span id="descripcion_tipo-hint" className={styles.hint}>
            Se completa automáticamente según el tipo de comprobante
          </span>
        </div>
        <div className={styles.rowHalf}>
          <div className={styles.row}>
            <label className={styles.label} htmlFor="prefijo">
              Prefijo
            </label>
            <input
              id="prefijo"
              type="text"
              className={styles.input}
              value={form.prefijo}
              onChange={(e) => handleChange("prefijo", e.target.value.toUpperCase().slice(0, 1))}
              placeholder="E"
              maxLength={1}
              aria-invalid={!!errors.prefijo}
            />
            {errors.prefijo && <span className={styles.fieldError}>{errors.prefijo}</span>}
          </div>
          <div className={styles.row}>
            <label className={styles.label} htmlFor="alerta_minima_restante">
              Alerta mínima restante
            </label>
            <input
              id="alerta_minima_restante"
              type="number"
              min={1}
              step={1}
              className={styles.input}
              value={form.alerta_minima_restante}
              onChange={(e) => handleChange("alerta_minima_restante", e.target.value)}
              aria-invalid={!!errors.alerta_minima_restante}
            />
            {errors.alerta_minima_restante && (
              <span className={styles.fieldError}>{errors.alerta_minima_restante}</span>
            )}
          </div>
        </div>
        <div className={styles.rowHalf}>
          <div className={styles.row}>
            <label className={styles.label} htmlFor="numero_inicial">
              Número inicial <span className={styles.required}>*</span>
            </label>
            <input
              id="numero_inicial"
              type="number"
              min={0}
              step={1}
              className={styles.input}
              value={form.numero_inicial}
              onChange={(e) => handleChange("numero_inicial", e.target.value)}
              aria-invalid={!!errors.numero_inicial}
            />
            {errors.numero_inicial && (
              <span className={styles.fieldError}>{errors.numero_inicial}</span>
            )}
          </div>
          <div className={styles.row}>
            <label className={styles.label} htmlFor="numero_final">
              Número final <span className={styles.required}>*</span>
            </label>
            <input
              id="numero_final"
              type="number"
              min={0}
              step={1}
              className={styles.input}
              value={form.numero_final}
              onChange={(e) => handleChange("numero_final", e.target.value)}
              aria-invalid={!!errors.numero_final}
            />
            {errors.numero_final && (
              <span className={styles.fieldError}>{errors.numero_final}</span>
            )}
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Fechas</h2>
        <div className={styles.rowHalf}>
          <div className={styles.row}>
            <label className={styles.label} htmlFor="fecha_autorizacion">
              Fecha de autorización <span className={styles.required}>*</span>
            </label>
            <input
              id="fecha_autorizacion"
              type="date"
              className={styles.input}
              value={form.fecha_autorizacion}
              onChange={(e) => handleChange("fecha_autorizacion", e.target.value)}
              aria-invalid={!!errors.fecha_autorizacion}
              title="Seleccione la fecha (por defecto: hoy)"
            />
            <span className={styles.hint}>Por defecto: hoy. Editable con el calendario.</span>
            {errors.fecha_autorizacion && (
              <span className={styles.fieldError}>{errors.fecha_autorizacion}</span>
            )}
          </div>
          <div className={styles.row}>
            <label className={styles.label} htmlFor="fecha_vencimiento">
              Fecha de vencimiento
              {requiereFechaVencimiento && <span className={styles.required}> *</span>}
            </label>
            <input
              id="fecha_vencimiento"
              type="date"
              className={styles.input}
              value={form.fecha_vencimiento}
              onChange={(e) => handleChange("fecha_vencimiento", e.target.value)}
              aria-invalid={!!errors.fecha_vencimiento}
              title="DGII suele asignar fin del año siguiente. Siempre editable."
            />
            {requiereFechaVencimiento ? (
              <span className={styles.hint}>Por defecto: 31/12 del año siguiente (DGII). Editable con el calendario.</span>
            ) : (
              <span className={styles.hint}>Opcional para tipos 32 y 34. Editable con el calendario.</span>
            )}
            {errors.fecha_vencimiento && (
              <span className={styles.fieldError}>{errors.fecha_vencimiento}</span>
            )}
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.row}>
          <label className={styles.label} htmlFor="comentario">
            Comentario
          </label>
          <textarea
            id="comentario"
            className={styles.textarea}
            value={form.comentario}
            onChange={(e) => handleChange("comentario", e.target.value)}
            placeholder="Opcional"
            rows={3}
            maxLength={500}
          />
        </div>
      </div>

      <div className={styles.actions}>
        <button
          type="submit"
          className={styles.submit}
          disabled={submitting || !empresa.rnc}
          aria-busy={submitting}
        >
          {submitting ? "Enviando..." : "Solicitar secuencia"}
        </button>
      </div>
    </form>
  );
}
