import { auth } from "@/auth";
import { redirect } from "next/navigation";
import styles from "./page.module.css";

export default async function MisComprobantesId({ params }) {
  const session = await auth();
  const user = session?.user;

  if (!user || user.role !== "user") {
    redirect("/login");
  }

  const { id } = await params;

  if (!id) {
    redirect("/dashboard/mis-comprobantes");
  }

  return <div className={styles.misComprobantesId}>
    <header className={styles.header}>
      <h1 className={styles.title}>Mis Comprobantes</h1>
      <p className={styles.subtitle}>
        Listado de todos los comprobantes emitidos por la empresa.
      </p>
    </header>
    <p>ID: {id}</p>
  </div>;
}