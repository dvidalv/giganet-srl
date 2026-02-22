"use client";
import styles from "./page.module.css";
import { useActionState, useState, useEffect } from "react";
import { enviarFormularioContacto } from "@/actions/enviarFormularioContacto-action";
import { formatPhoneNumber, formatPhoneNumberRealtime } from "@/utils/phoneUtils";

export default function Contacto() {
  const [state, action, isPending] = useActionState(
    enviarFormularioContacto,
    {
      errors: null,
      success: null,
      values: { nombre: "", email: "", telefono: "", mensaje: "" },
    }
  );

  // Estado local para el teléfono formateado
  const [telefono, setTelefono] = useState("");

  // Sincronizar con el valor del estado cuando hay errores o éxito
  useEffect(() => {
    if (state.values?.telefono !== undefined) {
      // Usar setTimeout para evitar sincronización directa
      setTimeout(() => {
        setTelefono(formatPhoneNumber(state.values.telefono));
      }, 0);
    }
  }, [state.values?.telefono]);

  const handlePhoneChange = (e) => {
  const formatted = formatPhoneNumberRealtime(e.target.value);
    setTelefono(formatted);
  };

  return (
    <div className={styles.contacto}>
      <div className={styles.formContainer}>
        <h1 className={styles.title}>Contacto</h1>
        <p className={styles.subtitle}>
          Contáctanos para cualquier consulta o solicitud de servicio
        </p>
        <form className={styles.form} action={action}>
          {/* Campo Nombre */}
          <div className={styles.fieldWrapper}>
            <input
              type="text"
              name="nombre"
              placeholder="Tu nombre completo"
              defaultValue={state.values?.nombre || ""}
              className={`${styles.input} ${state.errors?.nombre ? styles.inputError : ''}`}
            />
            {state.errors?.nombre && (
              <p className={styles.fieldError}>{state.errors.nombre}</p>
            )}
          </div>

          {/* Campo Teléfono */}
          <div className={styles.fieldWrapper}>
            <input
              type="tel"
              name="telefono"
              placeholder="ejemplo: (123) 456-7890"
              value={telefono}
              onChange={handlePhoneChange}
              className={`${styles.input} ${state.errors?.telefono ? styles.inputError : ''}`}
            />
            {state.errors?.telefono && (
              <p className={styles.fieldError}>{state.errors.telefono}</p>
            )}
          </div>

          {/* Campo Email */}
          <div className={styles.fieldWrapper}>
            <input
              type="email"
              name="email"
              placeholder="Tu email"
              defaultValue={state.values?.email || ""}
              className={`${styles.input} ${state.errors?.email ? styles.inputError : ''}`}
            />
            {state.errors?.email && (
              <p className={styles.fieldError}>{state.errors.email}</p>
            )}
          </div>

          {/* Campo Mensaje */}
          <div className={styles.fieldWrapper}>
            <textarea
              name="mensaje"
              placeholder="Tu mensaje"
              defaultValue={state.values?.mensaje || ""}
              className={`${styles.textarea} ${state.errors?.mensaje ? styles.inputError : ''}`}
              rows="5"
            />
            {state.errors?.mensaje && (
              <p className={styles.fieldError}>{state.errors.mensaje}</p>
            )}
          </div>

          <button type="submit" className={styles.submitButton} disabled={isPending}>
            {isPending ? "Enviando..." : "Enviar Mensaje"}
          </button>

          {state.errors?.general && (
            <p className={styles.fieldError}>{state.errors.general}</p>
          )}
        </form>

        {/* Mensaje de éxito */}
        {state.success && (
          <div className={styles.messages}>
            <p className={styles.success}>{state.success}</p>
          </div>
        )}
      </div>
    </div>
  );
}