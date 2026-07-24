import styles from "./page.module.css";
import Link from "next/link";
import Image from "next/image";
import ServicesCarousel from "@/components/ServicesCarousel";
import AppsShowcase from "@/components/AppsShowcase";
import ClientsCarousel from "@/components/ClientsCarousel";

export default async function Home() {
  return (
    <>
      <div id="hero" className={styles.heroContainer}>
        <div className={styles.heroContent}>
          <div className={styles.heroText}>
            <h1 className={styles.heroTitle}>
              Desarrollamos Soluciones Tecnológicas a tu Medida
            </h1>
            <p className={styles.heroDescription}>
              En GigaNet nos especializamos en el desarrollo de software personalizado 
              para empresas y particulares. Nuestro equipo de expertos está comprometido 
              con la excelencia, ofreciendo soluciones innovadoras y eficientes que se 
              adaptan perfectamente a tus necesidades específicas.
            </p>
            <Link href="/contacto" className={styles.ctaButton}>
              SOLICITA UNA CONSULTA
            </Link>
          </div>
          
          <div className={styles.heroImage}>
            <Image 
              src="/images/hero.png" 
              alt="Desarrollador trabajando en GigaNet"
              width={656}
              height={400}
              priority
              className={styles.image}
            />
          </div>
        </div>
      </div>

      <section id="servicios" className={styles.servicesSection}>
        <h2 className={styles.servicesTitle}>Nuestros Servicios</h2>
        <ServicesCarousel />
      </section>

      <section id="aplicaciones" className={styles.appsSection}>
        <h2 className={styles.appsTitle}>Nuestras Aplicaciones</h2>
        <p className={styles.appsSubtitle}>
          Soluciones reales desarrolladas a la medida para empresas de distintos sectores.
        </p>
        <AppsShowcase />
      </section>

      <section id="clientes" className={styles.clientsSection}>
        <h2 className={styles.clientsTitle}>Nuestros Clientes</h2>
        <ClientsCarousel />
      </section>
    </>
  );
}