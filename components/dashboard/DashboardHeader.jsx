"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOutAction } from "@/actions/signout-action";
import styles from "./DashboardHeader.module.css";

export default function DashboardHeader({ user }) {
    const router = useRouter();
    const [isSigningOut, setIsSigningOut] = useState(false);

    const handleSignOut = async () => {
        try {
            setIsSigningOut(true);
            await signOutAction();
            router.push("/login");
            router.refresh();
        } catch (error) {
            console.error("Error al cerrar sesión:", error);
            setIsSigningOut(false);
        }
    };

    return (
        <header className={styles.header}>
            <div className={styles.headerContent}>
                <div className={styles.headerLeft}>
                    <h1 className={styles.greeting}>
                        Bienvenido, {user?.name || "Usuario"}
                    </h1>
                </div>
                
                <div className={styles.headerRight}>
                    <button 
                        className={styles.notificationBtn}
                        aria-label="Notificaciones"
                    >
                        🔔
                        <span className={styles.badge}>3</span>
                    </button>
                    
                    <button 
                        onClick={handleSignOut}
                        disabled={isSigningOut}
                        className={styles.signOutBtn}
                    >
                        {isSigningOut ? "Cerrando..." : "Cerrar Sesión"}
                    </button>
                </div>
            </div>
        </header>
    );
}
