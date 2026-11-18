# Deployment Guide

## Quick Start

### Development

```bash
# Start PostgreSQL with Docker
docker compose -f docker-compose.dev.yml up -d

# Backend
cd backend
npm install
cp .env.example .env  # Edit with your settings
npx prisma migrate dev
npx prisma db seed
npm run dev

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

### Production

#### Backend Deployment

1. **Set environment variables:**
   ```bash
   export DATABASE_URL="postgresql://user:pass@host:5432/db"
   export JWT_SECRET="your-32-char-secret-minimum"
   export JWT_REFRESH_SECRET="your-32-char-refresh-secret"
   export NODE_ENV="production"
   ```

2. **Run database migrations:**
   ```bash
   cd backend
   npx prisma migrate deploy
   ```

3. **Build and deploy:**
   ```bash
   # Docker
   docker build -t dot-copilot-backend ./backend
   docker run -p 3001:3001 --env-file .env dot-copilot-backend

   # Or with docker-compose
   docker compose up -d
   ```

#### Frontend Deployment

1. **Set environment variables:**
   ```bash
   export VITE_API_BASE_URL="https://api.yourdomain.com/api"
   ```

2. **Build:**
   ```bash
   cd frontend
   npm run build
   ```

3. **Deploy to Vercel/Netlify:**
   - Connect your repository
   - Set build command: `npm run build`
   - Set output directory: `dist`
   - Add environment variable: `VITE_API_BASE_URL`

## Database Migrations

### Development
```bash
npx prisma migrate dev --name migration_name
```

### Production
```bash
npx prisma migrate deploy
```

### Rollback
```bash
# Prisma doesn't support automatic rollback
# You need to create a new migration to reverse changes
npx prisma migrate dev --name rollback_migration_name
```

## Health Checks

The backend provides three health check endpoints:

- `GET /health` - Basic health status
- `GET /health/ready` - Readiness (checks database)
- `GET /health/live` - Liveness check

Use these for:
- Kubernetes liveness/readiness probes
- Load balancer health checks
- Monitoring systems

## Monitoring

### Metrics Endpoint

Access performance metrics at `/metrics` (requires authentication in production):

```bash
curl -H "Authorization: Bearer <access-token>" http://localhost:3001/metrics
```

### Sentry Integration

1. Create a Sentry project
2. Get your DSN
3. Set `SENTRY_DSN` environment variable
4. Errors will automatically be tracked

### Logging

Logs are written to:
- Console (development)
- `logs/error.log` (production errors)
- `logs/combined.log` (production all logs)

## API Documentation

Access Swagger UI at `/api-docs` when:
- Running in development mode, OR
- `ENABLE_DOCS=true` environment variable is set

## Troubleshooting

### Database Connection Issues

```bash
# Test connection
npx prisma db pull

# Reset database (WARNING: deletes all data)
npx prisma migrate reset
```

### Build Issues

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear Prisma client
npx prisma generate
```

### Port Already in Use

```bash
# Change port in .env
PORT=3002
```

## Scaling

### Horizontal Scaling

1. Use a load balancer (nginx, AWS ALB, etc.)
2. Ensure database connection pooling is configured
3. Use Redis for session storage (if needed)
4. Configure sticky sessions for file uploads

### Database Optimization

1. Add indexes for frequently queried fields
2. Enable connection pooling (Prisma does this automatically)
3. Use read replicas for read-heavy workloads
4. Regular VACUUM and ANALYZE

## Security Checklist

- [ ] HTTPS enabled
- [ ] CORS configured for production domain only
- [ ] Rate limiting enabled
- [ ] JWT secrets are strong (32+ characters)
- [ ] Database credentials are secure
- [ ] Environment variables are not committed
- [ ] API documentation is disabled in production (or protected)
- [ ] Error messages don't expose sensitive information
- [ ] File uploads are validated and scanned
- [ ] Regular security updates

