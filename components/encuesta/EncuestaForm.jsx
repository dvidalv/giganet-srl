"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Turnstile } from "@marsidev/react-turnstile";
import { responderEncuesta } from "@/actions/responderEncuesta-action";
import styles from "./EncuestaForm.module.css";
import {
  FaArrowLeft,
  FaArrowRight,
  FaPaperPlane,
  FaCheck,
  FaUser,
  FaHeadset,
  FaRegClock,
  FaClipboard,
  FaPlug,
} from "react-icons/fa";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";

const EMOJI_STEPS = [
  { value: 1, emoji: "😡", label: "Mala" },
  { value: 2, emoji: "😐", label: "Regular" },
  { value: 3, emoji: "🙂", label: "Buena" },
  { value: 4, emoji: "😃", label: "Muy buena" },
  { value: 5, emoji: "🤩", label: "Excelente" },
];

const CHIP_LEVELS = [
  { value: 1, label: "Malo" },
  { value: 2, label: "Regular" },
  { value: 3, label: "Bueno" },
  { value: 4, label: "Excelente" },
];

const METRICS = [
  {
    key: "facilidadIntegracion",
    label: "Facilidad de integración con la plataforma",
    icon: "plug",
  },
  {
    key: "calidadSoporte",
    label: "Calidad del soporte técnico",
    icon: "headset",
  },
  {
    key: "tiempoRespuesta",
    label: "Tiempo de respuesta / entrega",
    icon: "clock",
  },
];

function MetricIcon({ type }) {
  if (type === "headset") {
    return (
      <span className={`${styles.metricIcon} ${styles.metricIconBlue}`}>
        <FaHeadset aria-hidden />
      </span>
    );
  }
  if (type === "clock") {
    return (
      <span className={`${styles.metricIcon} ${styles.metricIconGreen}`}>
        <FaRegClock aria-hidden />
      </span>
    );
  }
  return (
    <span className={`${styles.metricIcon} ${styles.metricIconPurple}`}>
      <FaPlug aria-hidden />
    </span>
  );
}

export default function EncuestaForm({ token, empresaLabel }) {
  const formRef = useRef(null);
  const turnstileRef = useRef(null);
  const [step, setStep] = useState(1);
  const [done, setDone] = useState(false);
  const [localError, setLocalError] = useState("");
  const [serverErrors, setServerErrors] = useState({});
  const [isPending, startTransition] = useTransition();

  const [satisfaccionGeneral, setSatisfaccionGeneral] = useState(null);
  const [nombreRespondiente, setNombreRespondiente] = useState("");
  const [emailRespondiente, setEmailRespondiente] = useState("");
  const [referenciaServicio, setReferenciaServicio] = useState("");
  const [facilidadIntegracion, setFacilidadIntegracion] = useState(null);
  const [calidadSoporte, setCalidadSoporte] = useState(null);
  const [tiempoRespuesta, setTiempoRespuesta] = useState(null);
  const [nps, setNps] = useState(null);
  const [loQueMasGusta, setLoQueMasGusta] = useState("");
  const [loQueMejorar, setLoQueMejorar] = useState("");
  const [comentarios, setComentarios] = useState("");

  const setMetric = (key, val) => {
    if (key === "facilidadIntegracion") setFacilidadIntegracion(val);
    if (key === "calidadSoporte") setCalidadSoporte(val);
    if (key === "tiempoRespuesta") setTiempoRespuesta(val);
  };

  const getMetric = (key) => {
    if (key === "facilidadIntegracion") return facilidadIntegracion;
    if (key === "calidadSoporte") return calidadSoporte;
    return tiempoRespuesta;
  };

  const goStep = (n) => {
    setLocalError("");
    setStep(n);
  };

  const nextFrom1 = () => {
    if (satisfaccionGeneral == null) {
      setLocalError("Seleccione cómo califica su experiencia general.");
      return;
    }
    goStep(2);
  };

  const nextFrom2 = () => {
    if (
      facilidadIntegracion == null ||
      calidadSoporte == null ||
      tiempoRespuesta == null
    ) {
      setLocalError("Evalúe los tres aspectos con las opciones Malo a Excelente.");
      return;
    }
    if (nps == null) {
      setLocalError("Seleccione un valor de recomendación (0 a 10).");
      return;
    }
    goStep(3);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setLocalError("");
    setServerErrors({});

    if (!TURNSTILE_SITE_KEY) {
      setLocalError("Falta configurar la verificación de seguridad (Turnstile).");
      return;
    }

    const form = formRef.current;
    if (!form) return;

    const fd = new FormData(form);
    fd.set("token", token);
    fd.set("satisfaccionGeneral", String(satisfaccionGeneral));
    fd.set("facilidadIntegracion", String(facilidadIntegracion));
    fd.set("calidadSoporte", String(calidadSoporte));
    fd.set("tiempoRespuesta", String(tiempoRespuesta));
    fd.set("nps", String(nps));
    fd.set("nombreRespondiente", nombreRespondiente);
    fd.set("emailRespondiente", emailRespondiente);
    fd.set("referenciaServicio", referenciaServicio);
    fd.set("loQueMasGusta", loQueMasGusta);
    fd.set("loQueMejorar", loQueMejorar);
    fd.set("comentarios", comentarios);

    startTransition(async () => {
      const res = await responderEncuesta(null, fd);
      if (res?.success) {
        setDone(true);
        turnstileRef.current?.reset();
        return;
      }
      setServerErrors(res?.errors || {});
      const g = res?.errors?.general;
      if (g) setLocalError(g);
      if (res?.errors && Object.keys(res.errors).length > 0) {
        if (
          res.errors.nombreRespondiente ||
          res.errors.emailRespondiente ||
          res.errors.referenciaServicio
        ) {
          goStep(1);
        } else if (
          res.errors.satisfaccionGeneral ||
          res.errors.facilidadIntegracion ||
          res.errors.calidadSoporte ||
          res.errors.tiempoRespuesta ||
          res.errors.nps
        ) {
          goStep(2);
        }
      }
      turnstileRef.current?.reset();
    });
  };

  if (done) {
    return (
      <div className={styles.page}>
        <div className={styles.shell}>
          <div className={styles.successScreen}>
            <div className={styles.successIcon}>
              <FaCheck aria-hidden />
            </div>
            <h2 className={styles.successTitle}>¡Gracias por tu tiempo!</h2>
            <p className={styles.successText}>
              Hemos recibido tu opinión correctamente. Tus comentarios nos ayudan
              a seguir mejorando Giganet.
            </p>
            <Link href="/" className={styles.btnOutline}>
              Volver al inicio
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.shellHeader}>
          <div className={styles.brandBlock}>
            <div className={styles.brandIcon}>
              <FaClipboard aria-hidden />
            </div>
            <div>
              <h1 className={styles.brandTitle}>Encuesta de satisfacción</h1>
              <p className={styles.brandSubtitle}>
                Tu opinión nos ayuda a mejorar
              </p>
            </div>
          </div>
          <div className={styles.progressWrap}>
            <span className={styles.progressLabel}>
              Paso <strong>{step}</strong> de 3
            </span>
            <div className={styles.progressBars} aria-hidden>
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`${styles.progressBar} ${
                    step >= i ? styles.progressBarActive : ""
                  }`}
                />
              ))}
            </div>
          </div>
        </header>

        <div className={styles.main}>
          {empresaLabel ? (
            <div className={styles.empresaBanner}>
              <strong>Empresa:</strong> {empresaLabel}
            </div>
          ) : null}

          {localError ? (
            <div className={styles.errorBanner} role="alert">
              {localError}
            </div>
          ) : null}

          <form ref={formRef} onSubmit={handleSubmit}>
            <div className={styles.hp} aria-hidden="true">
              <label htmlFor="enc-hp">Sitio web</label>
              <input id="enc-hp" type="text" name="website" tabIndex={-1} autoComplete="off" />
            </div>

            {/* Paso 1 */}
            <div
              className={`${styles.step} ${step === 1 ? styles.stepActive : ""}`}
            >
              <div className={styles.stack}>
                <div className={styles.cardGray}>
                  <h2 className={styles.sectionTitle}>
                    <FaUser className={styles.sectionTitleMuted} aria-hidden />
                    Información del contacto (opcional)
                  </h2>
                  <div className={styles.grid2}>
                    <div>
                      <label className={styles.fieldLabel} htmlFor="enc-nombre">
                        Nombre completo
                      </label>
                      <input
                        id="enc-nombre"
                        className={styles.input}
                        placeholder="Ej. Juan Pérez"
                        value={nombreRespondiente}
                        onChange={(e) => setNombreRespondiente(e.target.value)}
                        maxLength={120}
                      />
                      {serverErrors.nombreRespondiente ? (
                        <p className={styles.fieldError}>{serverErrors.nombreRespondiente}</p>
                      ) : null}
                    </div>
                    <div>
                      <label className={styles.fieldLabel} htmlFor="enc-email">
                        Correo electrónico
                      </label>
                      <input
                        id="enc-email"
                        type="email"
                        className={styles.input}
                        placeholder="ejemplo@correo.com"
                        value={emailRespondiente}
                        onChange={(e) => setEmailRespondiente(e.target.value)}
                        maxLength={254}
                      />
                      {serverErrors.emailRespondiente ? (
                        <p className={styles.fieldError}>{serverErrors.emailRespondiente}</p>
                      ) : null}
                    </div>
                    <div className={styles.span2}>
                      <label className={styles.fieldLabel} htmlFor="enc-ref">
                        Número de servicio / factura / referencia
                      </label>
                      <input
                        id="enc-ref"
                        className={styles.input}
                        placeholder="# de referencia"
                        value={referenciaServicio}
                        onChange={(e) => setReferenciaServicio(e.target.value)}
                        maxLength={200}
                      />
                      {serverErrors.referenciaServicio ? (
                        <p className={styles.fieldError}>{serverErrors.referenciaServicio}</p>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className={styles.cardWhite}>
                  <h2 className={styles.centerTitle}>
                    ¿Cómo calificarías tu experiencia general con Giganet?
                  </h2>
                  {serverErrors.satisfaccionGeneral ? (
                    <p className={styles.fieldError} style={{ textAlign: "center" }}>
                      {serverErrors.satisfaccionGeneral}
                    </p>
                  ) : null}
                  <div className={styles.emojiRow}>
                    {EMOJI_STEPS.map((row) => (
                      <button
                        key={row.value}
                        type="button"
                        className={`${styles.emojiBtn} ${
                          satisfaccionGeneral === row.value ? styles.emojiBtnActive : ""
                        }`}
                        onClick={() => setSatisfaccionGeneral(row.value)}
                        aria-pressed={satisfaccionGeneral === row.value}
                      >
                        <span className={styles.emoji}>{row.emoji}</span>
                        <span className={styles.emojiLabel}>{row.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className={styles.footerRow}>
                  <span />
                  <button type="button" className={styles.btnPrimary} onClick={nextFrom1}>
                    Siguiente <FaArrowRight aria-hidden />
                  </button>
                </div>
              </div>
            </div>

            {/* Paso 2 */}
            <div
              className={`${styles.step} ${step === 2 ? styles.stepActive : ""}`}
            >
              <div className={styles.stack}>
                <h2 className={styles.sectionTitle} style={{ marginBottom: 0 }}>
                  Evalúa aspectos específicos
                </h2>

                {METRICS.map((m) => (
                  <div key={m.key} className={styles.metricRow}>
                    <div className={styles.metricLeft}>
                      <MetricIcon type={m.icon} />
                      <span className={styles.metricLabel}>{m.label}</span>
                    </div>
                    <div className={styles.chipRow} role="group" aria-label={m.label}>
                      {CHIP_LEVELS.map((c) => (
                        <button
                          key={c.value}
                          type="button"
                          className={`${styles.chip} ${
                            getMetric(m.key) === c.value ? styles.chipActive : ""
                          }`}
                          onClick={() => setMetric(m.key, c.value)}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {(serverErrors.facilidadIntegracion ||
                  serverErrors.calidadSoporte ||
                  serverErrors.tiempoRespuesta) && (
                  <p className={styles.fieldError}>
                    {[
                      serverErrors.facilidadIntegracion,
                      serverErrors.calidadSoporte,
                      serverErrors.tiempoRespuesta,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  </p>
                )}

                <div className={styles.npsBox}>
                  <h2 className={styles.npsTitle}>
                    ¿Qué tan probable es que recomiendes Giganet?
                  </h2>
                  <p className={styles.npsSubtitle}>
                    A un colega, socio o empresa que conozcas.
                  </p>
                  {serverErrors.nps ? (
                    <p className={styles.fieldError} style={{ textAlign: "center" }}>
                      {serverErrors.nps}
                    </p>
                  ) : null}
                  <div className={styles.npsGrid}>
                    {Array.from({ length: 11 }, (_, i) => (
                      <button
                        key={i}
                        type="button"
                        className={`${styles.npsBtn} ${
                          nps === i ? styles.npsBtnActive : ""
                        }`}
                        onClick={() => setNps(i)}
                      >
                        {i}
                      </button>
                    ))}
                  </div>
                  <div className={styles.npsScaleLabels}>
                    <span>Nada probable</span>
                    <span>Muy probable</span>
                  </div>
                </div>

                <div className={styles.footerRow}>
                  <button
                    type="button"
                    className={styles.btnGhost}
                    onClick={() => goStep(1)}
                  >
                    <FaArrowLeft aria-hidden /> Atrás
                  </button>
                  <button type="button" className={styles.btnPrimary} onClick={nextFrom2}>
                    Siguiente <FaArrowRight aria-hidden />
                  </button>
                </div>
              </div>
            </div>

            {/* Paso 3 */}
            <div
              className={`${styles.step} ${step === 3 ? styles.stepActive : ""}`}
            >
              <h2 className={styles.sectionTitle} style={{ marginTop: 0 }}>
                Comentarios finales
              </h2>
              <p className={styles.introText}>
                Tu feedback detallado nos ayuda a mejorar nuestros procesos. Estos
                campos son opcionales.
              </p>

              <div className={styles.cardWhite}>
                <div style={{ marginBottom: "1.25rem" }}>
                  <label className={styles.fieldLabel} htmlFor="enc-gusta">
                    ¿Qué fue lo que más te gustó?
                  </label>
                  <textarea
                    id="enc-gusta"
                    className={styles.textarea}
                    rows={3}
                    placeholder="Cuéntanos tu experiencia positiva..."
                    value={loQueMasGusta}
                    onChange={(e) => setLoQueMasGusta(e.target.value)}
                    maxLength={1000}
                  />
                  {serverErrors.loQueMasGusta ? (
                    <p className={styles.fieldError}>{serverErrors.loQueMasGusta}</p>
                  ) : null}
                </div>
                <div style={{ marginBottom: "1.25rem" }}>
                  <label className={styles.fieldLabel} htmlFor="enc-mejorar">
                    ¿Qué podríamos mejorar?
                  </label>
                  <textarea
                    id="enc-mejorar"
                    className={styles.textarea}
                    rows={3}
                    placeholder="Sugerencias constructivas..."
                    value={loQueMejorar}
                    onChange={(e) => setLoQueMejorar(e.target.value)}
                    maxLength={1000}
                  />
                  {serverErrors.loQueMejorar ? (
                    <p className={styles.fieldError}>{serverErrors.loQueMejorar}</p>
                  ) : null}
                </div>
                <div>
                  <label className={styles.fieldLabel} htmlFor="enc-coment">
                    Comentarios adicionales (opcional)
                  </label>
                  <textarea
                    id="enc-coment"
                    className={styles.textarea}
                    rows={2}
                    placeholder="Cualquier otro comentario..."
                    value={comentarios}
                    onChange={(e) => setComentarios(e.target.value)}
                    maxLength={2000}
                  />
                  {serverErrors.comentarios ? (
                    <p className={styles.fieldError}>{serverErrors.comentarios}</p>
                  ) : null}
                </div>
              </div>

              {TURNSTILE_SITE_KEY ? (
                <div className={styles.turnstileWrap}>
                  <Turnstile
                    ref={turnstileRef}
                    siteKey={TURNSTILE_SITE_KEY}
                    options={{ language: "es" }}
                  />
                </div>
              ) : (
                <p className={styles.fieldError} role="alert">
                  Falta NEXT_PUBLIC_TURNSTILE_SITE_KEY; no se puede enviar la encuesta.
                </p>
              )}

              <div className={`${styles.footerRow} ${styles.footerRowBorder}`}>
                <button
                  type="button"
                  className={styles.btnGhost}
                  onClick={() => goStep(2)}
                >
                  <FaArrowLeft aria-hidden /> Atrás
                </button>
                <button
                  type="submit"
                  className={styles.btnPrimary}
                  disabled={isPending || !TURNSTILE_SITE_KEY}
                >
                  {isPending ? (
                    <>Enviando…</>
                  ) : (
                    <>
                      Enviar respuesta <FaPaperPlane aria-hidden />
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
