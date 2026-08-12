"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
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
  const [menuOpen, setMenuOpen] = useState(false);
  const isLoggedIn = Boolean(user);
  const displayName = user?.name?.trim() || "Usuario";
  const displayEmail = user?.email?.trim() || "";
  const displayImage = user?.image?.trim() || "";
  const displayRole = roleLabel(user?.role);
  const initial = displayName.charAt(0).toUpperCase() || "U";

  const navItems = [
    { label: "Servicios", href: "/#servicios" },
    { label: "Especialidades", href: "/#especialidades" },
    { label: "Aplicaciones", href: "/#aplicaciones" },
    { label: "Clientes", href: "/#clientes" },
  ];

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    closeMenu();
  }, [pathname, closeMenu]);

  useEffect(() => {
    if (!menuOpen) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") closeMenu();
    };

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen, closeMenu]);

  const isActive = (href) => {
    if (href.startsWith("/#")) {
      return false;
    }
    if (href === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(href);
  };

  return (
    <nav className={styles.nav}>
      <button
        type="button"
        className={`${styles.menuToggle} ${menuOpen ? styles.menuToggleOpen : ""}`}
        aria-expanded={menuOpen}
        aria-controls="site-nav-menu"
        aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <span className={styles.menuBar} aria-hidden />
        <span className={styles.menuBar} aria-hidden />
        <span className={styles.menuBar} aria-hidden />
      </button>

      {menuOpen ? (
        <button
          type="button"
          className={styles.menuBackdrop}
          aria-label="Cerrar menú"
          onClick={closeMenu}
        />
      ) : null}

      <ul
        id="site-nav-menu"
        className={`${styles.navList} ${menuOpen ? styles.navListOpen : ""}`}
      >
        {navItems.map((item) => (
          <li key={item.label} className={styles.navItem}>
            <Link
              href={item.href}
              className={`${styles.navLink} ${isActive(item.href) ? styles.active : ""}`}
              onClick={closeMenu}
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
                className={`${styles.navLink} ${
                  isActive("/dashboard") && !pathname.startsWith("/dashboard/perfil")
                    ? styles.active
                    : ""
                }`}
                onClick={closeMenu}
              >
                Dashboard
              </Link>
            </li>
            <li className={styles.navItem}>
              <Link
                href="/dashboard/perfil"
                className={`${styles.navLink} ${
                  isActive("/dashboard/perfil") ? styles.active : ""
                }`}
                onClick={closeMenu}
              >
                Mi perfil
              </Link>
            </li>
            <li className={`${styles.navItem} ${styles.userNavItem}`}>
              <Link
                href="/dashboard/perfil"
                className={styles.userChip}
                title={displayEmail || displayName}
                aria-label={`Perfil de ${displayName}`}
                onClick={closeMenu}
              >
                <span className={styles.userAvatar} aria-hidden>
                  {displayImage ? (
                    <Image
                      src={displayImage}
                      alt=""
                      width={32}
                      height={32}
                      className={styles.userAvatarImage}
                    />
                  ) : (
                    initial
                  )}
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
            <li className={`${styles.navItem} ${styles.logoutNavItem}`}>
              <LogoutButton withLabel />
            </li>
          </>
        ) : (
          <>
            <li className={styles.navItem}>
              <Link
                href="/login"
                className={`${styles.navLink} ${isActive("/login") ? styles.active : ""}`}
                onClick={closeMenu}
              >
                Login
              </Link>
            </li>
            <li className={styles.navItem}>
              <Link
                href="/contacto"
                className={`${styles.navLink} ${styles.ctaNav} ${
                  isActive("/contacto") ? styles.active : ""
                }`}
                onClick={closeMenu}
              >
                Solicitar Consulta
              </Link>
            </li>
          </>
        )}
      </ul>
    </nav>
  );
}
