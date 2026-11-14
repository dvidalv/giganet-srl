import { notFound } from "next/navigation";
import DgiiIntake from "@/app/models/dgiiIntake";
import DgiiIntakeForm from "@/components/dgii-intake/DgiiIntakeForm";
import styles from "./page.module.css";

export default async function DgiiIntakePublicPage({ params }) {
  const { token } = await params;
  if (!token || typeof token !== "string" || token.length < 32) {
    notFound();
  }

  const intake = await DgiiIntake.findOne({ token }).lean();
  if (!intake) {
    notFound();
  }

  const now = new Date();
  const expired = intake.expiresAt && new Date(intake.expiresAt) <= now;

  if (expired || intake.status === "expired") {
    if (intake.status !== "expired") {
      await DgiiIntake.findOneAndUpdate(
        { _id: intake._id },
        { $set: { status: "expired" } }
      ).catch(() => {});
    }
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <h1 className={styles.title}>Enlace expirado</h1>
          <p className={styles.text}>
            Este enlace de admisión DGII ya no está disponible. Solicite uno
            nuevo al administrador de Giganet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <DgiiIntakeForm token={token} />
    </div>
  );
}
