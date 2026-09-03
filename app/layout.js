import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import styles from "./layout.module.css";
import Header from "@/components/header";
import AnnouncementBanner from "@/components/AnnouncementBanner";
import Footer from "@/components/footer/Footer";
import JsonLd from "@/components/JsonLd";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: {
    default: "Giganet - Soluciones Tecnológicas",
    template: "%s | Giganet",
  },
  description:
    "Desarrollamos soluciones tecnológicas a tu medida. Software personalizado y servicios de desarrollo para empresas y particulares.",
  keywords: [
    "desarrollo de software",
    "soluciones tecnológicas",
    "software personalizado",
    "desarrollo web",
    "aplicaciones móviles",
    "consultoría tecnológica",
  ],
  authors: [{ name: "Giganet" }],
  creator: "Giganet",
  publisher: "Giganet",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "es_ES",
    url: "https://www.giganet-srl.com/",
    siteName: "Giganet",
    title: "Giganet - Soluciones Tecnológicas",
    description:
      "Desarrollamos soluciones tecnológicas a tu medida. Software personalizado y servicios de desarrollo para empresas y particulares.",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Giganet - Soluciones Tecnológicas",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Giganet - Soluciones Tecnológicas",
    description:
      "Desarrollamos soluciones tecnológicas a tu medida. Software personalizado y servicios de desarrollo para empresas y particulares.",
    images: ["/og-image.jpg"],
    creator: "@giganet",
  },
  metadataBase: new URL("https://www.giganet-srl.com/"),
  alternates: {
    canonical: "/",
  },
  verification: {
    google: "X3QKSRlCJs02tA8jT-gMzoCKs9HY0kPkW4eFpVxbfho",
  },
};

export default function RootLayout({ children }) {
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Giganet SRL",
    url: "https://www.giganet-srl.com/",
    logo: "https://www.giganet-srl.com/logo.png",
    description:
      "Desarrollamos soluciones tecnológicas a tu medida. Software personalizado y servicios de desarrollo para empresas y particulares.",
    sameAs: [
      "https://facebook.com/giganet-srl",
      "https://twitter.com/giganet-srl",
      "https://linkedin.com/company/giganet-srl",
    ],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "Customer Service",
      availableLanguage: ["Spanish", "English"],
    },
  };

  return (
    <html lang="es">
      <head>
        <JsonLd data={organizationSchema} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <Header />
        <AnnouncementBanner />
        <div className={styles.bodyShell}>{children}</div>
        <Footer />
      </body>
    </html>
  );
}
