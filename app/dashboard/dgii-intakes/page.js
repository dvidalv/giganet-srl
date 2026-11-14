import { auth } from "@/auth";
import { redirect } from "next/navigation";
import DgiiIntakesList from "@/components/dashboard/DgiiIntakesList";
import styles from "./page.module.css";

export default async function DgiiIntakesPage() {
  const session = await auth();
  const user = session?.user;

  if (!user || user.role !== "admin") {
    redirect("/dashboard/empresa");
  }

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Admisión DGII e-CF</h1>
          <p className={styles.subtitle}>
            Formularios tokenizados de datos de empresa, representante legal,
            facturas y certificado digital.
          </p>
        </div>
      </header>
      <DgiiIntakesList />
    </div>
  );
}
