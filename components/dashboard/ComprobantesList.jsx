"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import { FaReceipt, FaFileInvoiceDollar } from "react-icons/fa";
import { FaFileCircleMinus } from "react-icons/fa6";
import styles from "./ComprobantesList.module.css";

const MENSAJE_CONFIRMAR_ELIMINAR =
  "¿Está seguro de que desea eliminar esta secuencia? Esta acción no se puede deshacer.";

function formatRango(inicial, final) {
  return `${Number(inicial).toLocaleString("es-DO")} - ${Number(
    final
  ).toLocaleString("es-DO")}`;
}

function formatVencimiento(fecha) {
  if (!fecha) return null;
  const d = new Date(fecha);
  return isNaN(d.getTime())
    ? null
    : d.toLocaleDateString("es-DO", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
}

const ESTADOS_ACTIVOS = ["activo", "alerta", "pocos"];

const TIPO_ICON_MAP = {
  31: { Icon: FaReceipt, iconClass: "cardIcon_tipo31" },
  32: { Icon: FaReceipt, iconClass: "cardIcon_tipo32" },
  33: { Icon: FaFileInvoiceDollar, iconClass: "cardIcon_tipo33" },
  34: { Icon: FaFileCircleMinus, iconClass: "cardIcon_tipo34" },
  36: { Icon: FaFileInvoiceDollar, iconClass: "cardIcon_tipo36" },
};

function getTipoTheme(tipo) {
  const t = tipo != null ? Number(tipo) : null;
  const mapped = t != null && TIPO_ICON_MAP[t];
  if (mapped) {
    return { Icon: mapped.Icon, iconClass: styles[mapped.iconClass] };
  }
  return { Icon: FaReceipt, iconClass: styles.cardIcon_default };
}

function getCardTheme(estadoTipo) {
  const e = (estadoTipo ?? "activo").toString().toLowerCase();
  const isInactive = ["agotado", "vencido", "inactivo"].includes(e);
  const isAlerta = ["alerta", "pocos"].includes(e);
  if (isInactive) {
    return {
      disponiblesClass: styles.cardBoxDisponibles_agotado,
      badgeClass: styles.cardBadge_agotado,
      canGenerate: false,
    };
  }
  if (isAlerta) {
    return {
      disponiblesClass: styles.cardBoxDisponibles_alerta,
      badgeClass: styles.cardBadge_alerta,
      canGenerate: true,
    };
  }
  return {
    disponiblesClass: styles.cardBoxDisponibles_activo,
    badgeClass: styles.cardBadge_activo,
    canGenerate: true,
  };
}

function normalizarComprobante(r) {
  return {
    id: r._id ?? r.id,
    _id: r._id,
    titulo: r.descripcion_tipo ?? `Tipo ${r.tipo_comprobante}`,
    descripcion_tipo: r.descripcion_tipo,
    tipo: r.tipo_comprobante,
    tipo_comprobante: r.tipo_comprobante,
    rnc: r.rnc,
    razon_social: r.razon_social,
    razonSocial: r.razon_social,
    prefijo: r.prefijo ?? "E",
    numero_inicial: r.numero_inicial,
    numero_final: r.numero_final,
    numeroInicial: r.numero_inicial,
    numeroFinal: r.numero_final,
    numeros_disponibles: r.numeros_disponibles ?? 0,
    numeros_utilizados: r.numeros_utilizados ?? 0,
    disponibles: r.numeros_disponibles ?? 0,
    utilizados: r.numeros_utilizados ?? 0,
    proximoNumero: (r.numero_inicial ?? 0) + (r.numeros_utilizados ?? 0),
    proximo_numero: (r.numero_inicial ?? 0) + (r.numeros_utilizados ?? 0),
    estado: (r.estado ?? "activo").toUpperCase(),
    estado_tipo: r.estado ?? "activo",
    estadoTipo: r.estado === "alerta" ? "pocos" : r.estado ?? "activo",
    fecha_vencimiento: r.fecha_vencimiento,
    vencimiento: formatVencimiento(r.fecha_vencimiento),
  };
}

export default function ComprobantesList() {
  const [comprobantes, setComprobantes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [filterEstado, setFilterEstado] = useState("activos");
  const [deletingId, setDeletingId] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  const fetchComprobantes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/comprobantes");
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Error al cargar comprobantes");
        setComprobantes([]);
        return;
      }
      const data = (json.data ?? []).map(normalizarComprobante);
      setComprobantes(data);
    } catch (err) {
      setError("Error de conexión");
      setComprobantes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchComprobantes();
  }, [fetchComprobantes]);

  const openDeleteModal = useCallback((c) => {
    setPendingDelete(c);
  }, []);

  const closeDeleteModal = useCallback(() => {
    if (!deletingId) setPendingDelete(null);
  }, [deletingId]);

  const handleConfirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    const id = pendingDelete.id ?? pendingDelete._id;
    if (!id) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/comprobantes/${id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPendingDelete(null);
        alert(json.error ?? "Error al eliminar la secuencia");
        return;
      }
      setPendingDelete(null);
      await fetchComprobantes();
    } catch (err) {
      setPendingDelete(null);
      alert("Error de conexión al eliminar");
    } finally {
      setDeletingId(null);
    }
  }, [pendingDelete, fetchComprobantes]);

  useEffect(() => {
    const onEscape = (e) => {
      if (e.key === "Escape" && pendingDelete && !deletingId)
        setPendingDelete(null);
    };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [pendingDelete, deletingId]);

  const filtered = useMemo(() => {
    let list = comprobantes;
    if (filterEstado === "activos") {
      list = list.filter((c) => {
        const estado = (c.estado_tipo ?? c.estadoTipo ?? "activo")
          .toString()
          .toLowerCase();
        return ESTADOS_ACTIVOS.includes(estado);
      });
    }
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((c) => {
      const tipo = (c.tipo ?? c.tipo_comprobante ?? "")
        .toString()
        .toLowerCase();
      const descripcion = (
        (c.titulo ?? c.descripcion_tipo ?? "") ||
        ""
      ).toLowerCase();
      return tipo.includes(q) || descripcion.includes(q);
    });
  }, [comprobantes, query, filterEstado]);

  if (loading) {
    return <p className={styles.empty}>Cargando comprobantes...</p>;
  }

  if (error) {
    return (
      <p className={styles.empty} role="alert">
        {error}
      </p>
    );
  }

  return (
    <>
      {pendingDelete && (
        <div
          className={styles.modalOverlay}
          onClick={closeDeleteModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          aria-describedby="modal-desc">
          <div
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalIcon}>
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden>
                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                <path d="M10 11v6M14 11v6" />
              </svg>
            </div>
            <h2 id="modal-title" className={styles.modalTitle}>
              Eliminar secuencia
            </h2>
            <p id="modal-desc" className={styles.modalMessage}>
              {MENSAJE_CONFIRMAR_ELIMINAR}
            </p>
            {pendingDelete.titulo && (
              <p className={styles.modalDetail}>
                <strong>{pendingDelete.titulo}</strong>
                {pendingDelete.tipo_comprobante && (
                  <> — Tipo {pendingDelete.tipo_comprobante}</>
                )}
              </p>
            )}
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.modalCancel}
                onClick={closeDeleteModal}
                disabled={!!deletingId}>
                Cancelar
              </button>
              <button
                type="button"
                className={styles.modalConfirm}
                onClick={handleConfirmDelete}
                disabled={!!deletingId}>
                {deletingId ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={styles.filtersRow}>
        <div className={styles.filterEstadoWrap}>
          <label htmlFor="filter-estado" className={styles.filterLabel}>
            Mostrar
          </label>
          <select
            id="filter-estado"
            className={styles.filterSelect}
            value={filterEstado}
            onChange={(e) => setFilterEstado(e.target.value)}
            aria-label="Filtrar por estado: activos o todos">
            <option value="activos">Solo activos</option>
            <option value="todos">Todos</option>
          </select>
        </div>
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
              strokeLinejoin="round">
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
              aria-label="Limpiar búsqueda">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className={styles.empty}>
          {query
            ? "Ningún comprobante coincide con la búsqueda."
            : filterEstado === "activos"
            ? "No hay comprobantes activos para mostrar."
            : "No hay comprobantes para mostrar."}
        </p>
      ) : (
        <div className={styles.grid}>
          {filtered.map((c) => {
            const cardEstado =
              (c.estadoTipo ?? c.estado_tipo) === "pocos"
                ? "alerta"
                : (c.estadoTipo ?? c.estado_tipo ?? "activo").toString();
            const estadoTheme = getCardTheme(c.estado_tipo ?? c.estadoTipo);
            const tipoTheme = getTipoTheme(c.tipo ?? c.tipo_comprobante);
            const { Icon, iconClass } = tipoTheme;
            const { disponiblesClass, badgeClass, canGenerate } = estadoTheme;
            const detallesHref = `/dashboard/mis-comprobantes/${c.id ?? c._id}`;
            const tipoComprobante = c.tipo ?? c.tipo_comprobante;
            const generarHref =
              tipoComprobante != null && String(tipoComprobante).trim() !== ""
                ? `/dashboard/mis-comprobantes/nuevo?tipo=${encodeURIComponent(String(tipoComprobante).trim())}`
                : "/dashboard/mis-comprobantes/nuevo";
            const disponibles =
              c.disponibles ?? c.numeros_disponibles ?? 0;
            const utilizados =
              c.utilizados ?? c.numeros_utilizados ?? 0;
            const proximoNum =
              c.proximoNumero ?? c.proximo_numero ?? 0;

            return (
              <article
                key={c.id ?? c._id}
                className={`${styles.card} ${
                  styles[`card_${cardEstado}`] ?? ""
                }`}>
                <div>
                  <div className={styles.cardHeader}>
                    <div className={styles.cardHeaderInner}>
                      <div className={`${styles.cardIcon} ${iconClass}`}>
                        <Icon className={styles.cardIconSvg} size={20} />
                      </div>
                      <div className={styles.cardTitleWrap}>
                        <h2 className={styles.cardTitle}>
                          {c.titulo ??
                            c.descripcion_tipo ??
                            `Tipo ${c.tipo ?? c.tipo_comprobante}`}
                        </h2>
                        <p className={styles.cardSubtitle}>Electrónica</p>
                      </div>
                    </div>
                    <div className={styles.cardActions}>
                      <Link
                        href={detallesHref}
                        className={styles.actionBtn}
                        title="Editar"
                        aria-label="Editar comprobante">
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden>
                          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </Link>
                      <button
                        type="button"
                        className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                        title="Eliminar"
                        aria-label="Eliminar comprobante"
                        onClick={() => openDeleteModal(c)}
                        disabled={deletingId === (c.id ?? c._id)}>
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden>
                          <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                          <path d="M10 11v6M14 11v6" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className={styles.cardDivider} />
                  <div className={styles.cardBody}>
                    <div className={styles.cardGrid2}>
                      <div>
                        <p className={styles.cardLabel}>RNC</p>
                        <p className={styles.cardValue}>{c.rnc}</p>
                      </div>
                      <div>
                        <p className={styles.cardLabel}>Tipo</p>
                        <p className={styles.cardValue}>
                          {c.tipo ?? c.tipo_comprobante}
                        </p>
                      </div>
                    </div>
                    <div>
                      <p className={styles.cardLabel}>Razón Social</p>
                      <p className={styles.cardValue}>
                        {c.razonSocial ?? c.razon_social}
                      </p>
                    </div>
                    <div className={styles.cardGrid2}>
                      <div>
                        <p className={styles.cardLabel}>Prefijo</p>
                        <p className={styles.cardValue}>{c.prefijo}</p>
                      </div>
                      <div>
                        <p className={styles.cardLabel}>Rango</p>
                        <p className={styles.cardValue}>
                          {formatRango(
                            c.numeroInicial ?? c.numero_inicial,
                            c.numeroFinal ?? c.numero_final
                          )}
                        </p>
                      </div>
                    </div>
                    <div className={styles.cardGrid2}>
                      <div className={`${styles.cardBoxDisponibles} ${disponiblesClass}`}>
                        <p className={styles.cardLabel}>Disponibles</p>
                        <p className={styles.cardValue}>
                          {disponibles.toLocaleString("es-DO")}
                        </p>
                      </div>
                      <div className={styles.cardBoxUtilizados}>
                        <p className={styles.cardLabel}>Utilizados</p>
                        <p className={styles.cardValue}>
                          {utilizados.toLocaleString("es-DO")}
                        </p>
                      </div>
                    </div>
                    <div className={styles.cardEstadoRow}>
                      <div>
                        <p className={styles.cardLabel}>Estado</p>
                        <span
                          className={`${styles.cardBadge} ${badgeClass}`}
                          aria-label={`Estado: ${c.estado ?? "ACTIVO"}`}>
                          <span className={styles.cardBadgeDot} aria-hidden />
                          {c.estado ?? "ACTIVO"}
                        </span>
                      </div>
                      <div>
                        <p className={styles.cardLabel}>Próximo #</p>
                        <p className={styles.cardValue}>
                          {canGenerate
                            ? proximoNum.toLocaleString("es-DO")
                            : "—"}
                        </p>
                      </div>
                    </div>
                    <div>
                      <p className={styles.cardLabel}>Vencimiento</p>
                      <p className={styles.cardValue}>
                        {c.vencimiento ?? "No especificado"}
                      </p>
                    </div>
                  </div>
                </div>
                <div className={styles.cardActionsFooter}>
                  {canGenerate ? (
                    <Link
                      href={generarHref}
                      className={styles.cardBtnGenerar}>
                      Generar
                    </Link>
                  ) : (
                    <span
                      className={`${styles.cardBtnGenerar} ${styles.cardBtnGenerarDisabled}`}
                      aria-disabled="true">
                      Generar
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
