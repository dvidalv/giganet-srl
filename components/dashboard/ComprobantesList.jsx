"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import { FaReceipt, FaFileInvoiceDollar, FaBan } from "react-icons/fa";
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

function formatearNCF(prefijo, tipo, secuencia) {
  const tipoStr = String(tipo ?? "").padStart(2, "0");
  const secStr = String(secuencia ?? 0).padStart(10, "0");
  return `${prefijo ?? "E"}${tipoStr}${secStr}`;
}

const NCF_REGEX = /^E\d{2}\d{8,10}$/;

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

function labelAmbienteTheFactory(key) {
  if (key === "demo") return "Pruebas (demo)";
  if (key === "production") return "Producción";
  return key ? String(key) : "—";
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
  const [pendingAnular, setPendingAnular] = useState(null);
  const [anulandoId, setAnulandoId] = useState(null);
  const [anularNcfDesde, setAnularNcfDesde] = useState("");
  const [anularNcfHasta, setAnularNcfHasta] = useState("");
  const [tfSeriesLoading, setTfSeriesLoading] = useState(true);
  const [tfSeriesError, setTfSeriesError] = useState(null);
  const [tfSeriesPayload, setTfSeriesPayload] = useState(null);
  const [tfPanelOpen, setTfPanelOpen] = useState(false);

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

  const fetchTheFactorySeries = useCallback(async () => {
    setTfSeriesLoading(true);
    setTfSeriesError(null);
    setTfSeriesPayload(null);
    try {
      const res = await fetch("/api/comprobantes/thefactory-series");
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTfSeriesError(
          json.message ??
            json.error ??
            "No se pudieron obtener las series de The Factory."
        );
        return;
      }
      if (json.status === "success") {
        setTfSeriesPayload({
          ambiente: json.ambiente,
          rnc: json.rnc,
          series: Array.isArray(json.series) ? json.series : [],
        });
      } else {
        setTfSeriesError(
          json.message ?? "Respuesta inesperada al consultar The Factory."
        );
      }
    } catch {
      setTfSeriesError("Error de conexión al consultar The Factory.");
    } finally {
      setTfSeriesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchComprobantes();
    fetchTheFactorySeries();
  }, [fetchComprobantes, fetchTheFactorySeries]);

  const openDeleteModal = useCallback((c) => {
    setPendingDelete(c);
  }, []);

  const closeDeleteModal = useCallback(() => {
    if (!deletingId) setPendingDelete(null);
  }, [deletingId]);

  const openAnularModal = useCallback((c) => {
    setPendingAnular(c);
    const prefijo = c.prefijo ?? "E";
    const tipo = c.tipo ?? c.tipo_comprobante;
    const proximo = c.proximoNumero ?? c.proximo_numero ?? 0;
    const fin = c.numeroFinal ?? c.numero_final ?? 0;
    setAnularNcfDesde(formatearNCF(prefijo, tipo, proximo));
    setAnularNcfHasta(formatearNCF(prefijo, tipo, fin));
  }, []);

  const closeAnularModal = useCallback(() => {
    if (!anulandoId) {
      setPendingAnular(null);
      setAnularNcfDesde("");
      setAnularNcfHasta("");
    }
  }, [anulandoId]);

  const handleAnular = useCallback(async () => {
    if (!pendingAnular) return;
    const ncfDesde = anularNcfDesde.trim();
    const ncfHasta = anularNcfHasta.trim();
    if (!ncfDesde || !ncfHasta) {
      alert("Debe indicar NCF Desde y NCF Hasta.");
      return;
    }
    if (!NCF_REGEX.test(ncfDesde)) {
      alert(
        "NCF Desde tiene formato inválido. Debe ser E + tipo (2 dígitos) + secuencia (8-10 dígitos). Ej: E310000000044"
      );
      return;
    }
    if (!NCF_REGEX.test(ncfHasta)) {
      alert(
        "NCF Hasta tiene formato inválido. Debe ser E + tipo (2 dígitos) + secuencia (8-10 dígitos). Ej: E310000000050"
      );
      return;
    }
    const secDesde = parseInt(ncfDesde.substring(3), 10);
    const secHasta = parseInt(ncfHasta.substring(3), 10);
    if (secHasta < secDesde) {
      alert("NCF Hasta debe ser mayor o igual a NCF Desde.");
      return;
    }
    const id = pendingAnular.id ?? pendingAnular._id;
    setAnulandoId(id);
    try {
      const rnc = String(pendingAnular.rnc ?? "").replace(/\D/g, "").trim();
      const tipoDocumento = pendingAnular.tipo ?? pendingAnular.tipo_comprobante;
      const res = await fetch("/api/comprobantes/anular", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rnc,
          anulaciones: [{ tipoDocumento, ncfDesde, ncfHasta }],
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          json.message ?? json.error ?? "Error al anular secuencias";
        alert(msg);
        return;
      }
      setPendingAnular(null);
      setAnularNcfDesde("");
      setAnularNcfHasta("");
      await fetchComprobantes();
      alert(
        json.message ?? "Secuencias anuladas exitosamente ante DGII."
      );
    } catch (err) {
      alert("Error de conexión al anular.");
    } finally {
      setAnulandoId(null);
    }
  }, [
    pendingAnular,
    anularNcfDesde,
    anularNcfHasta,
    fetchComprobantes,
  ]);

  const handleConfirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    const id = pendingDelete.id ?? pendingDelete._id;
    if (!id) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/comprobantes/${id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const extra =
          json.theFactorySync?.message != null
            ? `\n\nThe Factory: ${json.theFactorySync.message}`
            : "";
        alert(`${json.error ?? "Error al eliminar la secuencia"}${extra}`);
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
      if (e.key !== "Escape") return;
      if (pendingDelete && !deletingId) setPendingDelete(null);
      if (pendingAnular && !anulandoId) {
        setPendingAnular(null);
        setAnularNcfDesde("");
        setAnularNcfHasta("");
      }
    };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [pendingDelete, deletingId, pendingAnular, anulandoId]);

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

      {pendingAnular && (
        <div
          className={styles.modalOverlay}
          onClick={closeAnularModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-anular-title"
          aria-describedby="modal-anular-desc">
          <div
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalIconAnular}>
              <FaBan size={28} aria-hidden />
            </div>
            <h2 id="modal-anular-title" className={styles.modalTitle}>
              Anular secuencias no usadas
            </h2>
            <p id="modal-anular-desc" className={styles.modalMessage}>
              Anula secuencias de NCF no utilizadas ante DGII / The Factory HKA
              para que no se reutilicen (p. ej. números que no usarás o rangos
              vencidos). No sustituye la corrección de un e-CF ya emitido.
            </p>
            <p className={styles.modalWikiNote}>
              <a
                className={styles.modalWikiLink}
                href="https://felwiki.thefactoryhka.com.do/doku.php?id=restapianulacion"
                target="_blank"
                rel="noopener noreferrer">
                Documentación REST: Anulación (The Factory HKA)
              </a>
            </p>
            {pendingAnular.titulo && (
              <p className={styles.modalDetail}>
                <strong>{pendingAnular.titulo}</strong>
                {pendingAnular.tipo_comprobante && (
                  <> — Tipo {pendingAnular.tipo_comprobante}</>
                )}
              </p>
            )}
            <div className={styles.modalForm}>
              <label htmlFor="anular-ncf-desde" className={styles.modalLabel}>
                NCF Desde
              </label>
              <input
                id="anular-ncf-desde"
                type="text"
                className={styles.modalInput}
                value={anularNcfDesde}
                onChange={(e) => setAnularNcfDesde(e.target.value)}
                placeholder="E310000000044"
                disabled={!!anulandoId}
              />
              <label htmlFor="anular-ncf-hasta" className={styles.modalLabel}>
                NCF Hasta
              </label>
              <input
                id="anular-ncf-hasta"
                type="text"
                className={styles.modalInput}
                value={anularNcfHasta}
                onChange={(e) => setAnularNcfHasta(e.target.value)}
                placeholder="E310000000050"
                disabled={!!anulandoId}
              />
            </div>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.modalCancel}
                onClick={closeAnularModal}
                disabled={!!anulandoId}>
                Cancelar
              </button>
              <button
                type="button"
                className={styles.modalConfirmAnular}
                onClick={handleAnular}
                disabled={!!anulandoId}>
                {anulandoId ? "Anulando..." : "Anular"}
              </button>
            </div>
          </div>
        </div>
      )}

      <section className={styles.tfSeriesPanel} aria-label="Series The Factory HKA">
        <div className={styles.tfSeriesPanelBar}>
          <button
            type="button"
            className={styles.tfSeriesToggle}
            id="tf-series-toggle"
            aria-expanded={tfPanelOpen}
            aria-controls="tf-series-panel-content"
            onClick={() => setTfPanelOpen((o) => !o)}>
            <span
              className={styles.tfSeriesChevron}
              data-expanded={tfPanelOpen}
              aria-hidden>
              ▸
            </span>
            <span className={styles.tfSeriesToggleLabel}>
              <span className={styles.tfSeriesPanelTitle}>
                Series en The Factory HKA
              </span>
              <span className={styles.tfSeriesPanelSubtitle}>
                {tfSeriesLoading
                  ? "Consultando The Factory…"
                  : tfSeriesError
                  ? "Error al consultar · expanda o pulse Actualizar"
                  : tfSeriesPayload
                  ? `${tfSeriesPayload.series.length} serie(s) · ${labelAmbienteTheFactory(tfSeriesPayload.ambiente)}`
                  : "Listado del emisor en The Factory"}
              </span>
            </span>
          </button>
          <button
            type="button"
            className={styles.tfSeriesRefresh}
            onClick={(e) => {
              e.stopPropagation();
              fetchTheFactorySeries();
            }}
            disabled={tfSeriesLoading}
            aria-label="Actualizar series desde The Factory">
            {tfSeriesLoading ? "Actualizando…" : "Actualizar"}
          </button>
        </div>
        {tfPanelOpen && (
          <div
            id="tf-series-panel-content"
            className={styles.tfSeriesPanelContent}
            role="region"
            aria-labelledby="tf-series-toggle">
            <p className={styles.tfSeriesIntro}>
              Datos en tiempo real según el RNC y el ambiente configurados en{" "}
              <Link href="/dashboard/empresa" className={styles.tfSeriesInlineLink}>
                Mi empresa
              </Link>
              . Las secuencias que gestionas en Giganet aparecen abajo; compara
              con este listado para alinear rangos.
            </p>
            {tfSeriesPayload && !tfSeriesLoading && (
              <p className={styles.tfSeriesMeta}>
                RNC consultado: <strong>{tfSeriesPayload.rnc}</strong>
                {" · "}
                Ambiente:{" "}
                <strong>{labelAmbienteTheFactory(tfSeriesPayload.ambiente)}</strong>
                {" · "}
                <a
                  className={styles.tfSeriesInlineLink}
                  href="https://felwiki.thefactoryhka.com.do/doku.php?id=restapiseries"
                  target="_blank"
                  rel="noopener noreferrer">
                  API Series (wiki TFHKA)
                </a>
              </p>
            )}
            {tfSeriesLoading && (
              <p className={styles.tfSeriesStatus}>Consultando The Factory…</p>
            )}
            {tfSeriesError && !tfSeriesLoading && (
              <div className={styles.tfSeriesError} role="alert">
                <p className={styles.tfSeriesErrorText}>{tfSeriesError}</p>
                <p className={styles.tfSeriesErrorHint}>
                  Compruebe RNC, usuario y clave de The Factory, y que el ambiente
                  (demo/producción) coincida con su cuenta.
                </p>
              </div>
            )}
            {tfSeriesPayload && !tfSeriesLoading && !tfSeriesError && (
              <>
                {tfSeriesPayload.series.length === 0 ? (
                  <p className={styles.tfSeriesEmpty}>
                    The Factory devolvió un listado vacío de series para este RNC.
                  </p>
                ) : (
                  <div className={styles.tfTableWrap}>
                    <table className={styles.tfTable}>
                      <thead>
                        <tr>
                          <th scope="col">Tipo</th>
                          <th scope="col">Serie</th>
                          <th scope="col">Correlativo</th>
                          <th scope="col">Rango</th>
                          <th scope="col">Vencimiento sec.</th>
                          <th scope="col">Sucursal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tfSeriesPayload.series.map((row, idx) => {
                          const tipo =
                            row.tipoDocumento ?? row.tipo_documento ?? "—";
                          const serie = row.serie ?? "—";
                          const correlativo =
                            row.correlativo != null ? row.correlativo : "—";
                          const vmin =
                            row.valorMinimo != null
                              ? row.valorMinimo
                              : row.valor_minimo;
                          const vmax =
                            row.valorMaximo != null
                              ? row.valorMaximo
                              : row.valor_maximo;
                          const rango =
                            vmin != null && vmax != null
                              ? `${Number(vmin).toLocaleString("es-DO")} – ${Number(vmax).toLocaleString("es-DO")}`
                              : "—";
                          const venc =
                            row.fechaVencimientoSecuencia ??
                            row.fecha_vencimiento_secuencia ??
                            "—";
                          const sucursal =
                            row.codigoSucursal ??
                            row.codigo_sucursal ??
                            "—";
                          return (
                            <tr key={`${serie}-${tipo}-${idx}`}>
                              <td>{tipo}</td>
                              <td>{serie}</td>
                              <td>{correlativo}</td>
                              <td>{rango}</td>
                              <td>{venc}</td>
                              <td>{sucursal}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </section>

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

      {loading ? (
        <p className={styles.empty}>Cargando secuencias en Giganet…</p>
      ) : error ? (
        <p className={styles.empty} role="alert">
          {error}
        </p>
      ) : filtered.length === 0 ? (
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
                      {disponibles > 0 && (
                        <button
                          type="button"
                          className={`${styles.actionBtn} ${styles.actionBtnAnular}`}
                          title="Anular secuencias"
                          aria-label="Anular secuencias no usadas"
                          onClick={() => openAnularModal(c)}
                          disabled={anulandoId === (c.id ?? c._id)}>
                          <FaBan size={16} aria-hidden />
                        </button>
                      )}
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
