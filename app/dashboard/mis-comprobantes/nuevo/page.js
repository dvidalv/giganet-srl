import styles from "./page.module.css";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import SecuenciaForm from "@/components/dashboard/SecuenciaForm";

export default async function NuevoComprobante() {
  const session = await auth();
  const user = session?.user;

  if (!user || user.role !== "user") {
    redirect("/login");
  }

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.title}>Solicitar Nueva Secuencia</h1>
      <p className={styles.subtitle}>
        Formulario para solicitar una nueva secuencia de comprobantes fiscales.
      </p>
      <Link href="/dashboard/mis-comprobantes" className={styles.back}>
        ← Volver a Mis Comprobantes
      </Link>
      <div className={styles.formSection}>
        <SecuenciaForm />
      </div>
    </div>
  );
}
