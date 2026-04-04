import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

dotenv.config();

import { logInfo, logError } from './services/logger';

import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import fleetRoutes from './routes/fleets';
import trainingProgramRoutes from './routes/trainingPrograms';
import moduleRoutes from './routes/modules';
import lessonRoutes from './routes/lessons';
import assignmentRoutes from './routes/assignments';
import notificationRoutes from './routes/notifications';
import completionRecordRoutes from './routes/completionRecords';
import complianceRoutes from './routes/compliance';
import documentsRoutes from './routes/documents';
import driverStatsRoutes from './routes/driverStats';

const app: Express = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

const allowedOrigins = [
  'http://localhost:5000',
  'http://localhost:5173',
  process.env.FRONTEND_URL,
  process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : undefined,
].filter(Boolean) as string[];

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin || allowedOrigins.some(o => origin.startsWith(o))) {
      callback(null, true);
    } else {
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'healthy',
    service: 'dot-copilot-backend',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/fleets', fleetRoutes);
app.use('/api/training-programs', trainingProgramRoutes);
app.use('/api/modules', moduleRoutes);
app.use('/api/lessons', lessonRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/completion-records', completionRecordRoutes);
app.use('/api/compliance', complianceRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/driver-stats', driverStatsRoutes);

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logError('Request error', err);
  const statusCode = (err as any).statusCode || 500;
  const message = process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message;
  res.status(statusCode).json({ error: message });
});

app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

const shutdown = async (signal: string) => {
  logInfo(`Received ${signal}, shutting down gracefully...`);
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('uncaughtException', (error) => {
  logError('Uncaught Exception', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logError('Unhandled Rejection', reason as Error);
});

app.listen(PORT, () => {
  logInfo(`Server started`, { port: PORT, env: process.env.NODE_ENV || 'development' });
  console.log(`Server is running on http://localhost:${PORT}`);
});

export default app;
