import mongoose from "mongoose";

const {MONGODB_URI } = process.env;

if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is not defined");
}

export const connectDB = async () => {
    try {
    const {connection} = await mongoose.connect(MONGODB_URI);
        if (connection.readyState === 1) {
            console.log("Connected to MongoDB");
            return Promise.resolve(true);
        } else {
            return Promise.reject(new Error("Failed to connect to MongoDB"));
        }
    } catch (error) {
        console.error("Error connecting to MongoDB", error);
        return Promise.reject(new Error("Failed to connect to MongoDB"));
    }
}

