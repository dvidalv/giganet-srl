import compStyles from "./EmpresaAdminForm.module.css";
import styles from "./EmpresaFolios.module.css";

export const ESTADOS_FOLIOS = [
  { value: "ILIMITADO", label: "Ilimitado" },
  { value: "VIGENTE", label: "Vigente" },
  { value: "POR_VENCER", label: "Por vencer" },
  { value: "SIN_SALDO_ASIGNADO", label: "Sin saldo asignado" },
  { value: "AGOTADO", label: "Agotado" },
  { value: "VENCIDO", label: "Vencido" },
  { value: "PROGRAMADO", label: "Programado" },
  { value: "SIN_CONTRATO", label: "Configuración incompleta" },
  { value: "CANCELADO", label: "Cancelado" },
];

const ETIQUETAS = Object.fromEntries(ESTADOS_FOLIOS.map((e) => [e.value, e.label]));

export const ETIQUETAS_ACCION = {
  MODALIDAD_CAMBIADA: "Modalidad cambiada",
  CONTRATO_CREADO: "Contrato creado",
  CONTRATO_RENOVADO: "Contrato de renovación creado",
  CONTRATO_ACTUALIZADO: "Contrato actualizado",
  CONTRATO_CANCELADO: "Contrato cancelado",
  CONTRATO_REACTIVADO: "Contrato reactivado",
  ASIGNACION_REGISTRADA: "Asignación registrada",
  AJUSTE_CONSUMO: "Ajuste de consumo",
  CONTADORES_RECALCULADOS: "Contadores recalculados",
  ALERTA_ATENDIDA: "Alerta atendida",
  ALERTA_MINIMA_CONFIGURADA: "Alerta mínima configurada",
  ALERTA_MINIMA_REARMADA: "Alerta mínima rearmada",
};

/** Indicador de envío del email de una alerta MINIMO; nada para los demás tipos. */
export function EstadoEmailAlerta({ alerta }) {
  if (alerta.tipo !== "MINIMO") return null;
  const enviado = !!alerta.emailEnviadoEn;
  return (
    <span
      className={`${styles.emailEstado} ${enviado ? styles.emailEstadoOk : styles.emailEstadoPendiente}`}
      title={
        enviado
          ? `Email enviado ${formatFechaHora(alerta.emailEnviadoEn)}`
          : alerta.emailError || "Se reintentará en la próxima ejecución diaria"
      }
    >
      {enviado ? "Email enviado" : "Email pendiente"}
    </span>
  );
}

export function formatNumero(n) {
  return Number(n ?? 0).toLocaleString("es-DO");
}

/** "2027-01-15" -> "15/01/2027" sin conversiones de zona horaria. */
export function formatDia(dia) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dia ?? ""));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "—";
}

export function formatFechaHora(valor) {
  if (!valor) return "—";
  const d = new Date(valor);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("es-DO", {
        timeZone: "America/Santo_Domingo",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

export function textoDiasRestantes(dias) {
  if (dias == null) return "";
  if (dias < 0) return `Venció hace ${formatNumero(-dias)} día${dias === -1 ? "" : "s"}`;
  if (dias === 0) return "Último día de vigencia";
  return `Faltan ${formatNumero(dias)} día${dias === 1 ? "" : "s"}`;
}

export function EstadoFoliosBadge({ estado }) {
  return (
    <span className={`${compStyles.compEstado} ${styles[`estado_${estado}`] ?? ""}`}>
      {ETIQUETAS[estado] ?? estado}
    </span>
  );
}

export function ModalidadBadge({ modalidad }) {
  const controlado = modalidad === "CONTROLADO";
  return (
    <span className={controlado ? styles.modalidadBadgeControlado : styles.modalidadBadgeIlimitado}>
      {controlado ? "Folios controlados" : "Folios ilimitados"}
    </span>
  );
}

export async function fetchJson(url, options) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detalle = Array.isArray(data.details) ? ` ${data.details.join(" ")}` : "";
    throw new Error(`${data.error || "Error de conexión"}${detalle}`);
  }
  return data;
}
