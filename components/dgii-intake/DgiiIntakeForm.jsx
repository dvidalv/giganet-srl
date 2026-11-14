"use client";

import { useCallback, useEffect, useState } from "react";
import { FiUpload } from "react-icons/fi";
import styles from "./DgiiIntakeForm.module.css";
import { FIELD_LABELS } from "@/lib/dgiiIntake/status";

const DOC_ACCEPT = "image/*,.pdf,application/pdf";

const CEDULA_SLOTS = [
  {
    key: "cedulaFrente",
    label: "Anverso",
    hint: "Cara frontal (anverso) de la cédula",
    accept: DOC_ACCEPT,
  },
  {
    key: "cedulaReverso",
    label: "Reverso",
    hint: "Cara posterior (reverso) de la cédula",
    accept: DOC_ACCEPT,
  },
];

const FACTURA_SLOTS = [
  { key: "factura1", label: "Factura 1", accept: DOC_ACCEPT },
  { key: "factura2", label: "Factura 2", accept: DOC_ACCEPT },
  { key: "factura3", label: "Factura 3", accept: DOC_ACCEPT },
  { key: "factura4", label: "Factura 4", accept: DOC_ACCEPT },
  { key: "factura5", label: "Factura 5", accept: DOC_ACCEPT },
];

const P12_SLOT = {
  key: "certificadoP12",
  label: "Certificado P-12",
  hint: "Archivo .p12 o .pfx — sin vista previa",
  accept: ".p12,.pfx,application/x-pkcs12,application/octet-stream",
};

function isP12Slot(slotKey) {
  return slotKey === "certificadoP12";
}

function getPreviewKind(file) {
  if (!file?.uploaded || !file?.url) return null;
  const mime = String(file.mimeType || "").toLowerCase();
  const name = String(file.originalName || "").toLowerCase();
  if (
    mime.includes("pkcs12") ||
    name.endsWith(".p12") ||
    name.endsWith(".pfx")
  ) {
    return null;
  }
  if (mime.startsWith("image/") || /\.(jpe?g|png|gif|webp|bmp)$/i.test(name)) {
    return "image";
  }
  if (mime === "application/pdf" || name.endsWith(".pdf")) {
    return "pdf";
  }
  // Unknown but has URL — try generic embed (not P12)
  return "other";
}

export default function DgiiIntakeForm({ token }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(null);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [intake, setIntake] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [preview, setPreview] = useState(null);

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
      const fullyComplete = Boolean(data.intake?.completion?.isComplete);
      // Success modal only for "Guardar progreso" when everything required is filled
      if (!extra.markComplete && fullyComplete) {
        setSuccessOpen(true);
        setMessage(null);
      } else {
        setMessage({ type: "ok", text: data.message || "Guardado" });
      }
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
    // Must remove existing file first — no silent overwrite
    if (intake?.files?.[slot]?.uploaded) {
      setError(
        "Elimine el archivo actual antes de subir uno nuevo en esta casilla.",
      );
      return;
    }
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

  async function removeFile(slot) {
    setUploading(slot);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/dgii-intake/${token}/upload?slot=${encodeURIComponent(slot)}`,
        { method: "DELETE" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No se pudo eliminar el archivo");
        return;
      }
      applyIntake(data.intake);
      setMessage({
        type: "ok",
        text: `${FIELD_LABELS[slot] || slot} eliminado`,
      });
    } catch {
      setError("Error al eliminar archivo");
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

  function renderFileSlot({ key, label, hint, accept }) {
    const file = intake?.files?.[key];
    const missing = completion.missing?.includes(key);
    const previewKind = isP12Slot(key) ? null : getPreviewKind(file);
    const canPreview = Boolean(previewKind && file?.url);
    return (
      <li
        key={key}
        className={`${styles.fileCard} ${
          missing ? styles.fileCardMissing : ""
        } ${file?.uploaded ? styles.fileCardDone : ""}`}
      >
        <div className={styles.fileCardTop}>
          <span className={styles.label}>
            {label}
            <span className={styles.requiredMark} aria-hidden="true">
              {" "}
              *
            </span>
          </span>
          {file?.uploaded ? (
            <span className={`${styles.fileStatus} ${styles.okHint}`}>
              Subido
            </span>
          ) : (
            <span
              className={`${styles.fileStatus} ${styles.fileStatusPending}`}
            >
              Pendiente
            </span>
          )}
        </div>
        {hint ? <p className={styles.hint}>{hint}</p> : null}
        {file?.uploaded ? (
          <div className={styles.filePreviewRow}>
            {canPreview && previewKind === "image" ? (
              <button
                type="button"
                className={styles.thumbBtn}
                onClick={() =>
                  setPreview({
                    kind: "image",
                    url: file.url,
                    title: label,
                    name: file.originalName || label,
                  })
                }
                aria-label={`Ver vista previa: ${label}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={file.url} alt="" className={styles.thumbImg} />
              </button>
            ) : null}
            {canPreview ? (
              <button
                type="button"
                className={styles.previewLink}
                onClick={() =>
                  setPreview({
                    kind: previewKind,
                    url: file.url,
                    title: label,
                    name: file.originalName || label,
                  })
                }
              >
                {file.originalName || "Ver archivo"}
                <span className={styles.previewHint}> · ver</span>
              </button>
            ) : (
              <p className={`${styles.hint} ${styles.okHint}`}>
                {file.originalName || "archivo"}
                {isP12Slot(key) ? " (sin vista previa)" : ""}
              </p>
            )}
            <button
              type="button"
              className={styles.removeFileBtn}
              disabled={uploading === key || saving}
              onClick={() => removeFile(key)}
            >
              {uploading === key ? "Eliminando…" : "Eliminar"}
            </button>
          </div>
        ) : (
          <div className={styles.filePicker}>
            <input
              id={`file-${key}`}
              type="file"
              className={styles.fileInputNative}
              accept={accept}
              aria-required="true"
              aria-label={label}
              disabled={uploading === key || saving}
              onChange={(e) => {
                const f = e.target.files?.[0];
                uploadFile(key, f);
                e.target.value = "";
              }}
            />
            <label
              htmlFor={`file-${key}`}
              className={`${styles.filePickerBtn} ${
                uploading === key || saving ? styles.filePickerBtnDisabled : ""
              }`}
            >
              <FiUpload className={styles.filePickerIcon} aria-hidden="true" />
              {uploading === key ? "Subiendo…" : "Elegir archivo"}
            </label>
            <span className={styles.filePickerHint}>Ningún archivo elegido</span>
          </div>
        )}
        {file?.uploaded ? (
          <p className={styles.hint}>
            Para subir otro archivo, elimine el actual primero.
          </p>
        ) : null}
      </li>
    );
  }

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
          <>
            <p className={styles.missingListTitle}>
              Faltan {completion.missing.length} requeridos:
            </p>
            <ul className={styles.missingList}>
              {completion.missing.map((k) => (
                <li key={k}>{FIELD_LABELS[k] || k}</li>
              ))}
            </ul>
          </>
        ) : (
          <p className={styles.okHint} style={{ margin: 0 }}>
            Todos los campos requeridos están completos.
          </p>
        )}
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

      <section className={styles.section} aria-labelledby="docs-heading">
        <h2 id="docs-heading" className={styles.sectionTitle}>
          Documentos
        </h2>
        <p className={styles.sectionLead}>
          Complete cada bloque. La cédula requiere anverso y reverso por
          separado.
        </p>

        <div className={styles.docGroup}>
          <div className={styles.docGroupHeader}>
            <h3 className={styles.docGroupTitle}>1. Cédula</h3>
            <p className={styles.docGroupDesc}>
              Anverso y reverso como dos archivos distintos (imagen o PDF).
            </p>
          </div>
          <ul className={styles.docChecklist}>
            {CEDULA_SLOTS.map(renderFileSlot)}
          </ul>
        </div>

        <div className={styles.docGroup}>
          <div className={styles.docGroupHeader}>
            <h3 className={styles.docGroupTitle}>2. Facturas</h3>
            <p className={styles.docGroupDesc}>
              Cinco facturas, una en cada casilla (imagen o PDF).
            </p>
          </div>
          <ul className={styles.docChecklist}>
            {FACTURA_SLOTS.map(renderFileSlot)}
          </ul>
        </div>

        <div className={styles.docGroup}>
          <div className={styles.docGroupHeader}>
            <h3 className={styles.docGroupTitle}>3. Certificado P-12</h3>
            <p className={styles.docGroupDesc}>
              Suba el certificado digital (.p12 / .pfx). No tiene vista previa.
            </p>
          </div>
          <ul className={`${styles.docChecklist} ${styles.docChecklistSingle}`}>
            {renderFileSlot(P12_SLOT)}
          </ul>
          <div className={`${styles.grid} ${styles.docGroupFields}`}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="cert-pass">
                Contraseña del certificado
                <span className={styles.requiredMark} aria-hidden="true">
                  {" "}
                  *
                </span>
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
          </div>
        </div>

        <div className={styles.docGroup}>
          <div className={styles.docGroupHeader}>
            <h3 className={styles.docGroupTitle}>
              4. Certificación de portal e-CF
            </h3>
            <p className={styles.docGroupDesc}>
              Credenciales del portal de certificación DGII (usuario RNC y
              contraseña).
            </p>
          </div>
          <div className={styles.grid}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="portal-rnc">
                RNC portal certificación DGII
                <span className={styles.requiredMark} aria-hidden="true">
                  {" "}
                  *
                </span>
              </label>
              <input
                id="portal-rnc"
                className={styles.input}
                value={secrets.dgiiPortalRnc}
                onChange={(e) =>
                  setSecrets((s) => ({
                    ...s,
                    dgiiPortalRnc: e.target.value
                      .replace(/\D/g, "")
                      .slice(0, 11),
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
                <span className={styles.requiredMark} aria-hidden="true">
                  {" "}
                  *
                </span>
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

      {successOpen ? (
        <div
          className={styles.overlay}
          onClick={() => setSuccessOpen(false)}
          role="presentation"
        >
          <div
            className={`${styles.modal} ${styles.successModal}`}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dgii-success-title"
            aria-describedby="dgii-success-desc"
          >
            <div className={styles.successIcon} aria-hidden="true">
              ✓
            </div>
            <h2 id="dgii-success-title">Completado exitosamente</h2>
            <p id="dgii-success-desc">
              Todos los datos están completados. Ya puede marcar el formulario
              como completado para notificar a Giganet.
            </p>
            <div className={styles.actions}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnComplete}`}
                onClick={() => setSuccessOpen(false)}
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {preview ? (
        <div
          className={styles.overlay}
          onClick={() => setPreview(null)}
          role="presentation"
        >
          <div
            className={`${styles.modal} ${styles.previewModal}`}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dgii-preview-title"
          >
            <div className={styles.previewHeader}>
              <h2 id="dgii-preview-title">{preview.title}</h2>
              <button
                type="button"
                className={styles.previewClose}
                onClick={() => setPreview(null)}
                aria-label="Cerrar vista previa"
              >
                ×
              </button>
            </div>
            <p className={styles.previewFileName}>{preview.name}</p>
            <div className={styles.previewBody}>
              {preview.kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview.url}
                  alt={preview.name}
                  className={styles.previewImg}
                />
              ) : (
                <iframe
                  title={preview.name}
                  src={preview.url}
                  className={styles.previewFrame}
                />
              )}
            </div>
            <div className={styles.actions}>
              <a
                className={`${styles.btn} ${styles.btnPrimary}`}
                href={preview.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Abrir en nueva pestaña
              </a>
              <button
                type="button"
                className={styles.btn}
                onClick={() => setPreview(null)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
