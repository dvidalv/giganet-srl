"use client";

import { useState, useMemo } from "react";
import styles from "./ComprobantesList.module.css";

function formatRango(inicial, final) {
  return `${inicial.toLocaleString("es-DO")} - ${final.toLocaleString("es-DO")}`;
}

export default function ComprobantesList({ comprobantes = [] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return comprobantes;
    return comprobantes.filter((c) => {
      const tipo = (c.tipo ?? c.tipo_comprobante ?? "").toString().toLowerCase();
      const descripcion = (
        (c.titulo ?? c.descripcion_tipo ?? "") ||
        ""
      ).toLowerCase();
      return tipo.includes(q) || descripcion.includes(q);
    });
  }, [comprobantes, query]);

  return (
    <>
      <div className={styles.searchWrap}>
        <span className={styles.searchIcon} aria-hidden>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
        </span>
        <input
          type="search"
          className={styles.searchInput}
          placeholder="Buscar por tipo (ej. 31, 34) o por descripción (ej. Factura, Crédito)..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Buscar comprobantes por tipo o descripción"
        />
        {query && (
          <button
            type="button"
            className={styles.searchClear}
            onClick={() => setQuery("")}
            aria-label="Limpiar búsqueda"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className={styles.empty}>
          {query
            ? "Ningún comprobante coincide con la búsqueda."
            : "No hay comprobantes para mostrar."}
        </p>
      ) : (
        <div className={styles.grid}>
          {filtered.map((c) => (
            <article key={c.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <h2 className={styles.cardTitle}>
                  {c.titulo ?? c.descripcion_tipo ?? `Tipo ${c.tipo ?? c.tipo_comprobante}`}
                </h2>
                <div className={styles.cardActions}>
                  <button
                    type="button"
                    className={styles.actionBtn}
                    title="Editar"
                    aria-label="Editar comprobante"
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className={styles.actionBtn}
                    title="Eliminar"
                    aria-label="Eliminar comprobante"
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                      <path d="M10 11v6M14 11v6" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className={styles.cardDivider} />
              <dl className={styles.fields}>
                <div className={styles.field}>
                  <dt>RNC</dt>
                  <dd>{c.rnc}</dd>
                </div>
                <div className={styles.field}>
                  <dt>Razón Social</dt>
                  <dd>{c.razonSocial ?? c.razon_social}</dd>
                </div>
                <div className={styles.fieldRow}>
                  <div className={styles.field}>
                    <dt>Tipo</dt>
                    <dd>{c.tipo ?? c.tipo_comprobante}</dd>
                  </div>
                  <div className={styles.field}>
                    <dt>Prefijo</dt>
                    <dd>{c.prefijo}</dd>
                  </div>
                </div>
                <div className={styles.field}>
                  <dt>Rango</dt>
                  <dd>
                    {formatRango(
                      c.numeroInicial ?? c.numero_inicial,
                      c.numeroFinal ?? c.numero_final
                    )}
                  </dd>
                </div>
                <div className={styles.fieldRow}>
                  <div className={styles.field}>
                    <dt>Disponibles</dt>
                    <dd>
                      <span
                        className={
                          (c.estadoTipo ?? c.estado_tipo) === "pocos"
                            ? styles.numPocos
                            : styles.numDisponibles
                        }
                      >
                        {(c.disponibles ?? c.numeros_disponibles ?? 0).toLocaleString(
                          "es-DO"
                        )}
                      </span>
                    </dd>
                  </div>
                  <div className={styles.field}>
                    <dt>Utilizados</dt>
                    <dd className={styles.numUtilizados}>
                      {(c.utilizados ?? c.numeros_utilizados ?? 0).toLocaleString(
                        "es-DO"
                      )}
                    </dd>
                  </div>
                </div>
                <div className={styles.field}>
                  <dt>Próximo Número</dt>
                  <dd>
                    {(c.proximoNumero ?? c.proximo_numero ?? 0).toLocaleString(
                      "es-DO"
                    )}
                  </dd>
                </div>
                <div className={styles.field}>
                  <dt>Estado</dt>
                  <dd>
                    <span
                      className={`${styles.badge} ${
                        styles[
                          `badge_${(c.estadoTipo ?? c.estado_tipo ?? "activo").toString()}`
                        ] || styles.badge_activo
                      }`}
                    >
                      {c.estado ?? "ACTIVO"}
                    </span>
                  </dd>
                </div>
                <div className={styles.field}>
                  <dt>Vencimiento</dt>
                  <dd>{c.vencimiento ?? "No especificado"}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
