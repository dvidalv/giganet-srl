"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { formatPhoneNumber } from "@/utils/phoneUtils";
import {
  readEmpresasListQ,
  writeEmpresasListQ,
} from "@/lib/empresasListSearch";
import styles from "./EmpresasList.module.css";

function normalizeForSearch(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

function empresaMatches(item, queryNorm) {
  if (!queryNorm) return true;
  const e = item.empresa || {};
  const haystack = normalizeForSearch(
    [
      e.razonSocial,
      e.nombre,
      item.name,
      item.email,
      e.email,
      e.rnc,
      e.telefono,
      e.ciudad,
    ]
      .filter(Boolean)
      .join(" "),
  );
  return haystack.includes(queryNorm);
}

function EmpresasListInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const qParam = searchParams.get("q") ?? "";

  const [empresas, setEmpresas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchInput, setSearchInput] = useState(qParam);
  const [searchReady, setSearchReady] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  useEffect(() => {
    const fromUrl = qParam.trim();
    if (fromUrl) {
      writeEmpresasListQ(fromUrl);
      setSearchInput(fromUrl);
      setSearchReady(true);
      return;
    }
    const saved = readEmpresasListQ();
    if (saved) {
      setSearchInput(saved);
      const params = new URLSearchParams(searchParams.toString());
      params.set("q", saved);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }
    setSearchReady(true);
    // Solo rehidratar al montar / al cambiar el q de la URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restore once per qParam change
  }, [qParam]);

  useEffect(() => {
    if (!searchReady) return;
    const timer = setTimeout(() => {
      const next = searchInput.trim();
      const current = qParam.trim();
      writeEmpresasListQ(next);
      if (next === current) return;
      const params = new URLSearchParams(searchParams.toString());
      if (next) params.set("q", next);
      else params.delete("q");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, searchReady, qParam, pathname, router, searchParams]);

  useEffect(() => {
    async function fetchEmpresas() {
      try {
        const res = await fetch("/api/empresas");
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error || "Error al cargar empresas");
          return;
        }
        const data = await res.json();
        setEmpresas(data.empresas ?? []);
      } catch {
        setError("Error de conexión");
      } finally {
        setLoading(false);
      }
    }
    fetchEmpresas();
  }, []);

  const queryNorm = normalizeForSearch(searchInput.trim());
  const filtradas = useMemo(
    () => empresas.filter((item) => empresaMatches(item, queryNorm)),
    [empresas, queryNorm],
  );

  return (
    <div className={styles.wrapper}>
      <div className={styles.toolbar}>
        <label className={styles.searchWrap}>
          <span className={styles.searchIcon} aria-hidden>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          </span>
          <input
            ref={searchRef}
            type="search"
            className={styles.searchInput}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar por nombre, RNC, email o teléfono…"
            aria-label="Buscar empresas"
          />
        </label>
      </div>

      {loading ? (
        <div className={styles.loading}>Cargando empresas...</div>
      ) : error ? (
        <div className={styles.error}>{error}</div>
      ) : empresas.length === 0 ? (
        <p className={styles.empty}>No hay empresas registradas.</p>
      ) : filtradas.length === 0 ? (
        <p className={styles.empty}>
          No hay empresas que coincidan con “{searchInput.trim()}”.
        </p>
      ) : (
        <ul className={styles.list}>
          {filtradas.map((item) => {
            const e = item.empresa;
            const razon =
              e.razonSocial || e.nombre || item.name || item.email || "Sin razón social";
            const rnc = e.rnc || "—";
            const telefono = e.telefono ? formatPhoneNumber(e.telefono) : "—";
            const isDemo = e.theFactoryAmbiente === "demo";
            return (
              <li key={item.id}>
                <Link href={`/dashboard/empresas/${item.id}`} className={styles.card}>
                  <div className={styles.logoWrap}>
                    {e.logo ? (
                      <Image
                        src={e.logo}
                        alt=""
                        width={56}
                        height={56}
                        className={styles.logo}
                        sizes="56px"
                      />
                    ) : (
                      <div className={styles.logoPlaceholder}>
                        <span className={styles.logoPlaceholderText}>Sin logo</span>
                      </div>
                    )}
                  </div>
                  <div className={styles.data}>
                    <div className={styles.titleRow}>
                      <div className={styles.razonSocial}>{razon}</div>
                      <span className={styles.badges}>
                        {item.incompleta && (
                          <span className={styles.badgeIncomplete}>Datos incompletos</span>
                        )}
                        <span className={isDemo ? styles.badgeDemo : styles.badgeProd}>
                          {isDemo ? "Pruebas (demo)" : "Producción"}
                        </span>
                      </span>
                    </div>
                    <div className={styles.row}>
                      <span className={styles.label}>Email:</span>
                      <span className={styles.value}>{item.email || "—"}</span>
                    </div>
                    <div className={styles.row}>
                      <span className={styles.label}>RNC:</span>
                      <span className={styles.value}>{rnc}</span>
                    </div>
                    <div className={styles.row}>
                      <span className={styles.label}>Teléfono:</span>
                      <span className={styles.value}>{telefono}</span>
                    </div>
                    <div className={styles.row}>
                      <span className={styles.label}>Folios:</span>
                      <span className={styles.value}>
                        {e.modalidadFolios === "CONTROLADO" ? "Controlados" : "Ilimitados"}
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function EmpresasListFallback() {
  return (
    <div className={styles.wrapper}>
      <div className={styles.loading}>Cargando empresas...</div>
    </div>
  );
}

export default function EmpresasList() {
  return (
    <Suspense fallback={<EmpresasListFallback />}>
      <EmpresasListInner />
    </Suspense>
  );
}
