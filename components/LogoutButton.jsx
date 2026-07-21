"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { FaSignOutAlt } from "react-icons/fa";
import { signOutAction } from "@/actions/signout-action";
import styles from "./header.module.css";

export default function LogoutButton() {
    const router = useRouter();
    const [isSigningOut, setIsSigningOut] = useState(false);

    const handleSignOut = async () => {
        try {
            setIsSigningOut(true);
            await signOutAction();
            router.push("/");
            router.refresh();
        } catch (error) {
            console.error("Error al cerrar sesión:", error);
            setIsSigningOut(false);
        }
    };

    return (
        <button
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
            className={styles.logoutButton}
            aria-label={isSigningOut ? "Cerrando sesión" : "Cerrar sesión"}
            title={isSigningOut ? "Cerrando sesión…" : "Cerrar sesión"}
        >
            <FaSignOutAlt aria-hidden className={styles.logoutIcon} />
        </button>
    );
}
