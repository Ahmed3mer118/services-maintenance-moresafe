import 'dotenv/config';
import http from 'http';
import mongoose from 'mongoose';
import app from './app.js';
import connectDB from './config/database.js';
import initializeSocket from './sockets/index.js';
import { loadSpecialtiesFromDb } from './services/specialtyRegistry.js';
import { Specialty } from './models/index.js';
import logger from './utils/logger.js';

const PORT = process.env.PORT || 5000;

const start = async () => {
  await connectDB();
  await loadSpecialtiesFromDb(Specialty);

  const server = http.createServer(app);
  initializeSocket(server);

  server.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
    logger.info(`Swagger docs: http://localhost:${PORT}/api/docs`);
  });
};

start().catch((err) => {
  logger.error('Failed to start server', err);
  process.exit(1);
});
