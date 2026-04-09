import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

dotenv.config();

import { initSentry } from './services/sentry';
import { logInfo, logError } from './services/logger';
import { initApplicationInsights } from './services/applicationInsights';
import { requestLogger, errorLogger } from './middleware/requestLogger';
import { correlationIdMiddleware } from './middleware/correlationId';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { performanceMiddleware } from './utils/performance';

initSentry();
initApplicationInsights();

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
import aiRoutes from './routes/ai';
import btwRoutes from './routes/btw';
import remindersRoutes from './routes/reminders';
import devicesRoutes from './routes/devices';
import i18nRoutes from './routes/i18n';
import agentNativeRoutes from './routes/agentNative';
import docsRoutes from './routes/docs';

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
    if (!origin || allowedOrigins.some((o) => origin.startsWith(o))) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
};
app.use(cors(corsOptions));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(performanceMiddleware);
app.use(correlationIdMiddleware);
app.use(requestLogger);

app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'dot-copilot-backend',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.get('/health/ready', async (req: Request, res: Response) => {
  const checks: Record<string, any> = {
    timestamp: new Date().toISOString(),
  };

  try {
    const dbStart = Date.now();
    // Use the singleton prisma instance
    await prisma.$queryRaw`SELECT 1`;

    checks.database = {
      status: 'healthy',
      responseTime: Date.now() - dbStart,
    };

    res.json({
      status: 'ready',
      service: 'dot-copilot-backend',
      checks,
    });
  } catch (error) {
    checks.database = {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    };

    res.status(503).json({
      status: 'not ready',
      service: 'dot-copilot-backend',
      checks,
    });
  }
});

app.get('/health/live', (req: Request, res: Response) => {
  res.json({
    status: 'alive',
    service: 'dot-copilot-backend',
    timestamp: new Date().toISOString(),
  });
});

app.get('/health/detailed', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const checks: Record<string, any> = {};

  try {
    const dbStart = Date.now();
    // Use the singleton prisma instance
    await prisma.$queryRaw`SELECT 1`;

    checks.database = {
      status: 'healthy',
      responseTime: Date.now() - dbStart,
    };
  } catch (error) {
    checks.database = {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  const memUsage = process.memoryUsage();
  checks.memory = {
    status: memUsage.heapUsed < memUsage.heapTotal * 0.9 ? 'healthy' : 'warning',
    heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
    external: `${Math.round(memUsage.external / 1024 / 1024)}MB`,
    rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
  };

  const allHealthy = Object.values(checks).every((check) => check.status === 'healthy' || check.status === 'warning');

  const statusCode = allHealthy ? 200 : 503;

  res.status(statusCode).json({
    status: allHealthy ? 'healthy' : 'degraded',
    service: 'dot-copilot-backend',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    responseTime: Date.now() - startTime,
    checks,
  });
});

app.get('/metrics', (req: Request, res: Response) => {
  const metricsKey = env.METRICS_API_KEY;
  const authHeader = req.headers.authorization;

  if (!metricsKey || !authHeader || authHeader !== `Bearer ${metricsKey}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { getMetrics } = require('./utils/performance');
  res.json({ metrics: getMetrics() });
});

if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_DOCS === 'true') {
  app.use('/api-docs', docsRoutes);
  logInfo('API documentation available at /api-docs');
}

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
app.use('/api/ai', aiRoutes);
app.use('/api/btw', btwRoutes);
app.use('/api/reminders', remindersRoutes);
app.use('/api/devices', devicesRoutes);
app.use('/api/i18n', i18nRoutes);
app.use('/api/agent', agentNativeRoutes);

app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use(errorLogger);
app.use(errorHandler);

const server = app.listen(PORT, () => {
  logInfo(`Server started`, { port: PORT, env: process.env.NODE_ENV || 'development' });
  console.log(`Server is running on http://localhost:${PORT}`);
});

const shutdown = async (signal: string) => {
  logInfo(`Received ${signal}, shutting down gracefully...`);
  
  server.close(async () => {
    logInfo('HTTP server closed.');
    
    try {
      await prisma.$disconnect();
      logInfo('Prisma connection closed.');
      
      const Sentry = require('@sentry/node');
      await Sentry.flush(2000);
      logInfo('Sentry logs flushed.');
      
      process.exit(0);
    } catch (err) {
      logError('Error during graceful shutdown', err as Error);
      process.exit(1);
    }
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logError('Graceful shutdown timed out, forcing exit.');
    process.exit(1);
  }, 10000);
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

export default app;
