import mongoose from "mongoose";
import { connectDB } from "@/lib/mongoDB";
import FolioContrato from "@/app/models/folioContrato";
import FolioAsignacion from "@/app/models/folioAsignacion";
import FolioConsumo from "@/app/models/folioConsumo";
import FolioAlerta from "@/app/models/folioAlerta";
import FolioAuditoria from "@/app/models/folioAuditoria";
import Encuesta from "@/app/models/encuesta";
import ComprobanteEnvio from "@/app/models/comprobanteEnvio";
import { getComprobanteModel } from "@/app/models/comprobante";

/** Borra folios, secuencias, envíos y encuestas de una cuenta antes de eliminar el usuario. */
export async function eliminarDatosDeEmpresa(userId) {
  await connectDB();
  const oid = new mongoose.Types.ObjectId(userId);
  await Promise.all([
    FolioContrato.deleteMany({ empresa: oid }),
    FolioAsignacion.deleteMany({ empresa: oid }),
    FolioConsumo.deleteMany({ empresa: oid }),
    FolioAlerta.deleteMany({ empresa: oid }),
    FolioAuditoria.deleteMany({ empresa: oid }),
    Encuesta.deleteMany({ userId: oid }),
    ComprobanteEnvio.deleteMany({ usuario: oid }),
  ]);

  const produccion = await getComprobanteModel(false);
  await produccion.deleteMany({ usuario: oid });

  if (String(process.env.MONGODB_URI_DEV || "").trim()) {
    try {
      const demo = await getComprobanteModel(true);
      await demo.deleteMany({ usuario: oid });
    } catch (err) {
      console.error("[eliminarEmpresa] No se pudieron borrar las secuencias demo:", err);
    }
  }
}
