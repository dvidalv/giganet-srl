"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import styles from "./Sidebar.module.css";
import { RiHome9Fill } from "react-icons/ri";
import { ImQrcode } from "react-icons/im";
import { BsBuildings } from "react-icons/bs";
import { IoPeopleCircle } from "react-icons/io5";
import { FcDataConfiguration } from "react-icons/fc";
import { IoKeySharp } from "react-icons/io5";
import { IoBarChartSharp } from "react-icons/io5";
import { MdOutlinePoll } from "react-icons/md";
import { FaUserCircle } from "react-icons/fa";

export default function Sidebar({ user }) {
  const { name, email, role, image } = user;
  const pathname = usePathname();

  const navItems = [
    { label: "Dashboard", href: "/dashboard", icon: <RiHome9Fill /> },
    { label: "Mi perfil", href: "/dashboard/perfil", icon: <FaUserCircle /> },
    ...(role === "admin"
      ? [
          { label: "Usuarios", href: "/dashboard/usuarios", icon: <IoPeopleCircle /> },
          { label: "Empresas", href: "/dashboard/empresas", icon: <BsBuildings /> },
          { label: "Encuestas", href: "/dashboard/encuestas", icon: <MdOutlinePoll /> },
        ]
      : []),
    ...(role === "admin"
      ? [{ label: "Comprobantes", href: "/dashboard/comprobantes", icon: <ImQrcode /> }]
      : []),
    ...(role !== "admin"
      ? [{ label: "Mis comprobantes", href: "/dashboard/mis-comprobantes", icon: <ImQrcode /> }]
      : []),
    ...(role !== "admin"
      ? [{ label: "Mi Empresa", href: "/dashboard/empresa", icon: <BsBuildings /> }]
      : []),
    ...(role !== "admin"
      ? [{ label: "API Key", href: "/dashboard/api-key", icon: <IoKeySharp /> }]
      : []),
    { label: "Reportes", href: "/dashboard/reportes", icon: <IoBarChartSharp /> },
    { label: "Configuración", href: "/dashboard/configuracion", icon: <FcDataConfiguration /> },
  ];

  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarContent}>
        <nav className={styles.nav}>
          <ul className={styles.navList}>
            {navItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
              return (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className={`${styles.navLink} ${isActive ? styles.active : ""}`}
                    title={item.label}
                    aria-label={item.label}
                  >
                    <span className={styles.icon}>{item.icon}</span>
                    <span className={styles.label}>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <Link
          href="/dashboard/perfil"
          className={styles.userInfo}
          title="Ir a Mi perfil"
          aria-label="Ir a Mi perfil"
        >
          <div className={styles.userAvatar}>
            {image ? (
              <Image
                src={image}
                alt=""
                width={45}
                height={45}
                className={styles.userAvatarImage}
              />
            ) : (
              name?.charAt(0).toUpperCase() || "U"
            )}
          </div>
          <div className={styles.userDetails}>
            <div className={styles.userName}>{name || "Usuario"}</div>
            <div className={styles.userRole}>{email || "email@ejemplo.com"}</div>
          </div>
        </Link>
      </div>
    </aside>
  );
}
