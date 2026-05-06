import styles from "./page.module.css";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import ComprobantesList from "@/components/dashboard/ComprobantesList";

export default async function MisComprobantes() {
  const session = await auth();
  const user = session?.user;

  if (!user || user.role !== "user") {
    redirect("/login");
  }

  return (
    <div className={styles.wrapper}>
      <header className={styles.header}>
        <div className={styles.headerText}>
          <h1 className={styles.title}>Gestión de Comprobantes Fiscales</h1>
          <p className={styles.subtitle}>
            Despliega el panel &quot;Series en The Factory HKA&quot; para ver
            lo que tiene el emisor en The Factory; más abajo, las secuencias en
            Giganet. Puedes anular NCF no utilizados desde cada tarjeta (icono
            de prohibido).
          </p>
        </div>
        <Link href="/dashboard/mis-comprobantes/nuevo" className={styles.cta}>
          <span className={styles.ctaIcon} aria-hidden>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          </span>
          Solicitar Nueva Secuencia
        </Link>
      </header>

      <ComprobantesList />
    </div>
  );
}
