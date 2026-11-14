import Link from "next/link";
import { FaFileInvoiceDollar } from "react-icons/fa";
import styles from "./DgiiPromoBanner.module.css";

export default function DgiiPromoBanner() {
  return (
    <aside className={styles.banner} aria-label="Aviso de facturación electrónica DGII">
      <div className={styles.glow} aria-hidden />
      <div className={styles.inner}>
        <div className={styles.badge}>
          <FaFileInvoiceDollar aria-hidden />
          <span>Desde mañana · Dom 15 nov 2026</span>
        </div>
        <div className={styles.copy}>
          <h2 className={styles.headline}>
            Facturación Electrónica DGII: lista desde mañana
          </h2>
          <p className={styles.support}>
            Integramos e-CF con cumplimiento DGII. Prepárate a tiempo con la
            experiencia de GigaNet en facturación electrónica.
          </p>
        </div>
        <Link href="/contacto" className={styles.cta}>
          Solicita tu consulta gratis
        </Link>
      </div>
    </aside>
  );
}
