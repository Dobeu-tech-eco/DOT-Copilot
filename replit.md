# DOT-Copilot — Fleet Driver Training Management Platform

## Overview
A React + Vite single-page application for managing fleet driver onboarding, training (video, PDF, quizzes), compliance tracking (CDL, medical cards), and fleet oversight. Designed for FMCSA/DOT regulatory adherence.

## Tech Stack
- **Frontend:** React 19, TypeScript 5.7, Vite 6, Tailwind CSS 3.4
- **State Management:** Zustand 5
- **Routing:** React Router 7
- **Charts:** Recharts
- **Icons:** Lucide React
- **Database/Auth:** Supabase (@supabase/supabase-js)
- **Package Manager:** npm

## Project Structure
```
/
├── src/
│   ├── App.tsx              # Root component with routing
│   ├── main.tsx             # Entry point
│   ├── index.css            # Global styles + Tailwind component classes
│   ├── components/
│   │   ├── Layout.tsx       # Sidebar nav + header layout shell
│   │   ├── Modal.tsx        # Reusable overlay modal (sizes, ESC key, backdrop click)
│   │   ├── FormFields.tsx   # Reusable form inputs (TextInput, SelectInput, DateInput, TextArea, CheckboxInput)
│   │   ├── StatusBadge.tsx  # ComplianceBadge, AssignmentBadge, PriorityBadge
│   │   ├── StatsCard.tsx    # Dashboard stat card
│   │   ├── EmptyState.tsx   # Empty state with optional CTA
│   │   └── LoadingSpinner.tsx
│   ├── pages/
│   │   ├── LoginPage.tsx    # Login with demo bypass
│   │   ├── DashboardPage.tsx # Fleet overview dashboard with charts
│   │   ├── UsersPage.tsx    # User management (full CRUD)
│   │   ├── VehiclesPage.tsx # Fleet vehicles (full CRUD, driver assignment)
│   │   ├── CompliancePage.tsx # Compliance records + driver documents (full CRUD)
│   │   ├── TrainingPage.tsx # Training programs + assignments (full CRUD)
│   │   ├── SettingsPage.tsx # Company profile/fleet configuration
│   │   └── NotFoundPage.tsx
│   ├── store/
│   │   ├── authStore.ts     # Auth state + demo login bypass (jeremyw/3938)
│   │   ├── appStore.ts      # Full CRUD state management + demo mode detection
│   │   └── demoData.ts      # Rich sample data (Baldor fleet, 10 users, 6 vehicles, etc.)
│   ├── lib/
│   │   └── supabase.ts      # Supabase client with placeholder fallbacks
│   └── types/
│       └── database.ts      # TypeScript type definitions for all entities
├── vite.config.ts           # Vite config (host: 0.0.0.0, port: 5000, allowedHosts: true)
├── tailwind.config.js       # Tailwind configuration with baldor color palette
├── tsconfig.json            # TypeScript configuration
└── index.html               # HTML entry point
```

## Demo Mode
- **Login:** username `jeremyw`, password `3938`
- Demo mode is auto-detected when `VITE_SUPABASE_URL` is missing or placeholder
- All CRUD operations work in-memory (no Supabase calls)
- Rich sample data: Baldor Food Company fleet with 10 users, 6 vehicles, 6 compliance requirements, 8 compliance records, 8 documents, 6 training programs, 8 assignments

## CSS Utilities
Global component classes defined in `src/index.css`:
- `.btn-primary`, `.btn-secondary`, `.btn-danger` — Button styles
- `.card` — Card container
- `.input-field` — Form input styling
- `.badge`, `.badge-success`, `.badge-warning`, `.badge-danger`, `.badge-info`, `.badge-neutral` — Status badges

## Development
- **Start:** `npm run dev` (runs on port 5000)
- **Build:** `npm run build` (outputs to `dist/`)
- **Type check:** `npx tsc --noEmit`

## Workflow
- Workflow: "Start application" → `npm run dev` → port 5000 (webview)

## Deployment
- Target: static
- Build: `npm run build`
- Public dir: `dist`

## Routes
- `/` — Login page
- `/dashboard` — Main dashboard with stats & charts (protected)
- `/compliance` — Compliance records + driver documents with CRUD (protected)
- `/training` — Training programs + assignments with CRUD (protected)
- `/vehicles` — Fleet vehicles with CRUD + driver assignment (protected)
- `/users` — User management with CRUD (protected, ADMIN/BRANCH_MANAGER only)
- `/settings` — Company/fleet configuration (protected, ADMIN only)
- `/notifications` — Notifications (protected, renders DashboardPage)

## Key Architecture Decisions
- All state managed via Zustand stores (authStore for auth, appStore for all entity CRUD)
- Demo mode bypasses Supabase entirely — isDemoMode() checks env vars
- CRUD operations use local state mutations in demo mode, Supabase in live mode
- Dashboard loads all data first (profiles, vehicles, assignments, compliance, documents) before computing stats
- Modal and FormFields are reusable components shared across all CRUD pages
