import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { logError } from '../services/logger';
import { captureException } from '../services/sentry';
import { sendError } from '../utils/response';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Log error
  logError('Request error', err, {
    method: req.method,
    path: req.path,
    body: req.body,
    query: req.query,
  });

  // Send to Sentry
  captureException(err instanceof Error ? err : new Error(String(err)));

  // Handle known error types
  if (err instanceof AppError) {
    return sendError(res, err.message, err.code, err.statusCode, err.details);
  }

  if (err instanceof ZodError) {
    return sendError(
      res,
      'Validation failed',
      'VALIDATION_ERROR',
      400,
      err.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }))
    );
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // Handle Prisma errors
    if (err.code === 'P2002') {
      return sendError(res, 'A record with this value already exists', 'DUPLICATE_ENTRY', 409);
    }

    if (err.code === 'P2025') {
      return sendError(res, 'Record not found', 'NOT_FOUND', 404);
    }

    return sendError(res, 'Database error', 'DATABASE_ERROR', 400);
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    return sendError(res, 'Invalid data provided', 'VALIDATION_ERROR', 400);
  }

  // Default error response
  const statusCode = (err as any).statusCode || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message;

  return sendError(
    res,
    message,
    'INTERNAL_ERROR',
    statusCode,
    process.env.NODE_ENV === 'development' ? { stack: err.stack } : undefined
  );
};

// Async error wrapper
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

