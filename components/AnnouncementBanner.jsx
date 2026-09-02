import styles from "./AnnouncementBanner.module.css";

const MESSAGE =
  "Atención: se acerca la fecha límite para la facturación electrónica. Regulariza tu emisión de e-CF a tiempo.";

export default function AnnouncementBanner() {
  return (
    <div className={styles.banner} role="status" aria-live="polite">
      <div className={styles.track}>
        <span className={styles.text}>{MESSAGE}</span>
        <span className={styles.text} aria-hidden="true">
          {MESSAGE}
        </span>
      </div>
      <p className={styles.staticText}>{MESSAGE}</p>
    </div>
  );
}
