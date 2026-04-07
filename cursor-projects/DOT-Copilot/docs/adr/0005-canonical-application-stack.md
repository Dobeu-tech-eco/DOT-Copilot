# ADR 0005: Canonical application stack (decision required)

## Status

Proposed — **product must choose** one primary spine before further production investment.

## Context

The monorepo currently contains:

- **Root** `src/`: React 19 + Vite + Supabase client + PostgreSQL migrations under `supabase/migrations/`.
- **Inner** `cursor-projects/DOT-Copilot/backend`: Express + Prisma + JWT API.
- **Inner** `cursor-projects/DOT-Copilot/frontend`: Legacy React + Axios client.
- **Repo** `docker/`: FastAPI + MCP gateway + compose stack **not** aligned with Azure production path for the inner app.

Running two authoritative databases and two first-class frontends doubles migrations, auth models, and CI surface area.

## Decision (to be confirmed)

**Option A — Supabase + root `src/` as system of record**  
- Production: host root SPA; data and RLS in Supabase.  
- Retire or narrow inner Express to a **BFF** only where server secrets are required (email, webhooks, long jobs), or replace with Supabase Edge Functions.  
- Inner Prisma schema becomes read-only legacy or is dropped after migration.

**Option B — Express + Prisma + inner frontend as system of record**  
- Production: Azure App Service + Static Web Apps per existing IaC.  
- Root `src/` is deprecated or merged into inner frontend.  
- Supabase project is retired after data/auth migration.

## Local development (until decision lands)

- **Inner API + Postgres:** from [`cursor-projects/DOT-Copilot`](..), use `docker-compose.dev.yml` (or documented equivalent) for database only, then `npm run dev` in `backend/`.  
- **Root SPA:** from repo root, `npm run dev` with `VITE_SUPABASE_*` env vars.  
- **Avoid** treating repo-root `docker/docker-compose.yml` as required for DOT-Copilot unless explicitly adopting that stack (see `docker/DEPRECATED-STACK.md`).

## Consequences

- CI at repo `.github/workflows/ci.yml` builds **both** root and inner paths until one stack is retired.  
- Agent and MCP features must target the **chosen** API and tenancy model only.

## Links

- `outputs/deepresearch-fleet-lms.md` (repo root)  
- `CLAUDE.md` (repo root)
