import { auth } from "@/auth";
import { redirect } from "next/navigation";
import EmpresasList from "@/components/dashboard/EmpresasList";
import styles from "./page.module.css";

export default async function Empresas() {
  const session = await auth();
  const user = session?.user;

  if (!user || user.role !== "admin") {
    redirect("/dashboard/empresa");
  }

  return (
    <div className={styles.empresas}>
      <header className={styles.header}>
        <h1 className={styles.title}>Empresas</h1>
        <p className={styles.subtitle}>
          Listado de todas las empresas registradas en la plataforma.
        </p>
      </header>
      <EmpresasList />
    </div>
  );
}