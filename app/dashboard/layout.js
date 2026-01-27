import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Sidebar from "@/components/dashboard/Sidebar";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import styles from "./layout.module.css";

export default async function DashboardLayout({ children }) {
    const session = await auth();
    
    if (!session?.user) {
        redirect("/login");
    }

    return (
        <div className={styles.dashboardLayout}>
            <Sidebar user={session.user} />
            
            <div className={styles.mainContent}>
                <DashboardHeader user={session.user} />
                
                <main className={styles.content}>
                    {children}
                </main>
            </div>
        </div>
    );
}