import styles from "./page.module.css";
import Link from "next/link";
import Image from "next/image";
import { FaCloud, FaFolder, FaLaptopCode, FaFileInvoice, FaArrowRight } from "react-icons/fa";

export default async function Home() {
  const clients = [
    {
      logo: "/images/lpcr-logo.png",
      name: "Laboratorio de Patología Contreras Robledo",
      description: "Giganet desarrolló desde cero una aplicación integral para la facturación, gestión de las ARS y generación de reportes de estudios, adaptada a las necesidades de todo el laboratorio.",
      website: "#"
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
      logo: "/images/biopap-logo.png",
      name: "BIOPAP",
      description: "Giganet desarrolló desde cero una aplicación integral para la facturación, gestión de las ARS y generación de reportes de estudios, adaptada a las necesidades de todo el laboratorio.",
      website: "#"
    }
  ];

  const services = [
    {
      icon: <FaCloud />,
      title: "Nube",
      description: "Potencie el crecimiento de su negocio mediante servicios y aplicaciones en la nube estratégicamente diseñados, respaldados por una infraestructura escalable y rentable.",
      backTitle: "Servicios en la Nube",
      backContent: [
        "Migración a la nube",
        "Optimización de costos",
        "Seguridad y cumplimiento",
        "Arquitectura cloud-native",
        "Soporte 24/7"
      ]
    },
    {
      icon: <FaFolder />,
      title: "FileMaker",
      description: "FileMaker es una plataforma de desarrollo de bases de datos relacionales que permite crear aplicaciones personalizadas para la gestión de datos.",
      backTitle: "Servicios de FileMaker",
      backContent: [
        "Creación de bases de datos",
        "Desarrollo de aplicaciones personalizadas",
        "Consultoría y asesoría",
        "Migración de datos",
        "Optimización de rendimiento"
      ]
    },
    {
      icon: <FaLaptopCode />,
      title: "Aplicaciones Web",
      description: "Dale vida a tu negocio con aplicaciones web personalizadas que mejoran la eficiencia y la experiencia del usuario.",
      backTitle: "Servicios de Desarrollo Web",
      backContent: [
        "Desarrollo de aplicaciones web personalizadas",
        "Integración de APIs",
        "Mantenimiento y soporte",
        "Optimización para SEO",
        "Desarrollo de aplicaciones móviles"
      ]
    },
    {
      icon: <FaFileInvoice />,
      title: "Facturación Electrónica DGII",
      description: "Somos expertos en integración de software con la facturación electrónica de la DGII.",
      backTitle: "Integración DGII",
      backContent: [
        "Emisión de comprobantes e-CF",
        "Integración con ERPs",
        "Cumplimiento normativa DGII",
        "Firma Digital segura",
        "Asesoría en implementación"
      ]
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
            <Link href="/contact" className={styles.ctaButton}>
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
        <div className={styles.servicesGrid}>
          {services.map((service, index) => (
            <div key={index} className={styles.cardContainer}>
              <div className={styles.card}>
                {/* Front of card */}
                <div className={styles.cardFront}>
                  <div className={styles.iconWrapper}>
                    {service.icon}
                  </div>
                  <h3 className={styles.serviceTitle}>{service.title}</h3>
                  <p className={styles.serviceDescription}>{service.description}</p>
                </div>
                
                {/* Back of card */}
                <div className={styles.cardBack}>
                  <h3 className={styles.backTitle}>{service.backTitle}</h3>
                  <p className={styles.backSubtitle}>
                    {service.backTitle === "Servicios de FileMaker" 
                      ? "Nuestros servicios de FileMaker incluyen:"
                      : service.backTitle === "Servicios en la Nube"
                      ? "Nuestros servicios en la nube incluyen:"
                      : service.backTitle === "Servicios de Desarrollo Web"
                      ? "Nuestros servicios de desarrollo web incluyen:"
                      : "Soluciones completas de facturación electrónica:"}
                  </p>
                  <ul className={styles.backList}>
                    {service.backContent.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
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