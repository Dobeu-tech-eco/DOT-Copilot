# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DOT-Copilot is a **Fleet Driver Training Management Platform** for transportation companies. It manages driver training, DOT/FMCSA compliance tracking, and regulatory adherence. Originally converted from Bubble.io to a modern stack.

This is a **monorepo** with two distinct application layers that share a git root but have separate dependency trees:

1. **Root-level Supabase frontend** (`/src`) — A React + Vite + Supabase app (the newer, active frontend)
2. **Inner monorepo** (`/cursor-projects/DOT-Copilot/`) — The original Express + Prisma backend and a separate React frontend

## Architecture

### Root Frontend (Supabase-backed)

- **Stack**: React 19, TypeScript 5.7, Vite 6, Tailwind CSS 3, Zustand 5, Supabase JS client
- **Entry**: `src/main.tsx` → `src/App.tsx` (BrowserRouter with protected routes)
- **State**: Two Zustand stores — `authStore.ts` (Supabase Auth) and `appStore.ts` (all domain data fetching)
- **Data**: All queries go directly to Supabase via `src/lib/supabase.ts` (no backend API)
- **Database**: Supabase PostgreSQL with RLS. Migrations in `supabase/migrations/`
- **Types**: Hand-written domain types in `src/types/database.ts` (Profile, Fleet, TrainingProgram, Assignment, etc.)
- **Path alias**: `@/*` maps to `./src/*` (configured in tsconfig and vite.config)
- **Custom colors**: `baldor` color palette and custom `slate-750/850` in tailwind.config.js
- **Env vars**: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` required

### Inner Backend (`cursor-projects/DOT-Copilot/backend/`)

- **Stack**: Express 4.21, TypeScript 5.7, Prisma 7 (PostgreSQL), Zod 4, JWT auth, Winston logging
- **ORM**: Prisma with 25+ models in `prisma/schema.prisma`
- **Routes**: 20 route files covering auth, assignments, compliance, documents, training, webhooks, BTW sessions, etc.
- **Middleware**: JWT auth, request logging, rate limiting, error handler, Redis caching
- **Services**: Email (Nodemailer), SMS (Twilio), push notifications (FCM), Azure Blob/S3 storage, Sentry, Application Insights
- **Validation**: Zod schemas in `src/schemas/`
- **Testing**: Jest + Supertest in `__tests__/`

### Inner Frontend (`cursor-projects/DOT-Copilot/frontend/`)

- **Stack**: React 19, Vite (rolldown-vite), Axios, Zustand, Vitest
- **Testing**: Vitest + Testing Library

### Infrastructure

- **Deployment**: Azure App Service (backend), Azure Static Web Apps (frontend)
- **IaC**: Bicep templates in `cursor-projects/DOT-Copilot/infrastructure/azure/`
- **CI/CD**: GitHub Actions in `cursor-projects/DOT-Copilot/.github/workflows/` (ci.yml, deploy.yml, azure-deploy.yml)
- **Docker**: Compose files in `cursor-projects/DOT-Copilot/` (dev and prod) and `docker/` (shared services including MCP gateway, nginx, monitoring)
- **Scripts**: Bash scripts in `scripts/` for PostgreSQL/MongoDB backup/restore and Bicep validation

## Build & Dev Commands

### Root frontend (from repo root)
```bash
npm run dev          # Vite dev server
npm run build        # tsc && vite build
npm run lint         # tsc --noEmit
npm run preview      # Preview production build
```

### Backend (from cursor-projects/DOT-Copilot/backend/)
```bash
npm run dev          # nodemon + ts-node
npm run build        # tsc
npm start            # node dist/server.js
npm test             # jest
npm run test:watch   # jest --watch
npm run test:coverage
npx jest path/to/test.test.ts        # run a single test file
npx jest -t "test name pattern"      # run tests matching a name
npm run lint         # tsc --noEmit
npm run db:migrate   # prisma migrate dev
npm run db:push      # prisma db push
npm run db:seed      # ts-node prisma/seed.ts
```

### Inner frontend (from cursor-projects/DOT-Copilot/frontend/)
```bash
npm run dev          # vite dev server
npm run build        # tsc && vite build
npm test             # vitest run
npm run test:watch   # vitest
npm run test:coverage
npx vitest run path/to/test.ts       # run a single test file
npm run lint         # tsc --noEmit
```

### Docker (from cursor-projects/DOT-Copilot/)
```bash
docker compose -f docker-compose.dev.yml up -d   # Local development
docker compose exec backend npx prisma migrate dev
docker compose exec backend npx prisma db seed
```

## Key Domain Concepts

- **Fleet**: Multi-tenant organization (company). All data is scoped by `fleet_id`
- **Roles**: DRIVER, DRIVER_COACH, SUPERVISOR, BRANCH_MANAGER, ADMIN — hierarchical access
- **Compliance**: CDL, medical cards, HAZMAT, etc. with expiration tracking and alert windows
- **Training**: Programs → Modules → Lessons hierarchy. Content types: VIDEO, PDF, SCORM, POWERPOINT, TEXT
- **Assignments**: Link drivers to training programs/modules with status tracking and due dates
- **BTW**: Behind-the-wheel training sessions with digital evaluations and signatures
- **Vehicles**: Fleet vehicles with temperature monitoring capabilities (food transport focus)

## Other Subprojects

`cursor-projects/` also contains independent projects: `dobeuinfo`, `accident-app`, `digital-wharf-dynamics`, `uniquestaffingprofessionals`. These have their own dependency trees and are not tightly coupled to DOT-Copilot.

## Database

Two separate database systems exist:
1. **Supabase** (root app): RLS-enabled PostgreSQL, migrations in `supabase/migrations/`. Core schema creates ~12 tables with row-level security policies scoped by fleet. The `database/` directory at root contains documentation on connection setup, migration contracts, and pricing analysis.
2. **Prisma** (inner backend): Schema at `cursor-projects/DOT-Copilot/backend/prisma/schema.prisma` with equivalent models

## Conventions

- Commit messages follow Conventional Commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`
- Branch naming: `feature/`, `fix/`, `docs/`, `refactor/`, `test/`
- TypeScript strict mode enabled in both frontends and backend
- Root frontend uses `noUnusedLocals` and `noUnusedParameters`

## Reference Documentation

Extensive operational and architecture docs live at the repo root:
- `INFRASTRUCTURE_ARCHITECTURE.md` — System diagrams
- `OPERATIONAL_HANDBOOK.md` — Operations and maintenance
- `DISASTER_RECOVERY.md` — DR procedures
- `IAC_SECURITY_AUDIT.md` — Security findings
- `cursor-projects/DOT-Copilot/docs/adr/` — Architecture Decision Records
