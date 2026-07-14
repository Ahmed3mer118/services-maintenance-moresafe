import mongoose from 'mongoose';
import logger from '../utils/logger.js';

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null, initDone: false };
}

async function runInit() {
  if (cached.initDone) return;
  const { loadSpecialtiesFromDb } = await import('../services/specialtyRegistry.js');
  const { Specialty } = await import('../models/index.js');
  await loadSpecialtiesFromDb(Specialty);
  cached.initDone = true;
}

export const connectDB = async () => {
  if (cached.conn) {
    return cached.conn;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is not set');
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(uri, {
        bufferCommands: false,
        serverSelectionTimeoutMS: 15000,
        maxPoolSize: 10,
      })
      .then(async (instance) => {
        logger.info(`MongoDB connected: ${instance.connection.host}`);
        await runInit();
        return instance;
      })
      .catch((error) => {
        cached.promise = null;
        logger.error(`MongoDB connection error: ${error.message}`);
        throw error;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
};

export default connectDB;
