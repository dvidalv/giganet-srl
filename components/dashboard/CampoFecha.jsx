"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FaCalendarAlt, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { hoyRD } from "@/lib/folios/fechasRD";
import styles from "./CampoFecha.module.css";

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];
const DIAS_SEMANA = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sá"];
const DIA_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
const ALTO_CALENDARIO = 370;
const ANCHO_CALENDARIO = 296;
const MARGEN = 8;

/** Coordenadas fijas del calendario junto al campo; se abre hacia arriba si no cabe debajo. */
function calcularPosicion(trigger) {
  const r = trigger.getBoundingClientRect();
  const arriba = window.innerHeight - r.bottom < ALTO_CALENDARIO && r.top > ALTO_CALENDARIO;
  const left = Math.max(MARGEN, Math.min(r.left, window.innerWidth - ANCHO_CALENDARIO - MARGEN));
  return arriba
    ? { left, bottom: window.innerHeight - r.top + 6 }
    : { left, top: r.bottom + 6 };
}

function partes(dia) {
  const m = DIA_REGEX.exec(dia || "");
  return m ? { y: Number(m[1]), m: Number(m[2]) - 1, d: Number(m[3]) } : null;
}

/** Normaliza desbordes (día 0, mes 12, etc.) igual que Date.UTC. */
function aDia(y, m, d) {
  return new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
}

function sumarDias(dia, n) {
  const p = partes(dia);
  return aDia(p.y, p.m, p.d + n);
}

function irAMes(dia, y, m) {
  const p = partes(dia);
  const ultimo = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return aDia(y, m, Math.min(p.d, ultimo));
}

function diaSemana(dia) {
  const p = partes(dia);
  return new Date(Date.UTC(p.y, p.m, p.d)).getUTCDay();
}

function formatoCorto(dia) {
  const p = partes(dia);
  return `${String(p.d).padStart(2, "0")}/${String(p.m + 1).padStart(2, "0")}/${p.y}`;
}

function etiquetaLarga(dia) {
  const p = partes(dia);
  return `${p.d} de ${MESES[p.m]} de ${p.y}`;
}

/**
 * Selector de fecha con calendario desplegable. Trabaja con días "YYYY-MM-DD" (sin zona horaria),
 * igual que `<input type="date">`; "hoy" se resuelve en hora de República Dominicana.
 */
export default function CampoFecha({
  id,
  value,
  onChange,
  min,
  max,
  required = false,
  disabled = false,
  placeholder = "dd/mm/aaaa",
  variante = "campo",
  className = "",
  "aria-describedby": describedBy,
}) {
  const autoId = useId();
  const triggerId = id ?? `fecha-${autoId}`;
  const dialogId = `${triggerId}-calendario`;
  const [abierto, setAbierto] = useState(false);
  const [enfoque, setEnfoque] = useState(null);
  const [posicion, setPosicion] = useState(null);
  const raizRef = useRef(null);
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);
  const gridRef = useRef(null);
  const enfocarGrid = useRef(false);

  const hoy = hoyRD();
  const valido = partes(value) ? value : "";
  const fueraDeRango = (dia) => Boolean((min && dia < min) || (max && dia > max));

  const abrir = () => {
    const base = valido || hoy;
    const inicial = min && base < min ? min : max && base > max ? max : base;
    setPosicion(calcularPosicion(triggerRef.current));
    enfocarGrid.current = true;
    setEnfoque(inicial);
    setAbierto(true);
  };

  const cerrar = () => {
    setAbierto(false);
    triggerRef.current?.focus();
  };

  const seleccionar = (dia) => {
    if (fueraDeRango(dia)) return;
    onChange?.(dia);
    cerrar();
  };

  useEffect(() => {
    if (!abierto) return undefined;
    const dentro = (nodo) =>
      raizRef.current?.contains(nodo) || popoverRef.current?.contains(nodo);
    const alPulsarFuera = (e) => {
      if (!dentro(e.target)) setAbierto(false);
    };
    const reubicar = () => {
      if (triggerRef.current) setPosicion(calcularPosicion(triggerRef.current));
    };
    document.addEventListener("mousedown", alPulsarFuera);
    document.addEventListener("touchstart", alPulsarFuera);
    window.addEventListener("scroll", reubicar, true);
    window.addEventListener("resize", reubicar);
    return () => {
      document.removeEventListener("mousedown", alPulsarFuera);
      document.removeEventListener("touchstart", alPulsarFuera);
      window.removeEventListener("scroll", reubicar, true);
      window.removeEventListener("resize", reubicar);
    };
  }, [abierto]);

  useEffect(() => {
    if (!abierto || !enfocarGrid.current) return;
    enfocarGrid.current = false;
    gridRef.current?.querySelector(`[data-dia="${enfoque}"]`)?.focus();
  }, [abierto, enfoque]);

  const moverEnfoque = (dia) => {
    enfocarGrid.current = true;
    setEnfoque(min && dia < min ? min : max && dia > max ? max : dia);
  };

  const alTeclearDia = (e) => {
    const p = partes(enfoque);
    const acciones = {
      ArrowLeft: () => sumarDias(enfoque, -1),
      ArrowRight: () => sumarDias(enfoque, 1),
      ArrowUp: () => sumarDias(enfoque, -7),
      ArrowDown: () => sumarDias(enfoque, 7),
      Home: () => sumarDias(enfoque, -diaSemana(enfoque)),
      End: () => sumarDias(enfoque, 6 - diaSemana(enfoque)),
      PageUp: () => (e.shiftKey ? irAMes(enfoque, p.y - 1, p.m) : irAMes(enfoque, p.y, p.m - 1)),
      PageDown: () => (e.shiftKey ? irAMes(enfoque, p.y + 1, p.m) : irAMes(enfoque, p.y, p.m + 1)),
    };
    const accion = acciones[e.key];
    if (!accion) return;
    e.preventDefault();
    moverEnfoque(accion());
  };

  const visible = abierto && enfoque ? partes(enfoque) : null;
  let semanas = [];
  let anios = [];
  if (visible) {
    const primero = aDia(visible.y, visible.m, 1);
    const inicioGrilla = sumarDias(primero, -diaSemana(primero));
    const dias = Array.from({ length: 42 }, (_, i) => sumarDias(inicioGrilla, i));
    semanas = Array.from({ length: 6 }, (_, i) => dias.slice(i * 7, i * 7 + 7));
    const anioHoy = partes(hoy).y;
    const desde = Math.min(min ? partes(min).y : anioHoy - 10, visible.y);
    const hasta = Math.max(max ? partes(max).y : anioHoy + 10, visible.y);
    anios = Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i);
  }

  const mesAnteriorDeshabilitado =
    visible && min ? aDia(visible.y, visible.m, 0) < min : false;
  const mesSiguienteDeshabilitado =
    visible && max ? aDia(visible.y, visible.m + 1, 1) > max : false;

  return (
    <div ref={raizRef} className={`${styles.raiz} ${className}`}>
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        className={`${styles.trigger} ${variante === "filtro" ? styles.triggerFiltro : ""} ${
          abierto ? styles.triggerAbierto : ""
        }`}
        onClick={() => (abierto ? setAbierto(false) : abrir())}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !abierto) {
            e.preventDefault();
            abrir();
          } else if (e.key === "Escape" && abierto) {
            e.stopPropagation();
            setAbierto(false);
          }
        }}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={abierto}
        aria-controls={abierto ? dialogId : undefined}
        aria-describedby={describedBy}
      >
        <FaCalendarAlt className={styles.icono} aria-hidden="true" />
        <span className={valido ? styles.valor : styles.placeholder}>
          {valido ? formatoCorto(valido) : placeholder}
        </span>
      </button>
      <input
        className={styles.validacion}
        tabIndex={-1}
        aria-hidden="true"
        required={required}
        value={valido}
        onChange={() => {}}
        onFocus={() => triggerRef.current?.focus()}
      />

      {visible && posicion && createPortal(
        <div
          ref={popoverRef}
          id={dialogId}
          className={styles.popover}
          style={posicion}
          role="dialog"
          aria-modal="false"
          aria-label="Seleccionar fecha"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              cerrar();
            }
          }}
          onBlur={(e) => {
            const destino = e.relatedTarget;
            if (destino && !popoverRef.current?.contains(destino) && destino !== triggerRef.current) {
              setAbierto(false);
            }
          }}
        >
          <div className={styles.cabecera}>
            <button
              type="button"
              className={styles.navBtn}
              onClick={() => setEnfoque(irAMes(enfoque, visible.y, visible.m - 1))}
              disabled={mesAnteriorDeshabilitado}
              aria-label="Mes anterior"
            >
              <FaChevronLeft aria-hidden="true" />
            </button>
            <div className={styles.selects}>
              <select
                className={styles.select}
                value={visible.m}
                onChange={(e) => setEnfoque(irAMes(enfoque, visible.y, Number(e.target.value)))}
                aria-label="Mes"
              >
                {MESES.map((nombre, i) => (
                  <option key={nombre} value={i}>
                    {nombre}
                  </option>
                ))}
              </select>
              <select
                className={styles.select}
                value={visible.y}
                onChange={(e) => setEnfoque(irAMes(enfoque, Number(e.target.value), visible.m))}
                aria-label="Año"
              >
                {anios.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className={styles.navBtn}
              onClick={() => setEnfoque(irAMes(enfoque, visible.y, visible.m + 1))}
              disabled={mesSiguienteDeshabilitado}
              aria-label="Mes siguiente"
            >
              <FaChevronRight aria-hidden="true" />
            </button>
          </div>

          <table ref={gridRef} className={styles.grilla} role="grid" aria-label={`${MESES[visible.m]} ${visible.y}`}>
            <thead>
              <tr>
                {DIAS_SEMANA.map((d) => (
                  <th key={d} scope="col" className={styles.diaSemana}>
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {semanas.map((semana) => (
                <tr key={semana[0]}>
                  {semana.map((dia) => {
                    const p = partes(dia);
                    const deshabilitado = fueraDeRango(dia);
                    const clases = [
                      styles.dia,
                      p.m !== visible.m ? styles.diaOtroMes : "",
                      dia === hoy ? styles.diaHoy : "",
                      dia === valido ? styles.diaSeleccionado : "",
                    ].join(" ");
                    return (
                      <td key={dia} role="gridcell" aria-selected={dia === valido}>
                        <button
                          type="button"
                          className={clases}
                          data-dia={dia}
                          tabIndex={dia === enfoque ? 0 : -1}
                          disabled={deshabilitado}
                          aria-label={etiquetaLarga(dia)}
                          aria-current={dia === hoy ? "date" : undefined}
                          onClick={() => seleccionar(dia)}
                          onKeyDown={alTeclearDia}
                        >
                          {p.d}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          <div className={styles.pie}>
            <button
              type="button"
              className={styles.pieBtn}
              onClick={() => seleccionar(hoy)}
              disabled={fueraDeRango(hoy)}
            >
              Hoy
            </button>
            {!required && valido && (
              <button
                type="button"
                className={styles.pieBtn}
                onClick={() => {
                  onChange?.("");
                  cerrar();
                }}
              >
                Limpiar
              </button>
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
