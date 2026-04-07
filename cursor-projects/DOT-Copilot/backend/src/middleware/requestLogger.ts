import { Request, Response, NextFunction } from 'express';
import { logHttp, logError } from '../services/logger';

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logHttp(req.method, req.path, res.statusCode, duration, {
      correlationId: req.correlationId,
    });
  });

  next();
};

export const errorLogger = (err: Error, req: Request, res: Response, next: NextFunction) => {
  logError('Request error', err, {
    method: req.method,
    path: req.path,
    body: req.body,
    query: req.query,
  });

  next(err);
};

