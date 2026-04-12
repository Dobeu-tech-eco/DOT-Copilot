# CLI Reference — DOT-Copilot

Copy-pastable commands for every common workflow. All commands assume you are at the repo root unless noted.

**Required env vars are marked** `[ENV: VAR_NAME]`.

---

## Table of Contents

1. [Local Dev Setup (from scratch)](#1-local-dev-setup-from-scratch)
2. [Run Tests + Lint](#2-run-tests--lint)
3. [Deploy to Azure](#3-deploy-to-azure)
4. [DB Migrations — Prisma](#4-db-migrations--prisma)
5. [DB Migrations — Supabase](#5-db-migrations--supabase)

---

## 1. Local Dev Setup (from scratch)

### 1.1 Clone and install dependencies

```bash
# Clone the repo
git clone https://github.com/dobeutech/DOT-Copilot.git
cd DOT-Copilot

# Install root frontend dependencies
npm install

# Install inner backend dependencies
cd cursor-projects/DOT-Copilot/backend && npm install && cd ../../..

# Install inner frontend dependencies
cd cursor-projects/DOT-Copilot/frontend && npm install && cd ../../..
```

### 1.2 Configure environment variables

```bash
# Root frontend — copy and fill in Supabase credentials
cp .env.example .env
# Edit .env and set:
#   VITE_SUPABASE_URL=https://<project>.supabase.co
#   VITE_SUPABASE_ANON_KEY=<anon-key>

# Inner backend — create .env from example
cp cursor-projects/DOT-Copilot/backend/.env.example \
   cursor-projects/DOT-Copilot/backend/.env
# Edit and set at minimum:
#   DATABASE_URL=postgresql://user:pass@localhost:5432/dot_copilot
#   JWT_SECRET=<min-32-char-random-string>
#   JWT_REFRESH_SECRET=<min-32-char-random-string>
#   NODE_ENV=development
```

### 1.3 Start Docker services (Postgres + Redis)

```bash
# Start the dev Docker Compose stack (Postgres 16 + Redis)
cd cursor-projects/DOT-Copilot
docker compose -f docker-compose.dev.yml up -d
# Verify services are healthy
docker compose -f docker-compose.dev.yml ps
cd ../..
```

### 1.4 Run database migrations

```bash
# Apply Prisma migrations to local Postgres
cd cursor-projects/DOT-Copilot/backend
npx prisma migrate dev        # applies pending migrations
npx prisma db seed            # seed initial data
cd ../../..

# Apply Supabase migrations (if using local Supabase)
npx supabase start            # starts local Supabase stack
npx supabase db push          # applies all migrations in supabase/migrations/
```

### 1.5 Start dev servers

```bash
# Terminal 1 — Root frontend (Vite, port 5000)
npm run dev

# Terminal 2 — Inner backend (Express + nodemon, port 3001)
cd cursor-projects/DOT-Copilot/backend && npm run dev

# Terminal 3 — Inner frontend (Vite, port 5173) — optional
cd cursor-projects/DOT-Copilot/frontend && npm run dev
```

### 1.6 Verify everything is running

```bash
# Check backend health endpoint
curl http://localhost:3001/health

# Check backend API docs (dev only)
open http://localhost:3001/api-docs

# Check root frontend
open http://localhost:5000
```

---

## 2. Run Tests + Lint

### 2.1 Root frontend

```bash
# TypeScript type check (no emit)
npm run lint
# Equivalent to: npx tsc --noEmit

# Production build (catches Vite/Rollup errors)
npm run build
```

### 2.2 Inner backend

```bash
cd cursor-projects/DOT-Copilot/backend

# TypeScript type check
npm run lint
# Equivalent to: npx tsc --noEmit

# Run all Jest tests
npm test

# Run tests with coverage report
npm run test:coverage

# Run a single test file
npx jest __tests__/auth.test.ts

# Run tests matching a name pattern
npx jest -t "should return 401"

# Watch mode (re-runs on file change)
npm run test:watch
```

### 2.3 Inner frontend

```bash
cd cursor-projects/DOT-Copilot/frontend

# TypeScript type check
npm run lint

# Run all Vitest tests (single run)
npm test
# Equivalent to: npx vitest run

# Run with coverage
npm run test:coverage

# Run a single test file
npx vitest run src/components/LoginPage.test.tsx

# Watch mode
npm run test:watch
```

### 2.4 Run everything at once

```bash
# From repo root — type-check all three packages
npm run lint && \
  (cd cursor-projects/DOT-Copilot/backend && npm run lint) && \
  (cd cursor-projects/DOT-Copilot/frontend && npm run lint) && \
  echo "All type checks passed"

# Run all tests
(cd cursor-projects/DOT-Copilot/backend && npm test) && \
  (cd cursor-projects/DOT-Copilot/frontend && npm test) && \
  echo "All tests passed"
```

---

## 3. Deploy to Azure

**Prerequisites:** Azure CLI installed, logged in, and the target resource group exists.
**Required:** `[ENV: AZURE_SUBSCRIPTION_ID]`, `[ENV: AZURE_RESOURCE_GROUP]`

### 3.1 Login and set subscription

```bash
# Interactive login
az login

# Set active subscription
az account set --subscription $AZURE_SUBSCRIPTION_ID

# Verify
az account show --query "{name:name, id:id}" -o table
```

### 3.2 Deploy infrastructure (Bicep)

```bash
ENVIRONMENT=prod   # dev | staging | prod
RESOURCE_GROUP=rg-dot-copilot-${ENVIRONMENT}
LOCATION=eastus

# Create resource group if it doesn't exist
az group create --name $RESOURCE_GROUP --location $LOCATION

# Validate the Bicep template before deploying
az deployment group validate \
  --resource-group $RESOURCE_GROUP \
  --template-file cursor-projects/DOT-Copilot/infrastructure/azure/main.bicep \
  --parameters @cursor-projects/DOT-Copilot/infrastructure/azure/parameters.${ENVIRONMENT}.json

# Deploy infrastructure
az deployment group create \
  --resource-group $RESOURCE_GROUP \
  --template-file cursor-projects/DOT-Copilot/infrastructure/azure/main.bicep \
  --parameters @cursor-projects/DOT-Copilot/infrastructure/azure/parameters.${ENVIRONMENT}.json \
  --name "deploy-$(date +%Y%m%d-%H%M%S)"
```

### 3.3 Build and deploy the backend (App Service)

```bash
BACKEND_APP_NAME=dot-copilot-backend-${ENVIRONMENT}

# Build the backend
cd cursor-projects/DOT-Copilot/backend
npm run build
cd ../../..

# Package for deployment
cd cursor-projects/DOT-Copilot/backend
zip -r ../../../deploy-backend.zip dist/ package.json package-lock.json node_modules/
cd ../../..

# Deploy to App Service
az webapp deploy \
  --resource-group $RESOURCE_GROUP \
  --name $BACKEND_APP_NAME \
  --src-path deploy-backend.zip \
  --type zip

# Clean up zip
rm deploy-backend.zip
```

### 3.4 Build and deploy the frontend (Static Web App)

```bash
STATIC_APP_NAME=dot-copilot-frontend-${ENVIRONMENT}

# Build the root frontend
npm run build
# Output is in dist/

# Deploy to Azure Static Web Apps
# Option A: via GitHub Actions (recommended — triggered automatically on push to main)
# Option B: manual deploy via SWA CLI
npm install -g @azure/static-web-apps-cli

swa deploy ./dist \
  --app-name $STATIC_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --env production
```

### 3.5 Zero-downtime deploy via staging slot swap (prod only)

```bash
BACKEND_APP_NAME=dot-copilot-backend-prod

# Deploy to staging slot first
az webapp deploy \
  --resource-group $RESOURCE_GROUP \
  --name $BACKEND_APP_NAME \
  --slot staging \
  --src-path deploy-backend.zip \
  --type zip

# Verify staging slot is healthy
curl https://${BACKEND_APP_NAME}-staging.azurewebsites.net/health

# Swap staging → production (zero downtime)
az webapp deployment slot swap \
  --resource-group $RESOURCE_GROUP \
  --name $BACKEND_APP_NAME \
  --slot staging \
  --target-slot production

# Verify production is healthy
curl https://${BACKEND_APP_NAME}.azurewebsites.net/health
```

### 3.6 View logs

```bash
# Stream live logs from App Service
az webapp log tail \
  --resource-group $RESOURCE_GROUP \
  --name $BACKEND_APP_NAME

# Download recent logs
az webapp log download \
  --resource-group $RESOURCE_GROUP \
  --name $BACKEND_APP_NAME \
  --log-file backend-logs.zip
```

---

## 4. DB Migrations — Prisma

**Working directory:** `cursor-projects/DOT-Copilot/backend/`
**Required:** `[ENV: DATABASE_URL]`

```bash
cd cursor-projects/DOT-Copilot/backend
```

### 4.1 Create and apply a new migration

```bash
# Create a new migration file and apply it to the dev database
npx prisma migrate dev --name <migration-name>
# Example: npx prisma migrate dev --name add_btw_sessions
# Creates: prisma/migrations/<timestamp>_add_btw_sessions/migration.sql
```

### 4.2 Apply existing migrations (CI / production)

```bash
# Apply all pending migrations without creating new ones (safe for CI/prod)
npx prisma migrate deploy
```

### 4.3 Push schema changes without migration files (prototyping only)

```bash
# Sync schema.prisma to the database without creating migration files
# WARNING: Do not use in production — changes are not tracked
npx prisma db push
```

### 4.4 Open Prisma Studio (visual DB browser)

```bash
# Opens a web UI at http://localhost:5555
npx prisma studio
```

### 4.5 Regenerate the Prisma client after schema changes

```bash
# Must run after any schema.prisma edit
npx prisma generate
```

### 4.6 Rollback a migration

```bash
# Mark a failed migration as rolled back (does NOT undo DB changes automatically)
npx prisma migrate resolve --rolled-back <migration-name>
# Example: npx prisma migrate resolve --rolled-back 20260404000000_add_btw_sessions

# To actually undo DB changes, run the rollback SQL manually:
psql $DATABASE_URL -f prisma/migrations/<timestamp>_<name>/rollback.sql
```

### 4.7 Check migration status

```bash
# List all migrations and their applied status
npx prisma migrate status
```

### 4.8 Reset the database (dev only)

```bash
# WARNING: Drops and recreates the database, applies all migrations, runs seed
# NEVER run against staging or production
npx prisma migrate reset
```

---

## 5. DB Migrations — Supabase

**Working directory:** repo root
**Required:** `[ENV: SUPABASE_ACCESS_TOKEN]` for remote operations; local Supabase stack for local operations.

### 5.1 Start the local Supabase stack

```bash
# Starts local Postgres, Auth, Storage, and Studio at http://localhost:54323
npx supabase start

# Check status and get local credentials
npx supabase status
```

### 5.2 Create a new migration file

```bash
# Creates supabase/migrations/<timestamp>_<name>.sql
npx supabase migration new <name>
# Example: npx supabase migration new add_btw_sessions
```

### 5.3 Apply migrations to local Supabase

```bash
# Apply all pending migrations to the local stack
npx supabase db push

# Or reset and reapply all migrations from scratch (dev only)
npx supabase db reset
```

### 5.4 Apply migrations to a remote Supabase project

```bash
# Link to your remote project (one-time setup)
npx supabase link --project-ref <project-ref>
# [ENV: SUPABASE_ACCESS_TOKEN] must be set

# Push migrations to the remote project
npx supabase db push --linked

# Check which migrations have been applied remotely
npx supabase migration list
```

### 5.5 Pull remote schema changes into local migrations

```bash
# Introspect the remote DB and generate a migration for any schema drift
npx supabase db pull
```

### 5.6 Open Supabase Studio (local)

```bash
# Opens at http://localhost:54323 after supabase start
open http://localhost:54323
```

### 5.7 Stop the local Supabase stack

```bash
npx supabase stop

# Stop and delete all local data (full reset)
npx supabase stop --no-backup
```

### 5.8 Generate TypeScript types from Supabase schema

```bash
# Generates src/types/supabase.ts from the remote schema
npx supabase gen types typescript \
  --project-id <project-ref> \
  --schema public \
  > src/types/supabase.ts
```
