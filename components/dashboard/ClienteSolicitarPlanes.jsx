"use client";

import { useMemo, useState } from "react";
import {
  PLANES_FOLIOS,
  formatPrecioRD,
  formatTransacciones,
} from "@/lib/folios/planesCatalogo";
import styles from "./EmpresaFolios.module.css";

/**
 * Formulario cliente: elegir uno o más planes del tarifario público y notificar a Giganet.
 */
export default function ClienteSolicitarPlanes() {
  const [seleccion, setSeleccion] = useState(() => new Set());
  const [nota, setNota] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [error, setError] = useState(null);

  const planes = useMemo(() => PLANES_FOLIOS, []);

  function togglePlan(slug) {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
    setMensaje(null);
    setError(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (seleccion.size === 0) {
      setError("Seleccione al menos un plan.");
      setMensaje(null);
      return;
    }
    setEnviando(true);
    setError(null);
    setMensaje(null);
    try {
      const res = await fetch("/api/users/me/folios/solicitar-planes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planSlugs: [...seleccion],
          nota: nota.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "No se pudo enviar la solicitud.");
      }
      setMensaje(data.message || "Solicitud enviada.");
      setSeleccion(new Set());
      setNota("");
    } catch (err) {
      setError(err.message || "Error de conexión.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className={styles.clienteSection} aria-labelledby="solicitar-planes-heading">
      <header className={styles.clienteHeader}>
        <div>
          <h2 id="solicitar-planes-heading" className={styles.clienteTitle}>
            Solicitar planes
          </h2>
          <p className={styles.clienteSubtitle}>
            Cuando se le agoten los folios, elija uno o más paquetes del tarifario. Enviaremos la
            solicitud a Giganet para coordinar la renovación.
          </p>
        </div>
      </header>

      <form className={styles.solicitudForm} onSubmit={handleSubmit}>
        <fieldset className={styles.solicitudFieldset} disabled={enviando}>
          <legend className={styles.solicitudLegend}>Planes disponibles</legend>
          <ul className={styles.solicitudLista}>
            {planes.map((plan) => {
              const id = `plan-${plan.slug}`;
              const checked = seleccion.has(plan.slug);
              return (
                <li key={plan.slug}>
                  <label
                    htmlFor={id}
                    className={`${styles.solicitudPlan} ${
                      checked ? styles.solicitudPlanActivo : ""
                    }`}
                  >
                    <input
                      id={id}
                      type="checkbox"
                      className={styles.solicitudCheck}
                      checked={checked}
                      onChange={() => togglePlan(plan.slug)}
                    />
                    <span className={styles.solicitudPlanBody}>
                      <span className={styles.solicitudPlanNombre}>
                        {plan.nombre}
                        {plan.badge ? (
                          <span className={styles.solicitudBadge}>{plan.badge}</span>
                        ) : null}
                      </span>
                      <span className={styles.solicitudPlanMeta}>
                        {formatTransacciones(plan.transacciones)} transacciones ·{" "}
                        {formatPrecioRD(plan.precioAnual)} / año
                        {plan.precioMensual != null
                          ? ` · ${formatPrecioRD(plan.precioMensual)} / mes`
                          : " · solo anual"}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>

        <div className={styles.solicitudNotaWrap}>
          <label htmlFor="solicitud-nota" className={styles.solicitudNotaLabel}>
            Nota (opcional)
          </label>
          <textarea
            id="solicitud-nota"
            className={styles.solicitudNota}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="Ej.: preferimos pago anual, necesitamos activación esta semana…"
            disabled={enviando}
          />
        </div>

        {error ? (
          <p className={`${styles.note} ${styles.noteWarn}`} role="alert">
            {error}
          </p>
        ) : null}
        {mensaje ? (
          <p className={`${styles.note} ${styles.noteInfo}`} role="status">
            {mensaje}
          </p>
        ) : null}

        <div className={styles.solicitudActions}>
          <button
            type="submit"
            className={styles.solicitudSubmit}
            disabled={enviando || seleccion.size === 0}
          >
            {enviando
              ? "Enviando…"
              : seleccion.size === 0
                ? "Seleccione un plan"
                : `Enviar solicitud (${seleccion.size})`}
          </button>
        </div>
      </form>
    </section>
  );
}
