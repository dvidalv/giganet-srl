import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import FoliosAdminTable from "@/components/dashboard/FoliosAdminTable";
import foliosStyles from "@/components/dashboard/EmpresaFolios.module.css";
import styles from "../page.module.css";

export default async function ControlFoliosPage() {
  const session = await auth();
  const user = session?.user;

  if (!user || user.role !== "admin") {
    redirect("/dashboard/empresa");
  }

  return (
    <div className={styles.empresas}>
      <header className={`${styles.header} ${foliosStyles.pageHeaderRow}`}>
        <div>
          <h1 className={styles.title}>Control de folios</h1>
          <p className={styles.subtitle}>
            Paquetes de folios electrónicos vendidos, asignaciones en The Factory, consumo y
            vencimientos por empresa.
          </p>
        </div>
        <Link href="/dashboard/empresas" className={foliosStyles.linkBtn}>
          Volver a empresas
        </Link>
      </header>
      <FoliosAdminTable />
    </div>
  );
}
