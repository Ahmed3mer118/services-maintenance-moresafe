import mongoose from 'mongoose';
import logger from '../utils/logger.js';

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null, initDone: false };
}

async function runInit() {
  if (cached.initDone) return;
  try {
    const { loadSpecialtiesFromDb } = await import('../services/specialtyRegistry.js');
    const { Specialty } = await import('../models/index.js');
    await loadSpecialtiesFromDb(Specialty);
    cached.initDone = true;
    logger.info('Specialty registry initialized from database');
  } catch (err) {
    logger.error(`Specialty init error: ${err.message}`);
  }
}

export default async function connectDB() {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    throw new Error('MONGODB_URI is not set. Add it in Vercel Environment Variables.');
  }

  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  if (!cached.promise) {
    logger.info('Connecting to MongoDB...');
    cached.promise = mongoose
      .connect(uri, {
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000,
        maxPoolSize: 10,
      })
      .then(async (instance) => {
        logger.info(`MongoDB connected: ${instance.connection.host}`);
        await runInit();
        return instance;
      })
      .catch((error) => {
        cached.promise = null;
        cached.conn = null;
        logger.error(`MongoDB connection error: ${error.message}`);
        throw error;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}
