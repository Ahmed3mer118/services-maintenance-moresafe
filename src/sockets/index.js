import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger.js';
import { setSocketIO } from '../services/notificationService.js';

export function initializeSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      credentials: true,
    },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const room = `user:${socket.userId}`;
    socket.join(room);
    logger.debug(`Socket connected: ${socket.userId}`);

    socket.on('disconnect', () => {
      logger.debug(`Socket disconnected: ${socket.userId}`);
    });
  });

  setSocketIO(io);
  return io;
}

export default initializeSocket;
