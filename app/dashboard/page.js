import styles from "./page.module.css";
import { getAllUsers } from "@/app/models/user";
import { auth } from "@/auth";
export default async function Dashboard() {
    const users = await getAllUsers();
    const usersCount = users.length;
    const session = await auth();
    const user = session?.user;
    return (
        <div className={styles.dashboard}>
            <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                    <div className={styles.statIcon}>👥</div>
                    <div className={styles.statInfo}>
                        <h3>Usuarios</h3>
                        <p className={styles.statNumber}>{usersCount}</p>
                        <span className={styles.statChange}>+12% este mes</span>
                    </div>
                </div>

                <div className={styles.statCard}>
                    <div className={styles.statIcon}>📦</div>
                    <div className={styles.statInfo}>
                        <h3>Productos</h3>
                        <p className={styles.statNumber}>567</p>
                        <span className={styles.statChange}>+8% este mes</span>
                    </div>
                </div>

                <div className={styles.statCard}>
                    <div className={styles.statIcon}>💰</div>
                    <div className={styles.statInfo}>
                        <h3>Ventas</h3>
                        <p className={styles.statNumber}>$45,678</p>
                        <span className={styles.statChange}>+23% este mes</span>
                    </div>
                </div>

                <div className={styles.statCard}>
                    <div className={styles.statIcon}>📊</div>
                    <div className={styles.statInfo}>
                        <h3>Reportes</h3>
                        <p className={styles.statNumber}>89</p>
                        <span className={styles.statChange}>+5% este mes</span>
                    </div>
                </div>
            </div>

            <div className={styles.contentGrid}>
                <div className={styles.card}>
                    <h2 className={styles.cardTitle}>Actividad Reciente</h2>
                    <div className={styles.activityList}>
                        <div className={styles.activityItem}>
                            <div className={styles.activityDot}></div>
                            <div>
                                <p className={styles.activityText}>Nuevo usuario registrado</p>
                                <span className={styles.activityTime}>Hace 5 minutos</span>
                            </div>
                        </div>
                        <div className={styles.activityItem}>
                            <div className={styles.activityDot}></div>
                            <div>
                                <p className={styles.activityText}>Producto actualizado</p>
                                <span className={styles.activityTime}>Hace 15 minutos</span>
                            </div>
                        </div>
                        <div className={styles.activityItem}>
                            <div className={styles.activityDot}></div>
                            <div>
                                <p className={styles.activityText}>Nueva venta realizada</p>
                                <span className={styles.activityTime}>Hace 1 hora</span>
                            </div>
                        </div>
                    </div>
                </div>

                {user.role === "admin" && <div className={styles.card}>
                    <h2 className={styles.cardTitle}>Accesos Rápidos</h2>
                    <div className={styles.quickLinks}>
                        <button className={styles.quickLink}>
                            <span className={styles.quickLinkIcon}>➕</span>
                            <span>Nuevo Usuario</span>
                        </button>
                        <button className={styles.quickLink}>
                            <span className={styles.quickLinkIcon}>📝</span>
                            <span>Nuevo Reporte</span>
                        </button>
                        <button className={styles.quickLink}>
                            <span className={styles.quickLinkIcon}>⚙️</span>
                            <span>Configuración</span>
                        </button>
                    </div>
                </div>}
            </div>
        </div>
    );
}