"use client";

import { useCallback, useRef, useState } from "react";
import {
  classifyDgiiImageFiles,
  describeDgiiImageSelection,
  DGII_IMPORT_MAX_FILES,
} from "@/lib/comprobantes/dgiiImportFiles";
import styles from "./EmpresaAdminImportarDgii.module.css";

const TIPOS = [
  { value: "31", label: "31 · Crédito fiscal" },
  { value: "32", label: "32 · Consumo" },
  { value: "33", label: "33 · Débito" },
  { value: "34", label: "34 · Crédito" },
  { value: "41", label: "41 · Compras" },
  { value: "43", label: "43 · Gastos menores" },
  { value: "44", label: "44 · Régimenes especiales" },
  { value: "45", label: "45 · Gubernamental" },
];

/** Display-only: 1000000 → "1,000,000" */
function formatSeqNumber(value) {
  if (value == null || value === "") return "";
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("en-US");
}

/** Parse typed text (with or without commas) back to a non-negative integer. */
function parseSeqNumberInput(raw) {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (!digits) return 0;
  const n = Number(digits);
  return Number.isInteger(n) && n >= 0 ? n : 0;
}

function emptyRow() {
  return {
    tipo_comprobante: "31",
    descripcion_tipo: "Factura de Crédito Fiscal Electrónica",
    numero_inicial: 1,
    numero_final: 1,
    fecha_autorizacion: "",
    fecha_vencimiento: "",
    alerta_minima_restante: 10,
    comentario: "",
    no_solicitud: "",
    no_autorizacion: "",
  };
}

/**
 * Importación admin de series E desde fotos DGII → producción (sin cambiar ambiente).
 */
export default function EmpresaAdminImportarDgii({
  userId,
  empresa,
  onCreated,
}) {
  const inputRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [filas, setFilas] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [resultados, setResultados] = useState(null);

  const rnc = empresa?.rnc || "";
  const razon = empresa?.razonSocial || empresa?.nombre || "";

  const addFiles = useCallback((list) => {
    const batch = Array.from(list || []);
    if (!batch.length) return;

    let summary = null;
    setFiles((prev) => {
      const { accepted, rejected, skippedDuplicate } = classifyDgiiImageFiles(
        batch,
        { existing: prev, maxFiles: DGII_IMPORT_MAX_FILES },
      );
      const next = accepted.length ? [...prev, ...accepted] : prev;
      summary = {
        acceptedCount: accepted.length,
        rejected,
        skippedDuplicate,
        totalCount: next.length,
      };
      return next;
    });

    setResultados(null);
    if (!summary) return;

    const { acceptedCount, rejected, skippedDuplicate, totalCount } = summary;
    if (acceptedCount === 0 && rejected.length === 0 && skippedDuplicate === 0) {
      return;
    }

    const msg = describeDgiiImageSelection({
      acceptedCount,
      totalCount,
      rejected,
      skippedDuplicate,
    });

    if (acceptedCount === 0) {
      setError(msg);
      setInfo("");
      return;
    }

    setError("");
    setInfo(msg);
  }, []);

  const removeFile = (idx) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateFila = (idx, patch) => {
    setFilas((prev) =>
      prev.map((row, i) => {
        if (i !== idx) return row;
        const next = { ...row, ...patch };
        if (patch.tipo_comprobante) {
          const t = TIPOS.find((x) => x.value === patch.tipo_comprobante);
          next.descripcion_tipo = t
            ? t.label.replace(/^\d+\s*·\s*/, "").trim()
            : next.descripcion_tipo;
          if (patch.tipo_comprobante === "32" || patch.tipo_comprobante === "34") {
            next.fecha_vencimiento = "";
          }
        }
        return next;
      }),
    );
  };

  const removeFila = (idx) => {
    setFilas((prev) => prev.filter((_, i) => i !== idx));
  };

  const analizar = async () => {
    if (!files.length) {
      setError("Seleccione al menos una foto de la autorización DGII.");
      return;
    }
    setAnalyzing(true);
    setError("");
    setInfo("");
    setResultados(null);
    const fotosEnviadas = files.length;
    try {
      const fd = new FormData();
      for (const f of files) fd.append("images", f);
      const res = await fetch(
        `/api/users/${userId}/comprobantes/importar-dgii/extraer`,
        { method: "POST", body: fd },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "No se pudieron leer las imágenes.");
        return;
      }
      const rows = Array.isArray(json.filas) ? json.filas : [];
      if (!rows.length) {
        setFilas([]);
        setError(
          `No se encontraron series E en las ${fotosEnviadas} foto${fotosEnviadas === 1 ? "" : "s"} enviada${fotosEnviadas === 1 ? "" : "s"}. Revise que se vean los rangos E31/E32/… o agregue filas a mano.`,
        );
        return;
      }
      setFilas(
        rows.map((r) => ({
          tipo_comprobante: r.tipo_comprobante,
          descripcion_tipo: r.descripcion_tipo || "",
          numero_inicial: r.numero_inicial,
          numero_final: r.numero_final,
          fecha_autorizacion: r.fecha_autorizacion || "",
          fecha_vencimiento: r.fecha_vencimiento || "",
          alerta_minima_restante: r.alerta_minima_restante ?? 10,
          comentario: r.comentario || "",
          no_solicitud: r.no_solicitud || "",
          no_autorizacion: r.no_autorizacion || "",
        })),
      );
      setInfo(
        `Se enviaron ${fotosEnviadas} foto${fotosEnviadas === 1 ? "" : "s"} y se extrajeron ${rows.length} serie${rows.length === 1 ? "" : "s"} E. Revise y edite antes de crear en producción.`,
      );
    } catch {
      setError("Error de conexión al analizar las imágenes.");
    } finally {
      setAnalyzing(false);
    }
  };

  const crear = async () => {
    if (!filas.length) {
      setError("No hay secuencias para crear.");
      return;
    }
    setCreating(true);
    setError("");
    setInfo("");
    setResultados(null);
    try {
      const res = await fetch(`/api/users/${userId}/comprobantes/importar-dgii`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filas }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "No se pudieron crear las secuencias.");
        return;
      }
      setResultados(json);
      setInfo(
        `Producción: ${json.creadas} creada${json.creadas === 1 ? "" : "s"}, ${json.fallidas} fallida${json.fallidas === 1 ? "" : "s"}. El ambiente de la empresa no se modificó.`,
      );
      if (json.creadas > 0) {
        // Evita reenviar las mismas fotos / filas con otro clic en Crear
        setFiles([]);
        setFilas([]);
        if (typeof onCreated === "function") onCreated(json);
      }
    } catch {
      setError("Error de conexión al crear las secuencias.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <section className={styles.section} aria-labelledby="importar-dgii-title">
      <div className={styles.header}>
        <h2 id="importar-dgii-title" className={styles.title}>
          Importar series E desde DGII
        </h2>
        <p className={styles.subtitle}>
          Suba fotos de las autorizaciones del portal DGII. El sistema lee solo
          series electrónicas (prefijo E), usted revisa los rangos y luego se
          crean en producción (Giganet + The Factory) sin cambiar el ambiente
          demo/producción de la empresa.
        </p>
        <p className={styles.meta}>
          <span>
            RNC: <strong>{rnc || "—"}</strong>
          </span>
          <span>
            Empresa: <strong>{razon || "—"}</strong>
          </span>
        </p>
        <p className={styles.note}>
          Destino fijo: base de datos y The Factory de <strong>producción</strong>.
          Si la empresa está en demo, estas secuencias no aparecerán en el listado
          demo hasta que cambie a producción.
        </p>
      </div>

      <div
        className={`${styles.dropzone} ${dragOver ? styles.dropzoneActive : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          addFiles(e.dataTransfer.files);
        }}
      >
        <label className={styles.dropLabel}>
          <input
            ref={inputRef}
            className={styles.fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <span>Arrastre fotos aquí o haga clic para elegir</span>
          <span className={styles.dropHint}>
            JPG, PNG o WebP · máx. 8 imágenes · 8 MB c/u
          </span>
        </label>
      </div>

      {files.length > 0 && (
        <ul className={styles.fileList}>
          {files.map((f, i) => (
            <li key={`${f.name}-${f.size}-${i}`} className={styles.fileChip}>
              <span>{f.name}</span>
              <button type="button" onClick={() => removeFile(i)} aria-label="Quitar">
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.btnPrimary}
          disabled={analyzing || creating || !files.length}
          onClick={analizar}
        >
          {analyzing ? "Analizando…" : "Analizar fotos"}
        </button>
        <button
          type="button"
          className={styles.btnSecondary}
          disabled={analyzing || creating}
          onClick={() => setFilas((prev) => [...prev, emptyRow()])}
        >
          Agregar fila manual
        </button>
        {filas.length > 0 && (
          <button
            type="button"
            className={styles.btnPrimary}
            disabled={analyzing || creating}
            onClick={crear}
          >
            {creating ? "Creando en producción…" : "Crear en producción"}
          </button>
        )}
        {(files.length > 0 || filas.length > 0 || resultados) && (
          <button
            type="button"
            className={styles.btnDanger}
            disabled={analyzing || creating}
            onClick={() => {
              setFiles([]);
              setFilas([]);
              setResultados(null);
              setError("");
              setInfo("");
            }}
          >
            Limpiar
          </button>
        )}
      </div>

      {error && <p className={styles.msgError}>{error}</p>}
      {info && !error && <p className={styles.msgSuccess}>{info}</p>}

      {filas.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.colTipo}>Tipo</th>
                <th>Desde</th>
                <th>Hasta</th>
                <th>Autorización</th>
                <th>Vence</th>
                <th>Alerta</th>
                <th className={styles.colComment}>Comentario</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filas.map((row, idx) => {
                const sinVenc =
                  row.tipo_comprobante === "32" || row.tipo_comprobante === "34";
                const tipoLabel =
                  TIPOS.find((t) => t.value === row.tipo_comprobante)?.label ||
                  row.tipo_comprobante;
                return (
                  <tr key={idx}>
                    <td className={styles.colTipo}>
                      <select
                        className={`${styles.select} ${styles.selectTipo}`}
                        value={row.tipo_comprobante}
                        title={tipoLabel}
                        onChange={(e) =>
                          updateFila(idx, { tipo_comprobante: e.target.value })
                        }
                        aria-label={`Tipo fila ${idx + 1}`}
                      >
                        {TIPOS.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        className={`${styles.input} ${styles.inputSeq}`}
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        value={formatSeqNumber(row.numero_inicial)}
                        onChange={(e) =>
                          updateFila(idx, {
                            numero_inicial: parseSeqNumberInput(e.target.value),
                          })
                        }
                        aria-label={`Número inicial fila ${idx + 1}`}
                      />
                    </td>
                    <td>
                      <input
                        className={`${styles.input} ${styles.inputSeq}`}
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        value={formatSeqNumber(row.numero_final)}
                        onChange={(e) =>
                          updateFila(idx, {
                            numero_final: parseSeqNumberInput(e.target.value),
                          })
                        }
                        aria-label={`Número final fila ${idx + 1}`}
                      />
                    </td>
                    <td>
                      <input
                        className={`${styles.input} ${styles.inputDate}`}
                        type="date"
                        value={row.fecha_autorizacion}
                        onChange={(e) =>
                          updateFila(idx, {
                            fecha_autorizacion: e.target.value,
                          })
                        }
                        aria-label={`Fecha autorización fila ${idx + 1}`}
                      />
                    </td>
                    <td>
                      <input
                        className={`${styles.input} ${styles.inputDate}`}
                        type="date"
                        value={row.fecha_vencimiento}
                        disabled={sinVenc}
                        onChange={(e) =>
                          updateFila(idx, {
                            fecha_vencimiento: e.target.value,
                          })
                        }
                        aria-label={`Fecha vencimiento fila ${idx + 1}`}
                      />
                    </td>
                    <td>
                      <input
                        className={`${styles.input} ${styles.inputNarrow}`}
                        type="number"
                        min={1}
                        value={row.alerta_minima_restante}
                        onChange={(e) =>
                          updateFila(idx, {
                            alerta_minima_restante: Number(e.target.value),
                          })
                        }
                        aria-label={`Alerta mínima fila ${idx + 1}`}
                      />
                    </td>
                    <td className={styles.colComment}>
                      <textarea
                        className={`${styles.input} ${styles.inputComment}`}
                        value={row.comentario}
                        maxLength={500}
                        rows={2}
                        title={row.comentario || undefined}
                        onChange={(e) =>
                          updateFila(idx, { comentario: e.target.value })
                        }
                        aria-label={`Comentario fila ${idx + 1}`}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className={styles.removeBtn}
                        onClick={() => removeFila(idx)}
                      >
                        Quitar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {resultados?.resultados?.length > 0 && (
        <div className={styles.results} aria-live="polite">
          {resultados.resultados.map((r, i) => (
            <div
              key={i}
              className={`${styles.resultRow} ${r.ok ? styles.resultOk : styles.resultFail}`}
            >
              <strong>
                E{r.tipo_comprobante} · {formatSeqNumber(r.numero_inicial)}–
                {formatSeqNumber(r.numero_final)}
              </strong>
              {r.ok ? (
                <span>
                  OK{r.tf_serie ? ` · TF ${r.tf_serie}` : ""}
                  {r.message ? ` · ${r.message}` : ""}
                </span>
              ) : (
                <span>{r.error || "Error"}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
