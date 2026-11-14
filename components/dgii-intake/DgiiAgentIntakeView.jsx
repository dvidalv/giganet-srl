"use client";

import { useCallback, useEffect, useState } from "react";
import DgiiIntakeReadView, {
  formatDate,
} from "@/components/dgii-intake/DgiiIntakeReadView";
import styles from "@/components/dgii-intake/DgiiIntakeReadView.module.css";

export default function DgiiAgentIntakeView({ agentToken }) {
  const [intake, setIntake] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expired, setExpired] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  const load = useCallback(async () => {
    if (!agentToken || agentToken.length < 32) {
      setLoading(false);
      setExpired(false);
      setError("Enlace no válido");
      setIntake(null);
      return;
    }

    setLoading(true);
    setError(null);
    setExpired(false);
    try {
      const res = await fetch(`/api/dgii-intake/agent/${encodeURIComponent(agentToken)}`);
      const data = await res.json().catch(() => ({}));
      if (res.status === 410) {
        setExpired(true);
        setError(
          data.error ||
            "Este enlace de agente ha expirado. Solicite uno nuevo al administrador."
        );
        setIntake(null);
        return;
      }
      if (!res.ok) {
        setError(data.error || "Enlace no válido");
        setIntake(null);
        return;
      }
      setIntake(data.intake);
    } catch {
      setError("Error de conexión");
      setIntake(null);
    } finally {
      setLoading(false);
    }
  }, [agentToken]);

  useEffect(() => {
    load();
  }, [load]);

  async function downloadFile(slot) {
    setBusy(true);
    setToast(null);
    try {
      const res = await fetch(
        `/api/dgii-intake/agent/${agentToken}/download?slot=${encodeURIComponent(slot)}`
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setToast({ type: "err", text: data.error || "Descarga no disponible" });
        return;
      }
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch {
      setToast({ type: "err", text: "Error al descargar" });
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>Cargando ficha DGII…</div>
      </div>
    );
  }

  if (error || !intake) {
    return (
      <div className={styles.page}>
        <div className={styles.stateCard}>
          <h1>{expired ? "Enlace expirado" : "Enlace no válido"}</h1>
          <p>
            {error ||
              "Este enlace de agente no está disponible. Solicite uno nuevo a Giganet."}
          </p>
        </div>
      </div>
    );
  }

  const footer = (
    <>
      {toast ? (
        <div
          className={`${styles.toast} ${
            toast.type === "ok" ? styles.toastOk : styles.toastErr
          }`}
          role="status"
        >
          {toast.text}
        </div>
      ) : null}
      <section className={styles.card} aria-labelledby="dgii-agent-meta">
        <h2 id="dgii-agent-meta" className={styles.cardTitle}>
          Acceso de agente
        </h2>
        <p className={styles.sectionLead}>
          Vista de solo lectura para The Factory. No requiere inicio de sesión.
        </p>
        <p className={styles.muted} style={{ margin: 0 }}>
          Acceso válido hasta {formatDate(intake.agentExpiresAt)}
          {intake.agentEmail ? ` · Destinatario: ${intake.agentEmail}` : null}
        </p>
      </section>
    </>
  );

  return (
    <DgiiIntakeReadView
      intake={intake}
      onDownload={downloadFile}
      busy={busy}
      eyebrow="The Factory · Admisión DGII"
      footer={footer}
    />
  );
}
