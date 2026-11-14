"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DgiiIntakeReadView, {
  formatDate,
} from "@/components/dgii-intake/DgiiIntakeReadView";
import { normalizeRnc } from "@/lib/dgiiIntake/normalizeRnc";
import styles from "@/components/dgii-intake/DgiiIntakeReadView.module.css";

export default function DgiiIntakeDetailAdmin({ intakeId }) {
  const router = useRouter();
  const [intake, setIntake] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  const [sendOpen, setSendOpen] = useState(false);
  const [sendEmail, setSendEmail] = useState("");
  const [sendError, setSendError] = useState("");

  const [revokeClientOpen, setRevokeClientOpen] = useState(false);
  const [revokeAgentOpen, setRevokeAgentOpen] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteRnc, setDeleteRnc] = useState("");
  const [deleteError, setDeleteError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/dgii-intake/admin/${intakeId}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No se pudo cargar");
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
  }, [intakeId]);

  useEffect(() => {
    load();
  }, [load]);

  async function copyText(text) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  async function runClientAction(action) {
    setBusy(true);
    setToast(null);
    try {
      const res = await fetch(`/api/dgii-intake/admin/${intakeId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setToast({ type: "err", text: data.error || "No se pudo completar" });
        return;
      }
      if (data.intake) setIntake(data.intake);
      else await load();
      let text = data.message || "Listo";
      if (data.url && (action === "regenerate" || action === "resend")) {
        const copied = await copyText(data.url);
        if (copied) text = `${text} (enlace copiado)`;
      }
      setToast({ type: "ok", text });
    } catch {
      setToast({ type: "err", text: "Error de conexión" });
    } finally {
      setBusy(false);
    }
  }

  async function downloadFile(slot, mode = "view") {
    setBusy(true);
    try {
      const disposition = mode === "download" ? "attachment" : "inline";
      const res = await fetch(
        `/api/dgii-intake/admin/${intakeId}/download?slot=${encodeURIComponent(
          slot
        )}&disposition=${disposition}`
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setToast({ type: "err", text: data.error || "Descarga no disponible" });
        return;
      }
      if (mode === "download") {
        const a = document.createElement("a");
        a.href = data.url;
        a.download = data.originalName || slot;
        a.rel = "noopener noreferrer";
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else {
        window.open(data.url, "_blank", "noopener,noreferrer");
      }
    } catch {
      setToast({ type: "err", text: "Error al descargar" });
    } finally {
      setBusy(false);
    }
  }

  async function downloadAllFiles() {
    setBusy(true);
    setToast(null);
    try {
      const res = await fetch(
        `/api/dgii-intake/admin/${intakeId}/download-all`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setToast({
          type: "err",
          text: data.error || "No se pudo generar el ZIP",
        });
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") || "";
      const match = /filename="([^"]+)"/i.exec(cd);
      const filename = match?.[1] || "admision-documentos.zip";
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      setToast({ type: "err", text: "Error al descargar el ZIP" });
    } finally {
      setBusy(false);
    }
  }

  async function submitSendAgent(e) {
    e.preventDefault();
    const email = sendEmail.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setSendError("Indique un correo válido");
      return;
    }
    setBusy(true);
    setSendError("");
    setToast(null);
    try {
      const res = await fetch(`/api/dgii-intake/admin/${intakeId}/send-agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSendError(data.error || "No se pudo enviar");
        return;
      }
      if (data.intake) setIntake(data.intake);
      setSendOpen(false);
      setSendEmail("");
      if (data.agentUrl) await copyText(data.agentUrl);
      setToast({
        type: data.warning ? "warn" : "ok",
        text:
          data.warning ||
          data.message ||
          "Enlace de agente generado (copiado)",
      });
    } catch {
      setSendError("Error de conexión");
    } finally {
      setBusy(false);
    }
  }

  async function revokeAgent() {
    setBusy(true);
    setToast(null);
    try {
      const res = await fetch(
        `/api/dgii-intake/admin/${intakeId}/revoke-agent`,
        { method: "POST" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setToast({ type: "err", text: data.error || "No se pudo revocar" });
        return;
      }
      if (data.intake) setIntake(data.intake);
      setRevokeAgentOpen(false);
      setToast({ type: "ok", text: data.message || "Agente revocado" });
    } catch {
      setToast({ type: "err", text: "Error de conexión" });
    } finally {
      setBusy(false);
    }
  }

  const storedRnc = intake?.empresa?.rnc || "";
  const rncMatches =
    Boolean(normalizeRnc(storedRnc)) &&
    normalizeRnc(deleteRnc) === normalizeRnc(storedRnc);

  async function submitDelete(e) {
    e.preventDefault();
    if (!rncMatches) {
      setDeleteError(
        "El RNC no coincide. Escriba el RNC de la empresa (con o sin guiones)."
      );
      return;
    }
    setBusy(true);
    setDeleteError("");
    setToast(null);
    try {
      const res = await fetch(`/api/dgii-intake/admin/${intakeId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rnc: deleteRnc }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDeleteError(data.error || "No se pudo eliminar");
        return;
      }
      router.push("/dashboard/dgii-intakes");
      router.refresh();
    } catch {
      setDeleteError("Error de conexión");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className={styles.loading}>Cargando ficha DGII…</div>;
  }

  if (error || !intake) {
    return (
      <div className={styles.stateCard}>
        <h1>No disponible</h1>
        <p>{error || "Formulario no encontrado"}</p>
        <div className={styles.actions} style={{ justifyContent: "center" }}>
          <a href="/dashboard/dgii-intakes" className={`${styles.btn} ${styles.btnPrimary}`}>
            Volver al listado
          </a>
        </div>
      </div>
    );
  }

  const enlaceFooter = (
    <>
      {toast ? (
        <div
          className={`${styles.toast} ${
            toast.type === "ok"
              ? styles.toastOk
              : toast.type === "warn"
                ? styles.toastWarn
                : styles.toastErr
          }`}
          role="status"
        >
          {toast.text}
        </div>
      ) : null}

      <section className={styles.card} aria-labelledby="dgii-client-link">
        <h2 id="dgii-client-link" className={styles.cardTitle}>
          Enlace del cliente
        </h2>
        <p className={styles.sectionLead}>
          Formulario público del cliente (independiente del enlace de agente).
        </p>
        <div className={styles.linkBox}>{intake.url || "—"}</div>
        <p className={styles.muted} style={{ marginTop: "0.65rem" }}>
          Vence {formatDate(intake.expiresAt)}
        </p>
        <div className={styles.actions}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            disabled={busy}
            onClick={() => runClientAction("regenerate")}
          >
            Regenerar
          </button>
          <button
            type="button"
            className={styles.btn}
            disabled={busy || !intake.clientEmail}
            onClick={() => runClientAction("resend")}
          >
            Reenviar
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnDanger}`}
            disabled={busy || intake.status === "expired"}
            onClick={() => setRevokeClientOpen(true)}
          >
            Revocar
          </button>
        </div>
      </section>

      <section className={styles.card} aria-labelledby="dgii-agent-link">
        <h2 id="dgii-agent-link" className={styles.cardTitle}>
          Enlace The Factory (agente)
        </h2>
        <p className={styles.sectionLead}>
          Acceso de solo lectura por 30 días. Token propio — no se afecta al
          regenerar o revocar el enlace del cliente.
        </p>
        {intake.agentActive && intake.agentUrl ? (
          <>
            <div className={styles.linkBox}>{intake.agentUrl}</div>
            <p className={styles.muted} style={{ marginTop: "0.65rem" }}>
              {intake.agentEmail ? `Enviado a ${intake.agentEmail} · ` : null}
              Vence {formatDate(intake.agentExpiresAt)}
              {intake.agentSentAt
                ? ` · Enviado ${formatDate(intake.agentSentAt)}`
                : null}
            </p>
          </>
        ) : (
          <p className={styles.muted} style={{ margin: 0 }}>
            Aún no hay enlace de agente activo.
          </p>
        )}
        <div className={styles.actions}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            disabled={busy}
            onClick={() => {
              setSendEmail(intake.agentEmail || "");
              setSendError("");
              setSendOpen(true);
            }}
          >
            {intake.agentActive ? "Regenerar / reenviar" : "Enviar"}
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnDanger}`}
            disabled={busy || !intake.agentActive}
            onClick={() => setRevokeAgentOpen(true)}
          >
            Revocar agente
          </button>
        </div>
      </section>

      <section className={styles.card} aria-labelledby="dgii-danger">
        <h2 id="dgii-danger" className={styles.cardTitle}>
          Zona de peligro
        </h2>
        <p className={styles.sectionLead}>
          Elimina permanentemente este formulario y sus archivos. Debe confirmar
          con el RNC de la empresa.
        </p>
        <div className={styles.actions}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnDanger}`}
            disabled={busy}
            onClick={() => {
              setDeleteRnc("");
              setDeleteError("");
              setDeleteOpen(true);
            }}
          >
            Eliminar
          </button>
        </div>
      </section>
    </>
  );

  return (
    <>
      <DgiiIntakeReadView
        intake={intake}
        onDownload={downloadFile}
        onDownloadAll={downloadAllFiles}
        busy={busy}
        backHref="/dashboard/dgii-intakes"
        backLabel="Volver al listado"
        eyebrow="Admisión DGII e-CF"
        footer={enlaceFooter}
      />

      {sendOpen ? (
        <div
          className={styles.overlay}
          onClick={() => !busy && setSendOpen(false)}
          role="presentation"
        >
          <div
            className={styles.modal}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dgii-send-agent-title"
          >
            <div className={styles.modalHeader}>
              <h2 id="dgii-send-agent-title">Enviar a The Factory</h2>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => !busy && setSendOpen(false)}
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>
            <p className={styles.modalBodyText}>
              Se generará un enlace de agente válido 30 días y se enviará por
              correo.
            </p>
            <form onSubmit={submitSendAgent}>
              <label className={styles.confirmField}>
                <span>Correo del agente</span>
                <input
                  className={styles.confirmInput}
                  type="email"
                  value={sendEmail}
                  onChange={(e) => setSendEmail(e.target.value)}
                  autoComplete="email"
                  autoFocus
                  disabled={busy}
                  placeholder="agente@ejemplo.com"
                />
              </label>
              {sendError ? (
                <p className={styles.confirmError}>{sendError}</p>
              ) : null}
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.btn}
                  disabled={busy}
                  onClick={() => setSendOpen(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  disabled={busy || !sendEmail.trim()}
                >
                  {busy ? "Enviando…" : "Enviar enlace"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {revokeClientOpen ? (
        <div
          className={styles.overlay}
          onClick={() => !busy && setRevokeClientOpen(false)}
          role="presentation"
        >
          <div
            className={styles.modal}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dgii-revoke-client-title"
          >
            <div className={styles.modalHeader}>
              <h2 id="dgii-revoke-client-title">Revocar enlace del cliente</h2>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => !busy && setRevokeClientOpen(false)}
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>
            <p className={styles.modalBodyText}>
              El cliente ya no podrá usar este enlace. El enlace de agente no se
              modifica.
            </p>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.btn}
                disabled={busy}
                onClick={() => setRevokeClientOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnDanger}`}
                disabled={busy}
                onClick={async () => {
                  setRevokeClientOpen(false);
                  await runClientAction("revoke");
                }}
              >
                Sí, revocar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {revokeAgentOpen ? (
        <div
          className={styles.overlay}
          onClick={() => !busy && setRevokeAgentOpen(false)}
          role="presentation"
        >
          <div
            className={styles.modal}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dgii-revoke-agent-title"
          >
            <div className={styles.modalHeader}>
              <h2 id="dgii-revoke-agent-title">Revocar enlace de agente</h2>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => !busy && setRevokeAgentOpen(false)}
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>
            <p className={styles.modalBodyText}>
              The Factory ya no podrá abrir esta ficha. El enlace del cliente no
              se modifica.
            </p>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.btn}
                disabled={busy}
                onClick={() => setRevokeAgentOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnDanger}`}
                disabled={busy}
                onClick={revokeAgent}
              >
                Sí, revocar agente
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteOpen ? (
        <div
          className={styles.overlay}
          onClick={() => !busy && setDeleteOpen(false)}
          role="presentation"
        >
          <div
            className={styles.modal}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dgii-delete-title"
          >
            <div className={styles.modalHeader}>
              <h2 id="dgii-delete-title">Eliminar formulario</h2>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => !busy && setDeleteOpen(false)}
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>
            <p className={styles.modalBodyText}>
              Esta acción no se puede deshacer. Escriba el RNC de la empresa
              {storedRnc ? (
                <>
                  {" "}
                  (<strong>{storedRnc}</strong>)
                </>
              ) : null}{" "}
              para confirmar. Se aceptan guiones o solo dígitos.
            </p>
            <form onSubmit={submitDelete}>
              <label className={styles.confirmField}>
                <span>RNC de la empresa</span>
                <input
                  className={styles.confirmInput}
                  value={deleteRnc}
                  onChange={(e) => {
                    setDeleteRnc(e.target.value);
                    setDeleteError("");
                  }}
                  autoComplete="off"
                  autoFocus
                  disabled={busy || !storedRnc}
                  placeholder="123-45678-9 o 123456789"
                />
              </label>
              {deleteError ? (
                <p className={styles.confirmError}>{deleteError}</p>
              ) : null}
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.btn}
                  disabled={busy}
                  onClick={() => setDeleteOpen(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={`${styles.btn} ${styles.btnDanger}`}
                  disabled={busy || !rncMatches}
                >
                  {busy ? "Eliminando…" : "Eliminar definitivamente"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
