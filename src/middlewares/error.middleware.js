import { AppError } from '../utils/AppError.js';
import logger from '../utils/logger.js';

export const errorHandler = (err, req, res, _next) => {
  let error = err;

  if (err.name === 'CastError') {
    error = new AppError('Invalid ID format', 400);
  }
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0];
    error = new AppError(`Duplicate value for ${field}`, 409);
  }
  if (err.name === 'ValidationError' && err.errors) {
    const messages = Object.values(err.errors).map((e) => e.message);
    error = new AppError(messages.join(', '), 400);
  }

  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal server error';

  if (statusCode >= 500) {
    logger.error(`${statusCode} - ${message}`, { stack: err.stack, path: req.path });
  }

  res.status(statusCode).json({
    success: false,
    message,
    errors: error.errors || null,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

export const notFound = (req, res, next) => {
  next(new AppError(`Route ${req.originalUrl} not found`, 404));
};

export default errorHandler;
