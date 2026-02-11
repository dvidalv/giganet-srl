import { auth } from "@/auth";
import Sidebar from "@/components/dashboard/Sidebar";
// import DashboardHeader from "@/components/dashboard/DashboardHeader";
import styles from "./layout.module.css";
import { redirect } from "next/navigation";

export default async function DashboardLayout({ children }) {
  const session = await auth();
  const user = session?.user;
  if (!user) {
    redirect("/login");
  }

  return (
    <div className={styles.dashboardLayout}>
      <div className={styles.sidebarWrapper}>
        <Sidebar user={user} />
      </div>

      <div className={styles.mainContent}>


        <main className={styles.content}>
          {children}
        </main>
      </div>
    </div>
  );
}
