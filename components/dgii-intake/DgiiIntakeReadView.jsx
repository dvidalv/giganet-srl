"use client";

import { DGII_FILE_SLOTS } from "@/lib/dgiiIntake/fileSlots";
import { FIELD_LABELS } from "@/lib/dgiiIntake/labels";
import styles from "./DgiiIntakeReadView.module.css";

export function formatDate(d) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("es-DO", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
}

export function StatusChip({ status }) {
  if (status === "complete") {
    return <span className={`${styles.chip} ${styles.chipComplete}`}>Completo</span>;
  }
  if (status === "expired") {
    return <span className={`${styles.chip} ${styles.chipExpired}`}>Expirado</span>;
  }
  return (
    <span className={`${styles.chip} ${styles.chipProgress}`}>En progreso</span>
  );
}

function displayStatus(intake) {
  if (!intake) return "in_progress";
  const now = new Date();
  if (
    intake.status === "expired" ||
    (intake.expiresAt && new Date(intake.expiresAt) <= now)
  ) {
    return "expired";
  }
  if (intake.status === "complete") return "complete";
  return "in_progress";
}

function Field({ label, value }) {
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <span className={styles.fieldValue}>{value || "—"}</span>
    </div>
  );
}

/**
 * Shared read-only sections for admin detail + agent public page.
 * @param {{
 *   intake: object,
 *   onDownload: (slot: string) => void,
 *   busy?: boolean,
 *   headerExtra?: React.ReactNode,
 *   footer?: React.ReactNode,
 *   backHref?: string,
 *   backLabel?: string,
 *   eyebrow?: string,
 *   publicLayout?: boolean,
 * }} props
 */
export default function DgiiIntakeReadView({
  intake,
  onDownload,
  busy = false,
  headerExtra = null,
  footer = null,
  backHref,
  backLabel = "Volver",
  eyebrow = "Admisión DGII e-CF",
  publicLayout = false,
}) {
  const completion = intake?.completion || {};
  const percent = completion.percent ?? 0;
  const missing = completion.missing || [];
  const uiStatus = displayStatus(intake);

  return (
    <div
      className={`${styles.page}${publicLayout ? ` ${styles.pagePublic}` : ""}`}
    >
      <header className={styles.stickyHeader}>
        <div className={styles.headerInner}>
          <div className={styles.headerTop}>
            {backHref ? (
              <a href={backHref} className={styles.backLink}>
                ← {backLabel}
              </a>
            ) : (
              <span className={styles.eyebrow}>{eyebrow}</span>
            )}
            {headerExtra}
          </div>
          <div className={styles.headerMain}>
            <div className={styles.headerTitles}>
              <p className={styles.eyebrow}>{eyebrow}</p>
              <h1 className={styles.title}>
                {intake.clientName || intake.empresa?.nombre || "Sin nombre"}
              </h1>
              <p className={styles.subtitle}>
                {intake.clientEmail || "Sin email"}
              </p>
            </div>
            <div className={styles.headerMeta}>
              <StatusChip status={uiStatus} />
              <div className={styles.metaDates}>
                <span>Creado {formatDate(intake.createdAt)}</span>
                <span>Vence {formatDate(intake.expiresAt)}</span>
                {intake.completedAt ? (
                  <span>Completado {formatDate(intake.completedAt)}</span>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className={styles.content}>
        <section className={styles.card} aria-labelledby="dgii-resumen">
          <div className={styles.cardHead}>
            <h2 id="dgii-resumen" className={styles.cardTitle}>
              Resumen
            </h2>
            <span className={styles.percentBadge}>{percent}%</span>
          </div>
          <div className={styles.progressTrack} aria-hidden="true">
            <div
              className={styles.progressFill}
              style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
            />
          </div>
          <p className={styles.progressLabel}>
            {completion.completed ?? 0} de {completion.total ?? 0} campos
            completos
          </p>
          {missing.length ? (
            <ul className={styles.missingList}>
              {missing.map((k) => (
                <li key={k}>{FIELD_LABELS[k] || k}</li>
              ))}
            </ul>
          ) : (
            <p className={styles.okNote}>Sin campos pendientes.</p>
          )}
        </section>

        <section className={styles.card} aria-labelledby="dgii-empresa">
          <h2 id="dgii-empresa" className={styles.cardTitle}>
            Empresa
          </h2>
          <div className={styles.grid}>
            <Field label="RNC" value={intake.empresa?.rnc} />
            <Field label="Nombre" value={intake.empresa?.nombre} />
            <Field label="Razón social" value={intake.empresa?.razonSocial} />
            <Field label="Teléfono" value={intake.empresa?.telefono} />
            <Field label="Dirección" value={intake.empresa?.direccion} />
          </div>
        </section>

        <section className={styles.card} aria-labelledby="dgii-rep">
          <h2 id="dgii-rep" className={styles.cardTitle}>
            Representante legal
          </h2>
          <div className={styles.grid}>
            <Field label="Nombre" value={intake.representante?.nombre} />
            <Field label="Email" value={intake.representante?.email} />
            <Field label="Teléfono" value={intake.representante?.telefono} />
            <Field label="Dirección" value={intake.representante?.direccion} />
          </div>
        </section>

        <section className={styles.card} aria-labelledby="dgii-docs">
          <h2 id="dgii-docs" className={styles.cardTitle}>
            Documentos
          </h2>
          <div className={styles.docGrid}>
            {DGII_FILE_SLOTS.map(({ key, label }) => {
              const file = intake.files?.[key];
              const has = Boolean(file?.hasFile);
              return (
                <article
                  key={key}
                  className={`${styles.docCard} ${
                    has ? styles.docCardReady : styles.docCardPending
                  }`}
                >
                  <div className={styles.docBody}>
                    <h3 className={styles.docLabel}>{label}</h3>
                    <p className={styles.docName}>
                      {has
                        ? file.originalName || "Archivo subido"
                        : "Pendiente"}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnSecondary}`}
                    disabled={!has || busy}
                    onClick={() => onDownload(key)}
                  >
                    Descargar
                  </button>
                </article>
              );
            })}
          </div>
        </section>

        <section className={styles.card} aria-labelledby="dgii-secrets">
          <h2 id="dgii-secrets" className={styles.cardTitle}>
            Certificado / portal e-CF
          </h2>
          <p className={styles.secretsHint}>
            Solo se muestra si están configurados. Las contraseñas nunca se
            revelan.
          </p>
          <div className={styles.secretFlags}>
            <span
              className={
                intake.secretsStatus?.certPassword
                  ? styles.flagOk
                  : styles.flagPending
              }
            >
              Contraseña certificado:{" "}
              {intake.secretsStatus?.certPassword ? "configurada" : "pendiente"}
            </span>
            <span
              className={
                intake.secretsStatus?.dgiiPortalRnc
                  ? styles.flagOk
                  : styles.flagPending
              }
            >
              RNC portal DGII:{" "}
              {intake.secretsStatus?.dgiiPortalRnc ? "configurado" : "pendiente"}
            </span>
            <span
              className={
                intake.secretsStatus?.dgiiPortalPassword
                  ? styles.flagOk
                  : styles.flagPending
              }
            >
              Contraseña portal:{" "}
              {intake.secretsStatus?.dgiiPortalPassword
                ? "configurada"
                : "pendiente"}
            </span>
          </div>
        </section>

        {footer}
      </div>
    </div>
  );
}
