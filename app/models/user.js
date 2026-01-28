import {Schema, model, models} from 'mongoose'
import { connectDB } from '@/lib/mongoDB'

// Variable para rastrear si ya se intentó conectar
let connectionInitiated = false;

// Función para asegurar la conexión a la base de datos
const ensureConnection = async () => {
    // Verificar si ya está conectado
    const mongoose = await import('mongoose');
    if (mongoose.default.connection.readyState === 1) {
        return;
    }
    
    // Conectar solo una vez
    if (!connectionInitiated) {
        connectionInitiated = true;
        await connectDB();
    }
};

const userSchema = new Schema(
    {
        email: {
            type: String,
            unique: true,
            required: [true, 'Email is required'],
            match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
        },
        password: {
            type: String,
            required: [true, 'Password is required'],
            minlength: [8, 'Password must be at least 8 characters long'],
            select: false, // No mostrar la contraseña en las consultas
        },
        name: {
            type: String,
            required: [true, 'Name is required'],
            minlength: [3, 'Name must be at least 3 characters long'],
            maxlength: [50, 'Name must be less than 50 characters long'],
        },
        role: {
            type: String,
            enum: ['user', 'admin'],
            default: 'user',
        },
        isVerified: {
            type: Boolean,
            default: false,
        },
        verificationToken: {
            type: String,
            select: false, // No mostrar en las consultas por defecto
        },
        verificationTokenExpires: {
            type: Date,
            select: false, // No mostrar en las consultas por defecto
        },
        resetPasswordToken: {
            type: String,
            select: false, // No mostrar en las consultas por defecto
        },
        resetPasswordExpires: {
            type: Date,
            select: false, // No mostrar en las consultas por defecto
        },
    },
    {
        timestamps: true,
        collection: 'users'
    }
);

// Crear el modelo
const User = models.User || model("User", userSchema);

// Interceptar métodos comunes para asegurar conexión antes de ejecutarlos
const originalCreate = User.create.bind(User);
const originalFind = User.find.bind(User);
const originalFindOne = User.findOne.bind(User);
const originalFindById = User.findById.bind(User);
const originalFindOneAndUpdate = User.findOneAndUpdate.bind(User);
const originalFindOneAndDelete = User.findOneAndDelete.bind(User);
const originalFindByIdAndUpdate = User.findByIdAndUpdate.bind(User);
const originalFindByIdAndDelete = User.findByIdAndDelete.bind(User);

User.create = async function(...args) {
    await ensureConnection();
    return originalCreate(...args);
};

User.find = async function(...args) {
    await ensureConnection();
    return originalFind(...args);
};

User.findOne = function(...args) {
    // Ensure connection, but don't await - let the query handle it
    // Return the query object so methods like .select() can be chained
    const query = originalFindOne(...args);
    // Ensure connection when query is executed
    const originalExec = query.exec.bind(query);
    query.exec = async function(...execArgs) {
        await ensureConnection();
        return originalExec(...execArgs);
    };
    // Also handle .then() for promise-like behavior
    const originalThen = query.then?.bind(query);
    if (originalThen) {
        query.then = async function(...thenArgs) {
            await ensureConnection();
            return originalThen(...thenArgs);
        };
    }
    return query;
};

User.findById = async function(...args) {
    await ensureConnection();
    return originalFindById(...args);
};

User.findOneAndUpdate = async function(...args) {
    await ensureConnection();
    return originalFindOneAndUpdate(...args);
};

User.findOneAndDelete = async function(...args) {
    await ensureConnection();
    return originalFindOneAndDelete(...args);
};

User.findByIdAndUpdate = async function(...args) {
    await ensureConnection();
    return originalFindByIdAndUpdate(...args);
};

User.findByIdAndDelete = async function(...args) {
    await ensureConnection();
    return originalFindByIdAndDelete(...args);
};

export default User;