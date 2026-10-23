import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { BsBuildings } from "react-icons/bs";
import { IoPeopleCircle } from "react-icons/io5";
import { MdOutlinePoll } from "react-icons/md";
import { RiFileList3Line } from "react-icons/ri";
import FoliosAlertasBanner from "@/components/dashboard/FoliosAlertasBanner";
import { formatNumero } from "@/components/dashboard/foliosUi";
import foliosStyles from "@/components/dashboard/EmpresaFolios.module.css";
import { getDashboardAdminStats } from "@/lib/dashboardAdminStats";
import styles from "./page.module.css";

function tiempoRelativo(iso) {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "";
  const min = Math.floor(ms / 60000);
  if (min < 1) return "Hace un momento";
  if (min < 60) return `Hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `Hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `Hace ${d} d`;
  return new Date(iso).toLocaleDateString("es-DO");
}

export default async function Dashboard() {
  const session = await auth();
  const user = session?.user;

  if (!user) {
    redirect("/login");
  }
  if (user.role !== "admin") {
    redirect("/dashboard/empresa");
  }

  const stats = await getDashboardAdminStats();
  const t = stats.foliosTotales;

  return (
    <div className={styles.dashboard}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Dashboard</h1>
          <p className={styles.subtitle}>
            Resumen operativo de empresas, folios e-CF y encuestas.
          </p>
        </div>
        <div className={styles.headerActions}>
          <Link href="/dashboard/empresas/folios" className={foliosStyles.linkBtn}>
            Control de folios
          </Link>
          <Link href="/dashboard/empresas" className={foliosStyles.linkBtn}>
            Empresas
          </Link>
        </div>
      </header>

      <FoliosAlertasBanner />

      <div className={styles.statsGrid}>
        <Link href="/dashboard/empresas" className={styles.statCard}>
          <p className={styles.statLabel}>Empresas</p>
          <p className={styles.statNumber}>{formatNumero(stats.empresas)}</p>
          <p className={styles.statHint}>Cuentas cliente activas en la plataforma</p>
        </Link>
        <Link
          href="/dashboard/empresas"
          className={`${styles.statCard} ${stats.incompletas ? styles.statWarn : ""}`}
        >
          <p className={styles.statLabel}>Datos incompletos</p>
          <p className={styles.statNumber}>{formatNumero(stats.incompletas)}</p>
          <p className={styles.statHint}>Sin RNC o razón social</p>
        </Link>
        <Link href="/dashboard/empresas/folios" className={styles.statCard}>
          <p className={styles.statLabel}>Folios controlados</p>
          <p className={styles.statNumber}>{formatNumero(stats.controladas)}</p>
          <p className={styles.statHint}>Empresas con modalidad controlada</p>
        </Link>
        <Link
          href="/dashboard/empresas/folios"
          className={`${styles.statCard} ${stats.alertasCount ? styles.statDanger : ""}`}
        >
          <p className={styles.statLabel}>Alertas de folios</p>
          <p className={styles.statNumber}>{formatNumero(stats.alertasCount)}</p>
          <p className={styles.statHint}>Pendientes de atender</p>
        </Link>
        <Link href="/dashboard/encuestas" className={styles.statCard}>
          <p className={styles.statLabel}>Encuestas pendientes</p>
          <p className={styles.statNumber}>
            {formatNumero(stats.encuestasPendientes)}
          </p>
          <p className={styles.statHint}>
            {formatNumero(stats.encuestasRespondidas)} respondidas
          </p>
        </Link>
      </div>

      <section className={styles.foliosBlock} aria-labelledby="dash-folios-title">
        <div className={styles.foliosHeader}>
          <div>
            <h2 id="dash-folios-title" className={styles.foliosTitle}>
              Folios e-CF
            </h2>
            <p className={styles.foliosSubtitle}>
              Estado comercial de las empresas. Las alertas y el detalle por
              contrato están en el panel de control de folios.
            </p>
          </div>
          <Link href="/dashboard/empresas/folios" className={foliosStyles.linkBtn}>
            Ir a control de folios
          </Link>
        </div>
        <div className={styles.metrics}>
          <div className={styles.metric}>
            <p className={styles.metricLabel}>Empresas</p>
            <p className={styles.metricValue}>{formatNumero(t.empresas)}</p>
            <p className={styles.metricHint}>
              {formatNumero(t.controladas)} controladas ·{" "}
              {formatNumero(t.ilimitadas)} ilimitadas
            </p>
          </div>
          <div className={styles.metric}>
            <p className={styles.metricLabel}>Por vencer (30 días)</p>
            <p className={styles.metricValue}>{formatNumero(t.porVencer)}</p>
          </div>
          <div className={styles.metric}>
            <p className={styles.metricLabel}>Emisión bloqueada</p>
            <p className={styles.metricValue}>{formatNumero(t.bloqueadas)}</p>
            <p className={styles.metricHint}>
              Vencidas, agotadas o sin contrato · {formatNumero(t.alertas)} alertas
            </p>
          </div>
        </div>
      </section>

      <div className={styles.contentGrid}>
        <section className={styles.card} aria-labelledby="dash-actividad">
          <h2 id="dash-actividad" className={styles.cardTitle}>
            Actividad reciente
          </h2>
          {stats.empresasRecientes.length === 0 &&
          stats.alertasRecientes.length === 0 ? (
            <p className={styles.emptyActivity}>No hay actividad reciente.</p>
          ) : (
            <div className={styles.activityList}>
              {stats.alertasRecientes.map((a) => (
                <div key={a.id} className={styles.activityItem}>
                  <div
                    className={`${styles.activityDot} ${styles.activityDotAlert}`}
                  />
                  <div>
                    <p className={styles.activityText}>
                      <Link href="/dashboard/empresas/folios">
                        {a.empresaNombre}
                      </Link>
                      {": "}
                      {a.mensaje || a.tipo}
                    </p>
                    <p className={styles.activityMeta}>Alerta de folios</p>
                  </div>
                </div>
              ))}
              {stats.empresasRecientes.map((e) => (
                <div key={e.id} className={styles.activityItem}>
                  <div className={styles.activityDot} />
                  <div>
                    <p className={styles.activityText}>
                      Empresa registrada:{" "}
                      <Link href={`/dashboard/empresas/${e.id}`}>{e.nombre}</Link>
                    </p>
                    <p className={styles.activityMeta}>
                      {[e.email, tiempoRelativo(e.createdAt)]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className={styles.card} aria-labelledby="dash-accesos">
          <h2 id="dash-accesos" className={styles.cardTitle}>
            Accesos rápidos
          </h2>
          <div className={styles.quickLinks}>
            <Link href="/dashboard/usuarios" className={styles.quickLink}>
              <span className={styles.quickLinkIcon} aria-hidden>
                <IoPeopleCircle />
              </span>
              Usuarios
            </Link>
            <Link href="/dashboard/empresas" className={styles.quickLink}>
              <span className={styles.quickLinkIcon} aria-hidden>
                <BsBuildings />
              </span>
              Empresas
            </Link>
            <Link href="/dashboard/empresas/folios" className={styles.quickLink}>
              <span className={styles.quickLinkIcon} aria-hidden>
                <RiFileList3Line />
              </span>
              Control de folios
            </Link>
            <Link href="/dashboard/encuestas" className={styles.quickLink}>
              <span className={styles.quickLinkIcon} aria-hidden>
                <MdOutlinePoll />
              </span>
              Encuestas
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
