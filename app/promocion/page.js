import Link from "next/link";
import Image from "next/image";
import { FaCheck, FaCloud, FaFileInvoice, FaChartBar } from "react-icons/fa";
import styles from "./page.module.css";

const blocks = [
  {
    icon: FaFileInvoice,
    title: "Factura electrónica sin enredos",
    problem: "Hoy el comprobante se arma en otro portal, después de cobrar.",
    solution: "Al cerrar la venta, el e-CF sale con el mismo cobro.",
  },
  {
    icon: FaCloud,
    title: "La venta no se pierde si la DGII falla",
    problem: "Si el servicio no responde, la caja se detiene o el comprobante se pierde.",
    solution: "La venta queda guardada y el comprobante espera para salir cuando la DGII vuelva.",
  },
  {
    icon: FaChartBar,
    title: "Los reportes salen solos",
    problem: "El 606 y el 607 se arman a mano, al cierre del mes.",
    solution: "Esos archivos salen de las ventas y los comprobantes ya emitidos.",
  },
];

const baseModules = ["Ventas", "Pagos", "Productos", "Clientes", "Configuración"];
const paidModules = [
  "Ventas",
  "Caja",
  "Pagos",
  "Productos",
  "Inventario",
  "Clientes",
  "Facturación e-CF",
  "Usuarios",
  "Roles y permisos",
  "Configuración",
  "Soporte",
];
const topModules = [
  "Ventas",
  "Caja",
  "Pagos",
  "Productos",
  "Inventario",
  "Clientes",
  "Facturación e-CF",
  "Usuarios",
  "Roles y permisos",
  "Configuración",
  "Auditoría",
  "Soporte",
];

const plans = [
  {
    code: "free",
    name: "Gratis",
    tagline: "Ventas, productos y clientes",
    price: "0",
    limits: "1 usuario · sin caja · sin e-CF",
    features: baseModules,
  },
  {
    code: "basic",
    name: "Básico",
    tagline: "Caja, inventario y e-CF",
    price: "990",
    limits: "2 usuarios · 1 caja · 800 e-CF",
    features: paidModules,
  },
  {
    code: "pro",
    name: "Pro",
    tagline: "Incluye auditoría",
    price: "1,890",
    limits: "5 usuarios · 3 cajas · 2,500 e-CF",
    features: topModules,
    featured: true,
  },
  {
    code: "enterprise",
    name: "Empresa",
    tagline: "Misma cobertura que Pro",
    price: "3,490",
    limits: "15 usuarios · 8 cajas · 8,000 e-CF",
    features: topModules,
  },
];

const quotes = [
  { text: "Cobro y el comprobante ya quedó. No abro otro sistema.", who: "Caja de colmado" },
  { text: "Si la DGII se tarda, la venta sigue. El comprobante sale después.", who: "Encargada de tienda" },
  { text: "El 607 me llega armado. Dejé la hoja de Excel del mes.", who: "Contador" },
];

const logos = [
  { src: "/images/la-epoca.png", alt: "Tienda La Época" },
  { src: "/images/lpcr-logo.png", alt: "Laboratorio de Patología Contreras Robledo" },
  { src: "/images/agrecon-logo.png", alt: "AGRECON" },
  { src: "/images/logo-airtime.jpeg", alt: "Airtime" },
];

export const metadata = {
  title: "Punto de venta",
  description:
    "Cobra en caja y el comprobante electrónico sale solo. Planes Gratis, Básico, Pro y Empresa para negocios en República Dominicana.",
  alternates: { canonical: "/promocion" },
};

export default function PromocionPage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroGrid}>
          <div>
            <p className={styles.kicker}>Punto de venta para República Dominicana</p>
            <h1 className={styles.title}>
              Cobra en caja y el comprobante <span className={styles.accent}>sale solo.</span>
            </h1>
            <Link href="/contacto" className={styles.demo}>
              Ver demo
            </Link>
          </div>
          <div className={styles.blocks} aria-label="Problemas que resuelve">
            {blocks.map((block) => {
              const Icon = block.icon;
              return (
                <article key={block.title} className={styles.block}>
                  <h2>
                    <Icon className={styles.blockIcon} aria-hidden />
                    <span>{block.title}</span>
                  </h2>
                  <p className={styles.problem}>{block.problem}</p>
                  <p className={styles.solution}>{block.solution}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className={styles.plans} id="planes" aria-labelledby="planes-titulo">
        <div className={styles.inner}>
          <h2 id="planes-titulo">Planes</h2>
          <p className={styles.note}>Precio mensual en pesos. ITBIS aparte. El e-CF de más cuesta RD$1.20.</p>
          <p className={styles.srOnly}>
            Planes Gratis, Básico, Pro y Empresa, con precio mensual y lo que incluye
          </p>
          <div className={styles.planGrid}>
            {plans.map((plan) => (
              <article
                key={plan.code}
                className={plan.featured ? `${styles.planCard} ${styles.featured}` : styles.planCard}
              >
                <h3>{plan.name}</h3>
                <p className={styles.tagline}>{plan.tagline}</p>
                {plan.featured ? <p className={styles.badge}>Recomendado</p> : null}
                <p className={styles.price}>
                  <span>RD${plan.price}</span>
                  <span className={styles.period}>/mes</span>
                </p>
                <p className={styles.limits}>{plan.limits}</p>
                <Link href="/contacto" className={styles.start}>
                  Empezar
                </Link>
                <p className={styles.includesLabel}>Incluye</p>
                <ul className={styles.featureList}>
                  {plan.features.map((feature) => (
                    <li key={feature}>
                      <FaCheck className={styles.featureIcon} aria-hidden />
                      {feature}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.close} aria-label="Opiniones y clientes">
        <div className={styles.inner}>
          <ul className={styles.logos}>
            {logos.map((logo) => (
              <li key={logo.alt}>
                <Image src={logo.src} alt={logo.alt} width={140} height={56} className={styles.logo} />
              </li>
            ))}
          </ul>
          <div className={styles.quotes}>
            {quotes.map((quote) => (
              <blockquote key={quote.who}>
                <p>“{quote.text}”</p>
                <footer>{quote.who}</footer>
              </blockquote>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
