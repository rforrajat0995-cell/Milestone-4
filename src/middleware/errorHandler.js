/**
 * Error Handling Middleware
 */

import { AppError } from '../errors/AppError.js';
import { serverConfig } from '../config/index.js';

/**
 * Global error handler middleware
 */
export function errorHandler(err, req, res, next) {
  // Log error
  console.error('Error:', {
    message: err.message,
    stack: serverConfig.isDevelopment ? err.stack : undefined,
    statusCode: err.statusCode,
  });

  // Determine status code
  const statusCode = err.statusCode || 500;
  const isOperational = err.isOperational !== false;

  // Send error response
  res.status(statusCode).json({
    error: isOperational ? err.message : 'Internal server error',
    ...(serverConfig.isDevelopment && {
      stack: err.stack,
      details: err,
    }),
  });
}

/**
 * Async error wrapper
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 404 Not Found handler
 */
export function notFoundHandler(req, res, next) {
  res.status(404).json({
    error: 'Route not found',
    path: req.path,
  });
}

