import { auth } from "@/auth";
import { redirect } from "next/navigation";
import styles from "./page.module.css";
import SecuenciaEditForm from "@/components/dashboard/SecuenciaEditForm";

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

  return (
    <div className={styles.misComprobantesId}>
      <SecuenciaEditForm id={id} />
    </div>
  );
}