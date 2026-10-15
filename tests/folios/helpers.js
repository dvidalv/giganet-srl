import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import User from "@/app/models/user";
import FolioContrato from "@/app/models/folioContrato";
import FolioAsignacion from "@/app/models/folioAsignacion";
import FolioConsumo from "@/app/models/folioConsumo";
import FolioAlerta from "@/app/models/folioAlerta";
import FolioAuditoria from "@/app/models/folioAuditoria";

let mongod = null;

export const ADMIN = { id: new mongoose.Types.ObjectId().toString(), email: "admin@giganet.test" };

export async function iniciarMongo() {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri("giganet_test");
  await mongoose.connect(process.env.MONGODB_URI);
  await Promise.all(
    [User, FolioContrato, FolioAsignacion, FolioConsumo, FolioAlerta, FolioAuditoria].map((m) =>
      m.syncIndexes(),
    ),
  );
}

export async function detenerMongo() {
  await mongoose.disconnect();
  await mongod?.stop();
}

export async function limpiarColecciones() {
  const cols = await mongoose.connection.db.collections();
  await Promise.all(cols.map((c) => c.deleteMany({})));
}

let secuencia = 0;

/** Empresa creada con el esquema actual (modalidad ILIMITADO explícita por defecto). */
export async function crearEmpresa({ modalidad, ambiente = "production", rnc = "130476896" } = {}) {
  secuencia += 1;
  const user = await User.create({
    email: `empresa${secuencia}@test.do`,
    password: "password-segura",
    name: `Empresa ${secuencia}`,
    isVerified: true,
    empresa: {
      nombre: `Empresa ${secuencia}`,
      razonSocial: `Empresa ${secuencia} SRL`,
      rnc,
      theFactoryAmbiente: ambiente,
      ...(modalidad ? { folios: { modalidad } } : {}),
    },
  });
  return String(user._id);
}

/** Empresa previa a esta funcionalidad: el documento no tiene `empresa.folios`. */
export async function crearEmpresaLegada({ ambiente = "production" } = {}) {
  secuencia += 1;
  const r = await mongoose.connection.collection("users").insertOne({
    email: `legada${secuencia}@test.do`,
    password: "hash",
    name: `Legada ${secuencia}`,
    role: "user",
    empresa: { nombre: "Legada", rnc: "101010101", theFactoryAmbiente: ambiente },
  });
  return String(r.insertedId);
}

/** Instante UTC equivalente a una hora local de República Dominicana (UTC-4, sin horario de verano). */
export function horaRD(dia, hora = "12:00") {
  return new Date(`${dia}T${hora}:00-04:00`);
}
