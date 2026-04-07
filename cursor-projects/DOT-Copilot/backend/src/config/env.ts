import { z } from 'zod';

const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  
  // Database
  DATABASE_URL: z.string().url('Invalid DATABASE_URL format'),
  
  // JWT
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  /** Optional; when set, password-reset HMAC uses this instead of JWT_SECRET */
  PASSWORD_RESET_SECRET: z.string().min(32).optional(),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // Metrics (optional; /metrics returns 401 if unset)
  METRICS_API_KEY: z.string().min(16).optional(),
  
  // CORS
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  
  // Email (optional for development)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().email().optional(),
  
  // File Storage (optional for development)
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().default('us-east-1'),
  AWS_S3_BUCKET: z.string().optional(),
  
  // Sentry (optional)
  SENTRY_DSN: z.string().url().optional(),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.issues.map((e: z.ZodIssue) => `  - ${e.path.join('.')}: ${e.message}`);
      console.error('Environment validation failed:');
      console.error(errors.join('\n'));
      
      process.exit(1);
    }
    throw error;
  }
}

export const env = validateEnv();

