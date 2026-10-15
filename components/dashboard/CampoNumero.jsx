"use client";

import { useLayoutEffect, useRef } from "react";

/** "-20000" -> "-20,000"; conserva un "-" solo mientras se escribe un negativo. */
function formatear(raw) {
  const texto = String(raw ?? "");
  const negativo = texto.startsWith("-");
  const digitos = texto.replace(/\D/g, "");
  if (!digitos) return negativo ? "-" : "";
  const n = Number(digitos).toLocaleString("en-US");
  return negativo ? `-${n}` : n;
}

function limpiar(texto, permitirNegativo) {
  const negativo = permitirNegativo && /^\s*-/.test(texto);
  const digitos = texto.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  return negativo ? `-${digitos}` : digitos;
}

function digitosAntes(texto, pos) {
  return texto.slice(0, pos).replace(/\D/g, "").length;
}

function posicionTrasDigitos(texto, n) {
  if (n === 0) return texto.startsWith("-") ? 1 : 0;
  let vistos = 0;
  for (let i = 0; i < texto.length; i += 1) {
    if (/\d/.test(texto[i])) vistos += 1;
    if (vistos === n) return i + 1;
  }
  return texto.length;
}

/**
 * Entero con separador de miles ("20,000"). Acepta lo que se pegue o escriba con comas,
 * puntos o espacios y entrega a `onChange` solo los dígitos ("20000", o "-3" si se permiten negativos).
 */
export default function CampoNumero({ value, onChange, permitirNegativo = false, ...props }) {
  const inputRef = useRef(null);
  const caretRef = useRef(null);
  const mostrado = formatear(value);

  useLayoutEffect(() => {
    const input = inputRef.current;
    if (caretRef.current === null || !input || document.activeElement !== input) return;
    const pos = posicionTrasDigitos(mostrado, caretRef.current);
    caretRef.current = null;
    input.setSelectionRange(pos, pos);
  }, [mostrado]);

  return (
    <input
      {...props}
      ref={inputRef}
      type="text"
      inputMode={permitirNegativo ? "text" : "numeric"}
      autoComplete="off"
      value={mostrado}
      onChange={(e) => {
        const { value: texto, selectionStart } = e.target;
        caretRef.current = digitosAntes(texto, selectionStart ?? texto.length);
        onChange(limpiar(texto, permitirNegativo));
      }}
    />
  );
}
