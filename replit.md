# DOT-Copilot — Fleet Driver Training Management Platform

## Overview
A React + Vite single-page application backed by an Express.js API server with PostgreSQL (Prisma ORM). Manages fleet driver onboarding, training (video, PDF, quizzes), compliance tracking (CDL, medical cards), and fleet oversight. Designed for FMCSA/DOT regulatory adherence.

## Tech Stack
- **Frontend:** React 19, TypeScript 5.7, Vite 6, Tailwind CSS 3.4
- **State Management:** Zustand 5
- **Routing:** React Router 7
- **Charts:** Recharts
- **Icons:** Lucide React
- **Backend:** Express.js (TypeScript, ts-node)
- **Database:** PostgreSQL via Prisma 5
- **Auth:** JWT access + refresh tokens (bcrypt password hashing)
- **Package Manager:** npm

## Project Structure
```
/
├── src/                          # Frontend (React + Vite)
│   ├── App.tsx                   # Root component with routing
│   ├── main.tsx                  # Entry point
│   ├── index.css                 # Global styles + Tailwind component classes
│   ├── components/
│   │   ├── Layout.tsx            # Sidebar nav + header layout shell
│   │   ├── Modal.tsx             # Reusable overlay modal
│   │   ├── FormFields.tsx        # Reusable form inputs
│   │   ├── StatusBadge.tsx       # ComplianceBadge, AssignmentBadge, PriorityBadge
│   │   ├── StatsCard.tsx         # Dashboard stat card
│   │   ├── EmptyState.tsx        # Empty state with optional CTA
│   │   └── LoadingSpinner.tsx
│   ├── pages/
│   │   ├── LoginPage.tsx         # Login (JWT auth to backend)
│   │   ├── DashboardPage.tsx     # Fleet overview dashboard with charts
│   │   ├── UsersPage.tsx         # User management (full CRUD)
│   │   ├── VehiclesPage.tsx      # Fleet vehicles (full CRUD, driver assignment)
│   │   ├── CompliancePage.tsx    # Compliance records + driver documents (full CRUD)
│   │   ├── TrainingPage.tsx      # Training programs + assignments (full CRUD)
│   │   ├── SettingsPage.tsx      # Company profile/fleet configuration
│   │   └── NotFoundPage.tsx
│   ├── store/
│   │   ├── authStore.ts          # Auth state (JWT login/logout/refresh)
│   │   ├── appStore.ts           # Full CRUD state management via API client
│   │   └── demoData.ts           # Rich sample data (opt-in via VITE_DEMO_MODE=true)
│   ├── lib/
│   │   └── api.ts                # Fetch-based API client with JWT auth + auto-refresh
│   └── types/
│       └── database.ts           # TypeScript type definitions for all entities
├── cursor-projects/DOT-Copilot/backend/   # Backend (Express.js)
│   ├── src/
│   │   ├── server.ts             # Express server entry (port 3001)
│   │   ├── db.ts                 # Prisma client singleton
│   │   ├── routes/
│   │   │   ├── auth.ts           # Login, register, logout, refresh, password reset
│   │   │   ├── users.ts          # User CRUD + /me endpoint
│   │   │   ├── fleets.ts         # Fleet management
│   │   │   ├── training.ts       # Training programs CRUD
│   │   │   ├── assignments.ts    # Assignment CRUD
│   │   │   ├── compliance.ts     # Compliance requirements + driver compliance
│   │   │   ├── documents.ts      # Driver documents CRUD
│   │   │   └── driverStats.ts    # Driver statistics
│   │   ├── middleware/
│   │   │   └── auth.ts           # JWT auth + role-based access control
│   │   ├── utils/
│   │   │   ├── jwt.ts            # Token generation, verification, blacklisting
│   │   │   ├── email.ts          # Email service (console logging in dev)
│   │   │   └── logger.ts         # Structured logging utility
│   │   └── schemas/              # Zod validation schemas
│   └── prisma/
│       ├── schema.prisma         # Database schema (User, Fleet, Training, etc.)
│       └── seed.ts               # Seed script (admin/supervisor/driver test users)
├── scripts/
│   └── start.mjs                 # Dev startup script (backend + Vite)
├── vite.config.ts                # Vite config (proxy /api → localhost:3001)
├── tailwind.config.js            # Tailwind configuration with baldor color palette
├── tsconfig.json                 # TypeScript configuration
└── index.html                    # HTML entry point
```

## Authentication
- JWT access tokens (15min) + refresh tokens (7d)
- Tokens stored in localStorage, attached via Bearer header
- Auto-refresh on 401 TOKEN_EXPIRED responses
- Token blacklisting on logout
- Password hashing with bcrypt (12 rounds)
- Dev-only demo bypass: username `jeremyw`, password `3938`

## Demo Mode
- Opt-in via `VITE_DEMO_MODE=true` environment variable
- All CRUD operations work in-memory (no API calls)
- Rich sample data: Baldor Food Company fleet with 10 users, 6 vehicles, etc.

## Test Credentials (Development)
- Admin: `admin@example.com` / `admin123456`
- Supervisor: `supervisor@example.com` / `supervisor123`
- Driver: `driver@example.com` / `driver123456`

## CSS Utilities
Global component classes defined in `src/index.css`:
- `.btn-primary`, `.btn-secondary`, `.btn-danger` — Button styles
- `.card` — Card container
- `.input-field` — Form input styling
- `.badge`, `.badge-success`, `.badge-warning`, `.badge-danger`, `.badge-info`, `.badge-neutral` — Status badges

## Development
- **Start:** `npm run dev` (starts backend on 3001 + Vite on 5000)
- **Build:** `npm run build` (frontend only, outputs to `dist/`)
- **Type check:** `npx tsc --noEmit`
- **Backend only:** `cd cursor-projects/DOT-Copilot/backend && npx ts-node src/server.ts`
- **DB push:** `cd cursor-projects/DOT-Copilot/backend && npx prisma db push`
- **DB seed:** `cd cursor-projects/DOT-Copilot/backend && npx ts-node prisma/seed.ts`

## Workflow
- Workflow: "Start application" → `npm run dev` → backend port 3001 + frontend port 5000 (webview)

## API Proxy
- Vite proxies `/api/*` and `/health` to `http://localhost:3001`
- Frontend uses relative URLs (`/api/auth/login`, `/api/users/me`, etc.)

## Routes
- `/` — Login page
- `/dashboard` — Main dashboard with stats & charts (protected)
- `/compliance` — Compliance records + driver documents with CRUD (protected)
- `/training` — Training programs + assignments with CRUD (protected)
- `/vehicles` — Fleet vehicles with CRUD + driver assignment (protected)
- `/users` — User management with CRUD (protected, ADMIN/BRANCH_MANAGER only)
- `/settings` — Company/fleet configuration (protected, ADMIN only)

## Key Architecture Decisions
- Prisma v5 (not v7) — v7 has breaking constructor API changes
- Backend returns snake_case JSON for frontend compatibility with `database.ts` types
- Frontend API client (`src/lib/api.ts`) handles camelCase↔snake_case normalization
- All state managed via Zustand stores (authStore for auth, appStore for all entity CRUD)
- Dashboard loads all data first then computes stats client-side
- Modal and FormFields are reusable components shared across all CRUD pages
- Vehicles are frontend-only (no backend model yet) — in-memory only
