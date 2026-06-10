import styles from "./page.module.css";
import Link from "next/link";
import Image from "next/image";
import { FaArrowRight } from "react-icons/fa";
import ServicesCarousel from "@/components/ServicesCarousel";

export default async function Home() {
  const clients = [
    {
      logo: "/images/lpcr-logo.png",
      name: "Laboratorio de Patología Contreras Robledo",
      description: "Giganet desarrolló desde cero una aplicación integral para la facturación, gestión de las ARS y generación de reportes de estudios, adaptada a las necesidades de todo el laboratorio.",
      website: "https://www.contrerasrobledo.com/"
    },
    {
      logo: "/images/agrecon-logo.png",
      name: "AGRECON",
      description: "AGRECON es una empresa que se dedica a la venta de cementos para la construcción en Giganet le desarrollamos un sistema hecho a la medida para el manejo de la venta y el transporte del cemento.",
      website: "#"
    },
    {
      logo: "/images/sgi-logo.png",
      name: "SOKAGAKAI INTERNACIONAL RD",
      description: "Giganet desarrolló desde cero la aplicación para el manejo de todos los miembros de la organización.",
      website: "#"
    },
    {
      logo: "/images/la-epoca.png",
      name: "Tienda La Época",
      description: "Desarrollo completo de un sistema de gestión para Tienda La Época, incluyendo ventas, inventario y facturación. Se integró facturación electrónica DGII, permitiendo automatizar procesos y mejorar la eficiencia operativa del negocio.",
      website: "https://tiendalaepoca.com/"
    }
  ];

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

      <section id="clientes" className={styles.clientsSection}>
        <h2 className={styles.clientsTitle}>Nuestros Clientes</h2>
        <div className={styles.clientsGrid}>
          {clients.map((client, index) => (
            <div key={index} className={styles.clientCard}>
              <div className={styles.clientLogo}>
                <Image 
                  src={client.logo} 
                  alt={client.name}
                  width={150}
                  height={75}
                  // style={{ width: 'auto', height: 'auto' }}
                  className={styles.logoImage}
                />
              </div>
              <h3 className={styles.clientName}>{client.name}</h3>
              <p className={styles.clientDescription}>{client.description}</p>
              <Link href={client.website} className={styles.visitButton}>
                Visitar <FaArrowRight />
              </Link>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}