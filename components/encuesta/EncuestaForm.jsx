"use client";

import styles from "@/app/encuesta/[token]/page.module.css";
import { useActionState, useEffect, useRef } from "react";
import { Turnstile } from "@marsidev/react-turnstile";
import { responderEncuesta } from "@/actions/responderEncuesta-action";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";

const initialState = {
  errors: null,
  success: null,
  values: {
    nps: "",
    satisfaccionGeneral: "",
    facilidadIntegracion: "",
    calidadSoporte: "",
    tiempoRespuesta: "",
    loQueMasGusta: "",
    loQueMejorar: "",
    comentarios: "",
  },
};

function LikertGroup({ name, label, hint, error, defaultValue }) {
  return (
    <div className={styles.fieldWrapper}>
      <span className={styles.label}>
        {label}
        {hint ? (
          <p className={styles.hint}>{hint}</p>
        ) : null}
      </span>
      <div className={styles.likertRow} role="group" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className={styles.radioLabel}>
            <input
              type="radio"
              name={name}
              value={String(n)}
              defaultChecked={defaultValue === String(n)}
            />
            {n}
          </label>
        ))}
      </div>
      {error ? <p className={styles.fieldError}>{error}</p> : null}
    </div>
  );
}

export default function EncuestaForm({ token, empresaLabel }) {
  const [state, action, isPending] = useActionState(
    responderEncuesta,
    initialState
  );
  const turnstileRef = useRef(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending) {
      turnstileRef.current?.reset();
    }
    wasPending.current = isPending;
  }, [isPending]);

  const v = state.values || initialState.values;

  if (state.success && !state.errors?.general) {
    return (
      <div className={styles.formContainer}>
        <h1 className={styles.title}>¡Gracias!</h1>
        <div className={styles.messages}>
          <p className={styles.success}>{state.success}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.formContainer}>
      <h1 className={styles.title}>Encuesta de satisfacción</h1>
      <p className={styles.subtitle}>
        Su opinión nos ayuda a mejorar Giganet. Todos los campos numéricos son
        obligatorios; los comentarios son opcionales.
      </p>

      {empresaLabel ? (
        <div className={styles.empresaBox}>
          <strong>Empresa:</strong> {empresaLabel}
        </div>
      ) : null}

      <form className={styles.form} action={action}>
        <input type="hidden" name="token" value={token} />

        <div className={styles.hpField} aria-hidden="true">
          <label htmlFor="encuesta-website-hp">Sitio web</label>
          <input
            id="encuesta-website-hp"
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
          />
        </div>

        <div className={styles.fieldWrapper}>
          <label className={styles.label} htmlFor="encuesta-nps">
            ¿Qué tan probable es que recomiende Giganet? (NPS: 0 = nada, 10 =
            muchísimo)
          </label>
          <select
            id="encuesta-nps"
            name="nps"
            className={`${styles.select} ${state.errors?.nps ? styles.inputError : ""}`}
            defaultValue={v.nps || ""}
            required
          >
            <option value="" disabled>
              Seleccione 0–10
            </option>
            {Array.from({ length: 11 }, (_, i) => (
              <option key={i} value={String(i)}>
                {i}
              </option>
            ))}
          </select>
          {state.errors?.nps ? (
            <p className={styles.fieldError}>{state.errors.nps}</p>
          ) : null}
        </div>

        <LikertGroup
          key={`sg-${v.satisfaccionGeneral || "x"}`}
          name="satisfaccionGeneral"
          label="Satisfacción general con el servicio"
          hint="1 = muy insatisfecho, 5 = muy satisfecho"
          error={state.errors?.satisfaccionGeneral}
          defaultValue={v.satisfaccionGeneral}
        />

        <LikertGroup
          key={`fi-${v.facilidadIntegracion || "x"}`}
          name="facilidadIntegracion"
          label="Facilidad de integración / uso"
          hint="1 = muy difícil, 5 = muy fácil"
          error={state.errors?.facilidadIntegracion}
          defaultValue={v.facilidadIntegracion}
        />

        <LikertGroup
          key={`cs-${v.calidadSoporte || "x"}`}
          name="calidadSoporte"
          label="Calidad del soporte recibido"
          hint="1 = muy mala, 5 = excelente"
          error={state.errors?.calidadSoporte}
          defaultValue={v.calidadSoporte}
        />

        <LikertGroup
          key={`tr-${v.tiempoRespuesta || "x"}`}
          name="tiempoRespuesta"
          label="Tiempo de respuesta ante consultas o incidencias"
          hint="1 = muy lento, 5 = muy rápido"
          error={state.errors?.tiempoRespuesta}
          defaultValue={v.tiempoRespuesta}
        />

        <div className={styles.fieldWrapper}>
          <label className={styles.label} htmlFor="encuesta-gusta">
            ¿Qué es lo que más le gusta? (opcional)
          </label>
          <textarea
            id="encuesta-gusta"
            name="loQueMasGusta"
            className={`${styles.textarea} ${state.errors?.loQueMasGusta ? styles.inputError : ""}`}
            rows={4}
            maxLength={1000}
            defaultValue={v.loQueMasGusta || ""}
            placeholder="Opcional"
          />
          {state.errors?.loQueMasGusta ? (
            <p className={styles.fieldError}>{state.errors.loQueMasGusta}</p>
          ) : null}
        </div>

        <div className={styles.fieldWrapper}>
          <label className={styles.label} htmlFor="encuesta-mejorar">
            ¿Qué cree que podríamos mejorar? (opcional)
          </label>
          <textarea
            id="encuesta-mejorar"
            name="loQueMejorar"
            className={`${styles.textarea} ${state.errors?.loQueMejorar ? styles.inputError : ""}`}
            rows={4}
            maxLength={1000}
            defaultValue={v.loQueMejorar || ""}
            placeholder="Opcional"
          />
          {state.errors?.loQueMejorar ? (
            <p className={styles.fieldError}>{state.errors.loQueMejorar}</p>
          ) : null}
        </div>

        <div className={styles.fieldWrapper}>
          <label className={styles.label} htmlFor="encuesta-comentarios">
            Comentarios adicionales (opcional)
          </label>
          <textarea
            id="encuesta-comentarios"
            name="comentarios"
            className={`${styles.textarea} ${state.errors?.comentarios ? styles.inputError : ""}`}
            rows={4}
            maxLength={2000}
            defaultValue={v.comentarios || ""}
            placeholder="Opcional"
          />
          {state.errors?.comentarios ? (
            <p className={styles.fieldError}>{state.errors.comentarios}</p>
          ) : null}
        </div>

        {TURNSTILE_SITE_KEY ? (
          <div className={styles.turnstileWrap}>
            <Turnstile
              ref={turnstileRef}
              siteKey={TURNSTILE_SITE_KEY}
              options={{ language: "es" }}
            />
          </div>
        ) : (
          <p className={styles.fieldError} role="alert">
            Falta configurar NEXT_PUBLIC_TURNSTILE_SITE_KEY. El formulario no se
            puede enviar hasta que un administrador añada las claves de
            Turnstile.
          </p>
        )}

        {state.errors?.general ? (
          <p className={styles.fieldError} role="alert">
            {state.errors.general}
          </p>
        ) : null}

        <button
          type="submit"
          className={styles.submitButton}
          disabled={isPending || !TURNSTILE_SITE_KEY}
        >
          {isPending ? "Enviando..." : "Enviar encuesta"}
        </button>
      </form>
    </div>
  );
}
