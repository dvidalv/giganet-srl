"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import styles from "./Sidebar.module.css";
import logo from "@/public/logo.png";

export default function Sidebar({ user }) {
    const pathname = usePathname();

    const navItems = [
        { label: "Dashboard", href: "/dashboard", icon: "🏠" },
        { label: "Usuarios", href: "/dashboard/usuarios", icon: "👥" },
        { label: "Productos", href: "/dashboard/productos", icon: "📦" },
        { label: "Reportes", href: "/dashboard/reportes", icon: "📊" },
        { label: "Configuración", href: "/dashboard/configuracion", icon: "⚙️" },
    ];

    return (
        <aside className={styles.sidebar}>
            <div className={styles.sidebarContent}>
                {/* Logo */}
                {/* <div className={styles.logoContainer}>
                    <Link href="/dashboard">
                        <Image 
                            src={logo} 
                            alt="Logo Giganet" 
                            width={150} 
                            height={60}
                            className={styles.logo}
                        />
                    </Link>
                </div> */}

                {/* Navigation */}
                <nav className={styles.nav}>
                    <ul className={styles.navList}>
                        {navItems.map((item) => {
                            const isActive = pathname === item.href;
                            return (
                                <li key={item.label}>
                                    <Link 
                                        href={item.href}
                                        className={`${styles.navLink} ${isActive ? styles.active : ''}`}
                                    >
                                        <span className={styles.icon}>{item.icon}</span>
                                        <span>{item.label}</span>
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </nav>

                {/* User Info */}
                <div className={styles.userInfo}>
                    <div className={styles.userAvatar}>
                        {user?.name?.charAt(0).toUpperCase() || "U"}
                    </div>
                    <div className={styles.userDetails}>
                        <div className={styles.userName}>{user?.name || "Usuario"}</div>
                        <div className={styles.userRole}>Administrador</div>
                    </div>
                </div>
            </div>
        </aside>
    );
}
