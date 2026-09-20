# AGENTS.md

## Repository map

- `src/` — canonical React 19/Vite frontend; tests live beside source as `*.test.ts(x)`.
- `public/` — static assets for the canonical frontend.
- `cursor-projects/DOT-Copilot/backend/` — canonical Express/Prisma API; Jest tests are in `__tests__/` and the database schema is in `prisma/`.
- `cursor-projects/DOT-Copilot/frontend/` — deprecated frontend. Do not add new features here unless the task explicitly targets it; CI still builds and tests it.
- `cursor-projects/DOT-Copilot/infrastructure/` — Azure Bicep infrastructure.
- `cursor-projects/DOT-Copilot/docs/` — backend/platform documentation and ADRs.
- `cursor-projects/dobeuinfo/` — independent React/Vite application.
- `supabase/migrations/` and `supabase/functions/` — Supabase SQL migrations and edge functions.
- `scripts/` — repository startup, backup, restore, and infrastructure validation scripts.
- `database/` — database connection and migration documentation.
- `docs/` — repository-wide architecture, migration, and operations documentation.
- `.github/workflows/` — CI, security scanning, and deployment workflows.
- `_archive/` — archived code; excluded from the root ESLint configuration.

This repository does not declare npm workspaces. Run each command from the package directory shown below. Prefer `npm ci` because every active package has a committed lockfile. CI uses Node.js 20 and PostgreSQL 16.

## Initial setup

Install the canonical frontend and backend:

```bash
npm ci
cd cursor-projects/DOT-Copilot/backend
npm ci
cp .env.example .env
cd ../../..
```

Set `FRONTEND_URL=http://localhost:5000` in the backend `.env` when using the root frontend; the checked-in backend example still points at the deprecated frontend's port 5173.

Start the development PostgreSQL container and initialize the backend schema:

```bash
docker compose -f cursor-projects/DOT-Copilot/docker-compose.dev.yml up -d postgres
docker compose -f cursor-projects/DOT-Copilot/docker-compose.dev.yml exec postgres createdb -U postgres dot_copilot_test
cd cursor-projects/DOT-Copilot/backend
npm run db:migrate
npm run db:seed
cd ../../..
```

The `createdb` command is a one-time test-database setup; skip it when `dot_copilot_test` already exists.

`db:migrate` uses Prisma's development migration command and may create a migration when the schema has uncommitted changes. Review generated migrations before committing them.

## Package commands

### Canonical app: repository root

`npm run dev` starts both the canonical backend on port 3001 and the root Vite frontend on port 5000. Backend dependencies and `cursor-projects/DOT-Copilot/backend/.env` must already exist.

```bash
npm run dev
npm run build
npm run preview
npm run lint
```

### Canonical backend

```bash
cd cursor-projects/DOT-Copilot/backend
npm run dev
npm run build
npm start
npm run lint
npm run db:migrate
npm run db:push
npm run db:seed
```

### Deprecated inner frontend

```bash
cd cursor-projects/DOT-Copilot/frontend
npm ci
npm run dev
npm run build
npm run preview
npm run lint
```

### `dobeuinfo`

```bash
cd cursor-projects/dobeuinfo
npm ci
npm run dev
npm run build
npm run preview
```

No lint, format, or test script is defined for `dobeuinfo`.

## Tests

### Canonical frontend

```bash
# All tests
npm test

# Watch mode
npm run test:watch

# One file
npm test -- src/utils/csv.test.ts

# One named test
npm test -- src/utils/csv.test.ts -t "renders null and undefined"
```

### Canonical backend

The full suite expects PostgreSQL at `localhost:5432` with a `dot_copilot_test` database. Jest supplies default test JWT secrets and the test database URL; CI runs Prisma migrations before the suite.

```bash
cd cursor-projects/DOT-Copilot/backend

# Prepare the test database, then run all tests
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/dot_copilot_test?schema=public npx prisma migrate deploy
npm test

# Watch or coverage
npm run test:watch
npm run test:coverage

# One file
npm test -- __tests__/password.test.ts

# One named test
npm test -- __tests__/password.test.ts -t "should verify correct password"
```

### Deprecated inner frontend

```bash
cd cursor-projects/DOT-Copilot/frontend

# All tests, watch mode, or coverage
npm test
npm run test:watch
npm run test:coverage

# One file
npm test -- src/__tests__/Button.test.tsx

# One named test
npm test -- src/__tests__/Button.test.tsx -t "calls onClick"
```

## Before committing

Run the checks for every package changed:

```bash
# Canonical frontend
npm run lint && npm test && npm run build

# Canonical backend
cd cursor-projects/DOT-Copilot/backend
npm run lint && npm test && npm run build

# Deprecated inner frontend, when touched
cd cursor-projects/DOT-Copilot/frontend
npm run lint && npm test && npm run build

# dobeuinfo, when touched
cd cursor-projects/dobeuinfo
npm run build
```

The `lint` scripts currently run TypeScript type-checking with `tsc --noEmit`. No package defines a formatter script; do not claim formatting was run unless an explicit formatter command is added.

## Pull requests

- Branch names: `feature/<topic>`, `fix/<topic>`, `docs/<topic>`, `refactor/<topic>`, or `test/<topic>`.
- Commits: Conventional Commits — `<type>(<optional-scope>): <description>`.
- Allowed documented types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, and `chore`.
- Open PRs against `main` or `develop`; both branches run the normal CI and security workflows.
- Keep these PR checks green:
  - `CI / Canonical Frontend (Root)` — install, lint, test, build.
  - `CI / Backend Lint & Test` — Prisma generate/migrate, lint, test, build against PostgreSQL 16.
  - `CI / Inner frontend Lint & Test` — install, lint, test, build.
  - `CodeQL / Analyze (JavaScript/TypeScript)`.
  - `Dependency Review / dependency-review`.
- PRs to `main` also trigger `Deploy to Azure`; its `build-test` job rebuilds the canonical frontend and backend before preview deployment.
- Update or add tests for behavior changes. Keep changes out of the deprecated inner frontend unless required by the task or needed to keep its CI check passing.
