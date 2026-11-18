"use client";

import { useEffect, useState } from "react";
import styles from "./EncuestaPublishToggle.module.css";

/**
 * Toggle whether a responded survey may appear on the public homepage.
 * publishOnHome=false = "No publicar".
 */
export default function EncuestaPublishToggle({
  encuestaId,
  initialPublishOnHome = false,
  disabled = false,
  compact = false,
  onChanged,
}) {
  const [publishOnHome, setPublishOnHome] = useState(
    initialPublishOnHome === true
  );
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Only sync from props when switching to another encuesta (not on every parent render).
  useEffect(() => {
    setPublishOnHome(initialPublishOnHome === true);
    setError("");
  }, [encuestaId]); // eslint-disable-line react-hooks/exhaustive-deps -- intentional: ignore prop churn for same id

  const onToggle = async () => {
    if (disabled || isSaving) return;

    const prev = publishOnHome === true;
    const next = !prev;

    setPublishOnHome(next);
    setError("");
    setIsSaving(true);

    try {
      const res = await fetch(`/api/encuestas/${encuestaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publishOnHome: next }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setPublishOnHome(prev);
        setError(data.error || "No se pudo actualizar");
        return;
      }

      // Prefer the value we sent; only trust API if it returns an explicit boolean.
      const saved =
        typeof data.encuesta?.publishOnHome === "boolean"
          ? data.encuesta.publishOnHome
          : next;

      setPublishOnHome(saved === true);
      onChanged?.(encuestaId, saved === true);
    } catch {
      setPublishOnHome(prev);
      setError("Error de conexión");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={compact ? styles.wrapCompact : styles.wrap}>
      <button
        type="button"
        role="switch"
        aria-checked={publishOnHome}
        aria-label={
          publishOnHome
            ? "Publicado en inicio. Clic para no publicar"
            : "No publicado en inicio. Clic para publicar"
        }
        className={`${styles.switch} ${publishOnHome ? styles.on : styles.off}`}
        onClick={onToggle}
        disabled={disabled || isSaving}
      >
        <span className={styles.knob} />
      </button>
      <div className={styles.labels}>
        <span className={styles.status}>
          {publishOnHome ? "Publicado en inicio" : "No publicar en inicio"}
        </span>
        {!compact && (
          <span className={styles.hint}>
            {publishOnHome
              ? "Visible en «Qué opinan nuestros clientes» si hay comentario."
              : "Oculta este testimonio en la página de inicio."}
          </span>
        )}
        {error ? <span className={styles.error}>{error}</span> : null}
      </div>
    </div>
  );
}
