# AGENTS.md

## Repository map

| Path | Purpose |
| --- | --- |
| `src/` | Canonical React 19 + Vite frontend. Tests live beside source as `*.test.ts(x)`. |
| `public/` | Static assets for the canonical frontend. |
| `server/` | Root application server helpers. |
| `supabase/` | Supabase migrations and Edge Functions for the root application. |
| `cursor-projects/DOT-Copilot/backend/` | Canonical Express + Prisma API; Jest tests are in `__tests__/`. |
| `cursor-projects/DOT-Copilot/frontend/` | Deprecated React frontend. It remains covered by CI until removal. |
| `cursor-projects/dobeuinfo/` | Independent React + Vite application with its own lockfile. |
| `database/` | Database setup and migration documentation. |
| `scripts/` | Startup, backup/restore, infrastructure, and automation scripts. |
| `docker/` | Shared Docker services, nginx, and monitoring configuration. |
| `docs/` | Architecture decisions and compliance documentation. |
| `.github/workflows/` | CI, security scanning, and deployment workflows. |

Each package has a separate dependency tree and `package-lock.json`. Use Node.js 20, which is the version used by CI.

## Setup and development

### Canonical root app

From the repository root:

```bash
npm ci
npm --prefix cursor-projects/DOT-Copilot/backend ci
cp .env.example .env
cp cursor-projects/DOT-Copilot/backend/.env.example cursor-projects/DOT-Copilot/backend/.env
docker compose -f cursor-projects/DOT-Copilot/docker-compose.dev.yml up -d
npm --prefix cursor-projects/DOT-Copilot/backend run db:migrate
npm --prefix cursor-projects/DOT-Copilot/backend run db:seed
npm run dev
```

- The development Compose file starts PostgreSQL 16 on port `5432`.
- `npm run dev` starts the Express backend on port `3001` and the root Vite frontend on port `5000`.
- Set required database/JWT values in the copied backend `.env`; never commit `.env` files.

```bash
npm run build
npm run preview
```

### Backend only

From `cursor-projects/DOT-Copilot/backend/`:

```bash
npm ci
cp .env.example .env
npm run db:migrate
npm run db:seed
npm run dev
npm run build
npm start
```

`npm start` runs the compiled `dist/server.js`; run `npm run build` first.

### Deprecated inner frontend

From `cursor-projects/DOT-Copilot/frontend/`:

```bash
npm ci
cp .env.example .env
npm run dev
npm run build
npm run preview
```

### Dobeu.info

From `cursor-projects/dobeuinfo/`:

```bash
npm ci
npm run dev
npm run build
npm run preview
```

This package defines no lint or test script.

## Tests

### Root frontend (Vitest)

From the repository root:

```bash
npm test
npm run test:watch
npm test -- src/utils/csv.test.ts
npm test -- src/utils/csv.test.ts -t "test name"
```

### Backend (Jest)

From `cursor-projects/DOT-Copilot/backend/`:

```bash
npm test
npm run test:watch
npm run test:coverage
npm test -- __tests__/password.test.ts
npm test -- -t "test name"
```

Database-backed suites require PostgreSQL plus the values documented in `backend/.env.example`.

### Deprecated inner frontend (Vitest)

From `cursor-projects/DOT-Copilot/frontend/`:

```bash
npm test
npm run test:watch
npm run test:coverage
npm test -- src/__tests__/Button.test.tsx
npm test -- src/__tests__/Button.test.tsx -t "test name"
```

## Before committing

Run checks in every affected package:

```bash
# Canonical root frontend
npm run lint
npm test
npm run build

# Backend
npm --prefix cursor-projects/DOT-Copilot/backend run lint
npm --prefix cursor-projects/DOT-Copilot/backend test
npm --prefix cursor-projects/DOT-Copilot/backend run build

# Deprecated inner frontend
npm --prefix cursor-projects/DOT-Copilot/frontend run lint
npm --prefix cursor-projects/DOT-Copilot/frontend test
npm --prefix cursor-projects/DOT-Copilot/frontend run build

# Dobeu.info, when changed
npm --prefix cursor-projects/dobeuinfo run build
```

The three `lint` scripts run `tsc --noEmit`. No formatter script or formatter configuration is currently defined; do not invent a formatting command.

## Pull requests

- Branch names: `<prefix>/<kebab-case-summary>`.
- Supported prefixes: `feature/`, `fix/`, `docs/`, `refactor/`, `test/`, `hotfix/`, and `infra/`.
- Commits use Conventional Commits: `<type>(<optional-scope>): <description>`.
- Commit types documented in this repository: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`, `ci`, and `build`.
- Open a pull request; do not force-push or delete `main`.
- PRs targeting `main` or `develop` must keep all applicable checks green:
  - `Canonical Frontend (Root)`: lint, test, build.
  - `Backend Lint & Test`: Prisma generate/migrate, lint, test, build.
  - `Inner frontend Lint & Test`: lint, test, build.
  - `Analyze (JavaScript/TypeScript)`: CodeQL analysis.
  - `dependency-review`: dependency review.
- PRs targeting `main` also run the Azure build/test and preview-deployment workflow.
- GitHub's current `main` ruleset does not name required status checks. Treat the workflows above as merge gates and do not merge with an applicable failure.
