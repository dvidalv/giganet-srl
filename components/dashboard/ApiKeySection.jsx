"use client";
import { useState, useEffect, useCallback } from "react";
import styles from "./ApiKeySection.module.css";

function getApiBase() {
  if (typeof window === "undefined")
    return "/api/comprobantes/solicitar-numero";
  return `${window.location.origin}/api/comprobantes/solicitar-numero`;
}

export default function ApiKeySection() {
  const [configured, setConfigured] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newKey, setNewKey] = useState(null);
  const [regenerating, setRegenerating] = useState(false);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/users/me/api-key");
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Error al cargar estado");
        setConfigured(false);
        return;
      }
      setConfigured(Boolean(json.configured));
    } catch (err) {
      setError("Error de conexión");
      setConfigured(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleGenerate = async () => {
    setRegenerating(true);
    setError(null);
    setNewKey(null);
    try {
      const res = await fetch("/api/users/me/api-key", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Error al generar API Key");
        return;
      }
      setNewKey(json.apiKey ?? null);
      setConfigured(true);
    } catch (err) {
      setError("Error de conexión");
    } finally {
      setRegenerating(false);
    }
  };

  const copyKey = useCallback(() => {
    if (!newKey) return;
    navigator.clipboard.writeText(newKey).then(() => {
      alert("API Key copiada al portapapeles.");
    });
  }, [newKey]);

  if (loading) {
    return (
      <div className={styles.wrapper}>
        <p className={styles.loading}>Cargando…</p>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.card}>
        <div
          className={`${styles.status} ${
            configured ? styles.statusConfigured : styles.statusNotConfigured
          }`}>
          {configured ? "API Key configurada" : "Sin API Key configurada"}
        </div>
        <button
          type="button"
          className={styles.btn}
          onClick={handleGenerate}
          disabled={regenerating}>
          {regenerating
            ? "Generando…"
            : configured
            ? "Regenerar API Key"
            : "Generar API Key"}
        </button>
        {newKey && (
          <>
            <div className={styles.keyBlock}>
              <div className={styles.keyBlockLabel}>
                Tu API Key (cópiala ahora):
              </div>
              <code>{newKey}</code>
              <button
                type="button"
                className={styles.copyBtn}
                onClick={copyKey}>
                Copiar
              </button>
            </div>
            <div className={styles.warning}>
              Esta clave solo se muestra una vez. Guárdala en un lugar seguro;
              no podrás verla de nuevo desde aquí.
            </div>
          </>
        )}
      </div>

      <div className={`${styles.card} ${styles.instructions}`}>
        <h3>Uso desde tu sistema</h3>
        <p>
          Envía una petición <strong>POST</strong> al endpoint de solicitud de
          número con la API Key en cabecera y el RNC y tipo de comprobante en el
          cuerpo:
        </p>
        <pre>{`POST ${getApiBase()}
Authorization: Bearer TU_API_KEY
Content-Type: application/json

{
  "rnc": "123456789",
  "tipo_comprobante": "32"
}`}</pre>
        <p>
          <strong>tipo_comprobante</strong> puede ser: 31, 32, 33, 34, 41, 43,
          44, 45.
        </p>
        <p>
          Opcional: <code>solo_preview: true</code> en el cuerpo para obtener el
          próximo número sin consumirlo.
        </p>
      </div>
    </div>
  );
}
