import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import EmpresasList from "@/components/dashboard/EmpresasList";
import FoliosAlertasBanner from "@/components/dashboard/FoliosAlertasBanner";
import foliosStyles from "@/components/dashboard/EmpresaFolios.module.css";
import styles from "./page.module.css";

export default async function Empresas() {
  const session = await auth();
  const user = session?.user;

  if (!user || user.role !== "admin") {
    redirect("/dashboard/empresa");
  }

  return (
    <div className={styles.empresas}>
      <header className={`${styles.header} ${foliosStyles.pageHeaderRow}`}>
        <div>
          <h1 className={styles.title}>Empresas</h1>
          <p className={styles.subtitle}>
            Listado de todas las empresas registradas en la plataforma.
          </p>
        </div>
        <Link href="/dashboard/empresas/folios" className={foliosStyles.linkBtn}>
          Control de folios
        </Link>
      </header>
      <FoliosAlertasBanner />
      <EmpresasList />
    </div>
  );
}
