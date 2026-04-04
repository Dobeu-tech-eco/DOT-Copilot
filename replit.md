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
│   ├── index.css            # Global styles
│   ├── components/          # Shared UI components (Layout, LoadingSpinner, etc.)
│   ├── pages/               # Route-level pages (Dashboard, Compliance, Training, Vehicles, Users)
│   ├── store/               # Zustand state stores (authStore, etc.)
│   ├── lib/                 # Utility libraries
│   └── types/               # TypeScript type definitions
├── vite.config.ts           # Vite config (host: 0.0.0.0, port: 5000)
├── tailwind.config.js       # Tailwind configuration
├── tsconfig.json            # TypeScript configuration
└── index.html               # HTML entry point
```

## Development
- **Start:** `npm run dev` (runs on port 5000)
- **Build:** `npm run build` (outputs to `dist/`)
- **Type check:** `npm run lint`

## Workflow
- Workflow: "Start application" → `npm run dev` → port 5000 (webview)

## Deployment
- Target: static
- Build: `npm run build`
- Public dir: `dist`

## Routes
- `/` — Login page
- `/dashboard` — Main dashboard (protected)
- `/compliance` — Compliance tracking (protected)
- `/training` — Training management (protected)
- `/vehicles` — Vehicles management (protected)
- `/users` — User management (protected)
- `/notifications` — Notifications (protected, renders DashboardPage)
