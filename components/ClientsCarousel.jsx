"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { FaArrowRight, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import styles from "./ClientsCarousel.module.css";

const clients = [
  {
    logo: "/images/lpcr-logo.png",
    name: "Laboratorio de Patología Contreras Robledo",
    description:
      "Giganet desarrolló desde cero una aplicación integral para la facturación, gestión de las ARS y generación de reportes de estudios, adaptada a las necesidades de todo el laboratorio.",
    website: "https://www.contrerasrobledo.com/",
  },
  {
    logo: "/images/agrecon-logo.png",
    name: "AGRECON",
    description:
      "AGRECON es una empresa que se dedica a la venta de cementos para la construcción en Giganet le desarrollamos un sistema hecho a la medida para el manejo de la venta y el transporte del cemento.",
    website: "#",
  },
  {
    logo: "/images/sgi-logo.png",
    name: "SOKAGAKAI INTERNACIONAL RD",
    description:
      "Giganet desarrolló desde cero la aplicación para el manejo de todos los miembros de la organización.",
    website: "#",
  },
  {
    logo: "/images/la-epoca.png",
    name: "Tienda La Época",
    description:
      "Desarrollo completo de un sistema de gestión para Tienda La Época, incluyendo ventas, inventario y facturación. Se integró facturación electrónica DGII, permitiendo automatizar procesos y mejorar la eficiencia operativa del negocio.",
    website: "https://tiendalaepoca.com/",
  },
  {
    logo: "/images/logo-airtime.jpeg",
    name: "Airtime",
    description:
      "Giganet desarrolló la plataforma web de Airtime, proveedor de internet de fibra óptica, con una experiencia moderna para presentar planes, cobertura y servicios de conectividad para hogares y empresas.",
    website: "https://www.airtime.com.do/",
  },
];

const AUTO_PLAY_INTERVAL = 4500;

function getVisibleCount(width) {
  if (width <= 640) return 1;
  if (width <= 1024) return 2;
  return 3;
}

export default function ClientsCarousel() {
  const viewportRef = useRef(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [slideWidth, setSlideWidth] = useState(0);
  const [visibleCount, setVisibleCount] = useState(3);
  const [isPaused, setIsPaused] = useState(false);
  const [enableTransition, setEnableTransition] = useState(true);

  const maxIndex = Math.max(0, clients.length - visibleCount);

  const updateLayout = useCallback(() => {
    if (!viewportRef.current) return;
    const width = viewportRef.current.offsetWidth;
    const nextVisible = getVisibleCount(window.innerWidth);
    setVisibleCount(nextVisible);
    setSlideWidth(width / nextVisible);
  }, []);

  const goToIndex = useCallback(
    (nextIndex) => {
      const wraps = nextIndex !== currentIndex && (
        (currentIndex === maxIndex && nextIndex === 0) ||
        (currentIndex === 0 && nextIndex === maxIndex)
      );

      if (wraps) {
        setEnableTransition(false);
        setCurrentIndex(nextIndex);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setEnableTransition(true));
        });
        return;
      }

      setEnableTransition(true);
      setCurrentIndex(nextIndex);
    },
    [currentIndex, maxIndex]
  );

  const goToNext = useCallback(() => {
    goToIndex(currentIndex >= maxIndex ? 0 : currentIndex + 1);
  }, [currentIndex, goToIndex, maxIndex]);

  const goToPrev = useCallback(() => {
    goToIndex(currentIndex <= 0 ? maxIndex : currentIndex - 1);
  }, [currentIndex, goToIndex, maxIndex]);

  useEffect(() => {
    updateLayout();
    window.addEventListener("resize", updateLayout);
    return () => window.removeEventListener("resize", updateLayout);
  }, [updateLayout]);

  useEffect(() => {
    setCurrentIndex((prev) => Math.min(prev, maxIndex));
  }, [maxIndex]);

  useEffect(() => {
    if (isPaused || maxIndex === 0) return;
    const interval = setInterval(goToNext, AUTO_PLAY_INTERVAL);
    return () => clearInterval(interval);
  }, [goToNext, isPaused, maxIndex]);

  return (
    <div
      className={styles.carousel}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
    >
      <div className={styles.carouselShell}>
        {maxIndex > 0 ? (
          <button
            type="button"
            className={`${styles.navBtn} ${styles.navPrev}`}
            aria-label="Cliente anterior"
            onClick={goToPrev}
          >
            <FaChevronLeft aria-hidden />
          </button>
        ) : null}

        <div ref={viewportRef} className={styles.carouselViewport}>
          <div
            className={`${styles.carouselTrack} ${
              enableTransition ? styles.carouselTrackAnimated : ""
            }`}
            style={{
              width: slideWidth ? slideWidth * clients.length : "100%",
              transform: slideWidth
                ? `translate3d(-${currentIndex * slideWidth}px, 0, 0)`
                : undefined,
            }}
          >
            {clients.map((client, index) => {
              const hasWebsite = Boolean(client.website && client.website !== "#");

              return (
                <div
                  key={client.name}
                  className={styles.slide}
                  style={{
                    width: slideWidth || `${100 / visibleCount}%`,
                  }}
                >
                  <article className={styles.clientCard}>
                    <div className={styles.clientLogo}>
                      <Image
                        src={client.logo}
                        alt={client.name}
                        width={150}
                        height={75}
                        className={styles.logoImage}
                        priority={index < 2}
                      />
                    </div>
                    <h3 className={styles.clientName}>{client.name}</h3>
                    <p className={styles.clientDescription}>{client.description}</p>
                    {hasWebsite ? (
                      <Link
                        href={client.website}
                        className={styles.visitButton}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Visitar <FaArrowRight aria-hidden />
                      </Link>
                    ) : (
                      <span className={styles.visitButtonDisabled} aria-disabled="true">
                        Próximamente
                      </span>
                    )}
                  </article>
                </div>
              );
            })}
          </div>
        </div>

        {maxIndex > 0 ? (
          <button
            type="button"
            className={`${styles.navBtn} ${styles.navNext}`}
            aria-label="Siguiente cliente"
            onClick={goToNext}
          >
            <FaChevronRight aria-hidden />
          </button>
        ) : null}
      </div>

      {maxIndex > 0 ? (
        <div className={styles.dots}>
          {Array.from({ length: maxIndex + 1 }).map((_, index) => (
            <button
              key={index}
              type="button"
              className={`${styles.dot} ${index === currentIndex ? styles.dotActive : ""}`}
              aria-label={`Ir al grupo de clientes ${index + 1}`}
              onClick={() => goToIndex(index)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
