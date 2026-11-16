"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./DgiiIntakeForm.module.css";
import { FIELD_LABELS } from "@/lib/dgiiIntake/labels";
import { LOGO_MAX_BYTES, MAX_UPLOAD_BYTES } from "@/lib/dgiiIntake/fileSlots";
import {
  requiresRegistroMercantil,
  TIPO_PERSONA_FISICA,
  TIPO_PERSONA_JURIDICA,
} from "@/lib/dgiiIntake/tipoPersona";

const DOC_ACCEPT =
  "image/jpeg,image/png,image/webp,application/pdf,.pdf";
const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif";
const RING_LEN = 97.4;
const HELP_WHATSAPP = "https://wa.me/16825602093";
const HELP_EMAIL = "mailto:dvidalv@giganet-srl.com";

const CEDULA_SLOTS = [
  {
    key: "cedulaFrente",
    label: "Anverso",
    hint: "Cara frontal, con foto",
    accept: DOC_ACCEPT,
    icon: "fa-regular fa-id-card",
  },
  {
    key: "cedulaReverso",
    label: "Reverso",
    hint: "Cara posterior, con código",
    accept: DOC_ACCEPT,
    icon: "fa-solid fa-barcode",
  },
];

const FACTURA_SLOTS = [
  { key: "factura1", label: "Factura 1", accept: DOC_ACCEPT },
  { key: "factura2", label: "Factura 2", accept: DOC_ACCEPT },
  { key: "factura3", label: "Factura 3", accept: DOC_ACCEPT },
  { key: "factura4", label: "Factura 4", accept: DOC_ACCEPT },
  { key: "factura5", label: "Factura 5", accept: DOC_ACCEPT },
];

const REGISTRO_MERCANTIL_SLOT = {
  key: "registroMercantil",
  label: "Registro Mercantil",
  hint: "Obligatorio para persona jurídica (imagen o PDF)",
  accept: DOC_ACCEPT,
  icon: "fa-regular fa-file-lines",
};

const LOGO_SLOT = {
  key: "logo",
  label: "Logo",
  hint: "JPG, PNG, WebP o GIF · máx. 5 MB",
  accept: IMAGE_ACCEPT,
};

const P12_SLOT = {
  key: "certificadoP12",
  label: "Certificado P-12",
  hint: "Archivo .p12 o .pfx",
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
  return "other";
}

function formatBytes(n) {
  const bytes = Number(n) || 0;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatExpiresAt(value) {
  if (!value) return null;
  try {
    return new Date(value).toLocaleDateString("es-DO", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return null;
  }
}

function sectionComplete(fields, keys) {
  return keys.every((k) => Boolean(fields?.[k]));
}

function sectionCount(fields, keys) {
  const done = keys.filter((k) => Boolean(fields?.[k])).length;
  return { done, total: keys.length };
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
  const [showCertPass, setShowCertPass] = useState(false);
  const [showPortalPass, setShowPortalPass] = useState(false);

  const [tipoPersona, setTipoPersona] = useState("");
  const [empresa, setEmpresa] = useState({
    rnc: "",
    nombre: "",
    razonSocial: "",
    telefono: "",
    direccion: "",
    ciudad: "",
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
    setTipoPersona(data.tipoPersona || "");
    setEmpresa({
      rnc: data.empresa?.rnc || "",
      nombre: data.empresa?.nombre || "",
      razonSocial: data.empresa?.razonSocial || "",
      telefono: data.empresa?.telefono || "",
      direccion: data.empresa?.direccion || "",
      ciudad: data.empresa?.ciudad || "",
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
        tipoPersona,
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
    if (intake?.files?.[slot]?.uploaded) {
      setError(
        "Elimine el archivo actual antes de subir uno nuevo en esta casilla.",
      );
      return;
    }
    if (slot === "logo") {
      const name = String(file.name || "").toLowerCase();
      const mime = String(file.type || "").toLowerCase();
      const isImage =
        mime.startsWith("image/") ||
        /\.(jpe?g|png|gif|webp)$/i.test(name);
      if (!isImage) {
        setError("El logo debe ser una imagen (JPG, PNG, WebP o GIF)");
        return;
      }
      if (file.size >= LOGO_MAX_BYTES) {
        setError("El logo debe ser una imagen de menos de 5 MB.");
        return;
      }
    }
    if (slot !== "logo" && file.size > MAX_UPLOAD_BYTES) {
      setError("El archivo supera el máximo de 8 MB");
      return;
    }
    setUploading(slot);
    setError(null);
    try {
      const mimeType = file.type || "application/octet-stream";
      const signRes = await fetch(`/api/dgii-intake/${token}/upload/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slot,
          fileName: file.name,
          mimeType,
          size: file.size,
        }),
      });
      const signed = await signRes.json().catch(() => ({}));
      if (!signRes.ok) {
        setError(signed.error || "Error al subir archivo");
        return;
      }

      const fd = new FormData();
      for (const [k, v] of Object.entries(signed.fields || {})) {
        fd.append(k, String(v));
      }
      fd.append("file", file);
      const cldRes = await fetch(signed.uploadUrl, { method: "POST", body: fd });
      const cld = await cldRes.json().catch(() => ({}));
      if (!cldRes.ok) {
        const msg = String(cld?.error?.message || "");
        setError(
          /format/i.test(msg)
            ? "Formato de archivo no válido para esta casilla."
            : /size|large/i.test(msg)
              ? "El archivo es demasiado grande."
              : "Error al subir archivo",
        );
        return;
      }

      const res = await fetch(`/api/dgii-intake/${token}/upload/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slot,
          publicId: cld.public_id || signed.publicId,
          resourceType: signed.resourceType,
          originalName: file.name,
          mimeType,
        }),
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
    return (
      <div className={`${styles.wrap} ${styles.loadingState}`}>
        Cargando formulario…
      </div>
    );
  }

  if (error && !intake) {
    return (
      <div className={`${styles.wrap} ${styles.errorState}`}>
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
    fields: {},
  };
  const fields = completion.fields || {};
  const isMarkedComplete = intake?.status === "complete";
  const canMarkComplete = completion.isComplete && !isMarkedComplete;
  const showRegistroMercantil = requiresRegistroMercantil(tipoPersona);
  const pending = Math.max(0, (completion.total || 0) - (completion.completed || 0));
  const ringOffset = RING_LEN * (1 - (completion.percent || 0) / 100);
  const expiresLabel = formatExpiresAt(intake?.expiresAt);

  const empresaKeys = [
    "tipoPersona",
    "empresaRnc",
    "empresaNombre",
    "empresaRazonSocial",
    "empresaTelefono",
    "empresaDireccion",
    "empresaCiudad",
  ];
  const repKeys = [
    "representanteNombre",
    "representanteEmail",
    "representanteTelefono",
    "representanteDireccion",
  ];
  const cedulaKeys = ["cedulaFrente", "cedulaReverso"];
  const facturaKeys = [
    "factura1",
    "factura2",
    "factura3",
    "factura4",
    "factura5",
  ];
  const certKeys = ["certificadoP12", "certPassword"];
  const portalKeys = ["dgiiPortalRnc", "dgiiPortalPassword"];

  const empresaDone = sectionComplete(fields, empresaKeys);
  const repDone = sectionComplete(fields, repKeys);
  const cedulaStats = sectionCount(fields, cedulaKeys);
  const facturaStats = sectionCount(fields, facturaKeys);
  const logoDone = Boolean(fields.logo);
  const certDone = sectionComplete(fields, certKeys);
  const portalDone = sectionComplete(fields, portalKeys);
  const registroDone = Boolean(fields.registroMercantil);

  const missingDocs = (completion.missing || []).filter((k) =>
    [
      "cedulaFrente",
      "cedulaReverso",
      "factura1",
      "factura2",
      "factura3",
      "factura4",
      "factura5",
      "registroMercantil",
      "logo",
      "certificadoP12",
    ].includes(k),
  );

  let sectionNum = 0;
  const nextNum = () => {
    sectionNum += 1;
    return sectionNum;
  };
  const numEmpresa = nextNum();
  const numRep = nextNum();
  const numCedula = nextNum();
  const numFacturas = nextNum();
  const numRegistro = showRegistroMercantil ? nextNum() : null;
  const numLogo = nextNum();
  const numCert = nextNum();
  const numPortal = nextNum();

  function stepIconClass(done, active) {
    if (done) return `${styles.stepIcon} ${styles.stepIconDone}`;
    if (active) return `${styles.stepIcon} ${styles.stepIconActive}`;
    return `${styles.stepIcon} ${styles.stepIconTodo}`;
  }

  function renderUploadSlot(slot, opts = {}) {
    const {
      compact = false,
      icon = "fa-regular fa-file-lines",
      ctaLabel = compact ? "Subir archivo" : "Subir o arrastrar",
    } = opts;
    const key = slot.key;
    const file = intake?.files?.[key];
    const missing = completion.missing?.includes(key);
    const previewKind = isP12Slot(key) ? null : getPreviewKind(file);
    const canPreview = Boolean(previewKind && file?.url);
    const busy = uploading === key || saving;
    const uploaded = Boolean(file?.uploaded);

    function onPick(e) {
      const f = e.target.files?.[0];
      uploadFile(key, f);
      e.target.value = "";
    }

    function onDrop(e) {
      e.preventDefault();
      if (busy || uploaded) return;
      const f = e.dataTransfer?.files?.[0];
      if (f) uploadFile(key, f);
    }

    if (uploaded) {
      return (
        <div
          key={key}
          className={`${styles.uploadSlot} ${styles.uploadSlotDone} ${
            compact ? styles.uploadSlotCompact : ""
          }`}
        >
          <div
            className={`${styles.slotDone} ${
              compact ? styles.slotDoneCompact : ""
            }`}
          >
            {canPreview && previewKind === "image" && !compact ? (
              <button
                type="button"
                className={styles.thumbBtn}
                onClick={() =>
                  setPreview({
                    kind: "image",
                    url: file.url,
                    title: slot.label,
                    name: file.originalName || slot.label,
                  })
                }
                aria-label={`Ver vista previa: ${slot.label}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={file.url} alt="" className={styles.thumbImg} />
              </button>
            ) : (
              <div className={styles.slotDoneIcon}>
                <i className="fa-solid fa-file-circle-check" aria-hidden="true" />
              </div>
            )}
            <div className={styles.minW0} style={{ minWidth: 0, flex: 1 }}>
              <p className={styles.slotDoneLabel}>{slot.label}</p>
              <p className={styles.slotDoneName}>
                {file.originalName || "archivo"}
                {isP12Slot(key) ? " (sin vista previa)" : ""}
              </p>
              {canPreview ? (
                <button
                  type="button"
                  className={styles.previewLink}
                  onClick={() =>
                    setPreview({
                      kind: previewKind,
                      url: file.url,
                      title: slot.label,
                      name: file.originalName || slot.label,
                    })
                  }
                >
                  <i className="fa-regular fa-eye" aria-hidden="true" /> Ver
                </button>
              ) : null}
            </div>
            <div className={styles.slotDoneActions}>
              <button
                type="button"
                className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                disabled={busy}
                onClick={() => removeFile(key)}
                title="Eliminar"
                aria-label={`Eliminar ${slot.label}`}
              >
                <i
                  className={
                    uploading === key
                      ? "fa-solid fa-spinner fa-spin"
                      : "fa-regular fa-trash-can"
                  }
                  aria-hidden="true"
                />
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <label
        key={key}
        className={`${styles.uploadSlot} ${
          compact ? styles.uploadSlotCompact : ""
        } ${missing ? styles.uploadSlotMissing : ""} ${
          busy ? styles.uploadSlotDisabled : ""
        }`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        <input
          id={`file-${key}`}
          type="file"
          className={styles.fileInputNative}
          accept={slot.accept}
          aria-required="true"
          aria-label={slot.label}
          disabled={busy}
          onChange={onPick}
        />
        <div className={styles.slotEmptyIcon} aria-hidden="true">
          <i className={icon} />
        </div>
        <p className={styles.slotTitle}>
          {slot.label}
          <span className={styles.requiredMark}> *</span>
        </p>
        {slot.hint ? <p className={styles.slotHint}>{slot.hint}</p> : null}
        <span className={styles.slotCta}>
          <i
            className={
              uploading === key
                ? "fa-solid fa-spinner fa-spin"
                : "fa-solid fa-arrow-up-from-bracket"
            }
            aria-hidden="true"
          />
          {uploading === key ? "Subiendo…" : ctaLabel}
        </span>
      </label>
    );
  }

  function renderDoneFileCard(slot, opts = {}) {
    const file = intake?.files?.[slot.key];
    if (!file?.uploaded) return renderUploadSlot(slot, opts);
    const previewKind = isP12Slot(slot.key) ? null : getPreviewKind(file);
    const busy = uploading === slot.key || saving;
    return (
      <div className={styles.fileDoneCard}>
        {previewKind === "image" && file.url ? (
          <button
            type="button"
            className={styles.fileDoneBadge}
            style={{ padding: 0, border: 0, cursor: "pointer" }}
            onClick={() =>
              setPreview({
                kind: "image",
                url: file.url,
                title: slot.label,
                name: file.originalName || slot.label,
              })
            }
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={file.url} alt="" />
          </button>
        ) : (
          <div
            className={`${styles.fileDoneBadge} ${
              isP12Slot(slot.key) ? styles.fileDoneBadgeCert : ""
            }`}
          >
            {isP12Slot(slot.key) ? (
              <i className="fa-solid fa-certificate" aria-hidden="true" />
            ) : (
              "LOGO"
            )}
          </div>
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          <p className={styles.slotDoneName}>
            {file.originalName || slot.label}
          </p>
          <p className={styles.hint}>
            {isP12Slot(slot.key)
              ? `Sin vista previa · ${formatBytes(file.bytes)}`
              : formatBytes(file.bytes)}
          </p>
          {previewKind && file.url ? (
            <button
              type="button"
              className={styles.previewLink}
              onClick={() =>
                setPreview({
                  kind: previewKind,
                  url: file.url,
                  title: slot.label,
                  name: file.originalName || slot.label,
                })
              }
            >
              <i className="fa-regular fa-eye" aria-hidden="true" /> Ver
            </button>
          ) : null}
        </div>
        <div className={styles.slotDoneActions}>
          <button
            type="button"
            className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
            disabled={busy}
            onClick={() => removeFile(slot.key)}
            title="Eliminar"
            aria-label={`Eliminar ${slot.label}`}
          >
            <i
              className={
                uploading === slot.key
                  ? "fa-solid fa-spinner fa-spin"
                  : "fa-regular fa-trash-can"
              }
              aria-hidden="true"
            />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <header className={styles.chrome}>
        <div className={styles.chromeInner}>
          <div className={styles.brandBlock}>
            <div className={styles.brandMark} aria-hidden="true">
              <i className="fa-solid fa-fire-flame-curved" />
            </div>
            <div className={styles.brandText}>
              <p className={styles.brandName}>Giganet</p>
              <p className={styles.brandSub}>Facturación electrónica</p>
            </div>
          </div>
          <div className={styles.chromeActions}>
            <span className={styles.securePill}>
              <i className="fa-solid fa-lock" aria-hidden="true" /> Enlace seguro
              y privado
            </span>
            <a
              href={HELP_WHATSAPP}
              target="_blank"
              rel="noreferrer"
              className={styles.helpPill}
            >
              <i className="fa-brands fa-whatsapp" aria-hidden="true" />
              <span className={styles.helpPillLabel}>¿Necesita ayuda?</span>
            </a>
          </div>
        </div>
      </header>

      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <div className={styles.progressCard}>
            <div className={styles.progressTop}>
              <div className={styles.ringWrap} aria-hidden="true">
                <svg viewBox="0 0 36 36" className={styles.ringSvg}>
                  <circle
                    cx="18"
                    cy="18"
                    r="15.5"
                    className={styles.ringTrack}
                  />
                  <circle
                    cx="18"
                    cy="18"
                    r="15.5"
                    className={styles.ringValue}
                    strokeDasharray={RING_LEN}
                    strokeDashoffset={ringOffset}
                  />
                </svg>
                <span className={styles.ringPct}>{completion.percent}%</span>
              </div>
              <div>
                <p className={styles.progressMetaLabel}>Progreso</p>
                <p className={styles.progressMetaCount}>
                  {completion.completed} de {completion.total}
                </p>
                <p className={styles.progressMetaPending}>
                  {pending} requeridos pendientes
                </p>
              </div>
            </div>

            <nav className={styles.stepsNav} aria-label="Secciones del formulario">
              <a
                href="#sec-empresa"
                className={styles.stepLink}
              >
                <span className={stepIconClass(empresaDone, false)}>
                  {empresaDone ? (
                    <i className="fa-solid fa-check" />
                  ) : (
                    numEmpresa
                  )}
                </span>
                <span className={styles.stepLabel}>Datos de la empresa</span>
              </a>
              <a href="#sec-representante" className={styles.stepLink}>
                <span className={stepIconClass(repDone, false)}>
                  {repDone ? <i className="fa-solid fa-check" /> : numRep}
                </span>
                <span className={styles.stepLabel}>Representante legal</span>
              </a>
              <a
                href="#sec-cedula"
                className={`${styles.stepLink} ${
                  cedulaStats.done < cedulaStats.total ? styles.stepLinkActive : ""
                }`}
              >
                <span
                  className={stepIconClass(
                    cedulaStats.done === cedulaStats.total,
                    cedulaStats.done < cedulaStats.total,
                  )}
                >
                  {cedulaStats.done === cedulaStats.total ? (
                    <i className="fa-solid fa-check" />
                  ) : (
                    numCedula
                  )}
                </span>
                <span className={styles.stepLabel}>Cédula</span>
                <span
                  className={`${styles.stepCount} ${
                    cedulaStats.done === cedulaStats.total
                      ? styles.stepCountDone
                      : ""
                  }`}
                >
                  {cedulaStats.done}/{cedulaStats.total}
                </span>
              </a>
              <a href="#sec-facturas" className={styles.stepLink}>
                <span
                  className={stepIconClass(
                    facturaStats.done === facturaStats.total,
                    false,
                  )}
                >
                  {facturaStats.done === facturaStats.total ? (
                    <i className="fa-solid fa-check" />
                  ) : (
                    numFacturas
                  )}
                </span>
                <span className={styles.stepLabel}>Facturas</span>
                <span
                  className={`${styles.stepCount} ${
                    facturaStats.done === facturaStats.total
                      ? styles.stepCountDone
                      : ""
                  }`}
                >
                  {facturaStats.done}/{facturaStats.total}
                </span>
              </a>
              {showRegistroMercantil ? (
                <a href="#sec-registro" className={styles.stepLink}>
                  <span className={stepIconClass(registroDone, false)}>
                    {registroDone ? (
                      <i className="fa-solid fa-check" />
                    ) : (
                      numRegistro
                    )}
                  </span>
                  <span className={styles.stepLabel}>Registro Mercantil</span>
                </a>
              ) : null}
              <a href="#sec-logo" className={styles.stepLink}>
                <span className={stepIconClass(logoDone, false)}>
                  {logoDone ? <i className="fa-solid fa-check" /> : numLogo}
                </span>
                <span className={styles.stepLabel}>Logo</span>
              </a>
              <a href="#sec-certificado" className={styles.stepLink}>
                <span className={stepIconClass(certDone, false)}>
                  {certDone ? <i className="fa-solid fa-check" /> : numCert}
                </span>
                <span className={styles.stepLabel}>Certificado P-12</span>
              </a>
              <a href="#sec-portal" className={styles.stepLink}>
                <span className={stepIconClass(portalDone, false)}>
                  {portalDone ? <i className="fa-solid fa-check" /> : numPortal}
                </span>
                <span className={styles.stepLabel}>Portal e-CF</span>
              </a>
            </nav>
          </div>

          <div className={styles.helpCard}>
            <div className={styles.helpCardTop}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo.png"
                alt=""
                className={styles.helpAvatar}
              />
              <div>
                <p className={styles.helpTitle}>
                  ¿Dudas con algún documento?
                </p>
                <p className={styles.helpText}>
                  Su asesor de Giganet le acompaña en el proceso.
                </p>
              </div>
            </div>
            <div className={styles.helpContacts}>
              <a
                href={HELP_WHATSAPP}
                target="_blank"
                rel="noreferrer"
                className={styles.helpContact}
              >
                <i className="fa-brands fa-whatsapp" aria-hidden="true" />
                682-560-2093
              </a>
              <a href={HELP_EMAIL} className={styles.helpContact}>
                <i className="fa-regular fa-envelope" aria-hidden="true" />
                dvidalv@giganet-srl.com
              </a>
            </div>
            <div className={styles.securityNote}>
              <i className="fa-solid fa-shield-halved" aria-hidden="true" />
              <p>
                Documentos y contraseñas cifrados, usados solo para el registro
                DGII.
              </p>
            </div>
          </div>
        </aside>

        <div className={styles.formColumn}>
          <div>
            <div className={styles.introMeta}>
              {expiresLabel ? (
                <span className={styles.metaPill}>
                  <i className="fa-regular fa-clock" aria-hidden="true" /> Enlace
                  válido hasta el {expiresLabel}
                </span>
              ) : null}
              {intake?.lastSavedAt ? (
                <span className={`${styles.metaPill} ${styles.metaPillOk}`}>
                  <i className="fa-solid fa-cloud-arrow-up" aria-hidden="true" />{" "}
                  Guardado
                </span>
              ) : null}
            </div>
            <h1 className={styles.title}>
              Admisión a facturación electrónica DGII
            </h1>
            <p className={styles.subtitle}>
              Complete los datos de su empresa y adjunte los documentos
              requeridos. Puede guardar y volver a este enlace cuantas veces
              necesite mientras esté vigente.
            </p>
          </div>

          {isMarkedComplete ? (
            <div className={styles.completeBanner} role="status">
              Este formulario ya fue marcado como completado. Aún puede
              actualizar datos si lo necesita; Giganet ya fue notificado.
            </div>
          ) : null}

          {!isMarkedComplete && missingDocs.length ? (
            <div className={styles.pendingAlert}>
              <div className={styles.pendingIcon} aria-hidden="true">
                <i className="fa-solid fa-triangle-exclamation" />
              </div>
              <div style={{ flex: 1 }}>
                <p className={styles.pendingTitle}>
                  Faltan documentos por adjuntar
                </p>
                <p className={styles.pendingText}>
                  {missingDocs.map((k) => FIELD_LABELS[k] || k).join(", ")}.
                </p>
              </div>
              <a href="#sec-cedula" className={styles.pendingCta}>
                Ir a documentos{" "}
                <i className="fa-solid fa-arrow-down" aria-hidden="true" />
              </a>
            </div>
          ) : null}

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

          {/* 1 Empresa */}
          <section id="sec-empresa" className={styles.section}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionHeaderLeft}>
                <span className={styles.sectionNum}>{numEmpresa}</span>
                <div>
                  <h2 className={styles.sectionTitle}>Datos de la empresa</h2>
                  <p className={styles.sectionLead}>
                    Información fiscal tal como aparece en la DGII
                  </p>
                </div>
              </div>
              <span
                className={`${styles.chip} ${
                  empresaDone ? styles.chipOk : styles.chipWarn
                }`}
              >
                <i
                  className={
                    empresaDone
                      ? "fa-solid fa-circle-check"
                      : "fa-regular fa-clock"
                  }
                  aria-hidden="true"
                />
                {empresaDone ? "Completo" : "Pendiente"}
              </span>
            </div>
            <div className={styles.sectionBody}>
              <div className={styles.grid}>
                <div className={`${styles.field} ${styles.fieldFull}`}>
                  <div
                    className={styles.tipoPersonaToggle}
                    role="radiogroup"
                    aria-label="Tipo de persona"
                  >
                    <label
                      className={`${styles.tipoPersonaChip} ${styles.personaOpt} ${
                        tipoPersona === TIPO_PERSONA_FISICA
                          ? `${styles.tipoPersonaChipActive} ${styles.personaOptActive}`
                          : ""
                      }`}
                    >
                      <input
                        className={styles.tipoPersonaInput}
                        type="radio"
                        name="tipoPersona"
                        value={TIPO_PERSONA_FISICA}
                        checked={tipoPersona === TIPO_PERSONA_FISICA}
                        onChange={() => setTipoPersona(TIPO_PERSONA_FISICA)}
                      />
                      <span className={styles.tipoPersonaIcon} aria-hidden="true">
                        <i className="fa-solid fa-user" />
                      </span>
                      <span>
                        <span className={styles.tipoPersonaChipTitle}>
                          Persona física
                        </span>
                        <span className={styles.tipoPersonaChipHint}>
                          Contribuyente individual
                        </span>
                      </span>
                      <span className={styles.tipoPersonaRadio} aria-hidden="true">
                        <span className={styles.tipoPersonaRadioDot} />
                      </span>
                    </label>
                    <label
                      className={`${styles.tipoPersonaChip} ${styles.personaOpt} ${
                        tipoPersona === TIPO_PERSONA_JURIDICA
                          ? `${styles.tipoPersonaChipActive} ${styles.personaOptActive}`
                          : ""
                      }`}
                    >
                      <input
                        className={styles.tipoPersonaInput}
                        type="radio"
                        name="tipoPersona"
                        value={TIPO_PERSONA_JURIDICA}
                        checked={tipoPersona === TIPO_PERSONA_JURIDICA}
                        onChange={() => setTipoPersona(TIPO_PERSONA_JURIDICA)}
                      />
                      <span className={styles.tipoPersonaIcon} aria-hidden="true">
                        <i className="fa-solid fa-building" />
                      </span>
                      <span>
                        <span className={styles.tipoPersonaChipTitle}>
                          Persona jurídica
                        </span>
                        <span className={styles.tipoPersonaChipHint}>
                          Empresa o sociedad
                        </span>
                      </span>
                      <span className={styles.tipoPersonaRadio} aria-hidden="true">
                        <span className={styles.tipoPersonaRadioDot} />
                      </span>
                    </label>
                  </div>
                </div>

                <div className={styles.field}>
                  <label className={styles.label} htmlFor="emp-rnc">
                    RNC / Cédula
                    <span className={styles.requiredMark}> *</span>
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
                    Nombre comercial
                    <span className={styles.requiredMark}> *</span>
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
                    <span className={styles.requiredMark}> *</span>
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
                    <span className={styles.requiredMark}> *</span>
                  </label>
                  <div className={styles.telRow}>
                    <span className={styles.telPrefix}>RD +1</span>
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
                </div>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="emp-ciudad">
                    Provincia / Ciudad
                    <span className={styles.requiredMark}> *</span>
                  </label>
                  <input
                    id="emp-ciudad"
                    className={styles.input}
                    value={empresa.ciudad ?? ""}
                    onChange={(e) =>
                      setEmpresa((s) => ({ ...s, ciudad: e.target.value }))
                    }
                    autoComplete="address-level2"
                    placeholder="Ej. Santo Domingo"
                  />
                </div>
                <div className={`${styles.field} ${styles.fieldFull}`}>
                  <label className={styles.label} htmlFor="emp-dir">
                    Dirección fiscal
                    <span className={styles.requiredMark}> *</span>
                  </label>
                  <textarea
                    id="emp-dir"
                    className={styles.textarea}
                    rows={2}
                    value={empresa.direccion ?? ""}
                    onChange={(e) =>
                      setEmpresa((s) => ({ ...s, direccion: e.target.value }))
                    }
                  />
                </div>
              </div>
            </div>
          </section>

          {/* 2 Representante */}
          <section id="sec-representante" className={styles.section}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionHeaderLeft}>
                <span className={styles.sectionNum}>{numRep}</span>
                <div>
                  <h2 className={styles.sectionTitle}>
                    Representante legal ante la DGII
                  </h2>
                  <p className={styles.sectionLead}>
                    Persona autorizada para firmar y gestionar
                  </p>
                </div>
              </div>
              <span
                className={`${styles.chip} ${
                  repDone ? styles.chipOk : styles.chipWarn
                }`}
              >
                <i
                  className={
                    repDone
                      ? "fa-solid fa-circle-check"
                      : "fa-regular fa-clock"
                  }
                  aria-hidden="true"
                />
                {repDone ? "Completo" : "Pendiente"}
              </span>
            </div>
            <div className={`${styles.sectionBody} ${styles.grid}`}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="rep-nombre">
                  Nombre completo
                  <span className={styles.requiredMark}> *</span>
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
                  <span className={styles.requiredMark}> *</span>
                </label>
                <div className={styles.inputWithIcon}>
                  <i
                    className={`fa-regular fa-envelope ${styles.inputIcon}`}
                    aria-hidden="true"
                  />
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
                <p className={styles.hint}>
                  Aquí recibirá las notificaciones del proceso
                </p>
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="rep-tel">
                  Teléfono
                  <span className={styles.requiredMark}> *</span>
                </label>
                <div className={styles.telRow}>
                  <span className={styles.telPrefix}>RD +1</span>
                  <input
                    id="rep-tel"
                    className={styles.input}
                    value={representante.telefono}
                    onChange={(e) =>
                      setRepresentante((s) => ({
                        ...s,
                        telefono: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="rep-dir">
                  Dirección de residencia
                  <span className={styles.requiredMark}> *</span>
                </label>
                <input
                  id="rep-dir"
                  className={styles.input}
                  value={representante.direccion}
                  onChange={(e) =>
                    setRepresentante((s) => ({
                      ...s,
                      direccion: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
          </section>

          {/* 3 Cédula */}
          <section
            id="sec-cedula"
            className={`${styles.section} ${
              cedulaStats.done < cedulaStats.total ? styles.sectionFocus : ""
            }`}
          >
            <div className={styles.sectionHeader}>
              <div className={styles.sectionHeaderLeft}>
                <span
                  className={`${styles.sectionNum} ${
                    cedulaStats.done < cedulaStats.total
                      ? styles.sectionNumActive
                      : ""
                  }`}
                >
                  {numCedula}
                </span>
                <div>
                  <h2 className={styles.sectionTitle}>
                    Cédula del representante
                  </h2>
                  <p className={styles.sectionLead}>
                    Ambas caras por separado · Imagen o PDF · máx. 8 MB
                  </p>
                </div>
              </div>
              <span
                className={`${styles.chip} ${
                  cedulaStats.done === cedulaStats.total
                    ? styles.chipOk
                    : styles.chipWarn
                }`}
              >
                <i
                  className={
                    cedulaStats.done === cedulaStats.total
                      ? "fa-solid fa-circle-check"
                      : "fa-regular fa-clock"
                  }
                  aria-hidden="true"
                />
                {cedulaStats.done === cedulaStats.total
                  ? "Completo"
                  : `${cedulaStats.done} de ${cedulaStats.total}`}
              </span>
            </div>
            <div className={styles.sectionBody}>
              <div
                className={`${styles.uploadGrid} ${styles.uploadGridCedula}`}
              >
                {CEDULA_SLOTS.map((slot) =>
                  renderUploadSlot(slot, { icon: slot.icon }),
                )}
              </div>
              <p className={styles.tipRow}>
                <i className="fa-regular fa-lightbulb" aria-hidden="true" />
                Consejo: fotografíe sobre una superficie oscura, con buena luz y
                sin reflejos. Elimine el archivo actual antes de subir otro.
              </p>
            </div>
          </section>

          {/* 4 Facturas */}
          <section id="sec-facturas" className={styles.section}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionHeaderLeft}>
                <span className={styles.sectionNum}>{numFacturas}</span>
                <div>
                  <h2 className={styles.sectionTitle}>Facturas de muestra</h2>
                  <p className={styles.sectionLead}>
                    5 facturas recientes · Imagen o PDF · máx. 8 MB
                  </p>
                </div>
              </div>
              <span
                className={`${styles.chip} ${
                  facturaStats.done === facturaStats.total
                    ? styles.chipOk
                    : styles.chipWarn
                }`}
              >
                <i
                  className={
                    facturaStats.done === facturaStats.total
                      ? "fa-solid fa-circle-check"
                      : "fa-regular fa-clock"
                  }
                  aria-hidden="true"
                />
                {facturaStats.done === facturaStats.total
                  ? "Completo"
                  : `${facturaStats.done} de ${facturaStats.total}`}
              </span>
            </div>
            <div className={styles.sectionBody}>
              <div className={styles.fileProgress} aria-hidden="true">
                <div
                  className={styles.fileProgressFill}
                  style={{
                    width: `${(facturaStats.done / facturaStats.total) * 100}%`,
                  }}
                />
              </div>
              <div
                className={`${styles.uploadGrid} ${styles.uploadGridFacturas}`}
              >
                {FACTURA_SLOTS.map((slot) =>
                  renderUploadSlot(slot, { compact: true }),
                )}
              </div>
              <p className={styles.tipRow}>
                <i className="fa-solid fa-circle-info" aria-hidden="true" />
                Suba un archivo por casilla. Para reemplazar, elimine el actual
                primero.
              </p>
            </div>
          </section>

          {showRegistroMercantil ? (
            <section id="sec-registro" className={styles.section}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionHeaderLeft}>
                  <span className={styles.sectionNum}>{numRegistro}</span>
                  <div>
                    <h2 className={styles.sectionTitle}>Registro Mercantil</h2>
                    <p className={styles.sectionLead}>
                      Obligatorio para persona jurídica · Imagen o PDF
                    </p>
                  </div>
                </div>
                <span
                  className={`${styles.chip} ${
                    registroDone ? styles.chipOk : styles.chipWarn
                  }`}
                >
                  <i
                    className={
                      registroDone
                        ? "fa-solid fa-circle-check"
                        : "fa-regular fa-clock"
                    }
                    aria-hidden="true"
                  />
                  {registroDone ? "Subido" : "Pendiente"}
                </span>
              </div>
              <div className={styles.sectionBody}>
                {renderUploadSlot(REGISTRO_MERCANTIL_SLOT, {
                  icon: REGISTRO_MERCANTIL_SLOT.icon,
                })}
              </div>
            </section>
          ) : null}

          <div className={styles.pairGrid}>
            <section id="sec-logo" className={styles.section}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionHeaderLeft}>
                  <span className={styles.sectionNum}>{numLogo}</span>
                  <div>
                    <h2 className={styles.sectionTitle}>Logo</h2>
                    <p className={styles.sectionLead}>{LOGO_SLOT.hint}</p>
                  </div>
                </div>
                <span
                  className={`${styles.chip} ${
                    logoDone ? styles.chipOk : styles.chipWarn
                  }`}
                >
                  <i
                    className={
                      logoDone
                        ? "fa-solid fa-circle-check"
                        : "fa-regular fa-clock"
                    }
                    aria-hidden="true"
                  />
                  {logoDone ? "Subido" : "Pendiente"}
                </span>
              </div>
              <div className={styles.sectionBody}>
                {renderDoneFileCard(LOGO_SLOT)}
              </div>
            </section>

            <section id="sec-certificado" className={styles.section}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionHeaderLeft}>
                  <span className={styles.sectionNum}>{numCert}</span>
                  <div>
                    <h2 className={styles.sectionTitle}>Certificado digital</h2>
                    <p className={styles.sectionLead}>{P12_SLOT.hint}</p>
                  </div>
                </div>
                <span
                  className={`${styles.chip} ${
                    fields.certificadoP12 ? styles.chipOk : styles.chipWarn
                  }`}
                >
                  <i
                    className={
                      fields.certificadoP12
                        ? "fa-solid fa-circle-check"
                        : "fa-regular fa-clock"
                    }
                    aria-hidden="true"
                  />
                  {fields.certificadoP12 ? "Subido" : "Pendiente"}
                </span>
              </div>
              <div className={styles.sectionBody} style={{ display: "grid", gap: "1rem" }}>
                {renderDoneFileCard(P12_SLOT)}
                <div className={styles.field}>
                  <div className={styles.labelRow}>
                    <label className={styles.label} htmlFor="cert-pass">
                      Contraseña del certificado
                      <span className={styles.requiredMark}> *</span>
                    </label>
                    {intake?.secretsStatus?.certPassword ? (
                      <span className={styles.savedHint}>
                        <i className="fa-solid fa-lock" aria-hidden="true" />{" "}
                        Guardada
                      </span>
                    ) : null}
                  </div>
                  <div className={styles.pwWrap}>
                    <input
                      id="cert-pass"
                      type={showCertPass ? "text" : "password"}
                      className={styles.input}
                      value={secrets.certPassword}
                      onChange={(e) =>
                        setSecrets((s) => ({
                          ...s,
                          certPassword: e.target.value,
                        }))
                      }
                      placeholder={
                        intake?.secretsStatus?.certPassword
                          ? "•••••••• · escriba solo para reemplazar"
                          : ""
                      }
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className={styles.pwToggle}
                      onClick={() => setShowCertPass((v) => !v)}
                      aria-label={
                        showCertPass
                          ? "Ocultar contraseña"
                          : "Mostrar contraseña"
                      }
                    >
                      <i
                        className={
                          showCertPass
                            ? "fa-regular fa-eye-slash"
                            : "fa-regular fa-eye"
                        }
                        aria-hidden="true"
                      />
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <section id="sec-portal" className={styles.section}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionHeaderLeft}>
                <span className={styles.sectionNum}>{numPortal}</span>
                <div>
                  <h2 className={styles.sectionTitle}>
                    Acceso al portal de certificación e-CF
                  </h2>
                  <p className={styles.sectionLead}>
                    Credenciales del portal de certificación DGII
                  </p>
                </div>
              </div>
              <span
                className={`${styles.chip} ${
                  portalDone ? styles.chipOk : styles.chipWarn
                }`}
              >
                <i
                  className={
                    portalDone
                      ? "fa-solid fa-circle-check"
                      : "fa-regular fa-clock"
                  }
                  aria-hidden="true"
                />
                {portalDone ? "Completo" : "Pendiente"}
              </span>
            </div>
            <div className={`${styles.sectionBody} ${styles.grid}`}>
              <div className={styles.field}>
                <div className={styles.labelRow}>
                  <label className={styles.label} htmlFor="portal-rnc">
                    Usuario (RNC)
                    <span className={styles.requiredMark}> *</span>
                  </label>
                  {intake?.secretsStatus?.dgiiPortalRnc ? (
                    <span className={styles.savedHint}>
                      <i className="fa-solid fa-lock" aria-hidden="true" />{" "}
                      Guardado
                    </span>
                  ) : null}
                </div>
                <div className={styles.inputWithIcon}>
                  <i
                    className={`fa-regular fa-user ${styles.inputIcon}`}
                    aria-hidden="true"
                  />
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
                        ? "Escriba solo para reemplazar"
                        : ""
                    }
                    autoComplete="off"
                  />
                </div>
              </div>
              <div className={styles.field}>
                <div className={styles.labelRow}>
                  <label className={styles.label} htmlFor="portal-pass">
                    Contraseña del portal
                    <span className={styles.requiredMark}> *</span>
                  </label>
                  {intake?.secretsStatus?.dgiiPortalPassword ? (
                    <span className={styles.savedHint}>
                      <i className="fa-solid fa-lock" aria-hidden="true" />{" "}
                      Guardada
                    </span>
                  ) : null}
                </div>
                <div className={`${styles.inputWithIcon} ${styles.pwWrap}`}>
                  <i
                    className={`fa-solid fa-key ${styles.inputIcon}`}
                    aria-hidden="true"
                  />
                  <input
                    id="portal-pass"
                    type={showPortalPass ? "text" : "password"}
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
                        ? "•••••••• · escriba solo para reemplazar"
                        : ""
                    }
                    autoComplete="new-password"
                    style={{ paddingRight: "2.75rem" }}
                  />
                  <button
                    type="button"
                    className={styles.pwToggle}
                    onClick={() => setShowPortalPass((v) => !v)}
                    aria-label={
                      showPortalPass
                        ? "Ocultar contraseña"
                        : "Mostrar contraseña"
                    }
                  >
                    <i
                      className={
                        showPortalPass
                          ? "fa-regular fa-eye-slash"
                          : "fa-regular fa-eye"
                      }
                      aria-hidden="true"
                    />
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      <div className={styles.actionBar}>
        <div className={styles.actionBarInner}>
          <div className={styles.actionBarMeta}>
            <div className={styles.actionBarTrack} aria-hidden="true">
              <div
                className={styles.actionBarFill}
                style={{ width: `${completion.percent || 0}%` }}
              />
            </div>
            <p className={styles.actionBarText}>
              {pending === 0 ? (
                <>
                  <strong style={{ color: "var(--fi-success, #065f46)" }}>
                    Todo listo
                  </strong>{" "}
                  · ya puede enviar
                </>
              ) : (
                <>
                  <strong>
                    {pending} requerido{pending === 1 ? "" : "s"}
                  </strong>{" "}
                  pendiente{pending === 1 ? "" : "s"} para enviar
                </>
              )}
            </p>
          </div>
          <div className={styles.actionBarButtons}>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnGhost}`}
              disabled={saving || uploading}
              onClick={() => save()}
            >
              <i className="fa-regular fa-floppy-disk" aria-hidden="true" />
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
              Enviar a revisión{" "}
              <i className="fa-solid fa-arrow-right" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

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
