import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';

const HEADER = 'x-request-id';

export const correlationIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const incoming = req.headers[HEADER];
  const id = typeof incoming === 'string' && incoming.trim() ? incoming.trim() : randomUUID();
  req.correlationId = id;
  res.setHeader(HEADER, id);
  next();
};

declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
    }
  }
}
