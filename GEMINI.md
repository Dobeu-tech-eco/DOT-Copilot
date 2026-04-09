# GEMINI.md - DOT-Copilot Monorepo

## Project Overview
**DOT-Copilot** is an enterprise-grade **Fleet Driver Training Management Platform** designed for transportation companies to manage driver training, compliance tracking, and regulatory adherence (FMCSA/DOT). The project is a monorepo containing two distinct application layers:

1.  **Root Frontend (Modern Stack):** A React 19 + Vite + Supabase application located at the repository root (`/src`). This is the active frontend that communicates directly with Supabase.
2.  **Inner Monorepo (`/cursor-projects/DOT-Copilot/`):** The original architecture consisting of an Express.js + Prisma backend and a separate React frontend.

## Architecture & Tech Stack

### Root Frontend (Supabase-backed)
- **Framework:** React 19, TypeScript 5.7, Vite 6
- **Styling:** Tailwind CSS 3 (with custom `baldor` and `slate` themes)
- **State Management:** Zustand 5 (`authStore` for auth, `appStore` for data)
- **Backend-as-a-Service:** Supabase (Auth, PostgreSQL with RLS, Storage)
- **Database Schema:** Managed via Supabase migrations in `/supabase/migrations/`
- **Key Patterns:** Direct Supabase client usage in `src/lib/supabase.ts`, domain types in `src/types/database.ts`.

### Inner Backend (`/cursor-projects/DOT-Copilot/backend/`)
- **Framework:** Express 4.21, TypeScript 5.7
- **ORM:** Prisma 7 (PostgreSQL)
- **Validation:** Zod 4
- **Auth:** JWT with refresh tokens, bcrypt hashing
- **Services:** Nodemailer (Email), Twilio (SMS), FCM (Push), Winston (Logging)
- **Monitoring:** Sentry, Azure Application Insights

### Infrastructure & DevOps
- **Cloud Provider:** Azure (App Service for backend, Static Web Apps for frontend)
- **Infrastructure-as-Code:** Bicep templates in `cursor-projects/DOT-Copilot/infrastructure/azure/`
- **Containerization:** Docker & Docker Compose (dev and prod configurations)
- **CI/CD:** GitHub Actions in `.github/workflows/`

## Building and Running

### Root Frontend (from repo root)
```bash
npm run dev          # Start Vite dev server (launches backend too via scripts/start.mjs)
npm run build        # Build for production (tsc && vite build)
npm run lint         # Run type checking (tsc --noEmit)
```

### Inner Backend (from cursor-projects/DOT-Copilot/backend/)
```bash
npm run dev          # Start with nodemon and ts-node
npm run db:migrate   # Apply Prisma migrations
npm run db:seed      # Seed the database
npm test             # Run Jest test suites
```

### Inner Frontend (from cursor-projects/DOT-Copilot/frontend/)
```bash
npm run dev          # Start Vite dev server
npm run build        # Build for production
npm test             # Run Vitest test suites
```

### Docker Development
From `cursor-projects/DOT-Copilot/`:
```bash
docker compose -f docker-compose.dev.yml up -d
```

## Development Conventions

- **Multi-Tenancy:** Data is scoped by `fleet_id`. Always ensure queries respect fleet isolation (Row Level Security is used in Supabase).
- **Role-Based Access Control (RBAC):** Roles include `DRIVER`, `DRIVER_COACH`, `SUPERVISOR`, `BRANCH_MANAGER`, and `ADMIN`.
- **Commits:** Follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, etc.).
- **Branching:** Use prefixes like `feature/`, `fix/`, `docs/`.
- **Testing:** Mandatory for new features. Use Vitest for frontends and Jest for the backend.
- **Security:** Avoid hardcoded secrets. Use `.env` files (see `.env.example` in respective directories).

## Key Files & Directories
- `/src/`: Root frontend source code (React + Supabase).
- `/supabase/migrations/`: Database schema definitions for the root app.
- `/cursor-projects/DOT-Copilot/backend/`: Original Express/Prisma API.
- `/cursor-projects/DOT-Copilot/frontend/`: Original React frontend.
- `/scripts/`: Utility scripts for backups, infrastructure validation, and startup.
- `/docs/`: Architectural Decision Records (ADR) and compliance backlog.
- `CLAUDE.md`: Detailed technical guidance for the monorepo.
- `INFRASTRUCTURE_ARCHITECTURE.md`: High-level system diagrams.
- `OPERATIONAL_HANDBOOK.md`: Maintenance and operations procedures.
