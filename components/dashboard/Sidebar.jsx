"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./Sidebar.module.css";

export default function Sidebar({ user }) {
  const { name, email, role } = user;
  const pathname = usePathname();
  const navItems = [
    { label: "Dashboard", href: "/dashboard", icon: "🏠" },
    ...(role === "admin"
      ? [{ label: "Usuarios", href: "/dashboard/usuarios", icon: "👥" }]
      : []),
      { label: "Comprobantes", href: "/dashboard/comprobantes", icon: "🔳" },
      { label: "Mi Empresa", href: "/dashboard/empresa", icon: "🏢" },
    { label: "Reportes", href: "/dashboard/reportes", icon: "📊" },
    { label: "Configuración", href: "/dashboard/configuracion", icon: "⚙️" },
  ];

  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarContent}>
        {/* Navigation */}
        <nav className={styles.nav}>
          <ul className={styles.navList}>
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className={`${styles.navLink} ${isActive ? styles.active : ""}`}>
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
            {name?.charAt(0).toUpperCase() || "U"}
          </div>
          <div className={styles.userDetails}>
            <div className={styles.userName}>{name || "Usuario"}</div>
            <div className={styles.userRole}>
              {email || "email@ejemplo.com"}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
