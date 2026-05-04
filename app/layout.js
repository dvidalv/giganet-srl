import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import styles from "./layout.module.css";
import Header from "@/components/header";
import Footer from "@/components/footer/Footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Giganet - Soluciones Tecnológicas",
  description: "Desarrollamos soluciones tecnológicas a tu medida. Software personalizado y servicios de desarrollo para empresas y particulares.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <Header />
        <div className={styles.bodyShell}>{children}</div>
        <Footer />
      </body>
    </html>
  );
}
