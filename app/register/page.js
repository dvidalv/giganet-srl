import styles from "./page.module.css";
import Link from "next/link";

export default function Register() {
  return (
    <div className={styles.register}>
      <div className={styles.formContainer}>
        <h1 className={styles.title}>Crear Cuenta</h1>
        <p className={styles.subtitle}>Regístrate para comenzar</p>
        <form className={styles.form}>
          <input
            type="text"
            name="fullName"
            placeholder="Tu nombre completo"
            className={styles.input}
            required
          />
          <input
            type="email"
            name="email"
            placeholder="Tu email"
            className={styles.input}
            required
          />
          <input
            type="password"
            name="password"
            placeholder="Tu contraseña"
            className={styles.input}
            required
          />
          <button type="submit" className={styles.submitButton}>
            Registrarse
          </button>
        </form>
        <div className={styles.loginLink}>
          ¿Ya tienes una cuenta? <Link href="/login">Inicia sesión</Link>
        </div>
      </div>
    </div>
  );
}