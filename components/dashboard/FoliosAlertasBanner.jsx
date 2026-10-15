"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "./EmpresaFolios.module.css";

/** Aviso compacto con el número de alertas de folios pendientes. No muestra nada si no hay. */
export default function FoliosAlertasBanner() {
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let activo = true;
    fetch("/api/folios/alertas")
      .then((res) => (res.ok ? res.json() : { alertas: [] }))
      .then((data) => {
        if (activo) setTotal(data.alertas?.length ?? 0);
      })
      .catch(() => {});
    return () => {
      activo = false;
    };
  }, []);

  if (!total) return null;

  return (
    <div className={styles.alertBanner} role="status">
      <span>
        Hay <strong>{total}</strong> alerta{total === 1 ? "" : "s"} de folios pendiente
        {total === 1 ? "" : "s"} (vencimientos, consumo o folios bajo el mínimo).
      </span>
      <Link href="/dashboard/empresas/folios" className={styles.linkBtn}>
        Revisar alertas
      </Link>
    </div>
  );
}
