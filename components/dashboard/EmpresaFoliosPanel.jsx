"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import compStyles from "./EmpresaAdminForm.module.css";
import styles from "./EmpresaFolios.module.css";
import CampoFecha from "./CampoFecha";
import CampoNumero from "./CampoNumero";
import FolioContratoCard from "./FolioContratoCard";
import {
  ETIQUETAS_ACCION,
  EstadoEmailAlerta,
  EstadoFoliosBadge,
  fetchJson,
  formatDia,
  formatFechaHora,
  formatNumero,
  textoDiasRestantes,
} from "./foliosUi";

const ALERTAS_CRITICAS = ["VENCIDO", "CONSUMO_100", "VENCE_7"];

function sumarDias(dia, dias) {
  const [y, m, d] = dia.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10);
}

function sumarAnio(dia) {
  const [y, m, d] = dia.split("-").map(Number);
  const t = new Date(Date.UTC(y + 1, m - 1, d));
  if (t.getUTCMonth() !== m - 1) t.setUTCDate(0);
  return t.toISOString().slice(0, 10);
}

function formularioInicial(hoy, base = null) {
  const inicio = base ? sumarDias(base.fechaVencimiento, 1) : hoy;
  return {
    cantidadContratada: base ? String(base.cantidadContratada) : "",
    fechaInicio: inicio,
    fechaVencimiento: sumarAnio(inicio),
    asignacionInicial: "",
    consumoPrevio: "",
    observaciones: "",
  };
}

function porcentaje(parte, total) {
  if (!total) return 0;
  return Math.min(100, Math.max(0, (parte / total) * 100));
}

function entero(valor) {
  const n = Number(valor);
  return valor !== "" && Number.isInteger(n) && n >= 0 ? n : null;
}

/** Disponible con el que arrancaría el contrato según los datos del formulario. */
function previsualizarContrato(form) {
  const cantidad = entero(form.cantidadContratada);
  if (!cantidad) return null;
  const asignados = entero(form.asignacionInicial) ?? 0;
  const consumidos = entero(form.consumoPrevio) ?? 0;
  return {
    consumidos,
    asignados,
    excedeAsignado: consumidos > asignados,
    disponible: Math.max(0, Math.min(asignados, cantidad) - consumidos),
  };
}

const ALERTA_MINIMA_PCT_MAX = 90;

function pctValido(valor) {
  const n = Number(valor);
  return Number.isInteger(n) && n >= 1 && n <= ALERTA_MINIMA_PCT_MAX ? n : null;
}

function textoAlertaMinima(pct, limite) {
  if (!pct) return "Desactivada: no se enviarán emails de folios bajos para esta empresa.";
  if (!limite) {
    return `Se enviará un email a Giganet cuando quede el ${pct} % o menos de los folios emitibles del contrato en uso (aún sin folios asignados).`;
  }
  const umbral = Math.ceil((limite * pct) / 100);
  const cantidad = umbral === 1 ? "quede 1 folio" : `queden ${formatNumero(umbral)} folios`;
  return `Se enviará un email a Giganet cuando ${cantidad} o menos (${pct} % de ${formatNumero(limite)}).`;
}

function hayContratoUtil(contratos) {
  return contratos.some((c) => !["VENCIDO", "CANCELADO"].includes(c.estadoCalculado));
}

export default function EmpresaFoliosPanel({ userId, onModalidadChange }) {
  const [resumen, setResumen] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [modalidadDestino, setModalidadDestino] = useState(null);
  const [motivoModalidad, setMotivoModalidad] = useState("");
  const [savingModalidad, setSavingModalidad] = useState(false);
  const [modalidadError, setModalidadError] = useState(null);
  const [creando, setCreando] = useState(null);
  const [form, setForm] = useState(null);
  const [formError, setFormError] = useState(null);
  const [savingContrato, setSavingContrato] = useState(false);
  const [mostrarHistorial, setMostrarHistorial] = useState(false);
  const [estimacion, setEstimacion] = useState(null);
  const [estimando, setEstimando] = useState(false);
  const [pctDraft, setPctDraft] = useState("");
  const [savingAlerta, setSavingAlerta] = useState(false);
  const [alertaError, setAlertaError] = useState(null);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      setResumen(await fetchJson(`/api/users/${userId}/folios`));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) cargar();
  }, [userId, cargar]);

  useEffect(() => {
    if (resumen?.modalidad) onModalidadChange?.(resumen.modalidad);
  }, [resumen?.modalidad, onModalidadChange]);

  const pctGuardado = resumen?.alertaMinima?.pct ?? null;
  useEffect(() => {
    setPctDraft(pctGuardado == null ? "" : String(pctGuardado));
  }, [pctGuardado]);

  const { vigentes, historicos } = useMemo(() => {
    const lista = resumen?.contratos ?? [];
    const esHistorico = (c) => ["VENCIDO", "CANCELADO"].includes(c.estadoCalculado);
    return {
      vigentes: lista.filter((c) => !esHistorico(c)),
      historicos: lista.filter(esHistorico),
    };
  }, [resumen]);

  const abrirFormulario = (base = null, hoy = resumen.hoy) => {
    setFormError(null);
    setMessage(null);
    setEstimacion(null);
    setCreando({ renovacionDe: base?.id ?? null, codigo: base?.codigo ?? null });
    setForm(formularioInicial(hoy, base));
  };

  const calcularConsumoPrevio = async () => {
    setEstimando(true);
    setFormError(null);
    try {
      const params = new URLSearchParams({ desde: form.fechaInicio });
      setEstimacion(await fetchJson(`/api/users/${userId}/folios/consumo-previo?${params}`));
    } catch (err) {
      setEstimacion(null);
      setFormError(err.message);
    } finally {
      setEstimando(false);
    }
  };

  const guardarContrato = async (e) => {
    e.preventDefault();
    setSavingContrato(true);
    setFormError(null);
    try {
      const data = await fetchJson(`/api/users/${userId}/folios/contratos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, renovacionDe: creando.renovacionDe }),
      });
      setCreando(null);
      const asignados = data.contrato.asignados || 0;
      const detalleAsignacion = asignados
        ? `${formatNumero(asignados)} folios asignados en The Factory.`
        : "Sin folios asignados: registre la asignación en el contrato para habilitar la emisión.";
      setMessage({
        type: "success",
        text: creando.renovacionDe
          ? `Renovación ${data.contrato.codigo} creada. ${detalleAsignacion} Los folios de cada contrato se mantienen separados.`
          : `Contrato ${data.contrato.codigo} creado. ${detalleAsignacion}`,
      });
      await cargar();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSavingContrato(false);
    }
  };

  const confirmarModalidad = async () => {
    setSavingModalidad(true);
    setModalidadError(null);
    try {
      const data = await fetchJson(`/api/users/${userId}/folios`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modalidad: modalidadDestino, motivo: motivoModalidad }),
      });
      setResumen(data);
      setModalidadDestino(null);
      const faltaContrato = data.modalidad === "CONTROLADO" && !hayContratoUtil(data.contratos);
      if (faltaContrato) abrirFormulario(null, data.hoy);
      setMessage({
        type: "success",
        text:
          data.modalidad === "CONTROLADO"
            ? faltaContrato
              ? "Control de folios activado. Registre el contrato de la empresa para habilitar la emisión."
              : "Control de folios activado."
            : "La empresa vuelve a emitir con folios ilimitados.",
      });
    } catch (err) {
      setModalidadError(err.message);
    } finally {
      setSavingModalidad(false);
    }
  };

  const guardarAlertaMinima = async (valor) => {
    if (valor !== "" && pctValido(valor) === null) {
      setAlertaError(`Indique un porcentaje entero entre 1 y ${ALERTA_MINIMA_PCT_MAX}, o déjelo vacío para desactivarla.`);
      return;
    }
    setSavingAlerta(true);
    setAlertaError(null);
    try {
      const data = await fetchJson(`/api/users/${userId}/folios`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertaMinimaPct: valor === "" ? null : Number(valor) }),
      });
      setResumen(data);
      setMessage({
        type: "success",
        text: data.alertaMinima?.pct
          ? `Alerta mínima configurada en ${data.alertaMinima.pct} %.`
          : "Alerta mínima desactivada.",
      });
    } catch (err) {
      setAlertaError(err.message);
    } finally {
      setSavingAlerta(false);
    }
  };

  const onContratoCambiado = (msg) => {
    setMessage(msg);
    cargar();
  };

  if (loading) {
    return (
      <section className={compStyles.compSection}>
        <p className={compStyles.compEmpty}>Cargando control de folios…</p>
      </section>
    );
  }

  if (!resumen) {
    return (
      <section className={compStyles.compSection}>
        <p className={compStyles.compMsgError} role="alert">
          {error || "No se pudo cargar el control de folios."}
        </p>
        <button type="button" className={compStyles.compRefresh} onClick={cargar}>
          Reintentar
        </button>
      </section>
    );
  }

  const controlado = resumen.modalidad === "CONTROLADO";
  const actual = resumen.contratoActual;
  const ocupado = savingModalidad || savingContrato;
  const vistaPrevia = form ? previsualizarContrato(form) : null;

  return (
    <section className={compStyles.compSection} aria-labelledby="folios-heading">
      <div className={compStyles.compHeader}>
        <div>
          <h2 id="folios-heading" className={compStyles.compTitle}>
            Control de folios
          </h2>
          <p className={compStyles.compSubtitle}>
            Paquetes de folios e-CF vendidos a esta empresa. Las asignaciones registran lo cargado
            manualmente en The Factory; el vencimiento comercial lo define el contrato.
          </p>
        </div>
        <div className={compStyles.compHeaderActions}>
          <EstadoFoliosBadge estado={resumen.estado} />
          <button type="button" className={compStyles.compRefresh} onClick={cargar} disabled={ocupado}>
            Actualizar
          </button>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.modalidadGroup} role="radiogroup" aria-label="Modalidad de folios">
          {[
            { value: "ILIMITADO", label: "Ilimitado" },
            { value: "CONTROLADO", label: "Controlado" },
          ].map((op) => {
            const activo = resumen.modalidad === op.value;
            return (
              <button
                key={op.value}
                type="button"
                role="radio"
                aria-checked={activo}
                className={`${styles.modalidadOption} ${activo ? styles.modalidadOptionActive : ""}`}
                onClick={() => {
                  if (activo) return;
                  setMotivoModalidad("");
                  setModalidadError(null);
                  setModalidadDestino(op.value);
                }}
                disabled={ocupado}
              >
                {op.label}
              </button>
            );
          })}
        </div>
        {controlado && !creando && (
          <button
            type="button"
            className={compStyles.compBtnPrimary}
            onClick={() => abrirFormulario()}
            disabled={ocupado}
          >
            Nuevo contrato
          </button>
        )}
      </div>

      {!resumen.controlAplica && (
        <p className={`${styles.note} ${styles.noteWarn}`}>
          Esta empresa emite en el ambiente de pruebas (demo). El control de folios solo se aplica en
          Producción: en pruebas la emisión no se limita ni se contabiliza.
        </p>
      )}

      {message && (
        <p
          className={message.type === "success" ? compStyles.compMsgSuccess : compStyles.compMsgError}
          role="status"
        >
          {message.text}
        </p>
      )}
      {error && (
        <p className={compStyles.compMsgError} role="alert">
          {error}
        </p>
      )}

      {!controlado && (
        <p className={`${styles.note} ${styles.noteInfo}`}>
          Emisión ilimitada: Giganet no aplica límites de cantidad ni vencimiento comercial a esta
          empresa. Las restricciones fiscales y técnicas de The Factory y la DGII siguen aplicando.
        </p>
      )}

      {controlado && resumen.bloqueoEmision && (
        <p className={compStyles.compMsgError} role="alert">
          <strong>Emisión bloqueada.</strong> El cliente recibe: “{resumen.bloqueoEmision.message}”.
        </p>
      )}

      {controlado && resumen.alertas.length > 0 && (
        <ul className={styles.alertList} aria-label="Alertas de folios">
          {resumen.alertas.map((a) => (
            <li
              key={a.id}
              className={`${styles.alertItem} ${
                ALERTAS_CRITICAS.includes(a.tipo) ? styles.alertItemCritica : ""
              }`}
            >
              <span>
                {a.mensaje}
                <EstadoEmailAlerta alerta={a} />
              </span>
              <span className={styles.subtle}>{formatFechaHora(a.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}

      {controlado && actual && (
        <>
          <p className={styles.subtle} style={{ margin: "0 0 0.5rem" }}>
            Contrato en uso: <strong>{actual.codigo}</strong>
          </p>
          <div className={styles.metrics}>
            <div className={styles.metric}>
              <p className={styles.metricLabel}>Contratados</p>
              <p className={styles.metricValue}>{formatNumero(actual.cantidadContratada)}</p>
            </div>
            <div className={styles.metric}>
              <p className={styles.metricLabel}>Asignados en The Factory</p>
              <p className={styles.metricValue}>{formatNumero(actual.asignados)}</p>
              <p className={styles.metricHint}>Pendiente: {formatNumero(actual.pendienteAsignar)}</p>
            </div>
            <div className={styles.metric}>
              <p className={styles.metricLabel}>Disponibles para emitir</p>
              <p className={styles.metricValue}>{formatNumero(actual.disponible)}</p>
            </div>
            <div className={styles.metric}>
              <p className={styles.metricLabel}>Consumidos</p>
              <p className={styles.metricValue}>{formatNumero(actual.consumidos)}</p>
              <p className={styles.metricHint}>{actual.porcentajeConsumo}% de lo contratado</p>
            </div>
            <div className={styles.metric}>
              <p className={styles.metricLabel}>Vigencia</p>
              <p className={styles.metricValue}>{formatDia(actual.fechaVencimiento)}</p>
              <p className={styles.metricHint}>{textoDiasRestantes(actual.diasRestantes)}</p>
            </div>
            <div className={styles.metric}>
              <p className={styles.metricLabel}>Saldo The Factory</p>
              <p className={styles.metricValue}>
                {actual.saldoTheFactory?.cantidad != null
                  ? formatNumero(actual.saldoTheFactory.cantidad)
                  : "—"}
              </p>
              <p className={styles.metricHint}>
                {actual.saldoTheFactory?.cantidad != null
                  ? `Confirmado ${formatFechaHora(actual.saldoTheFactory.fecha)}`
                  : "Consumo interno calculado"}
              </p>
            </div>
          </div>
          <div className={styles.progress}>
            <div className={styles.progressHead}>
              <span>Uso del contrato</span>
              <span>
                {formatNumero(actual.consumidos)} / {formatNumero(actual.cantidadContratada)}
              </span>
            </div>
            <div
              className={styles.progressTrack}
              role="progressbar"
              aria-label="Folios consumidos del contrato"
              aria-valuemin={0}
              aria-valuemax={actual.cantidadContratada}
              aria-valuenow={actual.consumidos}
            >
              <span
                className={styles.progressAsignado}
                style={{ width: `${porcentaje(actual.asignados, actual.cantidadContratada)}%` }}
              />
              <span
                className={`${styles.progressConsumido} ${
                  actual.porcentajeConsumo >= 80 ? styles.progressConsumidoAlto : ""
                }`}
                style={{ width: `${porcentaje(actual.consumidos, actual.cantidadContratada)}%` }}
              />
            </div>
            <div className={styles.progressLegend}>
              <span>
                <span className={styles.legendDot} style={{ background: "#0f766e" }} />
                Consumido
              </span>
              <span>
                <span className={styles.legendDot} style={{ background: "#99f6e4" }} />
                Asignado
              </span>
              <span>
                <span className={styles.legendDot} style={{ background: "#e2e8f0" }} />
                Pendiente de asignar
              </span>
            </div>
          </div>
        </>
      )}

      {controlado && (
        <form
          className={styles.alertaMinima}
          onSubmit={(e) => {
            e.preventDefault();
            guardarAlertaMinima(pctDraft.trim());
          }}
          aria-labelledby="alerta-minima-titulo"
        >
          <div className={styles.alertaMinimaTexto}>
            <p id="alerta-minima-titulo" className={styles.alertaMinimaTitulo}>
              Alerta mínima por email
            </p>
            <p id="alerta-minima-ayuda" className={styles.alertaMinimaHint} aria-live="polite">
              {textoAlertaMinima(
                pctDraft.trim() === "" ? null : pctValido(pctDraft),
                resumen.alertaMinima?.limite ?? 0,
              )}
            </p>
            {alertaError && (
              <p className={compStyles.compAjustarError} role="alert" style={{ marginTop: "0.4rem" }}>
                {alertaError}
              </p>
            )}
          </div>
          <div className={styles.alertaMinimaForm}>
            <label htmlFor="alerta-minima-pct" className={styles.subtle}>
              Avisar al quedar
            </label>
            <span className={styles.pctCampo}>
              <input
                id="alerta-minima-pct"
                type="number"
                inputMode="numeric"
                min={1}
                max={ALERTA_MINIMA_PCT_MAX}
                step={1}
                value={pctDraft}
                onChange={(e) => {
                  setAlertaError(null);
                  setPctDraft(e.target.value);
                }}
                placeholder="—"
                disabled={savingAlerta || ocupado}
                aria-describedby="alerta-minima-ayuda"
              />
              <span className={styles.pctSufijo} aria-hidden="true">
                %
              </span>
            </span>
            <button
              type="submit"
              className={compStyles.compBtnPrimary}
              disabled={
                savingAlerta ||
                ocupado ||
                pctDraft.trim() === (pctGuardado == null ? "" : String(pctGuardado))
              }
            >
              {savingAlerta ? "Guardando…" : "Guardar"}
            </button>
            {pctGuardado != null && (
              <button
                type="button"
                className={compStyles.compBtn}
                onClick={() => guardarAlertaMinima("")}
                disabled={savingAlerta || ocupado}
              >
                Desactivar
              </button>
            )}
          </div>
        </form>
      )}

      {creando && form && (
        <form className={compStyles.compCreate} onSubmit={guardarContrato}>
          <div className={compStyles.compCreateHead}>
            <h3 className={compStyles.compCreateTitle}>
              {creando.renovacionDe ? `Renovar contrato ${creando.codigo}` : "Nuevo contrato de folios"}
            </h3>
            <p className={compStyles.compCreateHint}>
              {creando.renovacionDe
                ? "Se crea un contrato nuevo e independiente; el anterior conserva sus folios e historial. Mientras ambos estén vigentes se usa primero el que vence antes."
                : "Si la empresa ya venía emitiendo, use la fecha real de inicio de su paquete y registre los folios que ya consumió. La fecha de vencimiento es comercial: el cliente emite durante todo ese día y queda bloqueado desde las 00:00 del día siguiente (hora de República Dominicana)."}
            </p>
          </div>
          <div className={compStyles.compEditorGrid}>
            <label>
              Cantidad contratada *
              <CampoNumero
                required
                value={form.cantidadContratada}
                onChange={(v) => setForm((f) => ({ ...f, cantidadContratada: v }))}
                placeholder="Ej. 100,000"
                disabled={savingContrato}
              />
            </label>
            <label>
              Asignación inicial en The Factory
              <CampoNumero
                value={form.asignacionInicial}
                onChange={(v) => setForm((f) => ({ ...f, asignacionInicial: v }))}
                placeholder="Opcional, ej. 20,000"
                disabled={savingContrato}
              />
            </label>
            <label>
              Fecha de inicio *
              <CampoFecha
                required
                value={form.fechaInicio}
                onChange={(dia) => {
                  setEstimacion(null);
                  setForm((f) => ({ ...f, fechaInicio: dia }));
                }}
                disabled={savingContrato}
              />
            </label>
            <label>
              Fecha de vencimiento *
              <CampoFecha
                required
                min={form.fechaInicio}
                value={form.fechaVencimiento}
                onChange={(dia) => setForm((f) => ({ ...f, fechaVencimiento: dia }))}
                disabled={savingContrato}
              />
            </label>
            {!creando.renovacionDe && (
              <div className={`${compStyles.compEditorFull} ${styles.campoCompuesto}`}>
                <label>
                  Folios consumidos a la fecha
                  <CampoNumero
                    value={form.consumoPrevio}
                    onChange={(v) => setForm((f) => ({ ...f, consumoPrevio: v }))}
                    placeholder="0 si la empresa empieza a emitir con este contrato"
                    disabled={savingContrato}
                    aria-describedby="consumo-previo-ayuda"
                  />
                </label>
                <p id="consumo-previo-ayuda" className={compStyles.compAjustarPreview}>
                  e-NCF que la empresa ya emitió en Producción con este paquete antes de activar el
                  control. Se descuentan del disponible y deben estar cubiertos por la asignación
                  inicial.
                </p>
                <button
                  type="button"
                  className={compStyles.compAjustarUsarTf}
                  onClick={calcularConsumoPrevio}
                  disabled={savingContrato || estimando || !form.fechaInicio}
                >
                  {estimando ? "Calculando…" : "Calcular con el historial de envíos de Giganet"}
                </button>
                {estimacion && (
                  <div className={compStyles.compAjustarHint} role="status">
                    {estimacion.total > 0 ? (
                      <>
                        Desde el {formatDia(estimacion.desde)} Giganet registra{" "}
                        <strong>{formatNumero(estimacion.total)}</strong> e-NCF que llegaron a The
                        Factory ({formatNumero(estimacion.aceptados)} aceptados,{" "}
                        {formatNumero(estimacion.rechazados)} rechazados).{" "}
                        <button
                          type="button"
                          className={compStyles.compAjustarUsarTf}
                          onClick={() =>
                            setForm((f) => ({ ...f, consumoPrevio: String(estimacion.total) }))
                          }
                          disabled={savingContrato}
                        >
                          Usar {formatNumero(estimacion.total)}
                        </button>
                        <br />
                        <span className={styles.subtle}>
                          No incluye lo emitido directamente en el portal de The Factory; compárelo
                          con el saldo que le informe The Factory.
                        </span>
                      </>
                    ) : (
                      <>
                        Giganet no registra e-NCF enviados en Producción desde el{" "}
                        {formatDia(estimacion.desde)}.
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
            <label className={compStyles.compEditorFull}>
              Observaciones
              <input
                type="text"
                maxLength={1000}
                value={form.observaciones}
                onChange={(e) => setForm((f) => ({ ...f, observaciones: e.target.value }))}
                placeholder="Ej. Factura de venta #1234"
                disabled={savingContrato}
              />
            </label>
          </div>
          {vistaPrevia &&
            (vistaPrevia.excedeAsignado ? (
              <p className={compStyles.compAjustarWarn} style={{ marginTop: "0.85rem" }}>
                Los folios consumidos ({formatNumero(vistaPrevia.consumidos)}) superan la asignación
                inicial ({formatNumero(vistaPrevia.asignados)}). Para haberlos emitido debieron estar
                asignados en The Factory: aumente la asignación inicial.
              </p>
            ) : (
              <p className={compStyles.compAjustarPreview} style={{ marginTop: "0.85rem" }}>
                Al crear el contrato la empresa tendrá{" "}
                <strong>{formatNumero(vistaPrevia.disponible)}</strong> folios disponibles para emitir.
              </p>
            ))}
          {formError && (
            <p className={compStyles.compMsgError} role="alert" style={{ marginTop: "0.85rem" }}>
              {formError}
            </p>
          )}
          <div className={compStyles.compEditorActions}>
            <button type="submit" className={compStyles.compBtnPrimary} disabled={savingContrato}>
              {savingContrato
                ? "Guardando…"
                : creando.renovacionDe
                  ? "Crear renovación"
                  : "Crear contrato"}
            </button>
            <button
              type="button"
              className={compStyles.compBtn}
              onClick={() => setCreando(null)}
              disabled={savingContrato}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {controlado && resumen.contratos.length === 0 && !creando && (
        <div className={compStyles.compEmptyBox}>
          <p className={compStyles.compEmpty}>
            Esta empresa aún no tiene contratos de folios. Mientras no registre uno, la emisión en
            Producción queda bloqueada por configuración incompleta.
          </p>
          <button
            type="button"
            className={compStyles.compBtnPrimary}
            onClick={() => abrirFormulario()}
          >
            Crear primer contrato
          </button>
        </div>
      )}

      {resumen.contratos.length > 0 && (
        <>
          <h3 className={styles.sectionTitle}>
            {controlado ? "Contratos" : "Contratos registrados (no se aplican en modalidad ilimitada)"}
          </h3>
          {vigentes.length === 0 ? (
            <p className={styles.subtle}>No hay contratos vigentes ni programados.</p>
          ) : (
            <ul className={compStyles.compList}>
              {vigentes.map((c) => (
                <FolioContratoCard
                  key={c.id}
                  userId={userId}
                  contrato={c}
                  hoy={resumen.hoy}
                  onChanged={onContratoCambiado}
                  onRenovar={abrirFormulario}
                  disabled={ocupado}
                />
              ))}
            </ul>
          )}
          {historicos.length > 0 && (
            <>
              <button
                type="button"
                className={compStyles.compBtn}
                style={{ marginTop: "0.85rem" }}
                onClick={() => setMostrarHistorial((v) => !v)}
                aria-expanded={mostrarHistorial}
              >
                {mostrarHistorial
                  ? "Ocultar contratos vencidos y cancelados"
                  : `Ver contratos vencidos y cancelados (${historicos.length})`}
              </button>
              {mostrarHistorial && (
                <ul className={compStyles.compList} style={{ marginTop: "0.85rem" }}>
                  {historicos.map((c) => (
                    <FolioContratoCard
                      key={c.id}
                      userId={userId}
                      contrato={c}
                      hoy={resumen.hoy}
                      onChanged={onContratoCambiado}
                      onRenovar={abrirFormulario}
                      disabled={ocupado}
                    />
                  ))}
                </ul>
              )}
            </>
          )}
        </>
      )}

      {resumen.auditoria.length > 0 && (
        <details className={compStyles.configPanel}>
          <summary className={compStyles.configPanelSummary}>
            <span className={compStyles.configPanelTitle}>Historial de cambios</span>
            <span className={styles.subtle}>{resumen.auditoria.length} recientes</span>
          </summary>
          <div className={compStyles.configPanelBody}>
            <ul className={styles.historyList}>
              {resumen.auditoria.map((a) => (
                <li key={a.id} className={styles.historyItem}>
                  {ETIQUETAS_ACCION[a.accion] ?? a.accion}
                  {a.accion === "MODALIDAD_CAMBIADA" && a.despues?.modalidad
                    ? `: ${a.antes?.modalidad ?? "—"} → ${a.despues.modalidad}`
                    : ""}
                  {a.accion === "ALERTA_MINIMA_CONFIGURADA"
                    ? `: ${a.antes?.alertaMinimaPct != null ? `${a.antes.alertaMinimaPct} %` : "desactivada"} → ${
                        a.despues?.alertaMinimaPct != null ? `${a.despues.alertaMinimaPct} %` : "desactivada"
                      }`
                    : ""}
                  {a.motivo ? ` — ${a.motivo}` : ""}
                  <span className={styles.historyMeta}>
                    {formatFechaHora(a.createdAt)} · {a.adminEmail || "Sistema"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </details>
      )}

      {modalidadDestino && (
        <div
          className={compStyles.compModalOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modalidad-dialog-title"
          onKeyDown={(e) => e.key === "Escape" && !savingModalidad && setModalidadDestino(null)}
        >
          <div className={compStyles.compModalContent}>
            <h3 id="modalidad-dialog-title" className={compStyles.compModalTitle}>
              {modalidadDestino === "CONTROLADO"
                ? "Activar control de folios"
                : "Cambiar a folios ilimitados"}
            </h3>
            <p className={compStyles.compModalMessage}>
              {modalidadDestino === "CONTROLADO"
                ? "Las emisiones en Producción se validarán contra el contrato vigente: se bloquearán al vencer o al agotar los folios disponibles."
                : "La empresa podrá emitir sin límites comerciales de cantidad ni vencimiento. Los contratos e historial se conservan."}
            </p>
            {modalidadDestino === "CONTROLADO" &&
              !resumen.contratos.some((c) => ["VIGENTE", "POR_VENCER"].includes(c.estadoCalculado)) && (
                <p className={compStyles.compAjustarWarn}>
                  Esta empresa no tiene un contrato vigente con saldo: sus emisiones quedarán
                  bloqueadas hasta que registre uno. Al confirmar se abrirá el formulario del
                  contrato, donde puede indicar la fecha de inicio y los folios ya consumidos.
                </p>
              )}
            <div className={compStyles.compModalForm}>
              <label className={styles.subtle} htmlFor="motivo-modalidad">
                Motivo (opcional, queda en la auditoría)
              </label>
              <textarea
                id="motivo-modalidad"
                className={`${compStyles.compModalInput} ${styles.modalTextarea}`}
                value={motivoModalidad}
                onChange={(e) => setMotivoModalidad(e.target.value)}
                maxLength={500}
                autoFocus
              />
              {modalidadError && <p className={compStyles.compAjustarError}>{modalidadError}</p>}
            </div>
            <div className={compStyles.compModalActions}>
              <button
                type="button"
                className={compStyles.compBtn}
                onClick={() => setModalidadDestino(null)}
                disabled={savingModalidad}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={compStyles.compBtnPrimary}
                onClick={confirmarModalidad}
                disabled={savingModalidad}
              >
                {savingModalidad ? "Guardando…" : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
