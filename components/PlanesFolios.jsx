"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FaCheck, FaWhatsapp } from "react-icons/fa";
import {
  PLANES_FOLIOS,
  formatPrecioRD,
  formatTransacciones,
  hrefContactoPlan,
  hrefWhatsappPlan,
  planesDestacados,
} from "@/lib/folios/planesCatalogo";
import styles from "./PlanesFolios.module.css";

const BENEFICIOS = [
  "Folios e-CF para facturación electrónica DGII",
  "Precios publicados en pesos dominicanos (RD$)",
  "Paquetes desde 200 hasta 150.000 transacciones",
  "Acompañamiento para activar o renovar su contrato",
];

function precioVisible(plan, ciclo) {
  if (ciclo === "mensual") {
    return {
      valor: formatPrecioRD(plan.precioMensual),
      sufijo: plan.precioMensual == null ? "" : "/ mes",
      nota: plan.precioMensual == null ? "Solo pago anual" : "Equivalente mensual",
    };
  }
  return {
    valor: formatPrecioRD(plan.precioAnual),
    sufijo: "/ año",
    nota: plan.precioMensual == null ? "Sin precio mensual" : `${formatPrecioRD(plan.precioMensual)} / mes`,
  };
}

export default function PlanesFolios({ variant = "section", compact = false }) {
  const [ciclo, setCiclo] = useState("anual");
  const destacados = useMemo(() => planesDestacados(), []);
  const TitleTag = variant === "page" ? "h1" : "h2";
  const mostrarTabla = !compact;

  return (
    <section
      id="planes"
      className={`${styles.section} ${variant === "page" ? styles.sectionPage : ""}`}
      aria-labelledby="planes-titulo"
    >
      <div className={styles.inner}>
        <header className={styles.header}>
          <div className={styles.badge}>
            <span className={styles.badgeDot} aria-hidden />
            Planes de folios e-CF
          </div>
          <TitleTag id="planes-titulo" className={styles.title}>
            Planes de <span className={styles.gradient}>folios</span>
          </TitleTag>
          <p className={styles.subtitle}>
            Opciones y precios en pesos dominicanos (RD$). Elija el paquete según las
            transacciones e-CF que su empresa necesita emitir.
          </p>

          <div className={styles.ciclo} role="group" aria-label="Ciclo de facturación">
            <button
              type="button"
              className={`${styles.cicloBtn} ${ciclo === "anual" ? styles.cicloBtnActive : ""}`}
              aria-pressed={ciclo === "anual"}
              onClick={() => setCiclo("anual")}
            >
              Precio anual
            </button>
            <button
              type="button"
              className={`${styles.cicloBtn} ${ciclo === "mensual" ? styles.cicloBtnActive : ""}`}
              aria-pressed={ciclo === "mensual"}
              onClick={() => setCiclo("mensual")}
            >
              Precio mensual
            </button>
          </div>
        </header>

        <div className={styles.featured}>
          {destacados.map((plan) => {
            const precio = precioVisible(plan, ciclo);
            const recomendado = plan.slug === "corp-5";
            return (
              <article
                key={plan.slug}
                className={`${styles.card} ${recomendado ? styles.cardFeatured : ""}`}
              >
                {plan.badge ? <span className={styles.cardBadge}>{plan.badge}</span> : null}
                <h3 className={styles.cardName}>{plan.nombre}</h3>
                <p className={styles.cardResumen}>{plan.resumen}</p>
                <p className={styles.cardPrice}>
                  <span className={styles.cardAmount}>{precio.valor}</span>
                  {precio.sufijo ? <span className={styles.cardPeriod}>{precio.sufijo}</span> : null}
                </p>
                <p className={styles.cardNote}>{precio.nota}</p>
                <p className={styles.cardVolume}>
                  <strong>{formatTransacciones(plan.transacciones)}</strong> transacciones
                </p>
                <ul className={styles.cardList}>
                  <li>
                    <FaCheck aria-hidden /> Folios electrónicos e-CF
                  </li>
                  <li>
                    <FaCheck aria-hidden /> Precio en RD$
                  </li>
                  <li>
                    <FaCheck aria-hidden />
                    {plan.precioMensual == null ? "Contratación anual" : "Pago anual o mensual"}
                  </li>
                </ul>
                <div className={styles.cardActions}>
                  <Link href={hrefContactoPlan(plan.slug)} className={styles.cardCta}>
                    Solicitar este plan
                  </Link>
                  <a
                    href={hrefWhatsappPlan(plan)}
                    className={styles.cardWhatsapp}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <FaWhatsapp aria-hidden /> WhatsApp
                  </a>
                </div>
              </article>
            );
          })}
        </div>

        {compact ? (
          <div className={styles.compactCta}>
            <p>
              El tarifario completo incluye 14 planes, desde 200 hasta 150.000
              transacciones, con precio anual y mensual.
            </p>
            <Link href="/planes" className={styles.cardCta}>
              Ver todos los planes
            </Link>
          </div>
        ) : null}

        {mostrarTabla ? (
        <div className={styles.tableBlock}>
          <div className={styles.tableHead}>
            <h3 className={styles.tableTitle}>Todos los planes</h3>
            <p className={styles.tableHint}>
              Tarifario completo. N/A: no aplica.
            </p>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <caption className={styles.srOnly}>
                Planes de folios, transacciones y precios en pesos dominicanos
              </caption>
              <thead>
                <tr>
                  <th scope="col">Plan</th>
                  <th scope="col">Transacciones</th>
                  <th scope="col">Precio anual</th>
                  <th scope="col">Precio mensual</th>
                  <th scope="col">
                    <span className={styles.srOnly}>Solicitar</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {PLANES_FOLIOS.map((plan) => (
                  <tr key={plan.slug} className={plan.destacado ? styles.rowDestacado : undefined}>
                    <th scope="row">
                      <span className={styles.planName}>{plan.nombre}</span>
                      {plan.badge ? <span className={styles.inlineBadge}>{plan.badge}</span> : null}
                    </th>
                    <td>{formatTransacciones(plan.transacciones)}</td>
                    <td>{formatPrecioRD(plan.precioAnual)}</td>
                    <td>{formatPrecioRD(plan.precioMensual)}</td>
                    <td>
                      <Link href={hrefContactoPlan(plan.slug)} className={styles.tableLink}>
                        Solicitar
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className={styles.mobileList}>
            {PLANES_FOLIOS.map((plan) => {
              const precio = precioVisible(plan, ciclo);
              return (
                <li key={plan.slug} className={styles.mobileItem}>
                  <div className={styles.mobileTop}>
                    <div>
                      <p className={styles.planName}>{plan.nombre}</p>
                      <p className={styles.mobileVolume}>
                        {formatTransacciones(plan.transacciones)} transacciones
                      </p>
                    </div>
                    {plan.badge ? <span className={styles.inlineBadge}>{plan.badge}</span> : null}
                  </div>
                  <p className={styles.mobilePrice}>
                    {precio.valor}
                    {precio.sufijo ? ` ${precio.sufijo}` : ""}
                  </p>
                  <p className={styles.mobileAlt}>
                    Anual {formatPrecioRD(plan.precioAnual)} · Mensual {formatPrecioRD(plan.precioMensual)}
                  </p>
                  <Link href={hrefContactoPlan(plan.slug)} className={styles.mobileCta}>
                    Solicitar {plan.nombre}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
        ) : null}

        <div className={styles.footerNote}>
          <ul className={styles.beneficios}>
            {BENEFICIOS.map((item) => (
              <li key={item}>
                <FaCheck aria-hidden />
                {item}
              </li>
            ))}
          </ul>
          <p>
            N/A: no aplica. Los precios corresponden al tarifario vigente en pesos dominicanos.
            Un folio equivale a una transacción e-CF. Para activar o renovar un paquete, solicite
            el plan y nuestro equipo lo configura en su contrato.
          </p>
        </div>
      </div>
    </section>
  );
}
