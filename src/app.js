import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import mongoSanitize from 'express-mongo-sanitize';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import path from 'path';
import { fileURLToPath } from 'url';
import routes from './routes/index.js';
import { errorHandler, notFound } from './middlewares/error.middleware.js';
import { swaggerSpec } from './config/swagger.js';
import { configureCloudinary } from './config/cloudinary.js';
import mongoose from 'mongoose';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

configureCloudinary();

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(mongoSanitize());

const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000,
  max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
  message: { success: false, message: 'Too many requests' },
});
app.use('/api', limiter);

const authLimiter = rateLimit({
  windowMs: 900000,
  max: 20,
  message: { success: false, message: 'Too many auth attempts' },
});
app.use('/api/v1/auth/login', authLimiter);

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.get('/api/v1/health', (_req, res) => {
  res.json({
    success: true,
    status: 'ok',
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/v1', routes);
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use(notFound);
app.use(errorHandler);

export default app;
