import { auth } from "@/auth";
import { redirect } from "next/navigation";
import ApiKeySection from "@/components/dashboard/ApiKeySection";
import styles from "./page.module.css";

export default async function ApiKeyPage() {
  const session = await auth();
  const user = session?.user;

  if (!user || user.role !== "user") {
    redirect("/login");
  }

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.title}>API Key</h1>
      <p className={styles.subtitle}>
        Usa esta clave para que tu sistema (ERP, punto de venta, etc.) pueda
        solicitar números de comprobante al backend. No la compartas ni la
        expongas en el frontend.
      </p>
      <ApiKeySection />
    </div>
  );
}
