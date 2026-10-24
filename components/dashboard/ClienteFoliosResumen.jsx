"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./EmpresaFolios.module.css";
import {
  EstadoFoliosBadge,
  fetchJson,
  formatDia,
  formatNumero,
  textoDiasRestantes,
} from "./foliosUi";

function porcentaje(parte, total) {
  const t = Number(total) || 0;
  if (t <= 0) return 0;
  return Math.min(100, Math.round(((Number(parte) || 0) / t) * 1000) / 10);
}

/**
 * Vista de solo lectura para el cliente: folios comprados (contratados), sin
 * “disponibles para emitir” ni métricas operativas de The Factory.
 */
export default function ClienteFoliosResumen() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchJson("/api/users/me/folios"));
    } catch (err) {
      setData(null);
      setError(err.message || "No se pudo cargar el resumen de folios.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (loading) {
    return (
      <section className={styles.clienteSection} aria-labelledby="mis-folios-heading">
        <p className={styles.clienteMuted}>Cargando folios…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className={styles.clienteSection} aria-labelledby="mis-folios-heading">
        <header className={styles.clienteHeader}>
          <h2 id="mis-folios-heading" className={styles.clienteTitle}>
            Mis folios
          </h2>
        </header>
        <p className={styles.noteWarn} role="alert">
          {error}
        </p>
      </section>
    );
  }

  const controlado = data?.modalidad === "CONTROLADO";
  const actual = data?.contratoActual;

  return (
    <section className={styles.clienteSection} aria-labelledby="mis-folios-heading">
      <header className={styles.clienteHeader}>
        <div>
          <h2 id="mis-folios-heading" className={styles.clienteTitle}>
            Mis folios
          </h2>
          <p className={styles.clienteSubtitle}>
            Paquete de folios e-CF contratado con Giganet.
          </p>
        </div>
        <EstadoFoliosBadge estado={data?.estado} />
      </header>

      {!data?.controlAplica && (
        <p className={`${styles.note} ${styles.noteWarn}`}>
          Está en ambiente de pruebas (demo). El control comercial de folios aplica en Producción.
        </p>
      )}

      {!controlado && (
        <p className={`${styles.note} ${styles.noteInfo}`}>
          Emisión ilimitada: no hay un cupo de folios contratado que limitar la cantidad de
          comprobantes.
        </p>
      )}

      {controlado && data?.bloqueoEmision && (
        <p className={`${styles.note} ${styles.noteWarn}`} role="alert">
          {data.bloqueoEmision.message}
        </p>
      )}

      {controlado && !actual && (
        <p className={`${styles.note} ${styles.noteWarn}`}>
          Aún no hay un contrato de folios registrado para su empresa. Contacte a Giganet.
        </p>
      )}

      {controlado && actual && (
        <>
          <p className={styles.subtle} style={{ margin: "0 0 0.5rem" }}>
            Contrato: <strong>{actual.codigo}</strong>
          </p>
          <div className={styles.metrics}>
            <div className={styles.metric}>
              <p className={styles.metricLabel}>Contratados</p>
              <p className={styles.metricValue}>{formatNumero(actual.cantidadContratada)}</p>
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
                className={`${styles.progressConsumido} ${
                  actual.porcentajeConsumo >= 80 ? styles.progressConsumidoAlto : ""
                }`}
                style={{ width: `${porcentaje(actual.consumidos, actual.cantidadContratada)}%` }}
              />
            </div>
          </div>
        </>
      )}
    </section>
  );
}
