import mongoose from "mongoose";
import { MongoClient } from "mongodb";

const connection = {};
const nativeConnection = {};

/** Mongoose connection dedicada a la colección `comprobantes` cuando la empresa usa ambiente demo (MONGODB_URI_DEV). */
let comprobantesDevConnection = null;
let comprobantesDevConnectionPromise = null;

/**
 * Quita parámetros de query que no son opciones válidas del driver (p. ej. typo `giganet_dev=Cluster0` en vez de `appName=...`).
 * @param {string} uri
 */
function sanitizeMongoUriQuery(uri) {
    const q = uri.indexOf("?");
    if (q === -1) return uri;
    const prefix = uri.slice(0, q);
    const search = uri.slice(q + 1);
    const params = new URLSearchParams(search);
    params.delete("giganet_dev");
    const next = params.toString();
    return next ? `${prefix}?${next}` : prefix;
}

/**
 * Conexión Mongoose separada para comprobantes en BD de demo/pruebas.
 * @throws {Error} si MONGODB_URI_DEV no está definida o la conexión falla
 */
export async function getComprobantesDevMongooseConnection() {
    const uri = sanitizeMongoUriQuery(String(process.env.MONGODB_URI_DEV ?? "").trim());
    if (!uri) {
        throw new Error(
            "MONGODB_URI_DEV no está definida: no se pueden manipular comprobantes para empresas en ambiente demo.",
        );
    }
    if (comprobantesDevConnection && comprobantesDevConnection.readyState === 1) {
        return comprobantesDevConnection;
    }
    if (!comprobantesDevConnectionPromise) {
        comprobantesDevConnectionPromise = (async () => {
            const uriPreview = uri.replace(/:[^:@]+@/, ":****@");
            console.log("🔌 [comprobantes demo] Conectando a:", uriPreview);
            const conn = mongoose.createConnection(uri, {
                serverSelectionTimeoutMS: 10000,
            });
            await conn.asPromise();
            comprobantesDevConnection = conn;
            console.log("✅ [comprobantes demo] MongoDB conectado");
            return conn;
        })().catch((err) => {
            comprobantesDevConnectionPromise = null;
            console.error("❌ [comprobantes demo] Error al conectar:", err?.message || err);
            throw err;
        });
    }
    return comprobantesDevConnectionPromise;
}

// Conexión con Mongoose (existente)
export async function connectDB() {
    if (connection.isConnected) {
        console.log("Usando conexión existente a MongoDB");
        return;
    }

    if (mongoose.connections.length > 0) {
        connection.isConnected = mongoose.connections[0].readyState;
        if (connection.isConnected === 1) {
            console.log("Usando conexión existente a MongoDB");
            return;
        }
        await mongoose.disconnect();
    }

    try {
        if (!process.env.MONGODB_URI) {
            console.error("❌ MONGODB_URI no está definida en las variables de entorno");
            return;
        }
        
        // Log para debugging (sin mostrar la contraseña completa)
        const uriPreview = process.env.MONGODB_URI.replace(/:[^:@]+@/, ':****@');
        console.log("🔌 Intentando conectar a:", uriPreview);
        
        const db = await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 10000,
        });
        connection.isConnected = db.connections[0].readyState;
        console.log("✅ Conectado a MongoDB");
    } catch (error) {
        console.error("❌ Error al conectar a MongoDB:", error.message);
        if (error.message.includes("authentication failed")) {
            console.error("💡 Verifica:");
            console.error("   1. Usuario y contraseña correctos en MongoDB Atlas");
            console.error("   2. Si la contraseña tiene caracteres especiales, codifícala en URL");
            console.error("   3. Que el usuario tenga permisos de lectura/escritura");
            console.error("   4. Que tu IP esté en la whitelist (o usa 0.0.0.0/0 para todas)");
        }
        connection.isConnected = 0;
    }
}

// Conexión directa con MongoDB driver nativo (sin Mongoose)
export async function connectDBDirect() {
    // Si ya hay una conexión activa, reutilizarla
    if (nativeConnection.client && nativeConnection.client.topology?.isConnected()) {
        console.log("✅ Usando conexión directa existente a MongoDB");
        return nativeConnection.client;
    }

    try {
        if (!process.env.MONGODB_URI) {
            console.error("❌ MONGODB_URI no está definida en las variables de entorno");
            return null;
        }

        // Log para debugging (sin mostrar la contraseña completa)
        const uriPreview = process.env.MONGODB_URI.replace(/:[^:@]+@/, ':****@');
        console.log("🔌 Intentando conectar directamente a MongoDB:", uriPreview);

        // Crear nuevo cliente
        const client = new MongoClient(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 10000,
        });

        // Conectar
        await client.connect();
        
        // Verificar conexión
        await client.db().admin().ping();
        
        nativeConnection.client = client;
        nativeConnection.isConnected = true;
        
        console.log("✅ Conectado directamente a MongoDB (sin Mongoose)");
        return client;
    } catch (error) {
        console.error("❌ Error al conectar directamente a MongoDB:", error.message);
        if (error.message.includes("authentication failed")) {
            console.error("💡 Verifica:");
            console.error("   1. Usuario y contraseña correctos en MongoDB Atlas");
            console.error("   2. Si la contraseña tiene caracteres especiales, codifícala en URL");
            console.error("   3. Que el usuario tenga permisos de lectura/escritura");
            console.error("   4. Que tu IP esté en la whitelist (o usa 0.0.0.0/0 para todas)");
        }
        nativeConnection.isConnected = false;
        return null;
    }
}

// Obtener la base de datos directamente
export async function getDB() {
    const client = await connectDBDirect();
    if (!client) {
        throw new Error("No se pudo conectar a MongoDB");
    }
    
    // Extraer el nombre de la base de datos de la URI
    const dbName = process.env.MONGODB_URI.match(/\/([^?]+)/)?.[1] || "giganet_db";
    return client.db(dbName);
}

// Cerrar conexión directa
export async function closeDirectConnection() {
    if (nativeConnection.client) {
        await nativeConnection.client.close();
        nativeConnection.client = null;
        nativeConnection.isConnected = false;
        console.log("🔌 Conexión directa a MongoDB cerrada");
    }
}
