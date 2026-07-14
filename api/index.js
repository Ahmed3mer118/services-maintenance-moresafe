import serverless from 'serverless-http';
import app from '../src/app.js';
import connectDB from '../src/config/database.js';

const handler = serverless(app, { binary: ['image/*', 'application/pdf'] });

export default async function vercelHandler(req, res) {
  try {
    await connectDB();
  } catch (err) {
    if (!res.headersSent) {
      res.status(503).json({
        success: false,
        message: 'Database unavailable — check MONGODB_URI and Atlas Network Access (0.0.0.0/0)',
        detail: err.message,
      });
    }
    return;
  }

  return handler(req, res);
}
