"use client";

import { useState, useTransition } from "react";
import { crearEncuestaStandalone } from "@/actions/crearEncuesta-action";
import styles from "./EncuestaSendForm.module.css";

/**
 * Standalone survey send — name + email required, no empresa account.
 */
export default function EncuestaSendForm({ onSent }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [organization, setOrganization] = useState("");
  const [message, setMessage] = useState(null);
  const [isPending, startTransition] = useTransition();

  const reset = () => {
    setName("");
    setEmail("");
    setPhone("");
    setOrganization("");
  };

  const close = () => {
    setOpen(false);
    setMessage(null);
  };

  const onSubmit = (event) => {
    event.preventDefault();
    setMessage(null);

    startTransition(async () => {
      const res = await crearEncuestaStandalone({
        name,
        email,
        phone,
        organization,
      });

      if (!res.ok) {
        setMessage({ type: "error", text: res.error || "No se pudo enviar." });
        return;
      }

      let copied = false;
      try {
        if (res.surveyUrl && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(res.surveyUrl);
          copied = true;
        }
      } catch {
        /* ignore */
      }

      setMessage({
        type: "success",
        text: copied
          ? `${res.message} Enlace copiado al portapapeles.`
          : `${res.message}${res.surveyUrl ? ` Enlace: ${res.surveyUrl}` : ""}`,
      });
      reset();
      onSent?.(res);
    });
  };

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={styles.sendBtn}
        onClick={() => {
          setOpen((v) => !v);
          setMessage(null);
        }}
        aria-expanded={open}
      >
        {open ? "Cerrar formulario" : "Enviar encuesta"}
      </button>

      {open ? (
        <form className={styles.panel} onSubmit={onSubmit} noValidate>
          <div className={styles.panelHeader}>
            <h2 className={styles.panelTitle}>Enviar encuesta sin empresa</h2>
            <p className={styles.panelDesc}>
              Envía el enlace a cualquier destinatario. No hace falta que exista
              en Empresas / facturación electrónica.
            </p>
          </div>

          <div className={styles.grid}>
            <label className={styles.field}>
              <span className={styles.label}>Nombre *</span>
              <input
                className={styles.input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre del destinatario"
                autoComplete="name"
                required
                maxLength={120}
                disabled={isPending}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Correo *</span>
              <input
                className={styles.input}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="correo@ejemplo.com"
                autoComplete="email"
                required
                maxLength={254}
                disabled={isPending}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Teléfono (opcional)</span>
              <input
                className={styles.input}
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="809…"
                autoComplete="tel"
                maxLength={30}
                disabled={isPending}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Organización (opcional)</span>
              <input
                className={styles.input}
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                placeholder="Empresa o proyecto"
                maxLength={200}
                disabled={isPending}
              />
            </label>
          </div>

          {message ? (
            <p
              className={
                message.type === "error" ? styles.errorMsg : styles.successMsg
              }
              role="status"
            >
              {message.text}
            </p>
          ) : null}

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={close}
              disabled={isPending}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={isPending}
            >
              {isPending ? "Enviando…" : "Enviar enlace"}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
