"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { formatPhoneNumber } from "@/utils/phoneUtils";
import styles from "./EmpresasList.module.css";

function EmpresasList() {
  const [empresas, setEmpresas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchEmpresas() {
      try {
        const res = await fetch("/api/empresas");
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error || "Error al cargar empresas");
          return;
        }
        const data = await res.json();
        setEmpresas(data.empresas ?? []);
      } catch (err) {
        setError("Error de conexión");
      } finally {
        setLoading(false);
      }
    }
    fetchEmpresas();
  }, []);

  if (loading) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.loading}>Cargando empresas...</div>
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

  if (empresas.length === 0) {
    return (
      <div className={styles.wrapper}>
        <p className={styles.empty}>No hay empresas registradas.</p>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <ul className={styles.list}>
        {empresas.map((item) => {
          const e = item.empresa;
          const razon = e.razonSocial || e.nombre || "Sin razón social";
          const rnc = e.rnc || "—";
          const telefono = e.telefono
            ? formatPhoneNumber(e.telefono)
            : "—";
          return (
            <li key={item.id}>
              <Link href={`/dashboard/empresas/${item.id}`} className={styles.card}>
                <div className={styles.logoWrap}>
                  {e.logo ? (
                    <img
                      src={e.logo}
                      alt=""
                      className={styles.logo}
                    />
                  ) : (
                    <div className={styles.logoPlaceholder}>
                      <span className={styles.logoPlaceholderText}>Sin logo</span>
                    </div>
                  )}
                </div>
                <div className={styles.data}>
                  <div className={styles.razonSocial}>{razon}</div>
                  <div className={styles.row}>
                    <span className={styles.label}>RNC:</span>
                    <span className={styles.value}>{rnc}</span>
                  </div>
                  <div className={styles.row}>
                    <span className={styles.label}>Teléfono:</span>
                    <span className={styles.value}>{telefono}</span>
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default EmpresasList;
