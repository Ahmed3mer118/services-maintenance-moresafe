import connectDB from '../config/database.js';

/** Ensures MongoDB is connected before handling API requests (required on serverless). */
export async function ensureDb(req, res, next) {
  try {
    await connectDB();
    next();
  } catch (err) {
    res.status(503).json({
      success: false,
      message: 'Database connection failed. Check MONGODB_URI and Atlas Network Access (0.0.0.0/0).',
      detail: err.message,
    });
  }
}
