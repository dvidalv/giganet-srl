import Image from "next/image";
import styles from "./AppsShowcase.module.css";

const apps = [
  {
    name: "GigaNet Punto de Venta",
    category: "Gestión Empresarial",
    description:
      "Sistema integral de facturación, inventario, caja y reportes con integración DGII.",
    image: "/apps/giganet-erp.png",
  },
  {
    name: "PathLab Pro",
    category: "Patologia",
    description:
      "Sistema de información de laboratorio patológico con trazabilidad completa de estudios.",
    image: "/apps/pathlab-pro.png",
  },
  {
    name: "ConsultaPro",
    category: "Medicina en general",
    description:
      "Gestión de consultas médicas, agenda, facturación ARS y licencias médicas.",
    image: "/apps/consultapro.png",
  },
  {
    name: "Moto Prestamos",
    category: "Financiamiento",
    description:
      "Sistema de gestión de financiamiento de motocicletas, contratos y pagos.",
    image: "/apps/wilson-auto.png",
  },
  {
    name: "Programa para Prestamos",
    category: "Finanzas",
    description:
      "Plataforma de gestión de préstamos, cartera de clientes y seguimiento de pagos.",
    image: "/apps/loandash.png",
  },
  {
    name: "Altadomus Luxe Realty",
    category: "Inmobiliaria",
    description:
      "Plataforma web de listado y gestión de propiedades de lujo en República Dominicana.",
    image: "/apps/altadomus-realty.png",
  },
  {
    name: "Integracion con MIkroWisp para ISP",
    category: "Telecomunicaciones",
    description:
      "Portal web para proveedor de internet fibra óptica con verificación de cobertura.",
    image: "/apps/airtime-tech.png",
  },
];

export default function AppsShowcase() {
  return (
    <div className={styles.grid}>
      {apps.map((app) => (
        <article key={app.name} className={styles.card}>
          <div className={styles.imageWrapper}>
            <Image
              src={app.image}
              alt={`Captura de pantalla de ${app.name}`}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className={styles.image}
            />
          </div>
          <div className={styles.cardBody}>
            <span className={styles.category}>{app.category}</span>
            <h3 className={styles.appName}>{app.name}</h3>
            <p className={styles.description}>{app.description}</p>
          </div>
        </article>
      ))}
    </div>
  );
}
