import mongoose from 'mongoose';
import logger from '../utils/logger.js';

const globalCache = globalThis;

if (!globalCache.__mongooseCache) {
  globalCache.__mongooseCache = { conn: null, promise: null, initDone: false };
}

const cache = globalCache.__mongooseCache;

const isServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

async function runInit() {
  if (cache.initDone) return;
  try {
    const { loadSpecialtiesFromDb } = await import('../services/specialtyRegistry.js');
    const { Specialty } = await import('../models/index.js');
    await loadSpecialtiesFromDb(Specialty);
    cache.initDone = true;
  } catch (err) {
    logger.error(`Specialty init error: ${err.message}`);
  }
}

export const getDbStatus = () => (
  mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
);

export const connectDB = async () => {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    throw new Error('MONGODB_URI is not set. Add it in Vercel Environment Variables.');
  }

  if (cache.conn && mongoose.connection.readyState === 1) {
    return cache.conn;
  }

  if (!cache.promise) {
    cache.promise = mongoose
      .connect(uri, {
        bufferCommands: false,
        serverSelectionTimeoutMS: isServerless ? 20000 : 30000,
        socketTimeoutMS: 45000,
        connectTimeoutMS: isServerless ? 20000 : 30000,
        maxPoolSize: isServerless ? 5 : 10,
        family: 4,
      })
      .then((connection) => {
        logger.info(`MongoDB connected: ${connection.connection.host}`);
        runInit().catch((err) => logger.error(`Specialty init error: ${err.message}`));
        return connection;
      })
      .catch((err) => {
        cache.promise = null;
        logger.error(`MongoDB connection error: ${err.message}`);
        throw err;
      });
  }

  cache.conn = await cache.promise;
  return cache.conn;
};

export default connectDB;
