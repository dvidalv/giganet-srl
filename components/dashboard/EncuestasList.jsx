"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import EncuestaPublishToggle from "@/components/dashboard/EncuestaPublishToggle";
import EncuestaSendForm from "@/components/dashboard/EncuestaSendForm";
import styles from "./EncuestasList.module.css";

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

function displayName(row) {
  const recipient = row.recipient || {};
  const emp = row.empresa || {};
  if (row.standalone) {
    return (
      recipient.name ||
      recipient.organization ||
      emp.nombre ||
      emp.razonSocial ||
      recipient.email ||
      "Destinatario"
    );
  }
  return emp.razonSocial || emp.nombre || recipient.name || "—";
}

function StatusChip({ status }) {
  const map = {
    pending: { label: "Pendiente", className: styles.chipPending },
    responded: { label: "Respondida", className: styles.chipResponded },
    expired: { label: "Expirada", className: styles.chipExpired },
  };
  const m = map[status] || map.pending;
  return (
    <span className={`${styles.chip} ${m.className}`}>{m.label}</span>
  );
}

export default function EncuestasList() {
  const [encuestas, setEncuestas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/encuestas?limit=100");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Error al cargar encuestas");
        return;
      }
      const data = await res.json();
      setEncuestas(data.encuestas ?? []);
      setError(null);
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load, reloadKey]);

  const handlePublishChanged = (encuestaId, publishOnHome) => {
    setEncuestas((prev) =>
      prev.map((row) =>
        row.id === encuestaId ? { ...row, publishOnHome } : row
      )
    );
  };

  const csvFilename = `encuestas-${new Date().toISOString().slice(0, 10)}.csv`;

  return (
    <div className={styles.wrapper}>
      <EncuestaSendForm
        onSent={() => {
          setReloadKey((k) => k + 1);
        }}
      />

      {loading ? (
        <div className={styles.loading}>Cargando encuestas...</div>
      ) : error ? (
        <div className={styles.error}>{error}</div>
      ) : encuestas.length === 0 ? (
        <p className={styles.empty}>
          Aún no hay encuestas enviadas. Usa «Enviar encuesta» para mandar un
          enlace a cualquier destinatario.
        </p>
      ) : (
        <>
          <div className={styles.toolbar}>
            <a
              className={styles.exportBtn}
              href="/api/encuestas/export"
              download={csvFilename}
              type="text/csv"
            >
              Exportar CSV
            </a>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Destinatario</th>
                  <th>Origen</th>
                  <th>Estado</th>
                  <th>Enviada</th>
                  <th>Respondida</th>
                  <th>NPS</th>
                  <th>Inicio</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {encuestas.map((row) => {
                  const emp = row.empresa || {};
                  const recipient = row.recipient || {};
                  return (
                    <tr key={row.id}>
                      <td>
                        <div className={styles.nameCell}>
                          <span>{displayName(row)}</span>
                          {(recipient.email || emp.email) && (
                            <span className={styles.mutedSmall}>
                              {recipient.email || emp.email}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        {row.standalone ? (
                          <span className={styles.originManual}>Manual</span>
                        ) : (
                          <span className={styles.originEmpresa}>
                            {emp.rnc ? `Empresa · ${emp.rnc}` : "Empresa"}
                          </span>
                        )}
                      </td>
                      <td>
                        <StatusChip status={row.status} />
                      </td>
                      <td>{formatDate(row.sentAt || row.createdAt)}</td>
                      <td>{formatDate(row.respondedAt)}</td>
                      <td>{row.nps != null ? row.nps : "—"}</td>
                      <td>
                        {row.status === "responded" ? (
                          <EncuestaPublishToggle
                            encuestaId={row.id}
                            initialPublishOnHome={row.publishOnHome === true}
                            onChanged={handlePublishChanged}
                            compact
                          />
                        ) : (
                          <span className={styles.muted}>—</span>
                        )}
                      </td>
                      <td>
                        <Link href={`/dashboard/encuestas/${row.id}`}>Ver</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
