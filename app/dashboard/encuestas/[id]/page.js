import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Types } from "mongoose";
import Encuesta from "@/app/models/encuesta";
import styles from "./page.module.css";

function formatDate(d) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("es-DO", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
}

export default async function EncuestaDetallePage({ params }) {
  const session = await auth();
  const user = session?.user;

  if (!user || user.role !== "admin") {
    redirect("/dashboard/empresa");
  }

  const { id } = await params;
  if (!id || !Types.ObjectId.isValid(id)) {
    notFound();
  }

  const e = await Encuesta.findById(id).lean().exec();
  if (!e) {
    notFound();
  }

  const emp = e.empresa || {};
  const a = e.answers || null;
  const empresaName = emp.razonSocial || emp.nombre || emp.rnc || "Empresa";

  return (
    <div className={styles.wrap}>
      <Link href="/dashboard/encuestas" className={styles.back}>
        ← Volver a encuestas
      </Link>

      <div className={styles.card}>
        <h1 className={styles.title}>{empresaName}</h1>
        <p className={styles.meta}>
          Estado: <strong>{e.status}</strong>
          {" · "}
          RNC: {emp.rnc || "—"}
          {" · "}
          Enviada: {formatDate(e.sentAt || e.createdAt)}
          {e.respondedAt ? ` · Respondida: ${formatDate(e.respondedAt)}` : ""}
        </p>

        <div className={styles.sectionTitle}>Datos de contacto (snapshot)</div>
        <div className={styles.row}>
          <span>Email empresa</span>
          <span>{emp.email || "—"}</span>
        </div>

        {!a ? (
          <p className={styles.emptyAnswers}>
            {e.status === "pending"
              ? "Esta encuesta aún no ha sido respondida."
              : "No hay respuestas registradas."}
          </p>
        ) : (
          <>
            <div className={styles.sectionTitle}>Puntuaciones</div>
            <div className={styles.row}>
              <span>NPS (0–10)</span>
              <span>{a.nps}</span>
            </div>
            <div className={styles.row}>
              <span>Satisfacción general (1–5)</span>
              <span>{a.satisfaccionGeneral}</span>
            </div>
            <div className={styles.row}>
              <span>Facilidad de integración (1–5)</span>
              <span>{a.facilidadIntegracion}</span>
            </div>
            <div className={styles.row}>
              <span>Calidad del soporte (1–5)</span>
              <span>{a.calidadSoporte}</span>
            </div>
            <div className={styles.row}>
              <span>Tiempo de respuesta (1–5)</span>
              <span>{a.tiempoRespuesta}</span>
            </div>

            <div className={styles.sectionTitle}>Lo que más gusta</div>
            <p className={styles.textBlock}>{a.loQueMasGusta || "—"}</p>

            <div className={styles.sectionTitle}>Qué mejorar</div>
            <p className={styles.textBlock}>{a.loQueMejorar || "—"}</p>

            <div className={styles.sectionTitle}>Comentarios</div>
            <p className={styles.textBlock}>{a.comentarios || "—"}</p>
          </>
        )}
      </div>
    </div>
  );
}
