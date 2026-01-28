"use client";
import styles from "./page.module.css";
import Link from "next/link";
import { useActionState } from "react";
import { crearUsuario } from "@/actions/crearUsuario-action";
export default function Register() {
  const [state, action, isPending] = useActionState(crearUsuario, {
    values: { name: "", email: "", password: "" },
    errors: { name: null, email: null, password: null },
    success: null,
    error: null,
  });
  return (
    <div className={styles.register}>
      <div className={styles.formContainer}>
        <h1 className={styles.title}>Crear Cuenta</h1>
        <p className={styles.subtitle}>Regístrate para comenzar</p>
        <form className={styles.form} action={action}>
          <input
            type="text"
            name="name"
            placeholder="Tu nombre completo"
            className={styles.input}
            required
            defaultValue={state.values?.name || ""}
          />
          <input
            type="email"
            name="email"
            placeholder="Tu email"
            className={styles.input}
            required
            defaultValue={state.values?.email || ""}
          />
          <input
            type="password"
            name="password"
            placeholder="Tu contraseña"
            className={styles.input}
            required
            defaultValue={state.values?.password || ""}
          />
          <button type="submit" className={styles.submitButton}>
            Registrarse
          </button>
        </form>
        <div className={styles.messages}>
          {state.errors?.name && (
            <p className={styles.error}>{state.errors.name}</p>
          )}
          {state.errors?.email && (
            <p className={styles.error}>{state.errors.email}</p>
          )}
          {state.errors?.password && (
            <p className={styles.error}>{state.errors.password}</p>
          )}
          {state.error && <p className={styles.error}>{state.error}</p>}
          {state.success && <p className={styles.success}>{state.success}</p>}
          {isPending && <p className={styles.pending}>Creando usuario...</p>}
        </div>
        <div className={styles.loginLink}>
          ¿Ya tienes una cuenta? <Link href="/login">Inicia sesión</Link>
        </div>
      </div>
    </div>
  );
}
