"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/encuestas?limit=100");
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error || "Error al cargar encuestas");
          return;
        }
        const data = await res.json();
        setEncuestas(data.encuestas ?? []);
      } catch {
        setError("Error de conexión");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.loading}>Cargando encuestas...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.error}>{error}</div>
      </div>
    );
  }

  if (encuestas.length === 0) {
    return (
      <div className={styles.wrapper}>
        <p className={styles.empty}>Aún no hay encuestas enviadas.</p>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Empresa</th>
              <th>RNC</th>
              <th>Estado</th>
              <th>Enviada</th>
              <th>Respondida</th>
              <th>NPS</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {encuestas.map((row) => {
              const emp = row.empresa || {};
              const name =
                emp.razonSocial || emp.nombre || "—";
              return (
                <tr key={row.id}>
                  <td>{name}</td>
                  <td>{emp.rnc || "—"}</td>
                  <td>
                    <StatusChip status={row.status} />
                  </td>
                  <td>{formatDate(row.sentAt || row.createdAt)}</td>
                  <td>{formatDate(row.respondedAt)}</td>
                  <td>{row.nps != null ? row.nps : "—"}</td>
                  <td>
                    <Link href={`/dashboard/encuestas/${row.id}`}>Ver</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
