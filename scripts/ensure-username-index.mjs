/**
 * Crea el índice único sparse de `username` en `users`.
 *
 * Uso:
 *   node --env-file=.env.local scripts/ensure-username-index.mjs
 */
import mongoose from "mongoose";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI no está definida");
  process.exit(1);
}

await mongoose.connect(uri);
const col = mongoose.connection.db.collection("users");

const existing = await col.indexes();
const already = existing.some((idx) => idx.name === "username_1");
if (already) {
  console.log("Índice username_1 ya existe");
} else {
  await col.createIndex(
    { username: 1 },
    {
      unique: true,
      sparse: true,
      name: "username_1",
      partialFilterExpression: {
        username: { $type: "string", $gt: "" },
      },
    },
  );
  console.log("Índice username_1 creado");
}

await mongoose.disconnect();
