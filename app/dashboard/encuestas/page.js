import { auth } from "@/auth";
import { redirect } from "next/navigation";
import EncuestasList from "@/components/dashboard/EncuestasList";
import styles from "./page.module.css";

export default async function EncuestasPage() {
  const session = await auth();
  const user = session?.user;

  if (!user || user.role !== "admin") {
    redirect("/dashboard/empresa");
  }

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Encuestas de satisfacción</h1>
          <p className={styles.subtitle}>
            Envía enlaces desde aquí (sin empresa) o desde Empresas, y revisa las
            respuestas.
          </p>
        </div>
      </header>
      <EncuestasList />
    </div>
  );
}
