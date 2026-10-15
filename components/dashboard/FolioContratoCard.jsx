"use client";

import { useCallback, useEffect, useState } from "react";
import compStyles from "./EmpresaAdminForm.module.css";
import styles from "./EmpresaFolios.module.css";
import CampoFecha from "./CampoFecha";
import {
  ETIQUETAS_ACCION,
  EstadoFoliosBadge,
  fetchJson,
  formatDia,
  formatFechaHora,
  formatNumero,
  textoDiasRestantes,
} from "./foliosUi";

const ESTADO_CONSUMO = {
  confirmado: "Consumido",
  reservado: "En proceso",
};

function draftDesdeContrato(c) {
  return {
    cantidadContratada: String(c.cantidadContratada),
    fechaInicio: c.fechaInicio,
    fechaVencimiento: c.fechaVencimiento,
    consumoPrevio: String(c.consumoPrevio || 0),
    observaciones: c.observaciones || "",
    saldoCantidad: c.saldoTheFactory?.cantidad ?? "",
    saldoNota: c.saldoTheFactory?.nota || "",
    motivo: "",
  };
}

export default function FolioContratoCard({ userId, contrato, hoy, onChanged, onRenovar, disabled }) {
  const base = `/api/users/${userId}/folios/contratos/${contrato.id}`;
  const [modo, setModo] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [asignacion, setAsignacion] = useState({ cantidad: "", fecha: hoy, observaciones: "" });
  const [draft, setDraft] = useState(() => draftDesdeContrato(contrato));
  const [ajuste, setAjuste] = useState({ cantidad: "", motivo: "" });
  const [cancelando, setCancelando] = useState(false);
  const [motivoCancelacion, setMotivoCancelacion] = useState("");
  const [detalle, setDetalle] = useState(null);
  const [detalleLoading, setDetalleLoading] = useState(false);
  const [paginaConsumo, setPaginaConsumo] = useState(1);

  const cancelado = contrato.estado === "cancelado";
  const vencido = contrato.estadoCalculado === "VENCIDO";

  const cargarDetalle = useCallback(
    async (pagina = 1) => {
      setDetalleLoading(true);
      setError(null);
      try {
        const data = await fetchJson(`${base}?pagina=${pagina}&porPagina=20`);
        setDetalle(data);
        setPaginaConsumo(pagina);
      } catch (err) {
        setError(err.message);
      } finally {
        setDetalleLoading(false);
      }
    },
    [base],
  );

  useEffect(() => {
    if (modo === "detalle") cargarDetalle(1);
  }, [modo, cargarDetalle]);

  const toggle = (nuevo) => {
    setError(null);
    if (nuevo === "editar") setDraft(draftDesdeContrato(contrato));
    if (nuevo === "asignar") setAsignacion({ cantidad: "", fecha: hoy, observaciones: "" });
    setModo((m) => (m === nuevo ? null : nuevo));
  };

  const ejecutar = async (fn, mensajeExito, { cerrar = true } = {}) => {
    setSaving(true);
    setError(null);
    try {
      await fn();
      if (cerrar) setModo(null);
      onChanged?.({ type: "success", text: mensajeExito });
      if (!cerrar && modo === "detalle") await cargarDetalle(paginaConsumo);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const guardarAsignacion = (e) => {
    e.preventDefault();
    ejecutar(
      () =>
        fetchJson(`${base}/asignaciones`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(asignacion),
        }),
      `Asignación de ${formatNumero(asignacion.cantidad)} folios registrada en ${contrato.codigo}.`,
    );
  };

  const guardarEdicion = (e) => {
    e.preventDefault();
    const cambios = {};
    if (Number(draft.cantidadContratada) !== contrato.cantidadContratada) {
      cambios.cantidadContratada = draft.cantidadContratada;
    }
    if (draft.fechaInicio !== contrato.fechaInicio) cambios.fechaInicio = draft.fechaInicio;
    if (draft.fechaVencimiento !== contrato.fechaVencimiento) {
      cambios.fechaVencimiento = draft.fechaVencimiento;
    }
    if (Number(draft.consumoPrevio) !== (contrato.consumoPrevio || 0)) {
      cambios.consumoPrevio = draft.consumoPrevio;
    }
    if (draft.observaciones !== (contrato.observaciones || "")) {
      cambios.observaciones = draft.observaciones;
    }
    const saldoActual = contrato.saldoTheFactory?.cantidad ?? "";
    if (
      String(draft.saldoCantidad) !== String(saldoActual) ||
      draft.saldoNota !== (contrato.saldoTheFactory?.nota || "")
    ) {
      cambios.saldoTheFactory = { cantidad: draft.saldoCantidad, nota: draft.saldoNota };
    }
    if (!Object.keys(cambios).length) {
      setError("No hay cambios para guardar.");
      return;
    }
    cambios.motivo = draft.motivo;
    ejecutar(
      () =>
        fetchJson(base, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cambios),
        }),
      `Contrato ${contrato.codigo} actualizado.`,
    );
  };

  const cambiarEstado = (estado, motivo = "") =>
    ejecutar(
      () =>
        fetchJson(base, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ estado, motivo }),
        }),
      estado === "cancelado"
        ? `Contrato ${contrato.codigo} cancelado.`
        : `Contrato ${contrato.codigo} reactivado.`,
    );

  const guardarAjuste = (e) => {
    e.preventDefault();
    ejecutar(
      () =>
        fetchJson(`${base}/ajustes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tipo: "consumo", ...ajuste, cantidad: Number(ajuste.cantidad) }),
        }),
      `Ajuste de consumo aplicado a ${contrato.codigo}.`,
      { cerrar: false },
    ).then((ok) => ok && setAjuste({ cantidad: "", motivo: "" }));
  };

  const recalcular = () =>
    ejecutar(
      () =>
        fetchJson(`${base}/ajustes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tipo: "recalcular" }),
        }),
      `Contadores de ${contrato.codigo} recalculados.`,
      { cerrar: false },
    );

  const bloqueado = disabled || saving;
  const totalPaginas = detalle
    ? Math.max(1, Math.ceil(detalle.consumos.total / detalle.consumos.porPagina))
    : 1;

  return (
    <li className={compStyles.compCard}>
      <div className={compStyles.compCardTop}>
        <div>
          <p className={compStyles.compTipo}>
            {contrato.renovacionDe ? "Renovación" : "Contrato"} · {contrato.codigo}
          </p>
          <h3 className={compStyles.compCardTitle}>
            {formatNumero(contrato.cantidadContratada)} folios ·{" "}
            {formatDia(contrato.fechaInicio)} – {formatDia(contrato.fechaVencimiento)}
          </h3>
          {!cancelado && (
            <p className={styles.subtle}>{textoDiasRestantes(contrato.diasRestantes)}</p>
          )}
          {cancelado && contrato.motivoCancelacion && (
            <p className={styles.subtle}>Motivo: {contrato.motivoCancelacion}</p>
          )}
        </div>
        <EstadoFoliosBadge estado={contrato.estadoCalculado} />
      </div>

      <dl className={compStyles.compMeta}>
        <div>
          <dt>Asignados</dt>
          <dd>{formatNumero(contrato.asignados)}</dd>
        </div>
        <div>
          <dt>Pendiente asignar</dt>
          <dd>{formatNumero(contrato.pendienteAsignar)}</dd>
        </div>
        <div>
          <dt>Consumidos</dt>
          <dd>
            {formatNumero(contrato.consumidos)}
            {contrato.reservados > 0 && (
              <span className={styles.subtle}> (+{formatNumero(contrato.reservados)} en proceso)</span>
            )}
            {contrato.consumoPrevio > 0 && (
              <span className={styles.subtle}>
                {" "}
                · {formatNumero(contrato.consumoPrevio)} antes del control
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt>Disponibles</dt>
          <dd>{formatNumero(contrato.disponible)}</dd>
        </div>
        <div>
          <dt>Saldo The Factory</dt>
          <dd>
            {contrato.saldoTheFactory?.cantidad != null ? (
              <span title={formatFechaHora(contrato.saldoTheFactory.fecha)}>
                {formatNumero(contrato.saldoTheFactory.cantidad)}
              </span>
            ) : (
              <span className={styles.muted}>Sin confirmar</span>
            )}
          </dd>
        </div>
      </dl>

      <div className={compStyles.compActions}>
        {!cancelado && !vencido && (
          <button
            type="button"
            className={compStyles.compBtnPrimary}
            onClick={() => toggle("asignar")}
            disabled={bloqueado || contrato.pendienteAsignar === 0}
            title={contrato.pendienteAsignar === 0 ? "Todo lo contratado ya fue asignado" : undefined}
          >
            {modo === "asignar" ? "Cerrar asignación" : "Registrar asignación"}
          </button>
        )}
        <button
          type="button"
          className={compStyles.compBtn}
          onClick={() => toggle("detalle")}
          disabled={disabled}
          aria-expanded={modo === "detalle"}
        >
          {modo === "detalle" ? "Ocultar detalle" : "Ver detalle"}
        </button>
        <button
          type="button"
          className={compStyles.compBtn}
          onClick={() => toggle("editar")}
          disabled={bloqueado}
        >
          {modo === "editar" ? "Cerrar edición" : "Editar"}
        </button>
        {!cancelado && (
          <button
            type="button"
            className={compStyles.compBtn}
            onClick={() => onRenovar?.(contrato)}
            disabled={bloqueado}
          >
            Renovar
          </button>
        )}
        {cancelado ? (
          <button
            type="button"
            className={compStyles.compBtn}
            onClick={() => cambiarEstado("activo")}
            disabled={bloqueado}
          >
            Reactivar
          </button>
        ) : (
          <button
            type="button"
            className={compStyles.compBtnDanger}
            onClick={() => {
              setMotivoCancelacion("");
              setError(null);
              setCancelando(true);
            }}
            disabled={bloqueado}
          >
            Cancelar contrato
          </button>
        )}
      </div>

      {error && !cancelando && (
        <p className={compStyles.compMsgError} role="alert" style={{ marginTop: "0.85rem" }}>
          {error}
        </p>
      )}

      {modo === "asignar" && (
        <form className={compStyles.compEditor} onSubmit={guardarAsignacion}>
          <p className={styles.subtle} style={{ marginTop: 0 }}>
            Registre aquí la cantidad que ya asignó manualmente en The Factory. Pendiente de asignar:{" "}
            <strong>{formatNumero(contrato.pendienteAsignar)}</strong>. La fecha de vencimiento del
            contrato no cambia.
          </p>
          <div className={compStyles.compEditorGrid}>
            <label>
              Cantidad asignada *
              <input
                type="number"
                min={1}
                max={contrato.pendienteAsignar}
                step={1}
                required
                value={asignacion.cantidad}
                onChange={(e) => setAsignacion((a) => ({ ...a, cantidad: e.target.value }))}
                disabled={saving}
              />
            </label>
            <label>
              Fecha de asignación *
              <CampoFecha
                required
                value={asignacion.fecha}
                onChange={(dia) => setAsignacion((a) => ({ ...a, fecha: dia }))}
                disabled={saving}
              />
            </label>
            <label className={compStyles.compEditorFull}>
              Observaciones
              <input
                type="text"
                maxLength={500}
                value={asignacion.observaciones}
                onChange={(e) => setAsignacion((a) => ({ ...a, observaciones: e.target.value }))}
                placeholder="Ej. Asignación de mayo en The Factory"
                disabled={saving}
              />
            </label>
          </div>
          <div className={compStyles.compEditorActions}>
            <button type="submit" className={compStyles.compBtnPrimary} disabled={saving}>
              {saving ? "Registrando…" : "Registrar asignación"}
            </button>
            <button type="button" className={compStyles.compBtn} onClick={() => setModo(null)} disabled={saving}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {modo === "editar" && (
        <form className={compStyles.compEditor} onSubmit={guardarEdicion}>
          <div className={compStyles.compEditorGrid}>
            <label>
              Cantidad contratada *
              <input
                type="number"
                min={Math.max(1, contrato.asignados, contrato.consumidos)}
                step={1}
                required
                value={draft.cantidadContratada}
                onChange={(e) => setDraft((d) => ({ ...d, cantidadContratada: e.target.value }))}
                disabled={saving}
              />
            </label>
            <label>
              Saldo confirmado por The Factory
              <input
                type="number"
                min={0}
                step={1}
                value={draft.saldoCantidad}
                onChange={(e) => setDraft((d) => ({ ...d, saldoCantidad: e.target.value }))}
                placeholder="Opcional"
                disabled={saving}
              />
            </label>
            <label>
              Fecha de inicio *
              <CampoFecha
                required
                value={draft.fechaInicio}
                onChange={(dia) => setDraft((d) => ({ ...d, fechaInicio: dia }))}
                disabled={saving}
              />
            </label>
            <label>
              Fecha de vencimiento *
              <CampoFecha
                required
                min={draft.fechaInicio}
                value={draft.fechaVencimiento}
                onChange={(dia) => setDraft((d) => ({ ...d, fechaVencimiento: dia }))}
                disabled={saving}
              />
            </label>
            <label>
              Consumidos antes del control
              <input
                type="number"
                min={0}
                max={contrato.asignados}
                step={1}
                value={draft.consumoPrevio}
                onChange={(e) => setDraft((d) => ({ ...d, consumoPrevio: e.target.value }))}
                disabled={saving}
                title="e-NCF emitidos antes de activar el control de folios; se suman a los consumidos"
              />
            </label>
            <label className={compStyles.compEditorFull}>
              Nota del saldo The Factory
              <input
                type="text"
                maxLength={500}
                value={draft.saldoNota}
                onChange={(e) => setDraft((d) => ({ ...d, saldoNota: e.target.value }))}
                disabled={saving}
              />
            </label>
            <label className={compStyles.compEditorFull}>
              Observaciones
              <input
                type="text"
                maxLength={1000}
                value={draft.observaciones}
                onChange={(e) => setDraft((d) => ({ ...d, observaciones: e.target.value }))}
                disabled={saving}
              />
            </label>
            <label className={compStyles.compEditorFull}>
              Motivo del cambio (queda en la auditoría)
              <input
                type="text"
                maxLength={500}
                value={draft.motivo}
                onChange={(e) => setDraft((d) => ({ ...d, motivo: e.target.value }))}
                disabled={saving}
              />
            </label>
          </div>
          <div className={compStyles.compEditorActions}>
            <button type="submit" className={compStyles.compBtnPrimary} disabled={saving}>
              {saving ? "Guardando…" : "Guardar cambios"}
            </button>
            <button type="button" className={compStyles.compBtn} onClick={() => setModo(null)} disabled={saving}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {modo === "detalle" && (
        <div className={compStyles.compEditor}>
          {detalleLoading && !detalle ? (
            <p className={compStyles.compEmpty}>Cargando detalle…</p>
          ) : detalle ? (
            <>
              <h4 className={styles.sectionTitle} style={{ marginTop: 0 }}>
                Historial de asignaciones
              </h4>
              {detalle.asignaciones.length === 0 ? (
                <p className={styles.subtle}>Aún no se han registrado asignaciones.</p>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th scope="col">Fecha</th>
                        <th scope="col" className={styles.num}>Cantidad</th>
                        <th scope="col">Administrador</th>
                        <th scope="col">Observaciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detalle.asignaciones.map((a) => (
                        <tr key={a.id}>
                          <td>{formatDia(a.fecha)}</td>
                          <td className={styles.num}>{formatNumero(a.cantidad)}</td>
                          <td>{a.adminEmail || "—"}</td>
                          <td>{a.observaciones || <span className={styles.muted}>—</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <h4 className={styles.sectionTitle}>Historial de consumo</h4>
              {detalle.consumos.total === 0 ? (
                <p className={styles.subtle}>No se han emitido comprobantes con este contrato.</p>
              ) : (
                <>
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th scope="col">e-NCF</th>
                          <th scope="col">Tipo</th>
                          <th scope="col">Estado</th>
                          <th scope="col">Respuesta</th>
                          <th scope="col" className={styles.num}>Intentos</th>
                          <th scope="col">Fecha</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detalle.consumos.items.map((c) => (
                          <tr key={c.id}>
                            <td>{c.ncf}</td>
                            <td>{c.tipoComprobante || "—"}</td>
                            <td>
                              {ESTADO_CONSUMO[c.estado] ?? c.estado}
                              {c.pendienteVerificacion && (
                                <span className={styles.subtle}> · por verificar</span>
                              )}
                            </td>
                            <td>{c.resultado || <span className={styles.muted}>—</span>}</td>
                            <td className={styles.num}>{c.intentos}</td>
                            <td>{formatFechaHora(c.confirmadoEn || c.reservadoEn)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className={styles.pagination}>
                    <span>
                      {formatNumero(detalle.consumos.total)} comprobantes · página {paginaConsumo} de{" "}
                      {totalPaginas}
                    </span>
                    <div className={styles.paginationButtons}>
                      <button
                        type="button"
                        className={compStyles.compBtn}
                        onClick={() => cargarDetalle(paginaConsumo - 1)}
                        disabled={detalleLoading || paginaConsumo <= 1}
                      >
                        Anterior
                      </button>
                      <button
                        type="button"
                        className={compStyles.compBtn}
                        onClick={() => cargarDetalle(paginaConsumo + 1)}
                        disabled={detalleLoading || paginaConsumo >= totalPaginas}
                      >
                        Siguiente
                      </button>
                    </div>
                  </div>
                </>
              )}

              <h4 className={styles.sectionTitle}>Ajustes administrativos</h4>
              <form onSubmit={guardarAjuste}>
                <div className={compStyles.compEditorGrid}>
                  <label>
                    Ajuste de consumo (+/-) *
                    <input
                      type="number"
                      step={1}
                      required
                      value={ajuste.cantidad}
                      onChange={(e) => setAjuste((a) => ({ ...a, cantidad: e.target.value }))}
                      placeholder="Ej. -3 o 10"
                      disabled={saving}
                    />
                  </label>
                  <label>
                    Motivo *
                    <input
                      type="text"
                      required
                      maxLength={500}
                      value={ajuste.motivo}
                      onChange={(e) => setAjuste((a) => ({ ...a, motivo: e.target.value }))}
                      placeholder="Ej. Conciliación con reporte de The Factory"
                      disabled={saving}
                    />
                  </label>
                </div>
                <div className={compStyles.compEditorActions}>
                  <button type="submit" className={compStyles.compBtnPrimary} disabled={saving}>
                    Aplicar ajuste
                  </button>
                  <button type="button" className={compStyles.compBtn} onClick={recalcular} disabled={saving}>
                    Recalcular contadores
                  </button>
                </div>
              </form>

              <h4 className={styles.sectionTitle}>Auditoría del contrato</h4>
              {detalle.auditoria.length === 0 ? (
                <p className={styles.subtle}>Sin registros.</p>
              ) : (
                <ul className={styles.historyList}>
                  {detalle.auditoria.map((a) => (
                    <li key={a.id} className={styles.historyItem}>
                      {ETIQUETAS_ACCION[a.accion] ?? a.accion}
                      {a.motivo ? ` — ${a.motivo}` : ""}
                      <span className={styles.historyMeta}>
                        {formatFechaHora(a.createdAt)} · {a.adminEmail || "Sistema"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : null}
        </div>
      )}

      {cancelando && (
        <div
          className={compStyles.compModalOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby={`cancelar-${contrato.id}`}
          onKeyDown={(e) => e.key === "Escape" && !saving && setCancelando(false)}
        >
          <div className={compStyles.compModalContent}>
            <h3 id={`cancelar-${contrato.id}`} className={compStyles.compModalTitle}>
              Cancelar contrato {contrato.codigo}
            </h3>
            <p className={compStyles.compModalMessage}>
              El contrato dejará de usarse para emitir. Se conserva todo su historial y puede
              reactivarse después.
            </p>
            <div className={compStyles.compModalForm}>
              <label className={styles.subtle} htmlFor={`motivo-cancel-${contrato.id}`}>
                Motivo de la cancelación *
              </label>
              <textarea
                id={`motivo-cancel-${contrato.id}`}
                className={`${compStyles.compModalInput} ${styles.modalTextarea}`}
                value={motivoCancelacion}
                onChange={(e) => setMotivoCancelacion(e.target.value)}
                maxLength={500}
                autoFocus
              />
              {error && <p className={compStyles.compAjustarError}>{error}</p>}
            </div>
            <div className={compStyles.compModalActions}>
              <button
                type="button"
                className={compStyles.compBtn}
                onClick={() => setCancelando(false)}
                disabled={saving}
              >
                Volver
              </button>
              <button
                type="button"
                className={compStyles.compBtnDanger}
                disabled={saving || !motivoCancelacion.trim()}
                onClick={async () => {
                  if (await cambiarEstado("cancelado", motivoCancelacion.trim())) {
                    setCancelando(false);
                  }
                }}
              >
                {saving ? "Cancelando…" : "Cancelar contrato"}
              </button>
            </div>
          </div>
        </div>
      )}
    </li>
  );
}
