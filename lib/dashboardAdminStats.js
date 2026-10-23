import { countUsers, getAllUsers } from "@/app/models/user";
import Encuesta from "@/app/models/encuesta";
import {
  evaluarAlertas,
  listarAlertas,
  listarPanelFolios,
} from "@/lib/folios/foliosService";

const FILTRO_INCOMPLETAS = {
  role: "user",
  $expr: {
    $or: [
      { $eq: [{ $trim: { input: { $ifNull: ["$empresa.rnc", ""] } } }, ""] },
      {
        $eq: [
          { $trim: { input: { $ifNull: ["$empresa.razonSocial", ""] } } },
          "",
        ],
      },
    ],
  },
};

/** Datos del dashboard admin: conteos, folios y actividad reciente. */
export async function getDashboardAdminStats() {
  const [
    empresas,
    incompletas,
    controladas,
    encuestasPendientes,
    encuestasRespondidas,
    recientes,
    panel,
  ] = await Promise.all([
    countUsers({ role: "user" }),
    countUsers(FILTRO_INCOMPLETAS),
    countUsers({
      role: "user",
      "empresa.folios.modalidad": "CONTROLADO",
    }),
    Encuesta.countDocuments({ status: "pending" }),
    Encuesta.countDocuments({ status: "responded" }),
    getAllUsers({
      filter: { role: "user" },
      sort: { createdAt: -1 },
      limit: 5,
      select: "name email empresa.razonSocial empresa.nombre createdAt",
    }),
    listarPanelFolios({ pagina: 1, porPagina: 1 }),
  ]);

  await evaluarAlertas();
  const alertas = await listarAlertas({ limite: 200 });

  const empresasRecientes = recientes.map((u) => {
    const obj = u.toObject?.() ?? u;
    return {
      id: String(obj._id),
      nombre:
        obj.empresa?.razonSocial ||
        obj.empresa?.nombre ||
        obj.name ||
        obj.email ||
        "Sin nombre",
      email: obj.email || "",
      createdAt: obj.createdAt ? new Date(obj.createdAt).toISOString() : null,
    };
  });

  return {
    empresas,
    incompletas,
    controladas,
    alertasCount: alertas.length,
    encuestasPendientes,
    encuestasRespondidas,
    foliosTotales: panel?.totales ?? {
      empresas: 0,
      ilimitadas: 0,
      controladas: 0,
      bloqueadas: 0,
      porVencer: 0,
      alertas: 0,
    },
    empresasRecientes,
    alertasRecientes: alertas.slice(0, 3).map((a) => ({
      id: a.id,
      empresa: a.empresa,
      empresaNombre: a.empresaNombre || "Empresa",
      tipo: a.tipo,
      mensaje: a.mensaje || "",
    })),
  };
}
