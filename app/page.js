import styles from "./page.module.css";
import Link from "next/link";

export default async function Home() {
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <h1 className={styles.title}>Welcome</h1>
        <p className={styles.description}>
          Bienvenido a nuestra plataforma. Inicia sesión o regístrate para comenzar.
        </p>
        
        <div className={styles.actions}>
          <Link href="/login" className={styles.primaryButton}>
            Iniciar Sesión
          </Link>
          <Link href="/register" className={styles.secondaryButton}>
            Registrarse
          </Link>
        </div>
      </div>
    </div>
  );
}