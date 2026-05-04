import { notFound } from "next/navigation";
import Encuesta from "@/app/models/encuesta";
import EncuestaForm from "@/components/encuesta/EncuestaForm";
import styles from "./page.module.css";

export default async function EncuestaPublicPage({ params }) {
  const { token } = await params;
  if (!token || typeof token !== "string" || token.length < 32) {
    notFound();
  }

  const enc = await Encuesta.findOne({ token }).lean();
  if (!enc) {
    notFound();
  }

  const now = new Date();
  const empresa = enc.empresa || {};
  const empresaLabel =
    [empresa.razonSocial, empresa.nombre].find(
      (s) => typeof s === "string" && s.trim().length > 0
    ) || empresa.rnc || "Su empresa";

  if (enc.status === "responded") {
    return (
      <div className={styles.encuesta}>
        <div className={styles.formContainer}>
          <h1 className={styles.title}>Encuesta completada</h1>
          <p className={styles.subtitle}>
            Esta encuesta ya fue respondida. ¡Gracias por su tiempo!
          </p>
          <div className={styles.messages}>
            <p className={styles.info}>
              Si necesita contactarnos, puede escribirnos por los canales
              habituales de soporte.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const expired =
    enc.expiresAt && new Date(enc.expiresAt) <= now;

  if (expired || enc.status === "expired") {
    if (enc.status === "pending") {
      await Encuesta.findOneAndUpdate(
        { _id: enc._id, status: "pending" },
        { $set: { status: "expired" } }
      ).catch(() => {});
    }
    return (
      <div className={styles.encuesta}>
        <div className={styles.formContainer}>
          <h1 className={styles.title}>Enlace expirado</h1>
          <p className={styles.subtitle}>
            Este enlace de encuesta ya no está disponible.
          </p>
          <div className={styles.messages}>
            <p className={styles.warning}>
              Solicite un nuevo enlace al administrador de Giganet si desea
              participar.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.encuesta}>
      <EncuestaForm token={token} empresaLabel={empresaLabel} />
    </div>
  );
}
