"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import {
  FaCloud,
  FaFolder,
  FaLaptopCode,
  FaFileInvoice,
  FaCreditCard,
} from "react-icons/fa";
import styles from "./ServicesCarousel.module.css";

const services = [
  {
    icon: FaCloud,
    title: "Nube",
    description:
      "Potencie el crecimiento de su negocio mediante servicios y aplicaciones en la nube estratégicamente diseñados, respaldados por una infraestructura escalable y rentable.",
    backTitle: "Servicios en la Nube",
    backSubtitle: "Nuestros servicios en la nube incluyen:",
    backContent: [
      "Migración a la nube",
      "Optimización de costos",
      "Seguridad y cumplimiento",
      "Arquitectura cloud-native",
      "Soporte 24/7",
    ],
  },
  {
    icon: FaFolder,
    title: "FileMaker",
    description:
      "FileMaker es una plataforma de desarrollo de bases de datos relacionales que permite crear aplicaciones personalizadas para la gestión de datos.",
    backTitle: "Servicios de FileMaker",
    backSubtitle: "Nuestros servicios de FileMaker incluyen:",
    backContent: [
      "Creación de bases de datos",
      "Desarrollo de aplicaciones personalizadas",
      "Consultoría y asesoría",
      "Migración de datos",
      "Optimización de rendimiento",
    ],
  },
  {
    icon: FaLaptopCode,
    title: "Aplicaciones Web",
    description:
      "Dale vida a tu negocio con aplicaciones web personalizadas que mejoran la eficiencia y la experiencia del usuario.",
    backTitle: "Servicios de Desarrollo Web",
    backSubtitle: "Nuestros servicios de desarrollo web incluyen:",
    backContent: [
      "Desarrollo de aplicaciones web personalizadas",
      "Integración de APIs",
      "Mantenimiento y soporte",
      "Optimización para SEO",
      "Desarrollo de aplicaciones móviles",
    ],
  },
  {
    icon: FaFileInvoice,
    title: "Facturación Electrónica DGII",
    description:
      "Somos expertos en integración de software con la facturación electrónica de la DGII.",
    backTitle: "Integración DGII",
    backSubtitle: "Soluciones completas de facturación electrónica:",
    backContent: [
      "Emisión de comprobantes e-CF",
      "Integración con ERPs",
      "Cumplimiento normativa DGII",
      "Firma Digital segura",
      "Asesoría en implementación",
    ],
  },
  {
    icon: FaCreditCard,
    title: "Pasarelas de Pago",
    description:
      "Integramos las principales pasarelas de pago para que su negocio procese transacciones de forma segura y confiable.",
    backTitle: "Pasarelas de Pago",
    backSubtitle: "Integramos las principales pasarelas del mercado dominicano:",
    backContent: [
      "Integración con Azul",
      "Integración con Cardnet",
      "Procesamiento seguro de tarjetas",
      "Conciliación de pagos",
      "Soporte técnico especializado",
    ],
    partnerLogos: [
      { src: "/images/azul.jpg", alt: "Azul" },
      { src: "/images/carndnet.jpg", alt: "Cardnet" },
    ],
  },
];

const AUTO_PLAY_INTERVAL = 4000;
const VISIBLE_COUNT = 3;

export default function ServicesCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const maxIndex = Math.max(0, services.length - VISIBLE_COUNT);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev >= maxIndex ? 0 : prev + 1));
  }, [maxIndex]);

  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(goToNext, AUTO_PLAY_INTERVAL);
    return () => clearInterval(interval);
  }, [goToNext, isPaused]);

  const slideOffset = (currentIndex * 100) / services.length;

  return (
    <div
      className={styles.carousel}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
    >
      <div className={styles.carouselViewport}>
        <div
          className={styles.carouselTrack}
          style={{
            "--total-slides": services.length,
            "--visible-count": VISIBLE_COUNT,
            transform: `translateX(-${slideOffset}%)`,
          }}
        >
          {services.map((service, index) => {
            const Icon = service.icon;

            return (
              <div key={index} className={styles.slide}>
                <div className={styles.cardContainer}>
                  <div className={styles.card}>
                    <div className={styles.cardFront}>
                      {service.partnerLogos ? (
                        <div className={styles.partnerLogos}>
                          {service.partnerLogos.map((logo) => (
                            <Image
                              key={logo.alt}
                              src={logo.src}
                              alt={logo.alt}
                              width={120}
                              height={60}
                              className={styles.partnerLogo}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className={styles.iconWrapper}>
                          <Icon />
                        </div>
                      )}
                      <h3 className={styles.serviceTitle}>{service.title}</h3>
                      <p className={styles.serviceDescription}>
                        {service.description}
                      </p>
                    </div>

                    <div className={styles.cardBack}>
                      <h3 className={styles.backTitle}>{service.backTitle}</h3>
                      <p className={styles.backSubtitle}>{service.backSubtitle}</p>
                      <ul className={styles.backList}>
                        {service.backContent.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.dots}>
        {Array.from({ length: maxIndex + 1 }).map((_, index) => (
          <button
            key={index}
            type="button"
            className={`${styles.dot} ${index === currentIndex ? styles.dotActive : ""}`}
            aria-label={`Ir al grupo de servicios ${index + 1}`}
            onClick={() => setCurrentIndex(index)}
          />
        ))}
      </div>
    </div>
  );
}
