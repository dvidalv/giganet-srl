"use client";
import styles from "./page.module.css";
import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { crearUsuario } from "@/actions/crearUsuario-action";

export default function Register() {
  const router = useRouter();
  const [canRegister, setCanRegister] = useState(null); // null = cargando, true = no hay admin, false = hay admin

  useEffect(() => {
    fetch("/api/auth/has-admin")
      .then((res) => res.json())
      .then((data) => {
        if (data.hasAdmin === true) {
          router.replace("/login");
          setCanRegister(false);
        } else {
          setCanRegister(true);
        }
      })
      .catch(() => setCanRegister(true)); // en error, permitir ver el formulario
  }, [router]);

  const [state, action, isPending] = useActionState(crearUsuario, {
    values: { name: "", email: "", password: "", username: "" },
    errors: { name: null, email: null, password: null, username: null },
    success: null,
    error: null,
  });

  // Mientras se comprueba si hay admin o ya hay admin, no mostrar el formulario
  if (canRegister === null) {
    return (
      <div className={styles.register}>
        <div className={styles.formContainer}>
          <h1 className={styles.title}>Cargando...</h1>
        </div>
      </div>
    );
  }

  if (canRegister === false) {
    return (
      <div className={styles.register}>
        <div className={styles.formContainer}>
          <h1 className={styles.title}>Redirigiendo...</h1>
        </div>
      </div>
    );
  }

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
            type="text"
            name="username"
            placeholder="Nombre de usuario (opcional)"
            className={styles.input}
            autoComplete="username"
            minLength={3}
            maxLength={30}
            defaultValue={state.values?.username || ""}
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
          {state.errors?.username && (
            <p className={styles.error}>{state.errors.username}</p>
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
