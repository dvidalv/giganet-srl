"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "./LogoutButton";
import styles from "./header.module.css";

export default function HeaderNav({ isLoggedIn }) {
    const pathname = usePathname();

    const navItems = [
        { label: "Inicio", href: "/" },
        { label: "Nosotros", href: "/nosotros" },
        { label: "Servicios", href: "/servicios" },
        { label: "Clientes", href: "/clientes" },
        { label: "Contacto", href: "/contacto" },
    ];

    const isActive = (href) => {
        if (href === "/") {
            return pathname === "/";
        }
        return pathname.startsWith(href);
    };

    return (
        <nav className={styles.nav}>
            <ul className={styles.navList}>
                {navItems.map((item) => (
                    <li key={item.label} className={styles.navItem}>
                        <Link 
                            href={item.href} 
                            className={`${styles.navLink} ${isActive(item.href) ? styles.active : ''}`}
                        >
                            {item.label}
                        </Link>
                    </li>
                ))}
                
                {isLoggedIn ? (
                    <>
                        <li className={styles.navItem}>
                            <Link 
                                href="/dashboard" 
                                className={`${styles.navLink} ${isActive("/dashboard") ? styles.active : ''}`}
                            >
                                Dashboard
                            </Link>
                        </li>
                        <li className={styles.navItem}>
                            <LogoutButton />
                        </li>
                    </>
                ) : (
                    <li className={styles.navItem}>
                        <Link 
                            href="/login" 
                            className={`${styles.navLink} ${isActive("/login") ? styles.active : ''}`}
                        >
                            Login
                        </Link>
                    </li>
                )}
            </ul>
        </nav>
    );
}
