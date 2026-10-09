"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FaHashtag } from "react-icons/fa";
import styles from "./EmpresaAdminForm.module.css";
import EmpresaAdminSecuenciaForm from "./EmpresaAdminSecuenciaForm";

const ESTADOS_ACTIVOS = ["activo", "alerta"];

const ESTADOS = [
  { value: "activo", label: "Activo" },
  { value: "inactivo", label: "Inactivo" },
  { value: "vencido", label: "Vencido" },
  { value: "agotado", label: "Agotado" },
  { value: "alerta", label: "Alerta" },
];

function formatRango(inicial, final) {
  return `${Number(inicial).toLocaleString("es-DO")} – ${Number(final).toLocaleString("es-DO")}`;
}

function formatFecha(fecha) {
  if (!fecha) return "—";
  const d = new Date(fecha);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("es-DO", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
}

function toInputDate(value) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

function proximoDe(row) {
  return Number(row.numero_inicial ?? 0) + Number(row.numeros_utilizados ?? 0);
}

function rowId(row) {
  return String(row._id ?? row.id ?? "");
}

function formatearNCF(prefijo, tipo, secuencia) {
  const tipoStr = String(tipo ?? "").padStart(2, "0");
  const secStr = String(secuencia ?? 0).padStart(10, "0");
  return `${prefijo ?? "E"}${tipoStr}${secStr}`;
}

function findTfCorrelativo(row, tfSeriesPayload) {
  const series = tfSeriesPayload?.series;
  if (!Array.isArray(series) || series.length === 0) return null;
  const tipo = String(row.tipo_comprobante ?? row.tipo ?? "").trim();
  const ni = Number(row.numero_inicial);
  const nf = Number(row.numero_final);
  let fallback = null;
  for (const item of series) {
    const td = String(item.tipoDocumento ?? item.tipo_documento ?? "").trim();
    if (td !== tipo) continue;
    const corr = Number(item.correlativo);
    if (!Number.isFinite(corr)) continue;
    const vmin = Number(item.valorMinimo ?? item.valor_minimo);
    const vmax = Number(item.valorMaximo ?? item.valor_maximo);
    if (Number.isFinite(vmin) && Number.isFinite(vmax) && Number.isFinite(ni) && Number.isFinite(nf)) {
      if (ni <= vmax && nf >= vmin) return corr;
    }
    if (fallback == null) fallback = corr;
  }
  return fallback;
}

export default function EmpresaAdminComprobantes({
  userId,
  ambiente,
  reloadToken = 0,
  empresa = null,
}) {
  const [rows, setRows] = useState([]);
  const [resolvedAmbiente, setResolvedAmbiente] = useState(ambiente || "production");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [rowMessage, setRowMessage] = useState(null);
  const [query, setQuery] = useState("");
  const [filterEstado, setFilterEstado] = useState("todos");
  const [pendingAjustar, setPendingAjustar] = useState(null);
  const [ajustandoId, setAjustandoId] = useState(null);
  const [ajustarProximo, setAjustarProximo] = useState("");
  const [ajustarError, setAjustarError] = useState(null);
  const [tfSeriesLoading, setTfSeriesLoading] = useState(false);
  const [tfSeriesPayload, setTfSeriesPayload] = useState(null);
  const [adding, setAdding] = useState(false);

  const fetchRows = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/users/${userId}/comprobantes`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Error al cargar comprobantes");
        setRows([]);
        return;
      }
      setRows(Array.isArray(json.data) ? json.data : []);
      if (json.ambiente === "demo" || json.ambiente === "production") {
        setResolvedAmbiente(json.ambiente);
      }
    } catch {
      setError("Error de conexión al cargar comprobantes");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const fetchTheFactorySeries = useCallback(async () => {
    if (!userId) return;
    setTfSeriesLoading(true);
    try {
      const res = await fetch(`/api/users/${userId}/thefactory-series`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.status !== "success") {
        setTfSeriesPayload(null);
        return;
      }
      setTfSeriesPayload({
        ambiente: json.ambiente,
        rnc: json.rnc,
        series: Array.isArray(json.series) ? json.series : [],
      });
    } catch {
      setTfSeriesPayload(null);
    } finally {
      setTfSeriesLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchRows();
    fetchTheFactorySeries();
  }, [fetchRows, fetchTheFactorySeries, reloadToken]);

  useEffect(() => {
    if (!pendingAjustar) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") closeAjustarModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pendingAjustar, ajustandoId]);

  const openAjustarModal = (row) => {
    const proximo = proximoDe(row);
    const tfCorr = findTfCorrelativo(row, tfSeriesPayload);
    const sugerido =
      tfCorr != null && Number.isFinite(tfCorr) && tfCorr > proximo
        ? tfCorr
        : proximo;
    setPendingAjustar(row);
    setAjustarProximo(String(sugerido));
    setAjustarError(null);
    setRowMessage(null);
    if (!tfSeriesPayload && !tfSeriesLoading) {
      fetchTheFactorySeries();
    }
  };

  useEffect(() => {
    if (!pendingAjustar || !tfSeriesPayload) return;
    const proximo = proximoDe(pendingAjustar);
    const tfCorr = findTfCorrelativo(pendingAjustar, tfSeriesPayload);
    if (tfCorr == null || !Number.isFinite(tfCorr) || tfCorr <= proximo) return;
    setAjustarProximo((current) =>
      String(current) === String(proximo) ? String(tfCorr) : current,
    );
  }, [pendingAjustar, tfSeriesPayload]);

  const closeAjustarModal = () => {
    if (ajustandoId) return;
    setPendingAjustar(null);
    setAjustarProximo("");
    setAjustarError(null);
  };

  const handleAjustarSecuencia = async () => {
    if (!pendingAjustar) return;
    const id = rowId(pendingAjustar);
    const inicial = Number(pendingAjustar.numero_inicial);
    const final = Number(pendingAjustar.numero_final);
    const proximo = Number(String(ajustarProximo).replace(/\D/g, ""));
    if (!Number.isInteger(proximo) || String(ajustarProximo).trim() === "") {
      setAjustarError("Indique el próximo número a emitir.");
      return;
    }
    if (proximo < inicial) {
      setAjustarError(
        `El próximo número no puede ser menor que el inicio del rango (${inicial.toLocaleString("es-DO")}).`,
      );
      return;
    }
    if (proximo > final + 1) {
      setAjustarError(
        `El próximo número no puede superar el final del rango (${final.toLocaleString("es-DO")}).`,
      );
      return;
    }
    setAjustandoId(id);
    setAjustarError(null);
    try {
      const res = await fetch(`/api/users/${userId}/comprobantes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proximo_numero: proximo }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAjustarError(json.error ?? "Error al ajustar la secuencia");
        return;
      }
      setPendingAjustar(null);
      setAjustarProximo("");
      let text = "Secuencia actualizada.";
      if (json.theFactorySync && !json.theFactorySync.ok) {
        text += ` Aviso The Factory: ${json.theFactorySync.message || "no se pudo sincronizar."}`;
      }
      setRowMessage({ type: "success", text });
      await fetchRows();
      await fetchTheFactorySeries();
    } catch {
      setAjustarError("Error de conexión al ajustar la secuencia.");
    } finally {
      setAjustandoId(null);
    }
  };

  const openEdit = (row) => {
    const id = rowId(row);
    setEditingId(id);
    setRowMessage(null);
    setDraft({
      numero_inicial: String(row.numero_inicial ?? ""),
      numero_final: String(row.numero_final ?? ""),
      proximo_numero: String(proximoDe(row)),
      estado: row.estado ?? "activo",
      fecha_vencimiento: toInputDate(row.fecha_vencimiento),
      comentario: row.comentario ?? "",
    });
  };

  const closeEdit = () => {
    if (savingId) return;
    setEditingId(null);
    setDraft(null);
    setRowMessage(null);
  };

  const handleSave = async (row) => {
    const id = rowId(row);
    if (!draft) return;
    const inicial = Number(draft.numero_inicial);
    const final = Number(draft.numero_final);
    const proximo = Number(draft.proximo_numero);
    if (!Number.isInteger(inicial) || !Number.isInteger(final) || !Number.isInteger(proximo)) {
      setRowMessage({ type: "error", text: "Inicial, final y próximo deben ser enteros." });
      return;
    }
    setSavingId(id);
    setRowMessage(null);
    try {
      const res = await fetch(`/api/users/${userId}/comprobantes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          numero_inicial: inicial,
          numero_final: final,
          proximo_numero: proximo,
          estado: draft.estado,
          fecha_vencimiento: draft.fecha_vencimiento || null,
          comentario: draft.comentario,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRowMessage({
          type: "error",
          text: json.error ?? "No se pudo guardar la secuencia",
        });
        return;
      }
      let text = "Secuencia actualizada.";
      if (json.theFactorySync && !json.theFactorySync.ok) {
        text += ` Aviso The Factory: ${json.theFactorySync.message || "no se pudo sincronizar."}`;
      }
      setRowMessage({ type: "success", text });
      setEditingId(null);
      setDraft(null);
      await fetchRows();
    } catch {
      setRowMessage({ type: "error", text: "Error de conexión al guardar." });
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (row) => {
    const id = rowId(row);
    const titulo = row.descripcion_tipo || `Tipo ${row.tipo_comprobante}`;
    if (
      !window.confirm(
        `¿Eliminar la secuencia ${titulo} (${formatRango(row.numero_inicial, row.numero_final)}) en Giganet y, si existe, en The Factory?`,
      )
    ) {
      return;
    }
    setDeletingId(id);
    setRowMessage(null);
    try {
      const res = await fetch(`/api/users/${userId}/comprobantes/${id}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRowMessage({
          type: "error",
          text: json.error ?? "No se pudo eliminar la secuencia",
        });
        return;
      }
      if (editingId === id) {
        setEditingId(null);
        setDraft(null);
      }
      setRowMessage({ type: "success", text: json.message ?? "Secuencia eliminada." });
      await fetchRows();
    } catch {
      setRowMessage({ type: "error", text: "Error de conexión al eliminar." });
    } finally {
      setDeletingId(null);
    }
  };

  const isDemo = resolvedAmbiente === "demo";
  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      const estado = String(row.estado ?? "activo").toLowerCase();
      if (filterEstado === "activos" && !ESTADOS_ACTIVOS.includes(estado)) {
        return false;
      }
      if (filterEstado === "vencidos" && estado !== "vencido") {
        return false;
      }
      if (filterEstado === "agotados" && estado !== "agotado") {
        return false;
      }
      if (!q) return true;
      const tipo = String(row.tipo_comprobante ?? "").toLowerCase();
      return tipo.includes(q);
    });
  }, [rows, query, filterEstado]);

  return (
    <section className={styles.compSection} aria-labelledby="admin-comprobantes-title">
      <div className={styles.compHeader}>
        <div>
          <h2 id="admin-comprobantes-title" className={styles.compTitle}>
            Comprobantes de la empresa
          </h2>
          <p className={styles.compSubtitle}>
            Se cargan las secuencias del ambiente activo. Puede agregar una
            serie, usar # para alinear Giganet con The Factory, o editar el rango.
          </p>
        </div>
        <div className={styles.compHeaderActions}>
          <span
            className={isDemo ? styles.compBadgeDemo : styles.compBadgeProd}
          >
            {isDemo ? "Pruebas (demo)" : "Producción"}
          </span>
          <button
            type="button"
            className={styles.compRefresh}
            onClick={fetchRows}
            disabled={loading}
          >
            {loading ? "Cargando…" : "Actualizar"}
          </button>
          <button
            type="button"
            className={styles.compBtnPrimary}
            onClick={() => {
              setAdding((open) => !open);
              setRowMessage(null);
            }}
            disabled={loading}
          >
            {adding ? "Cerrar alta" : "Agregar secuencia"}
          </button>
        </div>
      </div>

      <div className={styles.compFilters}>
        <div className={styles.compFilterEstado}>
          <label htmlFor="admin-comp-estado" className={styles.compFilterLabel}>
            Estado
          </label>
          <select
            id="admin-comp-estado"
            className={styles.compFilterSelect}
            value={filterEstado}
            onChange={(e) => setFilterEstado(e.target.value)}
            aria-label="Filtrar por estado: todos, activos o vencidos">
            <option value="todos">Todos</option>
            <option value="activos">Activos</option>
            <option value="vencidos">Vencidos</option>
            <option value="agotados">Agotados</option>
          </select>
        </div>
      <div className={styles.compSearchWrap}>
        <span className={styles.compSearchIcon} aria-hidden>
          <svg
            width="18"
            height="18"
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
          className={styles.compSearchInput}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por tipo (ej. 31, 32, 34)…"
          aria-label="Buscar comprobantes por tipo"
        />
        {query && (
          <button
            type="button"
            className={styles.compSearchClear}
            onClick={() => setQuery("")}
            aria-label="Limpiar búsqueda">
            <svg
              width="16"
              height="16"
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

      {adding && (
        <EmpresaAdminSecuenciaForm
          userId={userId}
          empresa={empresa}
          onCancel={() => setAdding(false)}
          onCreated={(data) => {
            setAdding(false);
            let text = data.message || "Secuencia creada.";
            if (data.theFactorySync && !data.theFactorySync.ok) {
              text += ` Aviso The Factory: ${data.theFactorySync.message || "no se pudo sincronizar."}`;
            }
            setRowMessage({ type: "success", text });
            fetchRows();
            fetchTheFactorySeries();
          }}
        />
      )}

      {rowMessage && (
        <p
          className={
            rowMessage.type === "success"
              ? styles.compMsgSuccess
              : styles.compMsgError
          }
          role="status"
        >
          {rowMessage.text}
        </p>
      )}

      {loading ? (
        <p className={styles.compEmpty}>Cargando secuencias…</p>
      ) : error ? (
        <p className={styles.compMsgError} role="alert">
          {error}
        </p>
      ) : rows.length === 0 ? (
        <div className={styles.compEmptyBox}>
          <p className={styles.compEmpty}>
            Esta empresa no tiene secuencias en el ambiente{" "}
            {isDemo ? "demo" : "producción"}.
          </p>
          {!adding && (
            <button
              type="button"
              className={styles.compBtnPrimary}
              onClick={() => {
                setAdding(true);
                setRowMessage(null);
              }}
            >
              Agregar la primera secuencia
            </button>
          )}
        </div>
      ) : filteredRows.length === 0 ? (
        <p className={styles.compEmpty}>
          {query.trim()
            ? `Ningún comprobante coincide con el tipo “${query.trim()}”.`
            : filterEstado === "activos"
              ? "No hay comprobantes activos."
              : filterEstado === "vencidos"
                ? "No hay comprobantes vencidos."
                : filterEstado === "agotados"
                  ? "No hay comprobantes agotados."
                  : "Ningún comprobante coincide con el filtro."}
        </p>
      ) : (
        <ul className={styles.compList}>
          {filteredRows.map((row) => {
            const id = rowId(row);
            const isEditing = editingId === id;
            const proximo = proximoDe(row);
            return (
              <li key={id} className={styles.compCard}>
                <div className={styles.compCardTop}>
                  <div>
                    <p className={styles.compTipo}>
                      Tipo {row.tipo_comprobante}
                    </p>
                    <h3 className={styles.compCardTitle}>
                      {row.descripcion_tipo || `Comprobante ${row.tipo_comprobante}`}
                    </h3>
                  </div>
                  <span
                    className={`${styles.compEstado} ${
                      styles[`compEstado_${row.estado}`] ?? ""
                    }`}
                  >
                    {(row.estado || "activo").toUpperCase()}
                  </span>
                </div>
                <dl className={styles.compMeta}>
                  <div>
                    <dt>Rango</dt>
                    <dd>{formatRango(row.numero_inicial, row.numero_final)}</dd>
                  </div>
                  <div>
                    <dt>Próximo</dt>
                    <dd>
                      <button
                        type="button"
                        className={styles.compProximoBtn}
                        onClick={() => openAjustarModal(row)}
                        title="Ajustar próximo número"
                        aria-label={`Ajustar próximo número ${proximo.toLocaleString("es-DO")}`}
                        disabled={!!savingId || deletingId === id || !!ajustandoId}
                      >
                        <FaHashtag size={12} aria-hidden />
                        {proximo.toLocaleString("es-DO")}
                      </button>
                    </dd>
                  </div>
                  <div>
                    <dt>Utilizados</dt>
                    <dd>{Number(row.numeros_utilizados ?? 0).toLocaleString("es-DO")}</dd>
                  </div>
                  <div>
                    <dt>Disponibles</dt>
                    <dd>{Number(row.numeros_disponibles ?? 0).toLocaleString("es-DO")}</dd>
                  </div>
                  <div>
                    <dt>Vence</dt>
                    <dd>{formatFecha(row.fecha_vencimiento)}</dd>
                  </div>
                </dl>
                <div className={styles.compActions}>
                  <button
                    type="button"
                    className={styles.compBtnHash}
                    onClick={() => openAjustarModal(row)}
                    title="Ajustar secuencia"
                    aria-label="Ajustar próximo número de secuencia"
                    disabled={!!savingId || deletingId === id || !!ajustandoId}
                  >
                    <FaHashtag size={14} aria-hidden />
                  </button>
                  <button
                    type="button"
                    className={styles.compBtn}
                    onClick={() => (isEditing ? closeEdit() : openEdit(row))}
                    disabled={!!savingId || deletingId === id}
                  >
                    {isEditing ? "Cerrar" : "Editar / ajustar"}
                  </button>
                  <button
                    type="button"
                    className={styles.compBtnDanger}
                    onClick={() => handleDelete(row)}
                    disabled={!!savingId || deletingId === id}
                  >
                    {deletingId === id ? "Eliminando…" : "Eliminar"}
                  </button>
                </div>
                {isEditing && draft && (
                  <div className={styles.compEditor}>
                    <div className={styles.compEditorGrid}>
                      <label>
                        Número inicial
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={draft.numero_inicial}
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, numero_inicial: e.target.value }))
                          }
                          disabled={!!savingId}
                        />
                      </label>
                      <label>
                        Número final
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={draft.numero_final}
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, numero_final: e.target.value }))
                          }
                          disabled={!!savingId}
                        />
                      </label>
                      <label>
                        Próximo a emitir
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={draft.proximo_numero}
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, proximo_numero: e.target.value }))
                          }
                          disabled={!!savingId}
                        />
                      </label>
                      <label>
                        Estado
                        <select
                          value={draft.estado}
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, estado: e.target.value }))
                          }
                          disabled={!!savingId}
                        >
                          {ESTADOS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Vencimiento
                        <input
                          type="date"
                          value={draft.fecha_vencimiento}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              fecha_vencimiento: e.target.value,
                            }))
                          }
                          disabled={!!savingId}
                        />
                      </label>
                      <label className={styles.compEditorFull}>
                        Comentario
                        <input
                          type="text"
                          maxLength={500}
                          value={draft.comentario}
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, comentario: e.target.value }))
                          }
                          disabled={!!savingId}
                        />
                      </label>
                    </div>
                    <div className={styles.compEditorActions}>
                      <button
                        type="button"
                        className={styles.compBtnPrimary}
                        onClick={() => handleSave(row)}
                        disabled={!!savingId}
                      >
                        {savingId === id ? "Guardando…" : "Guardar cambios"}
                      </button>
                      <button
                        type="button"
                        className={styles.compBtn}
                        onClick={closeEdit}
                        disabled={!!savingId}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {pendingAjustar && (() => {
        const inicial = Number(pendingAjustar.numero_inicial ?? 0);
        const final = Number(pendingAjustar.numero_final ?? 0);
        const actual = proximoDe(pendingAjustar);
        const tfCorr = findTfCorrelativo(pendingAjustar, tfSeriesPayload);
        const proximoParsed = Number(String(ajustarProximo).replace(/\D/g, ""));
        const proximoValido =
          Number.isInteger(proximoParsed) &&
          String(ajustarProximo).trim() !== "" &&
          proximoParsed >= inicial &&
          proximoParsed <= final + 1;
        const nuevosUtilizados = proximoValido ? proximoParsed - inicial : null;
        const cantidad = final - inicial + 1;
        const nuevosDisponibles =
          nuevosUtilizados != null ? Math.max(0, cantidad - nuevosUtilizados) : null;
        const ncfPreview = proximoValido
          ? formatearNCF(pendingAjustar.prefijo ?? "E", pendingAjustar.tipo_comprobante, proximoParsed)
          : null;
        const vaAtras = proximoValido && proximoParsed < actual;
        const sinCambio = proximoValido && proximoParsed === actual;

        return (
          <div
            className={styles.compModalOverlay}
            onClick={closeAjustarModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-modal-ajustar-title"
            aria-describedby="admin-modal-ajustar-desc"
          >
            <div
              className={styles.compModalContent}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.compModalIcon}>
                <FaHashtag size={24} aria-hidden />
              </div>
              <h2 id="admin-modal-ajustar-title" className={styles.compModalTitle}>
                Ajustar secuencia
              </h2>
              <p id="admin-modal-ajustar-desc" className={styles.compModalMessage}>
                Adelante el próximo número si ya emitió e-CF desde The Factory
                u otro sistema, para que Giganet no reutilice esos NCF.
              </p>
              <p className={styles.compModalDetail}>
                <strong>
                  {pendingAjustar.descripcion_tipo ||
                    `Tipo ${pendingAjustar.tipo_comprobante}`}
                </strong>
                {pendingAjustar.tipo_comprobante != null && (
                  <> — Tipo {pendingAjustar.tipo_comprobante}</>
                )}
              </p>
              <div className={styles.compAjustarMeta}>
                <div>
                  <p className={styles.compAjustarLabel}>Rango</p>
                  <p className={styles.compAjustarValue}>
                    {formatRango(inicial, final)}
                  </p>
                </div>
                <div>
                  <p className={styles.compAjustarLabel}>Próximo actual</p>
                  <p className={styles.compAjustarValue}>
                    {Number(actual).toLocaleString("es-DO")}
                  </p>
                </div>
                <div>
                  <p className={styles.compAjustarLabel}>The Factory</p>
                  <p className={styles.compAjustarValue}>
                    {tfSeriesLoading
                      ? "…"
                      : tfCorr != null
                        ? Number(tfCorr).toLocaleString("es-DO")
                        : "—"}
                  </p>
                </div>
              </div>
              {tfCorr != null && tfCorr > actual && (
                <p className={styles.compAjustarHint} role="status">
                  The Factory ya va por {Number(tfCorr).toLocaleString("es-DO")}.
                  Use ese correlativo para que Giganet no reutilice NCF ya
                  emitidos allá.
                </p>
              )}
              {tfCorr != null && tfCorr < actual && (
                <p className={styles.compAjustarHint} role="status">
                  The Factory reporta {Number(tfCorr).toLocaleString("es-DO")},
                  por detrás de Giganet. No lo use salvo que deba retroceder
                  a propósito.
                </p>
              )}
              <div className={styles.compModalForm}>
                <label htmlFor="admin-ajustar-proximo" className={styles.compAjustarLabel}>
                  Próximo número a emitir
                </label>
                <input
                  id="admin-ajustar-proximo"
                  type="number"
                  min={inicial}
                  max={final + 1}
                  step={1}
                  className={styles.compModalInput}
                  value={ajustarProximo}
                  onChange={(e) => {
                    setAjustarProximo(e.target.value);
                    setAjustarError(null);
                  }}
                  disabled={!!ajustandoId}
                  autoFocus
                />
                {tfCorr != null && tfCorr !== proximoParsed && (
                  <button
                    type="button"
                    className={styles.compAjustarUsarTf}
                    onClick={() => {
                      setAjustarProximo(String(tfCorr));
                      setAjustarError(null);
                    }}
                    disabled={!!ajustandoId}
                  >
                    Usar correlativo de The Factory ({tfCorr.toLocaleString("es-DO")})
                  </button>
                )}
                {ncfPreview && (
                  <p className={styles.compAjustarPreview}>
                    NCF: <strong>{ncfPreview}</strong>
                    {nuevosUtilizados != null && (
                      <>
                        {" · "}
                        Utilizados {nuevosUtilizados.toLocaleString("es-DO")}
                        {" · "}
                        Disponibles {nuevosDisponibles.toLocaleString("es-DO")}
                      </>
                    )}
                  </p>
                )}
                {vaAtras && (
                  <p className={styles.compAjustarWarn} role="alert">
                    Está retrocediendo la secuencia. Solo hágalo si el número
                    actual no se llegó a emitir.
                  </p>
                )}
                {ajustarError && (
                  <p className={styles.compAjustarError} role="alert">
                    {ajustarError}
                  </p>
                )}
              </div>
              <div className={styles.compModalActions}>
                <button
                  type="button"
                  className={styles.compBtn}
                  onClick={closeAjustarModal}
                  disabled={!!ajustandoId}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className={styles.compBtnPrimary}
                  onClick={handleAjustarSecuencia}
                  disabled={!!ajustandoId || !proximoValido || sinCambio}
                >
                  {ajustandoId ? "Guardando…" : "Guardar secuencia"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </section>
  );
}
