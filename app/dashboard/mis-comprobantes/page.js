import styles from "./page.module.css";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import ComprobantesList from "@/components/dashboard/ComprobantesList";

// Datos dummy para previsualización (3 tipos de comprobante)
const COMPROBANTES_DUMMY = [
  {
    id: "dummy-1",
    titulo: "Nota de Crédito Electrónica",
    descripcion_tipo: "Nota de Crédito Electrónica",
    tipo: "34",
    rnc: "130085765",
    razonSocial: "LABORATORIO DE PATOLOGIA CONTRERAS ROBLEDO SRL",
    prefijo: "E",
    numeroInicial: 1,
    numeroFinal: 3000,
    disponibles: 2972,
    utilizados: 28,
    proximoNumero: 29,
    estado: "ACTIVO",
    estadoTipo: "activo",
    vencimiento: null,
  },
  {
    id: "dummy-2",
    titulo: "Factura de Crédito Fiscal",
    descripcion_tipo: "Factura de Crédito Fiscal",
    tipo: "31",
    rnc: "130085765",
    razonSocial: "LABORATORIO DE PATOLOGIA CONTRERAS ROBLEDO SRL",
    prefijo: "E",
    numeroInicial: 1,
    numeroFinal: 10000,
    disponibles: 8450,
    utilizados: 1550,
    proximoNumero: 1551,
    estado: "ACTIVO",
    estadoTipo: "activo",
    vencimiento: "31/12/2026",
  },
  {
    id: "dummy-3",
    titulo: "Factura de Consumo",
    descripcion_tipo: "Factura de Consumo",
    tipo: "32",
    rnc: "130085765",
    razonSocial: "LABORATORIO DE PATOLOGIA CONTRERAS ROBLEDO SRL",
    prefijo: "E",
    numeroInicial: 1,
    numeroFinal: 5000,
    disponibles: 120,
    utilizados: 4880,
    proximoNumero: 4881,
    estado: "POCOS",
    estadoTipo: "pocos",
    vencimiento: "31/12/2026",
  },
];

export default async function MisComprobantes() {
  const session = await auth();
  const user = session?.user;

  if (!user || user.role !== "user") {
    redirect("/login");
  }

  return (
    <div className={styles.wrapper}>
      <header className={styles.header}>
        <div className={styles.headerText}>
          <h1 className={styles.title}>Gestión de Comprobantes Fiscales</h1>
          <p className={styles.subtitle}>
            Visualiza y administra tus tipos de comprobantes y secuencias
            disponibles
          </p>
        </div>
        <Link href="/dashboard/mis-comprobantes/nuevo" className={styles.cta}>
          <span className={styles.ctaIcon} aria-hidden>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          </span>
          Solicitar Nueva Secuencia
        </Link>
      </header>

      <ComprobantesList comprobantes={COMPROBANTES_DUMMY} />
    </div>
  );
}
