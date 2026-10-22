"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./EmpresaAdminForm.module.css";

export default function EmpresaAdminApiKey({ userId }) {
  const [configured, setConfigured] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newKey, setNewKey] = useState(null);
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const cargar = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/users/${userId}/api-key`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "No se pudo consultar la API key");
        setConfigured(false);
        return;
      }
      setConfigured(Boolean(json.configured));
    } catch {
      setError("Error de conexión");
      setConfigured(false);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const generar = async () => {
    setGenerating(true);
    setError(null);
    setCopied(false);
    try {
      const res = await fetch(`/api/users/${userId}/api-key`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "No se pudo generar la API key");
        return;
      }
      setNewKey(json.apiKey || null);
      setConfigured(true);
      setConfirming(false);
    } catch {
      setError("Error de conexión");
    } finally {
      setGenerating(false);
    }
  };

  const copiar = async () => {
    if (!newKey) return;
    try {
      await navigator.clipboard.writeText(newKey);
      setCopied(true);
    } catch {
      setError("No se pudo copiar. Seleccione la clave y cópiela manualmente.");
    }
  };

  return (
    <section className={styles.compSection} aria-labelledby="api-key-empresa">
      <div className={styles.compHeader}>
        <div>
          <h2 id="api-key-empresa" className={styles.compTitle}>
            API key
          </h2>
          <p className={styles.compSubtitle}>
            Clave para que el sistema de esta empresa solicite números de comprobante. No se vuelve
            a mostrar después de generarla.
          </p>
        </div>
      </div>

      {loading ? (
        <p className={styles.compEmpty}>Cargando API key…</p>
      ) : (
        <>
          <p className={styles.compSubtitle} style={{ marginBottom: "0.85rem" }}>
            {configured ? "Esta empresa ya tiene una API key." : "Esta empresa aún no tiene API key."}
          </p>
          {error && (
            <p className={styles.compMsgError} role="alert">
              {error}
            </p>
          )}
          <button
            type="button"
            className={configured ? styles.compBtnDanger : styles.compBtnPrimary}
            onClick={() => (configured ? setConfirming(true) : generar())}
            disabled={generating}
          >
            {generating ? "Generando…" : configured ? "Regenerar API key" : "Generar API key"}
          </button>
          {newKey && (
            <div className={styles.apiKeyBox} role="status">
              <p className={styles.compAjustarLabel}>API key (cópiela ahora)</p>
              <code className={styles.apiKeyValue}>{newKey}</code>
              <button type="button" className={styles.compBtn} onClick={copiar}>
                {copied ? "Copiada" : "Copiar"}
              </button>
              <p className={styles.compAjustarWarn}>
                Esta clave solo se muestra una vez. Guárdela en un lugar seguro; no podrá verla de
                nuevo. Si la regenera, la anterior deja de funcionar.
              </p>
            </div>
          )}
        </>
      )}

      {confirming && (
        <div
          className={styles.compModalOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="api-key-confirm-title"
          onKeyDown={(e) => e.key === "Escape" && !generating && setConfirming(false)}
        >
          <div className={styles.compModalContent}>
            <h3 id="api-key-confirm-title" className={styles.compModalTitle}>
              Regenerar API key
            </h3>
            <p className={styles.compModalMessage}>
              La clave actual de esta empresa dejará de funcionar en cuanto genere la nueva.
              Actualice el sistema que la usa con la clave que se mostrará a continuación.
            </p>
            <div className={styles.compModalActions}>
              <button
                type="button"
                className={styles.compBtn}
                onClick={() => setConfirming(false)}
                disabled={generating}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={styles.compBtnDanger}
                onClick={generar}
                disabled={generating}
              >
                {generating ? "Generando…" : "Regenerar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
