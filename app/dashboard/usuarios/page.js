import styles from "./page.module.css";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import UserManagement from "@/components/dashboard/UserManagement";

export default async function Usuarios() {
  const session = await auth();
  const user = session?.user;

  if (!user || user.role !== "admin") {
    redirect("/login");
  }

  return (
    <div className={styles.usuarios}>
      <UserManagement />
    </div>
  );
}
