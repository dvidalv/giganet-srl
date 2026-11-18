import styles from "./page.module.css";
import Link from "next/link";
import Image from "next/image";
import AppsShowcase from "@/components/AppsShowcase";
import ClientsCarousel from "@/components/ClientsCarousel";
import TestimonialsSection from "@/components/TestimonialsSection";
import DgiiPromoBanner from "@/components/DgiiPromoBanner";
import { getPublicTestimonials } from "@/lib/encuestas/getPublicTestimonials";
import {
  FaArrowRight,
  FaAws,
  FaBriefcase,
  FaCheck,
  FaCheckCircle,
  FaCloud,
  FaCode,
  FaCreditCard,
  FaDatabase,
  FaDesktop,
  FaLaptopCode,
  FaNodeJs,
  FaPlayCircle,
  FaPython,
  FaReact,
  FaRocket,
  FaShoppingCart,
} from "react-icons/fa";
import { SiMongodb } from "react-icons/si";

const techTags = [
  { label: "React", icon: FaReact, className: styles.techReact },
  { label: "Node.js", icon: FaNodeJs, className: styles.techNode },
  { label: "Python", icon: FaPython, className: styles.techPython },
  { label: "SQL / NoSQL", icon: FaDatabase, className: styles.techDb },
  { label: "MongoDB", icon: SiMongodb, className: styles.techMongo },
  { label: "AWS", icon: FaAws, className: styles.techAws },
];

const websitePlans = [
  {
    id: "starter",
    name: "Starter",
    price: "$15,000",
    currency: "DOP",
    icon: FaDesktop,
    featured: false,
    features: [
      "Sitio de 3 páginas",
      "Diseño responsivo",
      "Logo gratis incluido",
    ],
  },
  {
    id: "business",
    name: "Business",
    price: "$30,000",
    currency: "DOP",
    icon: FaBriefcase,
    featured: true,
    features: [
      "Sitio de 6 páginas",
      "Sistema de citas",
      "Configuración de redes sociales",
    ],
  },
  {
    id: "ecommerce",
    name: "E-Commerce",
    price: "$85,000",
    currency: "DOP",
    icon: FaShoppingCart,
    featured: false,
    features: [
      "Tienda de 10 páginas",
      "SEO básico",
      "Manager dedicado",
    ],
  },
];

const mainServices = [
  {
    icon: FaCloud,
    title: "Nube",
    description:
      "Potencie su negocio mediante servicios estratégicamente diseñados en la nube, con infraestructura escalable y rentable.",
    items: ["Migración de datos", "Optimización de costos", "Arquitectura cloud-native"],
  },
  {
    icon: FaDatabase,
    title: "FileMaker",
    description:
      "Plataforma líder para bases de datos relacionales, permitiendo crear apps personalizadas para la gestión de datos.",
    items: ["Consultoría experta", "Apps multiplataforma", "Integración de sistemas"],
  },
  {
    icon: FaLaptopCode,
    title: "Aplicaciones Web",
    description:
      "Dale vida a tu negocio con aplicaciones web que mejoran la eficiencia operativa y la experiencia del usuario.",
    items: ["Frontend Moderno", "Integración de APIs", "Optimización SEO"],
  },
];

export default async function Home() {
  const testimonials = await getPublicTestimonials(9);

  return (
    <>
      <section id="hero" className={styles.heroContainer}>
        <div className={styles.heroOrb} aria-hidden />

        <div className={styles.heroInner}>
          <DgiiPromoBanner />
          <div className={styles.heroContent}>
            <div className={styles.heroText}>
              <div className={styles.badgePill}>
                <span className={styles.badgeDot} aria-hidden />
                <span className={styles.badgeLabel}>Desarrollo de Software</span>
              </div>

              <h1 className={styles.heroTitle}>
                <span className={styles.gradientText}>Desarrollamos</span>
                <br />
                <span className={styles.titleWhite}>Soluciones</span>
                <br />
                <span className={styles.titleWhite}>Tecnológicas</span>
                <span className={styles.titleMuted}> a tu</span>
                <br />
                <span className={styles.titleWhite}>Medida</span>
              </h1>

              <p className={styles.heroDescription}>
                En GigaNet nos especializamos en el desarrollo de{" "}
                <span className={styles.descHighlight}>software personalizado</span>{" "}
                para empresas y particulares. Soluciones innovadoras y eficientes que se
                adaptan perfectamente a tus necesidades.
              </p>

              <div className={styles.techTags}>
                {techTags.map(({ label, icon: Icon, className }) => (
                  <span key={label} className={styles.techTag}>
                    <Icon className={className} aria-hidden />
                    {label}
                  </span>
                ))}
              </div>

              <div className={styles.ctaRow}>
                <Link href="/contacto" className={styles.ctaButton}>
                  Solicita una Consulta
                </Link>
                <Link href="/#aplicaciones" className={styles.ctaSecondary}>
                  <FaPlayCircle className={styles.playIcon} aria-hidden />
                  Ver Demo
                </Link>
              </div>

              <div className={styles.statsRow}>
                <div>
                  <div className={styles.statValue}>
                    150<span className={styles.statAccent}>+</span>
                  </div>
                  <div className={styles.statLabel}>Proyectos entregados</div>
                </div>
                <div className={styles.statDivider} aria-hidden />
                <div>
                  <div className={styles.statValue}>
                    8<span className={styles.statAccent}>+</span>
                  </div>
                  <div className={styles.statLabel}>Años de experiencia</div>
                </div>
                <div className={styles.statDivider} aria-hidden />
                <div>
                  <div className={styles.statValue}>
                    98<span className={styles.statAccent}>%</span>
                  </div>
                  <div className={styles.statLabel}>Clientes satisfechos</div>
                </div>
              </div>
            </div>

            <div className={styles.heroImageWrap}>
              <div className={styles.heroImageFrame}>
                <div className={styles.accentBorder} aria-hidden />

                <div className={styles.heroImage}>
                  <Image
                    src="/images/hero.webp"
                    alt="Equipo de GigaNet Systems"
                    width={1200}
                    height={800}
                    priority
                    className={styles.image}
                  />
                  <div className={styles.imageOverlay} aria-hidden />

                  <div className={styles.floatingBadgeBottomLeft}>
                    <div className={styles.floatingIcon}>
                      <FaCode aria-hidden />
                    </div>
                    <div>
                      <div className={styles.floatingCaption}>Líneas de código</div>
                      <div className={styles.floatingValue}>10M+ entregadas</div>
                    </div>
                  </div>
                </div>

                <div className={styles.floatingBadgeTopRight}>
                  <div className={styles.floatingSuccessRow}>
                    <FaCheckCircle className={styles.successIcon} aria-hidden />
                    <span className={styles.floatingCaption}>Tasa de éxito</span>
                  </div>
                  <div className={styles.floatingBigStat}>
                    98<span className={styles.statAccentSmall}>%</span>
                  </div>
                </div>

                <div className={styles.floatingBadgeBottomRight}>
                  <FaRocket className={styles.rocketIcon} aria-hidden />
                  <span className={styles.floatingValue}>Entrega Ágil</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.heroBottomFade} aria-hidden />
      </section>

      <section id="diseno-web" className={styles.websiteDesignSection}>
        <div className={styles.sectionInner}>
          <div className={styles.sectionHeaderCenter}>
            <h2 className={styles.sectionTitle}>
              Diseño de <span className={styles.gradientText}>Sitios Web</span>
            </h2>
            <p className={styles.sectionSubtitle}>
              Sitios profesionales para negocios y comercio electrónico, listos para
              destacar tu marca.
            </p>
          </div>

          <div className={styles.websitePlansGrid}>
            {websitePlans.map((plan) => {
              const Icon = plan.icon;
              return (
                <article
                  key={plan.id}
                  className={`${styles.websitePlanCard} ${
                    plan.featured ? styles.websitePlanCardFeatured : ""
                  }`}
                >
                  {plan.featured ? (
                    <span className={styles.websitePlanBadge}>Más popular</span>
                  ) : null}
                  <div className={styles.websitePlanIcon}>
                    <Icon aria-hidden />
                  </div>
                  <h3 className={styles.websitePlanName}>{plan.name}</h3>
                  <div className={styles.websitePlanPriceRow}>
                    <span className={styles.websitePlanPrice}>{plan.price}</span>
                    <span className={styles.websitePlanCurrency}>{plan.currency}</span>
                  </div>
                  <ul className={styles.websitePlanFeatures}>
                    {plan.features.map((feature) => (
                      <li key={feature}>
                        <FaCheck className={styles.checkIcon} aria-hidden />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>

          <div className={styles.websiteDesignCta}>
            <Link href="/contacto" className={styles.ctaButton}>
              Solicitar cotización
            </Link>
          </div>
        </div>
      </section>

      <section id="servicios" className={styles.servicesSection}>
        <div className={styles.sectionInner}>
          <div className={styles.sectionHeaderCenter}>
            <h2 className={styles.sectionTitle}>
              Nuestros <span className={styles.gradientText}>Servicios</span>
            </h2>
            <p className={styles.sectionSubtitle}>
              Soluciones integrales de software impulsadas por la innovación y la
              eficiencia técnica.
            </p>
          </div>

          <div className={styles.servicesGrid}>
            {mainServices.map((service) => {
              const Icon = service.icon;
              return (
                <article key={service.title} className={styles.glassCard}>
                  <div className={styles.serviceIcon}>
                    <Icon aria-hidden />
                  </div>
                  <h3 className={styles.serviceCardTitle}>{service.title}</h3>
                  <p className={styles.serviceCardDesc}>{service.description}</p>
                  <ul className={styles.serviceList}>
                    {service.items.map((item) => (
                      <li key={item}>
                        <FaCheck className={styles.checkIcon} aria-hidden />
                        {item}
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="especialidades" className={styles.specialtiesSection}>
        <div className={styles.sectionInner}>
          <div className={styles.specialtiesGrid}>
            <div className={styles.specialtiesContent}>
              <h2 className={styles.sectionTitleLeft}>
                Expertos en{" "}
                <span className={styles.gradientText}>Integraciones Críticas</span>
              </h2>

              <article className={styles.dgiiCard}>
                <div className={styles.specialtyIconDgii}>
                  <Image
                    src="/images/dgii-icon.png"
                    alt="Logo DGII"
                    width={40}
                    height={40}
                    className={styles.dgiiLogo}
                  />
                </div>
                <div>
                  <h3 className={styles.specialtyTitle}>Facturación Electrónica DGII</h3>
                  <p className={styles.specialtyDesc}>
                    Somos expertos en integración de software con la normativa dominicana
                    de facturación electrónica (e-CF).
                  </p>
                  <div className={styles.tagRow}>
                    <span className={styles.tagOrange}>Cumplimiento Legal</span>
                    <span className={styles.tagOrange}>Firma Digital</span>
                    <Link href="/planes" className={styles.tagOrange}>
                      Ver planes de folios
                    </Link>
                  </div>
                </div>
              </article>

              <article className={styles.glassCardHorizontal}>
                <div className={styles.specialtyIconBlue}>
                  <FaCreditCard aria-hidden />
                </div>
                <div>
                  <h3 className={styles.specialtyTitle}>Pasarelas de Pago</h3>
                  <p className={styles.specialtyDesc}>
                    Integramos las principales pasarelas del mercado dominicano: Azul y
                    Cardnet para transacciones seguras.
                  </p>
                  <div className={styles.tagRow}>
                    <span className={styles.tagBlue}>Integración Azul</span>
                    <span className={styles.tagBlue}>Conciliación Cardnet</span>
                  </div>
                </div>
              </article>
            </div>

            <div className={styles.specialtiesVisual}>
              <div className={styles.specialtiesGlow} aria-hidden />
              <div className={styles.partnerPanel}>
                <p className={styles.partnerLabel}>Partners de pago</p>
                <div className={styles.partnerLogos}>
                  <div className={styles.partnerLogoCard}>
                    <Image
                      src="/images/azul.jpg"
                      alt="Azul"
                      width={140}
                      height={70}
                      className={styles.partnerLogo}
                    />
                  </div>
                  <div className={styles.partnerLogoCard}>
                    <Image
                      src="/images/carndnet.jpg"
                      alt="Cardnet"
                      width={140}
                      height={70}
                      className={styles.partnerLogo}
                    />
                  </div>
                </div>
                <p className={styles.partnerNote}>
                  Integraciones seguras con cumplimiento local y conciliación operativa.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="aplicaciones" className={styles.appsSection}>
        <div className={styles.sectionInner}>
          <div className={styles.appsHeader}>
            <div>
              <h2 className={styles.sectionTitleLeft}>
                Nuestras <span className={styles.gradientText}>Aplicaciones</span>
              </h2>
              <p className={styles.appsIntro}>
                Soluciones reales desarrolladas a la medida para sectores estratégicos.
              </p>
            </div>
            <Link href="/contacto" className={styles.ghostButton}>
              Explorar Portafolio <FaArrowRight aria-hidden />
            </Link>
          </div>
          <AppsShowcase />
        </div>
      </section>

      <section id="clientes" className={styles.clientsSection}>
        <div className={styles.sectionInner}>
          <div className={styles.sectionHeaderCenter}>
            <h2 className={styles.sectionTitle}>
              Nuestros <span className={styles.gradientText}>Clientes</span>
            </h2>
            <p className={styles.sectionSubtitle}>
              Empresas que han transformado sus procesos con nuestra tecnología.
            </p>
          </div>
          <ClientsCarousel />
        </div>
      </section>

      <TestimonialsSection initialTestimonials={testimonials} />

      <section className={styles.finalCtaSection}>
        <div className={styles.finalCtaCard}>
          <div className={styles.finalCtaGlow} aria-hidden />
          <div className={styles.finalCtaContent}>
            <h2 className={styles.finalCtaTitle}>
              ¿Listo para escalar
              <br />
              tu <span className={styles.gradientText}>Proyecto?</span>
            </h2>
            <p className={styles.finalCtaText}>
              Nuestro equipo de expertos está listo para convertir tus ideas en soluciones
              tecnológicas reales y eficientes.
            </p>
            <Link href="/contacto" className={styles.ctaButton}>
              Empezar Ahora
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
