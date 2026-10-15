import mongoose from "mongoose";
import { connectDB } from "@/lib/mongoDB";

let conexionPromise = null;

export async function asegurarConexionFolios() {
  if (mongoose.connection.readyState === 1) return;
  if (!conexionPromise) {
    conexionPromise = connectDB().finally(() => {
      conexionPromise = null;
    });
  }
  await conexionPromise;
}
