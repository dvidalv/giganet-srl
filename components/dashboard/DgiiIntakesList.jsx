"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./DgiiIntakesList.module.css";
import { FIELD_LABELS } from "@/lib/dgiiIntake/status";

const FILE_SLOTS = [
  { key: "cedulaFrente", label: "Cédula — anverso" },
  { key: "cedulaReverso", label: "Cédula — reverso" },
  { key: "factura1", label: "Factura 1" },
  { key: "factura2", label: "Factura 2" },
  { key: "factura3", label: "Factura 3" },
  { key: "factura4", label: "Factura 4" },
  { key: "factura5", label: "Factura 5" },
  { key: "certificadoP12", label: "Certificado P-12" },
];

function formatDate(d) {
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

function StatusChip({ status }) {
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

export default function DgiiIntakesList() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [busyId, setBusyId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [toast, setToast] = useState(null);
  const [revokeTarget, setRevokeTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
        status,
      });
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(`/api/dgii-intake/admin/list?${params}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Error al cargar");
        return;
      }
      setRows(data.intakes || []);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }, [page, search, status]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  async function runAction(id, action) {
    setBusyId(id);
    setToast(null);
    try {
      const res = await fetch(`/api/dgii-intake/admin/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setToast({ type: "err", text: data.error || "No se pudo completar la acción" });
        return;
      }
      setToast({ type: "ok", text: data.message || "Listo" });
      if (data.url && (action === "regenerate" || action === "resend")) {
        try {
          await navigator.clipboard.writeText(data.url);
          setToast({
            type: "ok",
            text: `${data.message || "Listo"} (enlace copiado)`,
          });
        } catch {
          /* ignore */
        }
      }
      await load();
      if (detail?.id === id) {
        openDetail(id);
      }
    } catch {
      setToast({ type: "err", text: "Error de conexión" });
    } finally {
      setBusyId(null);
    }
  }

  async function openDetail(id) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/dgii-intake/admin/${id}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setToast({ type: "err", text: data.error || "No se pudo abrir" });
        return;
      }
      setDetail(data.intake);
    } catch {
      setToast({ type: "err", text: "Error de conexión" });
    } finally {
      setBusyId(null);
    }
  }

  async function downloadFile(id, slot) {
    setBusyId(id);
    try {
      const res = await fetch(
        `/api/dgii-intake/admin/${id}/download?slot=${encodeURIComponent(slot)}`
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
      setBusyId(null);
    }
  }

  return (
    <div className={styles.wrapper}>
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

      <div className={styles.toolbar}>
        <input
          className={styles.searchInput}
          type="search"
          placeholder="Buscar por nombre, email o RNC…"
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
          aria-label="Buscar intakes DGII"
        />
        <select
          className={styles.select}
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value);
          }}
          aria-label="Filtrar por estado"
        >
          <option value="all">Todos</option>
          <option value="in_progress">En progreso</option>
          <option value="complete">Completo</option>
          <option value="expired">Expirado</option>
        </select>
      </div>

      {loading ? (
        <div className={styles.loading}>Cargando formularios DGII…</div>
      ) : error ? (
        <div className={styles.error}>{error}</div>
      ) : rows.length === 0 ? (
        <p className={styles.empty}>
          Aún no hay formularios de admisión DGII. Se crean al agregar un
          usuario cliente.
        </p>
      ) : (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>RNC</th>
                  <th>Estado</th>
                  <th>Creado</th>
                  <th>Vence</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div className={styles.clientName}>{row.clientName}</div>
                      {row.clientEmail ? (
                        <div className={styles.muted}>{row.clientEmail}</div>
                      ) : null}
                      <div className={styles.muted}>
                        {row.completion?.completed}/{row.completion?.total} campos
                      </div>
                    </td>
                    <td>{row.rnc || "—"}</td>
                    <td>
                      <StatusChip status={row.status} />
                    </td>
                    <td>{formatDate(row.createdAt)}</td>
                    <td>{formatDate(row.expiresAt)}</td>
                    <td>
                      <div className={styles.actions}>
                        <button
                          type="button"
                          className={`${styles.btn} ${styles.btnPrimary}`}
                          disabled={busyId === row.id}
                          onClick={() => openDetail(row.id)}
                        >
                          Ver
                        </button>
                        <button
                          type="button"
                          className={styles.btn}
                          disabled={busyId === row.id}
                          onClick={() => runAction(row.id, "regenerate")}
                        >
                          Regenerar
                        </button>
                        <button
                          type="button"
                          className={styles.btn}
                          disabled={busyId === row.id || !row.clientEmail}
                          onClick={() => runAction(row.id, "resend")}
                        >
                          Reenviar
                        </button>
                        <button
                          type="button"
                          className={`${styles.btn} ${styles.btnDanger}`}
                          disabled={busyId === row.id || row.status === "expired"}
                          onClick={() => setRevokeTarget(row.id)}
                        >
                          Revocar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.pagination}>
            <span>
              {total} registro{total === 1 ? "" : "s"} · Página {page} de{" "}
              {totalPages}
            </span>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.btn}
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </button>
              <button
                type="button"
                className={styles.btn}
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Siguiente
              </button>
            </div>
          </div>
        </>
      )}

      {detail ? (
        <div
          className={styles.overlay}
          onClick={() => setDetail(null)}
          role="presentation"
        >
          <div
            className={styles.modal}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dgii-detail-title"
          >
            <div className={styles.modalHeader}>
              <div>
                <h2 id="dgii-detail-title">{detail.clientName || "Detalle DGII"}</h2>
                <p className={styles.muted} style={{ margin: "0.35rem 0 0" }}>
                  {detail.clientEmail || "Sin email"} ·{" "}
                  <StatusChip
                    status={
                      detail.status === "complete"
                        ? "complete"
                        : detail.status === "expired"
                          ? "expired"
                          : "in_progress"
                    }
                  />
                </p>
              </div>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setDetail(null)}
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>

            <div className={styles.section}>
              <h3>Enlace</h3>
              <div className={styles.linkBox}>{detail.url}</div>
            </div>

            <div className={styles.section}>
              <h3>Empresa</h3>
              <div className={styles.grid}>
                <div>
                  <span className={styles.label}>RNC</span>
                  <span className={styles.value}>{detail.empresa?.rnc || "—"}</span>
                </div>
                <div>
                  <span className={styles.label}>Nombre</span>
                  <span className={styles.value}>
                    {detail.empresa?.nombre || "—"}
                  </span>
                </div>
                <div>
                  <span className={styles.label}>Razón social</span>
                  <span className={styles.value}>
                    {detail.empresa?.razonSocial || "—"}
                  </span>
                </div>
                <div>
                  <span className={styles.label}>Teléfono</span>
                  <span className={styles.value}>
                    {detail.empresa?.telefono || "—"}
                  </span>
                </div>
                <div>
                  <span className={styles.label}>Dirección</span>
                  <span className={styles.value}>
                    {detail.empresa?.direccion || "—"}
                  </span>
                </div>
              </div>
            </div>

            <div className={styles.section}>
              <h3>Representante legal</h3>
              <div className={styles.grid}>
                <div>
                  <span className={styles.label}>Nombre</span>
                  <span className={styles.value}>
                    {detail.representante?.nombre || "—"}
                  </span>
                </div>
                <div>
                  <span className={styles.label}>Email</span>
                  <span className={styles.value}>
                    {detail.representante?.email || "—"}
                  </span>
                </div>
                <div>
                  <span className={styles.label}>Teléfono</span>
                  <span className={styles.value}>
                    {detail.representante?.telefono || "—"}
                  </span>
                </div>
                <div>
                  <span className={styles.label}>Dirección</span>
                  <span className={styles.value}>
                    {detail.representante?.direccion || "—"}
                  </span>
                </div>
              </div>
            </div>

            <div className={styles.section}>
              <h3>Archivos</h3>
              {FILE_SLOTS.map(({ key, label }) => {
                const file = detail.files?.[key];
                return (
                  <div key={key} className={styles.fileRow}>
                    <span>
                      {label}
                      {file?.hasFile ? (
                        <span className={styles.muted}>
                          {" "}
                          · {file.originalName || "subido"}
                        </span>
                      ) : (
                        <span className={styles.muted}> · pendiente</span>
                      )}
                    </span>
                    <button
                      type="button"
                      className={styles.btn}
                      disabled={!file?.hasFile || busyId === detail.id}
                      onClick={() => downloadFile(detail.id, key)}
                    >
                      Descargar
                    </button>
                  </div>
                );
              })}
            </div>

            <div className={styles.section}>
              <h3>Credenciales (cifradas)</h3>
              <p className={styles.muted} style={{ margin: 0 }}>
                Cert. password:{" "}
                {detail.secretsStatus?.certPassword ? "guardada" : "pendiente"} ·
                Portal RNC:{" "}
                {detail.secretsStatus?.dgiiPortalRnc ? "guardado" : "pendiente"} ·
                Portal password:{" "}
                {detail.secretsStatus?.dgiiPortalPassword
                  ? "guardada"
                  : "pendiente"}
              </p>
            </div>

            <div className={styles.section}>
              <h3>Progreso</h3>
              <p className={styles.value} style={{ margin: "0 0 0.5rem" }}>
                {detail.completion?.completed}/{detail.completion?.total} (
                {detail.completion?.percent}%)
              </p>
              {detail.completion?.missing?.length ? (
                <ul className={styles.muted}>
                  {detail.completion.missing.map((k) => (
                    <li key={k}>{FIELD_LABELS[k] || k}</li>
                  ))}
                </ul>
              ) : (
                <p className={styles.muted}>Sin campos pendientes.</p>
              )}
            </div>

            <div className={styles.actions}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                disabled={busyId === detail.id}
                onClick={() => runAction(detail.id, "regenerate")}
              >
                Regenerar enlace
              </button>
              <button
                type="button"
                className={styles.btn}
                disabled={busyId === detail.id || !detail.clientEmail}
                onClick={() => runAction(detail.id, "resend")}
              >
                Reenviar por email
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnDanger}`}
                disabled={busyId === detail.id || detail.status === "expired"}
                onClick={() => setRevokeTarget(detail.id)}
              >
                Revocar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {revokeTarget ? (
        <div
          className={styles.overlay}
          onClick={() => setRevokeTarget(null)}
          role="presentation"
        >
          <div
            className={styles.modal}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dgii-revoke-title"
          >
            <div className={styles.modalHeader}>
              <h2 id="dgii-revoke-title">Revocar enlace</h2>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setRevokeTarget(null)}
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>
            <p style={{ margin: "0 0 1rem", color: "#cbd5e1" }}>
              ¿Revocar este enlace? El cliente ya no podrá usarlo.
            </p>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.btn}
                onClick={() => setRevokeTarget(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnDanger}`}
                disabled={busyId === revokeTarget}
                onClick={async () => {
                  const id = revokeTarget;
                  setRevokeTarget(null);
                  await runAction(id, "revoke");
                }}
              >
                Sí, revocar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
