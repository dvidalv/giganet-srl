import { auth } from "@/auth";
import { redirect } from "next/navigation";
import ClienteFoliosResumen from "@/components/dashboard/ClienteFoliosResumen";
import ClienteSolicitarPlanes from "@/components/dashboard/ClienteSolicitarPlanes";
import styles from "./page.module.css";

export default async function MisFoliosPage() {
  const session = await auth();
  const user = session?.user;

  if (!user || user.role !== "user") {
    redirect("/login");
  }

  return (
    <div className={styles.wrapper}>
      <ClienteFoliosResumen />
      <ClienteSolicitarPlanes />
    </div>
  );
}
