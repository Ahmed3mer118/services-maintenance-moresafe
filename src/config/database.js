import mongoose from 'mongoose';
import logger from '../utils/logger.js';

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null, initDone: false };
}

const isServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const CONNECT_TIMEOUT_MS = isServerless ? 8000 : 15000;

async function runInit() {
  if (cached.initDone) return;
  try {
    const { loadSpecialtiesFromDb } = await import('../services/specialtyRegistry.js');
    const { Specialty } = await import('../models/index.js');
    await loadSpecialtiesFromDb(Specialty);
    cached.initDone = true;
  } catch (err) {
    logger.error(`Specialty init error: ${err.message}`);
  }
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    }),
  ]);
}

export const connectDB = async () => {
  if (cached.conn?.connection?.readyState === 1) {
    return cached.conn;
  }

  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is not set on Vercel');
  }

  if (!cached.promise) {
    cached.promise = withTimeout(
      mongoose.connect(uri, {
        bufferCommands: false,
        serverSelectionTimeoutMS: CONNECT_TIMEOUT_MS,
        connectTimeoutMS: CONNECT_TIMEOUT_MS,
        maxPoolSize: isServerless ? 5 : 10,
        family: 4,
      }),
      CONNECT_TIMEOUT_MS + 1000,
      'MongoDB connection'
    )
      .then(async (instance) => {
        logger.info(`MongoDB connected: ${instance.connection.host}`);
        runInit();
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
};

export default connectDB;
