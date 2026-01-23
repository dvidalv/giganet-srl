import mongoose from "mongoose";
import { MongoClient } from "mongodb";

const connection = {};
const nativeConnection = {};

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
