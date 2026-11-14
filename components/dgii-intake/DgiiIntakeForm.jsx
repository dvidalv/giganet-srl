"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./DgiiIntakeForm.module.css";
import { FIELD_LABELS } from "@/lib/dgiiIntake/status";

const FILE_SLOTS = [
  { key: "cedula", label: "Cédula", accept: "image/*,.pdf,application/pdf" },
  { key: "factura1", label: "Factura 1", accept: "image/*,.pdf,application/pdf" },
  { key: "factura2", label: "Factura 2", accept: "image/*,.pdf,application/pdf" },
  { key: "factura3", label: "Factura 3", accept: "image/*,.pdf,application/pdf" },
  { key: "factura4", label: "Factura 4", accept: "image/*,.pdf,application/pdf" },
  { key: "factura5", label: "Factura 5", accept: "image/*,.pdf,application/pdf" },
  {
    key: "certificadoP12",
    label: "Certificado P-12",
    accept: ".p12,.pfx,application/x-pkcs12,application/octet-stream",
  },
];

export default function DgiiIntakeForm({ token }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(null);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [intake, setIntake] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [empresa, setEmpresa] = useState({
    rnc: "",
    nombre: "",
    razonSocial: "",
    telefono: "",
    direccion: "",
  });
  const [representante, setRepresentante] = useState({
    nombre: "",
    email: "",
    telefono: "",
    direccion: "",
  });
  const [secrets, setSecrets] = useState({
    certPassword: "",
    dgiiPortalRnc: "",
    dgiiPortalPassword: "",
  });

  const applyIntake = useCallback((data) => {
    setIntake(data);
    setEmpresa({
      rnc: data.empresa?.rnc || "",
      nombre: data.empresa?.nombre || "",
      razonSocial: data.empresa?.razonSocial || "",
      telefono: data.empresa?.telefono || "",
      direccion: data.empresa?.direccion || "",
    });
    setRepresentante({
      nombre: data.representante?.nombre || "",
      email: data.representante?.email || "",
      telefono: data.representante?.telefono || "",
      direccion: data.representante?.direccion || "",
    });
    setSecrets({ certPassword: "", dgiiPortalRnc: "", dgiiPortalPassword: "" });
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/dgii-intake/${token}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (!cancelled) setError(data.error || "No se pudo cargar el formulario");
          return;
        }
        if (!cancelled) applyIntake(data.intake);
      } catch {
        if (!cancelled) setError("Error de conexión");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [token, applyIntake]);

  async function save(extra = {}) {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const payload = {
        empresa,
        representante,
        secrets: {
          ...(secrets.certPassword.trim()
            ? { certPassword: secrets.certPassword }
            : {}),
          ...(secrets.dgiiPortalRnc.trim()
            ? { dgiiPortalRnc: secrets.dgiiPortalRnc }
            : {}),
          ...(secrets.dgiiPortalPassword.trim()
            ? { dgiiPortalPassword: secrets.dgiiPortalPassword }
            : {}),
        },
        ...extra,
      };
      const res = await fetch(`/api/dgii-intake/${token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No se pudo guardar");
        if (data.intake) applyIntake(data.intake);
        return false;
      }
      applyIntake(data.intake);
      setMessage({ type: "ok", text: data.message || "Guardado" });
      return true;
    } catch {
      setError("Error de conexión");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function uploadFile(slot, file) {
    if (!file) return;
    setUploading(slot);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("slot", slot);
      fd.append("file", file);
      const res = await fetch(`/api/dgii-intake/${token}/upload`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Error al subir archivo");
        return;
      }
      applyIntake(data.intake);
      setMessage({ type: "ok", text: `${FIELD_LABELS[slot] || slot} subido` });
    } catch {
      setError("Error al subir archivo");
    } finally {
      setUploading(null);
    }
  }

  async function confirmComplete() {
    setConfirmOpen(false);
    await save({ markComplete: true });
  }

  if (loading) {
    return <div className={styles.wrap}>Cargando formulario…</div>;
  }

  if (error && !intake) {
    return (
      <div className={styles.wrap}>
        <h1 className={styles.title}>Formulario no disponible</h1>
        <p className={styles.subtitle}>{error}</p>
      </div>
    );
  }

  const completion = intake?.completion || {
    percent: 0,
    completed: 0,
    total: 0,
    missing: [],
    isComplete: false,
  };
  const isMarkedComplete = intake?.status === "complete";
  const canMarkComplete = completion.isComplete && !isMarkedComplete;

  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>Admisión facturación electrónica DGII</h1>
      <p className={styles.subtitle}>
        Complete los datos de su empresa. Puede guardar y volver a este enlace
        mientras esté vigente.
      </p>

      {isMarkedComplete ? (
        <div className={styles.completeBanner} role="status">
          Este formulario ya fue marcado como completado. Aún puede actualizar
          datos si lo necesita; Giganet ya fue notificado.
        </div>
      ) : null}

      <div className={styles.progress} aria-live="polite">
        <strong>
          Progreso: {completion.completed}/{completion.total} ({completion.percent}
          %)
        </strong>
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: `${completion.percent}%` }}
          />
        </div>
        {completion.missing?.length ? (
          <ul className={styles.missingList}>
            {completion.missing.map((k) => (
              <li key={k}>{FIELD_LABELS[k] || k}</li>
            ))}
          </ul>
        ) : (
          <p className={styles.okHint} style={{ margin: 0 }}>
            Todos los campos requeridos están completos.
          </p>
        )}
      </div>

      <div className={styles.warning} role="note">
        <strong>Información sensible.</strong> La contraseña del certificado
        digital y las credenciales del portal DGII se solicitan porque The
        Factory las requiere para la integración. Se envían cifradas al servidor,
        se almacenan encriptadas y nunca se registran en logs ni se muestran de
        nuevo en texto plano.
      </div>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Datos de la empresa</h2>
        <div className={styles.grid}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="emp-rnc">
              RNC
            </label>
            <input
              id="emp-rnc"
              className={styles.input}
              value={empresa.rnc}
              onChange={(e) =>
                setEmpresa((s) => ({
                  ...s,
                  rnc: e.target.value.replace(/\D/g, "").slice(0, 11),
                }))
              }
              inputMode="numeric"
              autoComplete="off"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="emp-nombre">
              Nombre de la empresa
            </label>
            <input
              id="emp-nombre"
              className={styles.input}
              value={empresa.nombre}
              onChange={(e) =>
                setEmpresa((s) => ({ ...s, nombre: e.target.value }))
              }
              autoComplete="organization"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="emp-razon">
              Razón social
            </label>
            <input
              id="emp-razon"
              className={styles.input}
              value={empresa.razonSocial}
              onChange={(e) =>
                setEmpresa((s) => ({ ...s, razonSocial: e.target.value }))
              }
              autoComplete="organization"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="emp-tel">
              Teléfono
            </label>
            <input
              id="emp-tel"
              className={styles.input}
              value={empresa.telefono}
              onChange={(e) =>
                setEmpresa((s) => ({ ...s, telefono: e.target.value }))
              }
              autoComplete="tel"
            />
          </div>
          <div className={`${styles.field} ${styles.fieldFull}`}>
            <label className={styles.label} htmlFor="emp-dir">
              Dirección
            </label>
            <textarea
              id="emp-dir"
              className={styles.textarea}
              value={empresa.direccion}
              onChange={(e) =>
                setEmpresa((s) => ({ ...s, direccion: e.target.value }))
              }
            />
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          Representante legal ante la DGII
        </h2>
        <div className={styles.grid}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="rep-nombre">
              Nombre
            </label>
            <input
              id="rep-nombre"
              className={styles.input}
              value={representante.nombre}
              onChange={(e) =>
                setRepresentante((s) => ({ ...s, nombre: e.target.value }))
              }
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="rep-email">
              Correo electrónico
            </label>
            <input
              id="rep-email"
              type="email"
              className={styles.input}
              value={representante.email}
              onChange={(e) =>
                setRepresentante((s) => ({ ...s, email: e.target.value }))
              }
              autoComplete="email"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="rep-tel">
              Teléfono
            </label>
            <input
              id="rep-tel"
              className={styles.input}
              value={representante.telefono}
              onChange={(e) =>
                setRepresentante((s) => ({ ...s, telefono: e.target.value }))
              }
            />
          </div>
          <div className={`${styles.field} ${styles.fieldFull}`}>
            <label className={styles.label} htmlFor="rep-dir">
              Dirección de residencia
            </label>
            <textarea
              id="rep-dir"
              className={styles.textarea}
              value={representante.direccion}
              onChange={(e) =>
                setRepresentante((s) => ({ ...s, direccion: e.target.value }))
              }
            />
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Documentos</h2>
        <div className={styles.grid}>
          {FILE_SLOTS.map(({ key, label, accept }) => {
            const file = intake?.files?.[key];
            return (
              <div key={key} className={styles.fileCard}>
                <span className={styles.label}>{label}</span>
                {file?.uploaded ? (
                  <span className={`${styles.hint} ${styles.okHint}`}>
                    Subido: {file.originalName || "archivo"}
                  </span>
                ) : (
                  <span className={styles.hint}>Pendiente</span>
                )}
                <input
                  type="file"
                  accept={accept}
                  disabled={uploading === key || saving}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    uploadFile(key, f);
                    e.target.value = "";
                  }}
                />
              </div>
            );
          })}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Certificado y portal DGII</h2>
        <div className={styles.grid}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="cert-pass">
              Contraseña del certificado
            </label>
            <input
              id="cert-pass"
              type="password"
              className={styles.input}
              value={secrets.certPassword}
              onChange={(e) =>
                setSecrets((s) => ({ ...s, certPassword: e.target.value }))
              }
              placeholder={
                intake?.secretsStatus?.certPassword
                  ? "•••••••• (ya guardada; escriba para reemplazar)"
                  : ""
              }
              autoComplete="new-password"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="portal-rnc">
              RNC portal certificación DGII
            </label>
            <input
              id="portal-rnc"
              className={styles.input}
              value={secrets.dgiiPortalRnc}
              onChange={(e) =>
                setSecrets((s) => ({
                  ...s,
                  dgiiPortalRnc: e.target.value.replace(/\D/g, "").slice(0, 11),
                }))
              }
              placeholder={
                intake?.secretsStatus?.dgiiPortalRnc
                  ? "Ya guardado; escriba para reemplazar"
                  : ""
              }
              autoComplete="off"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="portal-pass">
              Contraseña portal DGII
            </label>
            <input
              id="portal-pass"
              type="password"
              className={styles.input}
              value={secrets.dgiiPortalPassword}
              onChange={(e) =>
                setSecrets((s) => ({
                  ...s,
                  dgiiPortalPassword: e.target.value,
                }))
              }
              placeholder={
                intake?.secretsStatus?.dgiiPortalPassword
                  ? "•••••••• (ya guardada; escriba para reemplazar)"
                  : ""
              }
              autoComplete="new-password"
            />
          </div>
        </div>
      </section>

      <div className={styles.actions}>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnPrimary}`}
          disabled={saving || uploading}
          onClick={() => save()}
        >
          {saving ? "Guardando…" : "Guardar progreso"}
        </button>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnComplete}`}
          disabled={!canMarkComplete || saving || uploading}
          title={
            canMarkComplete
              ? "Notificar a Giganet que los datos están completos"
              : "Complete todos los campos para habilitar"
          }
          onClick={() => setConfirmOpen(true)}
        >
          Marcar como completado
        </button>
      </div>

      {message ? (
        <div
          className={`${styles.message} ${
            message.type === "ok" ? styles.messageOk : styles.messageErr
          }`}
          role="status"
        >
          {message.text}
        </div>
      ) : null}
      {error ? (
        <div className={`${styles.message} ${styles.messageErr}`} role="alert">
          {error}
        </div>
      ) : null}

      {confirmOpen ? (
        <div
          className={styles.overlay}
          onClick={() => setConfirmOpen(false)}
          role="presentation"
        >
          <div
            className={styles.modal}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dgii-complete-title"
          >
            <h2 id="dgii-complete-title">Confirmar envío</h2>
            <p>¿Confirmas que toda la información está completa?</p>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.btn}
                onClick={() => setConfirmOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnComplete}`}
                disabled={saving}
                onClick={confirmComplete}
              >
                Sí, confirmar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
