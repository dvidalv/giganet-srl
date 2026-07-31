"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import styles from "./AppsShowcase.module.css";

const apps = [
  {
    name: "GigaNet Punto de Venta",
    category: "Gestión Empresarial",
    description:
      "Sistema integral de facturación, inventario, caja y reportes con integración DGII.",
    image: "/images-de-apps/giganet-pos.png",
    imageBig: "/images-de-apps/apps-big/giganet-pos.png",
  },
  {
    name: "PathLab Pro",
    category: "Patologia",
    description:
      "Sistema de información de laboratorio patológico con trazabilidad completa de estudios.",
    image: "/images-de-apps/pathlab-pro.png",
    imageBig: "/images-de-apps/apps-big/pathlab-pro.png",
  },
  {
    name: "ConsultaPro",
    category: "Medicina en general",
    description:
      "Gestión de consultas médicas, agenda, facturación ARS y licencias médicas.",
    image: "/images-de-apps/consulta-pro.png",
    imageBig: "/images-de-apps/apps-big/consulta-pro.png",
  },
  {
    name: "Moto Prestamos",
    category: "Financiamiento",
    description:
      "Sistema de gestión de financiamiento de motocicletas, contratos y pagos.",
    image: "/images-de-apps/moto-prestamos.png",
    imageBig: "/images-de-apps/apps-big/moto-prestamos.png",
  },
  {
    name: "Programa para Prestamos",
    category: "Finanzas",
    description:
      "Plataforma de gestión de préstamos, cartera de clientes y seguimiento de pagos.",
    image: "/images-de-apps/prestamos-manager.png",
    imageBig: "/images-de-apps/apps-big/prestamos-manager.png",
  },
  {
    name: "Altadomus Luxe Realty",
    category: "Inmobiliaria",
    description:
      "Plataforma web de listado y gestión de propiedades de lujo en República Dominicana.",
    image: "/images-de-apps/altadomus.png",
    imageBig: "/images-de-apps/apps-big/altadomus.png",
  },
  {
    name: "Integracion con MIkroWisp para ISP",
    category: "Telecomunicaciones",
    description:
      "Portal web para proveedor de internet fibra óptica con verificación de cobertura.",
    image: "/images-de-apps/mikromanager-pro.png",
    imageBig: "/images-de-apps/apps-big/mikromanager-pro.png",
  },
];

export default function AppsShowcase() {
  const [selected, setSelected] = useState(null);

  const closeModal = useCallback(() => setSelected(null), []);

  useEffect(() => {
    if (!selected) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") closeModal();
    };

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [selected, closeModal]);

  return (
    <>
      <div className={styles.grid}>
        {apps.map((app) => (
          <article key={app.name} className={styles.card}>
            <button
              type="button"
              className={styles.imageButton}
              onClick={() => setSelected(app)}
              aria-label={`Ver captura ampliada de ${app.name}`}
            >
              <div className={styles.imageWrapper}>
                <Image
                  src={app.image}
                  alt={`Captura de pantalla de ${app.name}`}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className={styles.image}
                />
                <span className={styles.zoomHint} aria-hidden="true">
                  Ver detalle
                </span>
              </div>
            </button>
            <div className={styles.cardBody}>
              <span className={styles.category}>{app.category}</span>
              <h3 className={styles.appName}>{app.name}</h3>
              <p className={styles.description}>{app.description}</p>
            </div>
          </article>
        ))}
      </div>

      {selected && (
        <div
          className={styles.modalOverlay}
          onClick={closeModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="app-modal-title"
        >
          <div
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <div>
                <span className={styles.category}>{selected.category}</span>
                <h3 id="app-modal-title" className={styles.modalTitle}>
                  {selected.name}
                </h3>
              </div>
              <button
                type="button"
                className={styles.modalClose}
                onClick={closeModal}
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>
            <div className={styles.modalImageWrap}>
              <Image
                src={selected.imageBig}
                alt={`Captura ampliada de ${selected.name}`}
                width={1600}
                height={1000}
                className={styles.modalImage}
                sizes="(max-width: 900px) 95vw, 90vw"
                priority
              />
            </div>
            <p className={styles.modalDescription}>{selected.description}</p>
          </div>
        </div>
      )}
    </>
  );
}
