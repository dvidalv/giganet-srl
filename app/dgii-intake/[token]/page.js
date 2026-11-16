import { notFound } from "next/navigation";
import { Plus_Jakarta_Sans } from "next/font/google";
import DgiiIntake from "@/app/models/dgiiIntake";
import DgiiIntakeForm from "@/components/dgii-intake/DgiiIntakeForm";
import styles from "./page.module.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-dgii-jakarta",
  display: "swap",
});

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
      <div
        className={`${styles.page} ${jakarta.variable}`}
        data-dgii-intake-page=""
      >
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
        />
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
    <div
      className={`${styles.page} ${jakarta.variable}`}
      data-dgii-intake-page=""
    >
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
        crossOrigin="anonymous"
        referrerPolicy="no-referrer"
      />
      <DgiiIntakeForm token={token} />
    </div>
  );
}
