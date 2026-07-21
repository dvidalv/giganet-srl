"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "./LogoutButton";
import styles from "./header.module.css";

function roleLabel(role) {
    if (role === "admin") return "Admin";
    if (role) return "Usuario";
    return "";
}

export default function HeaderNav({ user }) {
    const pathname = usePathname();
    const isLoggedIn = Boolean(user);
    const displayName = user?.name?.trim() || "Usuario";
    const displayEmail = user?.email?.trim() || "";
    const displayRole = roleLabel(user?.role);
    const initial = displayName.charAt(0).toUpperCase() || "U";

    const navItems = [
        { label: "Inicio", href: "/" },
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
                            className={`${styles.navLink} ${isActive(item.href) ? styles.active : ""}`}
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
                                className={`${styles.navLink} ${isActive("/dashboard") ? styles.active : ""}`}
                            >
                                Dashboard
                            </Link>
                        </li>
                        <li className={styles.navItem}>
                            <Link
                                href="/dashboard"
                                className={styles.userChip}
                                title={displayEmail || displayName}
                                aria-label={`Sesión de ${displayName}`}
                            >
                                <span className={styles.userAvatar} aria-hidden>
                                    {initial}
                                </span>
                                <span className={styles.userMeta}>
                                    <span className={styles.userName}>{displayName}</span>
                                    <span className={styles.userSub}>
                                        {displayRole}
                                        {displayRole && displayEmail ? " · " : ""}
                                        {displayEmail}
                                    </span>
                                </span>
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
                            className={`${styles.navLink} ${isActive("/login") ? styles.active : ""}`}
                        >
                            Login
                        </Link>
                    </li>
                )}
            </ul>
        </nav>
    );
}
