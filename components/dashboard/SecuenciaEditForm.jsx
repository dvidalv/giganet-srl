"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./SecuenciaEditForm.module.css";

const ESTADOS = [
  { value: "activo", label: "Activo" },
  { value: "inactivo", label: "Inactivo" },
  { value: "vencido", label: "Vencido" },
  { value: "agotado", label: "Agotado" },
  { value: "alerta", label: "Alerta" },
];

const TIPOS_SIN_FECHA_VENCIMIENTO = ["32", "34"];

function formatRango(inicial, final) {
  return `${Number(inicial).toLocaleString("es-DO")} - ${Number(final).toLocaleString("es-DO")}`;
}

function formatFecha(fecha) {
  if (!fecha) return "No especificado";
  const d = new Date(fecha);
  return isNaN(d.getTime()) ? "No especificado" : d.toLocaleDateString("es-DO", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function toInputDate(value) {
  if (!value) return "";
  const d = new Date(value);
  return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

export default function SecuenciaEditForm({ id }) {
  const router = useRouter();
  const [comprobante, setComprobante] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [numero_inicial, setNumero_inicial] = useState("");
  const [numero_final, setNumero_final] = useState("");
  const [fecha_autorizacion, setFecha_autorizacion] = useState("");
  const [fecha_vencimiento, setFecha_vencimiento] = useState("");
  const [estado, setEstado] = useState("");
  const [comentario, setComentario] = useState("");
  const [alerta_minima_restante, setAlerta_minima_restante] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);

  const fetchComprobante = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/comprobantes/${id}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Error al cargar la secuencia");
        setComprobante(null);
        return;
      }
      const data = json.data ?? {};
      setComprobante(data);
      setNumero_inicial(String(data.numero_inicial ?? ""));
      setNumero_final(String(data.numero_final ?? ""));
      setFecha_autorizacion(toInputDate(data.fecha_autorizacion));
      setFecha_vencimiento(toInputDate(data.fecha_vencimiento));
      setEstado(data.estado ?? "activo");
      setComentario(data.comentario ?? "");
      setAlerta_minima_restante(String(data.alerta_minima_restante ?? 10));
    } catch (err) {
      setError("Error de conexión");
      setComprobante(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchComprobante();
  }, [fetchComprobante]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);
    setSubmitting(true);
    try {
      const payload = {
        numero_inicial: numero_inicial !== "" ? Number(numero_inicial) : undefined,
        numero_final: numero_final !== "" ? Number(numero_final) : undefined,
        fecha_autorizacion: fecha_autorizacion || undefined,
        fecha_vencimiento:
          comprobante.tipo_comprobante && TIPOS_SIN_FECHA_VENCIMIENTO.includes(comprobante.tipo_comprobante)
            ? fecha_vencimiento || null
            : fecha_vencimiento || undefined,
        estado: estado.trim(),
        comentario: comentario.trim(),
        alerta_minima_restante: alerta_minima_restante ? Number(alerta_minima_restante) : undefined,
      };
      const res = await fetch(`/api/comprobantes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: "error", text: json.error ?? "Error al guardar" });
        return;
      }
      setMessage({ type: "success", text: "Cambios guardados correctamente" });
      const updated = json.data ?? comprobante;
      setComprobante(updated);
      setNumero_inicial(String(updated.numero_inicial ?? ""));
      setNumero_final(String(updated.numero_final ?? ""));
      setFecha_autorizacion(toInputDate(updated.fecha_autorizacion));
      setFecha_vencimiento(toInputDate(updated.fecha_vencimiento));
      setTimeout(() => router.push("/dashboard/mis-comprobantes"), 1500);
    } catch (err) {
      setMessage({ type: "error", text: "Error de conexión" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <p className={styles.loading}>Cargando secuencia...</p>;
  }

  if (error || !comprobante) {
    return (
      <div className={styles.wrapper}>
        <p className={styles.error} role="alert">
          {error ?? "Secuencia no encontrada"}
        </p>
        <Link href="/dashboard/mis-comprobantes" className={styles.back}>
          ← Volver a Mis Comprobantes
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <Link href="/dashboard/mis-comprobantes" className={styles.back}>
        ← Volver a Mis Comprobantes
      </Link>

      <h1 className={styles.title}>Editar secuencia</h1>
      <p className={styles.subtitle}>
        {comprobante.descripcion_tipo ?? `Tipo ${comprobante.tipo_comprobante}`} — RNC {comprobante.rnc}
      </p>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Datos de la secuencia (solo lectura)</h2>
        <dl className={styles.fields}>
          <div className={styles.field}>
            <dt>RNC</dt>
            <dd>{comprobante.rnc}</dd>
          </div>
          <div className={styles.field}>
            <dt>Razón social</dt>
            <dd>{comprobante.razon_social}</dd>
          </div>
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <dt>Tipo</dt>
              <dd>{comprobante.tipo_comprobante}</dd>
            </div>
            <div className={styles.field}>
              <dt>Prefijo</dt>
              <dd>{comprobante.prefijo ?? "E"}</dd>
            </div>
          </div>
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <dt>Disponibles</dt>
              <dd>{Number(comprobante.numeros_disponibles ?? 0).toLocaleString("es-DO")}</dd>
            </div>
            <div className={styles.field}>
              <dt>Utilizados</dt>
              <dd>{Number(comprobante.numeros_utilizados ?? 0).toLocaleString("es-DO")}</dd>
            </div>
          </div>
        </dl>
      </section>

      <form onSubmit={handleSubmit} className={styles.form}>
        {message && (
          <div
            className={message.type === "success" ? styles.alertSuccess : styles.alertError}
            role="alert"
          >
            {message.text}
          </div>
        )}

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Campos editables</h2>
          <div className={styles.rowHalf}>
            <div className={styles.row}>
              <label className={styles.label} htmlFor="numero_inicial">
                Número inicial
              </label>
              <input
                id="numero_inicial"
                type="number"
                min={0}
                step={1}
                className={styles.input}
                value={numero_inicial}
                onChange={(e) => setNumero_inicial(e.target.value)}
              />
            </div>
            <div className={styles.row}>
              <label className={styles.label} htmlFor="numero_final">
                Número final
              </label>
              <input
                id="numero_final"
                type="number"
                min={0}
                step={1}
                className={styles.input}
                value={numero_final}
                onChange={(e) => setNumero_final(e.target.value)}
              />
            </div>
          </div>
          <div className={styles.rowHalf}>
            <div className={styles.row}>
              <label className={styles.label} htmlFor="fecha_autorizacion">
                Fecha de autorización
              </label>
              <input
                id="fecha_autorizacion"
                type="date"
                className={styles.input}
                value={fecha_autorizacion}
                onChange={(e) => setFecha_autorizacion(e.target.value)}
              />
            </div>
            <div className={styles.row}>
              <label className={styles.label} htmlFor="fecha_vencimiento">
                Fecha de vencimiento
                {comprobante.tipo_comprobante && TIPOS_SIN_FECHA_VENCIMIENTO.includes(comprobante.tipo_comprobante) && (
                  <span className={styles.hint}> (opcional para tipo {comprobante.tipo_comprobante})</span>
                )}
              </label>
              <input
                id="fecha_vencimiento"
                type="date"
                className={styles.input}
                value={fecha_vencimiento}
                onChange={(e) => setFecha_vencimiento(e.target.value)}
              />
            </div>
          </div>
          <div className={styles.row}>
            <label className={styles.label} htmlFor="estado">
              Estado
            </label>
            <select
              id="estado"
              className={styles.select}
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
            >
              {ESTADOS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.row}>
            <label className={styles.label} htmlFor="alerta_minima_restante">
              Alerta mínima restante
            </label>
            <input
              id="alerta_minima_restante"
              type="number"
              min={1}
              step={1}
              className={styles.input}
              value={alerta_minima_restante}
              onChange={(e) => setAlerta_minima_restante(e.target.value)}
            />
          </div>
          <div className={styles.row}>
            <label className={styles.label} htmlFor="comentario">
              Comentario
            </label>
            <textarea
              id="comentario"
              className={styles.textarea}
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              rows={3}
              maxLength={500}
            />
          </div>
        </section>

        <div className={styles.actions}>
          <button type="submit" className={styles.submit} disabled={submitting}>
            {submitting ? "Guardando..." : "Guardar cambios"}
          </button>
          <Link href="/dashboard/mis-comprobantes" className={styles.cancel}>
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
