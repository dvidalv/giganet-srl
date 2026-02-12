import styles from "./page.module.css";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function Reportes() {
  const session = await auth();
  const user = session?.user;

  if (!user || user.role !== "admin") {
    redirect("/login");
  }
  return (
    <div className={styles.reportes}>
      <Link href="/dashboard" className={styles.back}>
        ← Volver a Dashboard
      </Link>
      <h1>En construcción</h1>
      <p>Esta sección está en construcción. Por favor, inténtelo más tarde.</p>
    </div>
  );
}