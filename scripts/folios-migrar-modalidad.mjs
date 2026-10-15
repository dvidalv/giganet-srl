/**
 * Fija explícitamente la modalidad de folios ILIMITADO en las empresas existentes
 * que aún no tienen `empresa.folios.modalidad`. Idempotente: puede ejecutarse varias veces.
 * Solo escribe `empresa.folios`; no toca API Keys, credenciales The Factory ni secuencias e-NCF.
 *
 * Uso:
 *   node scripts/folios-migrar-modalidad.mjs            (aplica cambios)
 *   node scripts/folios-migrar-modalidad.mjs --dry-run  (solo cuenta)
 * Lee MONGODB_URI de .env.local / .env (o del entorno).
 */
import { config } from "dotenv";
import { MongoClient } from "mongodb";

config({ path: ".env.local" });
config();

const dryRun = process.argv.includes("--dry-run");
const uri = String(process.env.MONGODB_URI ?? "").trim();
if (!uri) {
  console.error("MONGODB_URI no está definida.");
  process.exit(1);
}

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });

try {
  await client.connect();
  const users = client.db().collection("users");
  const filtro = { "empresa.folios.modalidad": { $exists: false } };
  const pendientes = await users.countDocuments(filtro);
  console.log(`Empresas sin modalidad de folios: ${pendientes}`);

  if (dryRun || pendientes === 0) {
    console.log(dryRun ? "Dry run: no se aplicaron cambios." : "Nada que migrar.");
  } else {
    const r = await users.updateMany(filtro, {
      $set: {
        "empresa.folios.modalidad": "ILIMITADO",
        "empresa.folios.actualizadoEn": null,
        "empresa.folios.actualizadoPor": null,
      },
    });
    console.log(`Empresas actualizadas a ILIMITADO: ${r.modifiedCount}`);
  }
} catch (err) {
  console.error("Error en la migración:", err?.message || err);
  process.exitCode = 1;
} finally {
  await client.close();
}
