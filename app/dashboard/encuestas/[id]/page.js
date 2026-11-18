import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Types } from "mongoose";
import Encuesta from "@/app/models/encuesta";
import EncuestaPublishToggle from "@/components/dashboard/EncuestaPublishToggle";
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
  const recipient = e.recipient || {};
  const a = e.answers || null;
  const standalone = e.standalone === true;
  const title =
    (standalone
      ? recipient.name || recipient.organization || emp.nombre
      : emp.razonSocial || emp.nombre || emp.rnc) || "Encuesta";

  return (
    <div className={styles.wrap}>
      <Link href="/dashboard/encuestas" className={styles.back}>
        ← Volver a encuestas
      </Link>

      <div className={styles.card}>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.meta}>
          Estado: <strong>{e.status}</strong>
          {" · "}
          Origen: <strong>{standalone ? "Manual" : "Empresa"}</strong>
          {!standalone ? ` · RNC: ${emp.rnc || "—"}` : ""}
          {" · "}
          Enviada: {formatDate(e.sentAt || e.createdAt)}
          {e.respondedAt ? ` · Respondida: ${formatDate(e.respondedAt)}` : ""}
        </p>

        {e.status === "responded" ? (
          <div className={styles.publishBox}>
            <div className={styles.sectionTitle}>Testimonio en inicio</div>
            <EncuestaPublishToggle
              encuestaId={String(e._id)}
              initialPublishOnHome={e.publishOnHome === true}
            />
          </div>
        ) : null}

        {standalone ? (
          <>
            <div className={styles.sectionTitle}>Destinatario</div>
            <div className={styles.row}>
              <span>Nombre</span>
              <span>{recipient.name || "—"}</span>
            </div>
            <div className={styles.row}>
              <span>Email</span>
              <span>{recipient.email || emp.email || "—"}</span>
            </div>
            <div className={styles.row}>
              <span>Teléfono</span>
              <span>{recipient.phone || "—"}</span>
            </div>
            <div className={styles.row}>
              <span>Organización</span>
              <span>{recipient.organization || "—"}</span>
            </div>
          </>
        ) : (
          <>
            <div className={styles.sectionTitle}>Datos de contacto (snapshot)</div>
            <div className={styles.row}>
              <span>Email empresa</span>
              <span>{emp.email || "—"}</span>
            </div>
          </>
        )}

        {(a?.nombreRespondiente || a?.emailRespondiente || a?.referenciaServicio) ? (
          <>
            <div className={styles.sectionTitle}>Quién respondió (opcional)</div>
            <div className={styles.row}>
              <span>Nombre</span>
              <span>{a.nombreRespondiente || "—"}</span>
            </div>
            <div className={styles.row}>
              <span>Correo indicado</span>
              <span>{a.emailRespondiente || "—"}</span>
            </div>
            <div className={styles.row}>
              <span>Referencia</span>
              <span>{a.referenciaServicio || "—"}</span>
            </div>
          </>
        ) : null}

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
