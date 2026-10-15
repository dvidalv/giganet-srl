"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import compStyles from "./EmpresaAdminForm.module.css";
import styles from "./EmpresaFolios.module.css";
import CampoFecha from "./CampoFecha";
import {
  ESTADOS_FOLIOS,
  EstadoEmailAlerta,
  EstadoFoliosBadge,
  ModalidadBadge,
  fetchJson,
  formatDia,
  formatFechaHora,
  formatNumero,
  textoDiasRestantes,
} from "./foliosUi";

const FILTROS_INICIALES = { q: "", modalidad: "", estado: "", vencDesde: "", vencHasta: "" };
const POR_PAGINA = 20;
const ALERTAS_CRITICAS = ["VENCIDO", "CONSUMO_100", "VENCE_7"];

function Num({ value }) {
  return value == null ? <span className={styles.muted}>—</span> : formatNumero(value);
}

export default function FoliosAdminTable() {
  const [filtros, setFiltros] = useState(FILTROS_INICIALES);
  const [qDebounced, setQDebounced] = useState("");
  const [pagina, setPagina] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [alertas, setAlertas] = useState([]);
  const [alertasError, setAlertasError] = useState(null);
  const [atendiendo, setAtendiendo] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(filtros.q.trim()), 300);
    return () => clearTimeout(t);
  }, [filtros.q]);

  const { modalidad, estado, vencDesde, vencHasta } = filtros;
  const cargarTabla = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ pagina: String(pagina), porPagina: String(POR_PAGINA) });
    const extra = { q: qDebounced, modalidad, estado, vencDesde, vencHasta };
    for (const [k, v] of Object.entries(extra)) {
      if (v) params.set(k, v);
    }
    try {
      setData(await fetchJson(`/api/folios?${params}`));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [pagina, qDebounced, modalidad, estado, vencDesde, vencHasta]);

  const cargarAlertas = useCallback(async () => {
    setAlertasError(null);
    try {
      const res = await fetchJson("/api/folios/alertas");
      setAlertas(res.alertas ?? []);
    } catch (err) {
      setAlertasError(err.message);
    }
  }, []);

  useEffect(() => {
    cargarTabla();
  }, [cargarTabla]);

  useEffect(() => {
    cargarAlertas();
  }, [cargarAlertas]);

  const setFiltro = (campo, valor) => {
    setPagina(1);
    setFiltros((f) => ({ ...f, [campo]: valor }));
  };

  const atenderAlerta = async (id) => {
    setAtendiendo(id);
    try {
      await fetchJson(`/api/folios/alertas/${id}`, { method: "PATCH" });
      setAlertas((list) => list.filter((a) => a.id !== id));
      cargarTabla();
    } catch (err) {
      setAlertasError(err.message);
    } finally {
      setAtendiendo(null);
    }
  };

  const hayFiltros = Object.entries(filtros).some(([, v]) => v);
  const totalPaginas = data ? Math.max(1, Math.ceil(data.total / data.porPagina)) : 1;
  const t = data?.totales;

  return (
    <div>
      {t && (
        <div className={styles.metrics}>
          <div className={styles.metric}>
            <p className={styles.metricLabel}>Empresas</p>
            <p className={styles.metricValue}>{formatNumero(t.empresas)}</p>
            <p className={styles.metricHint}>
              {formatNumero(t.controladas)} controladas · {formatNumero(t.ilimitadas)} ilimitadas
            </p>
          </div>
          <div className={styles.metric}>
            <p className={styles.metricLabel}>Por vencer (30 días)</p>
            <p className={styles.metricValue}>{formatNumero(t.porVencer)}</p>
          </div>
          <div className={styles.metric}>
            <p className={styles.metricLabel}>Emisión bloqueada</p>
            <p className={styles.metricValue}>{formatNumero(t.bloqueadas)}</p>
            <p className={styles.metricHint}>Vencidas, agotadas o sin contrato</p>
          </div>
        </div>
      )}

      <section className={compStyles.compSection} aria-labelledby="alertas-folios">
        <div className={compStyles.compHeader}>
          <div>
            <h2 id="alertas-folios" className={compStyles.compTitle}>
              Alertas de folios
            </h2>
            <p className={compStyles.compSubtitle}>
              Vencimientos a 30, 15 y 7 días, contratos vencidos y consumo del 80 % y 100 %. Solo
              empresas con folios controlados.
            </p>
          </div>
          <div className={compStyles.compHeaderActions}>
            <button type="button" className={compStyles.compRefresh} onClick={cargarAlertas}>
              Actualizar
            </button>
          </div>
        </div>
        {alertasError && (
          <p className={compStyles.compMsgError} role="alert">
            {alertasError}
          </p>
        )}
        {alertas.length === 0 ? (
          <p className={compStyles.compEmpty}>No hay alertas pendientes.</p>
        ) : (
          <ul className={styles.alertList}>
            {alertas.map((a) => (
              <li
                key={a.id}
                className={`${styles.alertItem} ${
                  ALERTAS_CRITICAS.includes(a.tipo) ? styles.alertItemCritica : ""
                }`}
              >
                <span>
                  <Link href={`/dashboard/empresas/${a.empresa}`} style={{ color: "inherit", fontWeight: 700 }}>
                    {a.empresaNombre}
                  </Link>{" "}
                  · {a.contratoCodigo} · {a.mensaje}
                  {a.fechaVencimiento ? ` (vence ${formatDia(a.fechaVencimiento)})` : ""}
                  <EstadoEmailAlerta alerta={a} />
                  <span className={styles.historyMeta}>{formatFechaHora(a.createdAt)}</span>
                </span>
                <button
                  type="button"
                  className={compStyles.compBtn}
                  onClick={() => atenderAlerta(a.id)}
                  disabled={atendiendo === a.id}
                >
                  {atendiendo === a.id ? "Guardando…" : "Marcar atendida"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={compStyles.compSection} aria-labelledby="tabla-folios">
        <div className={compStyles.compHeader}>
          <div>
            <h2 id="tabla-folios" className={compStyles.compTitle}>
              Folios por empresa
            </h2>
            <p className={compStyles.compSubtitle}>
              Para empresas controladas se muestra el contrato en uso (el vigente que vence primero).
            </p>
          </div>
          <div className={compStyles.compHeaderActions}>
            <button type="button" className={compStyles.compRefresh} onClick={cargarTabla} disabled={loading}>
              Actualizar
            </button>
          </div>
        </div>

        <div className={compStyles.compFilters}>
          <div className={compStyles.compSearchWrap}>
            <span className={compStyles.compSearchIcon} aria-hidden>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
            </span>
            <input
              type="search"
              className={compStyles.compSearchInput}
              value={filtros.q}
              onChange={(e) => setFiltro("q", e.target.value)}
              placeholder="Buscar empresa o RNC…"
              aria-label="Buscar empresa o RNC"
            />
          </div>
          <div className={compStyles.compFilterEstado}>
            <label className={compStyles.compFilterLabel} htmlFor="filtro-modalidad">
              Modalidad
            </label>
            <select
              id="filtro-modalidad"
              className={compStyles.compFilterSelect}
              value={filtros.modalidad}
              onChange={(e) => setFiltro("modalidad", e.target.value)}
            >
              <option value="">Todas</option>
              <option value="ILIMITADO">Ilimitado</option>
              <option value="CONTROLADO">Controlado</option>
            </select>
          </div>
          <div className={compStyles.compFilterEstado}>
            <label className={compStyles.compFilterLabel} htmlFor="filtro-estado">
              Estado
            </label>
            <select
              id="filtro-estado"
              className={compStyles.compFilterSelect}
              value={filtros.estado}
              onChange={(e) => setFiltro("estado", e.target.value)}
            >
              <option value="">Todos</option>
              {ESTADOS_FOLIOS.filter((e) => e.value !== "CANCELADO").map((e) => (
                <option key={e.value} value={e.value}>
                  {e.label}
                </option>
              ))}
            </select>
          </div>
          <div className={compStyles.compFilterEstado}>
            <label className={compStyles.compFilterLabel} htmlFor="filtro-desde">
              Vence desde
            </label>
            <CampoFecha
              id="filtro-desde"
              variante="filtro"
              value={filtros.vencDesde}
              max={filtros.vencHasta || undefined}
              onChange={(dia) => setFiltro("vencDesde", dia)}
            />
          </div>
          <div className={compStyles.compFilterEstado}>
            <label className={compStyles.compFilterLabel} htmlFor="filtro-hasta">
              Vence hasta
            </label>
            <CampoFecha
              id="filtro-hasta"
              variante="filtro"
              value={filtros.vencHasta}
              min={filtros.vencDesde || undefined}
              onChange={(dia) => setFiltro("vencHasta", dia)}
            />
          </div>
          {hayFiltros && (
            <button
              type="button"
              className={compStyles.compBtn}
              onClick={() => {
                setPagina(1);
                setFiltros(FILTROS_INICIALES);
              }}
            >
              Limpiar filtros
            </button>
          )}
        </div>

        {error ? (
          <p className={compStyles.compMsgError} role="alert">
            {error}
          </p>
        ) : !data && loading ? (
          <p className={compStyles.compEmpty}>Cargando folios…</p>
        ) : data && data.items.length === 0 ? (
          <p className={compStyles.compEmpty}>
            {hayFiltros
              ? "Ninguna empresa coincide con los filtros."
              : "No hay empresas registradas."}
          </p>
        ) : data ? (
          <>
            <div className={styles.tableWrap} aria-busy={loading}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Empresa</th>
                    <th scope="col">Modalidad</th>
                    <th scope="col" className={styles.num}>Contratados</th>
                    <th scope="col" className={styles.num}>Asignados</th>
                    <th scope="col" className={styles.num}>Consumidos</th>
                    <th scope="col" className={styles.num}>Disponibles</th>
                    <th scope="col" className={styles.num}>Pend. asignar</th>
                    <th scope="col">Vencimiento</th>
                    <th scope="col">Estado</th>
                    <th scope="col" aria-label="Acciones" />
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((f) => {
                    const c = f.contrato;
                    return (
                      <tr key={f.id}>
                        <td>
                          <strong>{f.nombre}</strong>
                          <span className={styles.historyMeta}>
                            RNC {f.rnc || "—"}
                            {f.ambiente === "demo" ? " · Pruebas (demo)" : ""}
                            {f.alertas > 0
                              ? ` · ${f.alertas} alerta${f.alertas === 1 ? "" : "s"}`
                              : ""}
                          </span>
                        </td>
                        <td>
                          <ModalidadBadge modalidad={f.modalidad} />
                        </td>
                        <td className={styles.num}>
                          <Num value={c?.cantidadContratada} />
                        </td>
                        <td className={styles.num}>
                          <Num value={c?.asignados} />
                        </td>
                        <td className={styles.num}>
                          <Num value={c?.consumidos} />
                        </td>
                        <td className={styles.num}>
                          <Num value={c?.disponible} />
                        </td>
                        <td className={styles.num}>
                          <Num value={c?.pendienteAsignar} />
                        </td>
                        <td>
                          {c ? (
                            <>
                              {formatDia(c.fechaVencimiento)}
                              <span className={styles.historyMeta}>
                                {textoDiasRestantes(c.diasRestantes)}
                              </span>
                            </>
                          ) : (
                            <span className={styles.muted}>
                              {f.modalidad === "CONTROLADO" ? "—" : "Sin vencimiento"}
                            </span>
                          )}
                        </td>
                        <td>
                          <EstadoFoliosBadge estado={f.estado} />
                        </td>
                        <td>
                          <Link href={`/dashboard/empresas/${f.id}`} className={styles.linkBtn}>
                            Ver detalle
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className={styles.pagination}>
              <span>
                {formatNumero(data.total)} empresa{data.total === 1 ? "" : "s"} · página {data.pagina} de{" "}
                {totalPaginas}
              </span>
              <div className={styles.paginationButtons}>
                <button
                  type="button"
                  className={compStyles.compBtn}
                  onClick={() => setPagina((p) => p - 1)}
                  disabled={loading || data.pagina <= 1}
                >
                  Anterior
                </button>
                <button
                  type="button"
                  className={compStyles.compBtn}
                  onClick={() => setPagina((p) => p + 1)}
                  disabled={loading || data.pagina >= totalPaginas}
                >
                  Siguiente
                </button>
              </div>
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}
