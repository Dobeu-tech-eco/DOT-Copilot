# AGENTS.md

DOT-Copilot is a fleet driver training and DOT/FMCSA compliance platform. Canonical UI is the root React app; the API is Express + Prisma under `cursor-projects/DOT-Copilot/backend/`.

## Where code lives

- `src/` — canonical UI (React 19, Vite 6, Zustand). Entry: `src/main.tsx`. Alias `@/*` → `src/*`.
- `cursor-projects/DOT-Copilot/backend/` — canonical API. Schema: `backend/prisma/schema.prisma`.
- `supabase/migrations/` — Supabase Postgres and RLS. Connection notes: `database/`.
- `cursor-projects/DOT-Copilot/frontend/` — deprecated inner UI. Do not extend it.
- `cursor-projects/DOT-Copilot/infrastructure/azure/` — Bicep. CI: `.github/workflows/ci.yml` (Node 20).

## Install, test, lint, build

`npm ci` in each tree. Verified 2026-10-21 on Node v22.23.3. Every command below passed.

Root (`/`): `npm test` (vitest, 33 passed / 0 failed), `npm run lint` (`tsc --noEmit`), `npm run build` (`tsc && vite build`). Dev script is `npm run dev` (`scripts/start.mjs`).

Backend (`cursor-projects/DOT-Copilot/backend/`): set `DATABASE_URL`, then `npx prisma generate`, then `npm test` (jest, 49 passed / 0 failed), `npm run lint` (`tsc --noEmit`), `npm run build` (`tsc`). Tests mock Prisma and did not need a live database. Dev script is `npm run dev`.

## Config and env (names only)

Full contracts: `.env.example`, `cursor-projects/DOT-Copilot/.env.example`, `cursor-projects/DOT-Copilot/backend/.env.example`, `cursor-projects/DOT-Copilot/frontend/.env.example`, `docker/.env.example`. Never commit `.env` or print values.

App names: `DATABASE_URL`, `PORT`, `NODE_ENV`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `JWT_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`, `FRONTEND_URL`, `VITE_API_URL` (root UI), `VITE_API_BASE_URL` (inner app and Docker), `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`, `REDIS_URL`, `ENABLE_DOCS`.

Optional service names in those files: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_S3_BUCKET`, `AZURE_STORAGE_CONNECTION_STRING`, `AZURE_STORAGE_CONTAINER`, `AZURE_SUBSCRIPTION_ID`, `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `SENTRY_DSN`, `APPINSIGHTS_INSTRUMENTATIONKEY`, `APPLICATIONINSIGHTS_CONNECTION_STRING`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `FCM_SERVER_KEY`, `COMPOSIO_API_KEY`, `SLACK_ADMIN_CHANNEL`. `docker/.env.example` also names Postgres, Mongo, Auth0, Grafana, and gateway keys.

## Project rules

- Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`). Branches: `feature/`, `fix/`, `docs/`, `refactor/`, `test/`.
- TypeScript strict. Root `tsconfig.json` also sets `noUnusedLocals` and `noUnusedParameters`.
- Data is scoped by `fleet_id`. Roles: `DRIVER`, `DRIVER_COACH`, `SUPERVISOR`, `BRANCH_MANAGER`, `ADMIN`.

## Working rules

- Define done-when before starting.
- Fill the Change receipt section of the PR template in every PR (the org default template provides it).
- After 3 failed review or fix rounds on the same PR, stop and escalate to Jeremy instead of looping.
- When the same mistake happens twice, add a check, test, or written rule.
- Never print secrets.
- Never deploy or touch production without Jeremy's approval.

Official Rule 8: https://drive.google.com/file/d/17vTVg_M8SnyajgiILv1XN-fC-75Q54wI/view
