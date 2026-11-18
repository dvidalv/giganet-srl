"use client";

import { useCallback, useEffect, useState } from "react";
import { FaQuoteLeft, FaStar } from "react-icons/fa";
import styles from "./TestimonialsSection.module.css";

/**
 * Homepage testimonials. Seeds from SSR, then refreshes from /api/testimonials
 * so new survey responses / publish toggles appear without a rebuild.
 */
export default function TestimonialsSection({ initialTestimonials = [] }) {
  const [testimonials, setTestimonials] = useState(initialTestimonials);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/testimonials?limit=9", {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.testimonials)) {
        setTestimonials(data.testimonials);
      }
    } catch {
      // Keep SSR / last good data
    }
  }, []);

  useEffect(() => {
    setTestimonials(initialTestimonials);
  }, [initialTestimonials]);

  useEffect(() => {
    // Soft refresh shortly after mount (covers submit → navigate home)
    const t = setTimeout(refresh, 1500);
    const interval = setInterval(refresh, 45000);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      clearTimeout(t);
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  if (!testimonials.length) {
    return null;
  }

  return (
    <section
      id="opiniones"
      className={styles.section}
      aria-labelledby="opiniones-heading"
    >
      <div className={styles.inner}>
        <div className={styles.header}>
          <p className={styles.eyebrow}>Testimonios reales</p>
          <h2 id="opiniones-heading" className={styles.title}>
            Qué opinan{" "}
            <span className={styles.gradient}>nuestros clientes</span>
          </h2>
          <p className={styles.subtitle}>
            Comentarios tomados de las encuestas de satisfacción que enviamos
            tras cada proyecto.
          </p>
        </div>

        <div className={styles.grid}>
          {testimonials.map((item) => (
            <article key={item.id} className={styles.card}>
              <FaQuoteLeft className={styles.quoteIcon} aria-hidden />
              <p className={styles.quote}>{item.quote}</p>
              <div className={styles.meta}>
                <div className={styles.avatar} aria-hidden>
                  {(item.person || item.company || "?").charAt(0).toUpperCase()}
                </div>
                <div className={styles.who}>
                  <p className={styles.company}>{item.company}</p>
                  {item.person ? (
                    <p className={styles.person}>{item.person}</p>
                  ) : null}
                  {item.service ? (
                    <p className={styles.service}>{item.service}</p>
                  ) : null}
                </div>
                {item.nps != null ? (
                  <div className={styles.nps} title={`NPS ${item.nps}/10`}>
                    <FaStar aria-hidden />
                    <span>{item.nps}/10</span>
                  </div>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
