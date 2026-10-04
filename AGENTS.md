# AGENTS.md

## Repository map

- `src/` — canonical React 19/Vite frontend; tests live beside source as `*.test.ts(x)`.
- `src/test/` — shared Vitest setup for the canonical frontend.
- `public/` — static assets for the canonical frontend.
- `cursor-projects/DOT-Copilot/backend/` — canonical Express/Prisma API; Jest tests are in `__tests__/`.
- `cursor-projects/DOT-Copilot/backend/prisma/` — Prisma schema, migrations, and seed script.
- `cursor-projects/DOT-Copilot/frontend/` — deprecated frontend; CI still builds and tests it.
- `cursor-projects/DOT-Copilot/infrastructure/` — Azure Bicep infrastructure.
- `cursor-projects/DOT-Copilot/docs/` — API/platform documentation and ADRs.
- `cursor-projects/DOT-Copilot/mcp-gateway/` — Python/FastAPI MCP gateway.
- `cursor-projects/dobeuinfo/` — independent React/Vite application.
- `supabase/migrations/`, `supabase/functions/` — Supabase migrations and edge functions.
- `scripts/` — repository startup, backup, restore, and infrastructure validation scripts.
- `database/` — database connection and migration documentation.
- `docs/` — repository-wide architecture, migration, and operations documentation.
- `docker/` — shared-service, gateway, monitoring, and nginx configuration.
- `.github/workflows/` — CI, security scanning, dependency review, and deployment workflows.
- `_archive/` — archived code; excluded from the root ESLint configuration.

This repository does not declare npm workspaces. Run each command from the package directory shown. Prefer `npm ci`; every active npm package has a committed lockfile. CI uses Node.js 20 and PostgreSQL 16.

## Initial setup

Install the canonical frontend and backend:

```bash
# Repository root
cp .env.example .env
npm ci

cd cursor-projects/DOT-Copilot/backend
cp .env.example .env
npm ci
cd ../../..
```

For the root frontend, set `FRONTEND_URL=http://localhost:5000` in `cursor-projects/DOT-Copilot/backend/.env`; the example still uses the deprecated frontend's port `5173`.

Start PostgreSQL and initialize the development database:

```bash
docker compose -f cursor-projects/DOT-Copilot/docker-compose.dev.yml up -d postgres

cd cursor-projects/DOT-Copilot/backend
npm run db:migrate
npm run db:seed
cd ../../..
```

Create the test database once when backend integration tests need it:

```bash
docker compose -f cursor-projects/DOT-Copilot/docker-compose.dev.yml exec postgres \
  createdb -U postgres dot_copilot_test
```

`db:migrate` runs `prisma migrate dev` and can create a migration when the schema changed. Review generated migrations before committing.

## Package commands

### Canonical app: repository root

`npm run dev` starts the backend on port `3001` and the root frontend on port `5000`. Install backend dependencies and create its `.env` first.

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

Do not add new features here unless the task explicitly targets it or CI compatibility requires a change.

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

### MCP gateway

```bash
cd cursor-projects/DOT-Copilot/mcp-gateway
python -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

No build, lint, format, or test command is defined for the MCP gateway.

## Tests

### Canonical frontend

```bash
# All tests or watch mode
npm test
npm run test:watch

# One file
npm test -- src/utils/csv.test.ts

# One named test
npm test -- src/utils/csv.test.ts -t "renders null and undefined"
```

### Canonical backend

The full suite expects PostgreSQL at `localhost:5432` with a `dot_copilot_test` database. Jest supplies default test JWT secrets and the test database URL; CI applies Prisma migrations before testing.

```bash
cd cursor-projects/DOT-Copilot/backend

# Prepare the test schema and run all tests
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/dot_copilot_test?schema=public \
  npx prisma migrate deploy
npm test

# Watch mode or coverage
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

npm test
npm run test:watch
npm run test:coverage

# One file or one named test
npm test -- src/__tests__/Button.test.tsx
npm test -- src/__tests__/Button.test.tsx -t "calls onClick"
```

## Before committing

- TypeScript strict mode is enabled in the root frontend, backend, and deprecated inner frontend.
- The `lint` scripts run TypeScript type-checking with `tsc --noEmit`.
- No package defines a formatter command. Match the quoting and semicolon style of edited files; do not claim formatting was run unless a formatter command is added.
- Run the checks for every package changed:

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

## Pull requests

- Branch names: `feature/<topic>`, `fix/<topic>`, `docs/<topic>`, `refactor/<topic>`, or `test/<topic>`.
- Commits: Conventional Commits — `<type>(<optional-scope>): <description>`.
- Documented commit types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, and `chore`.
- Add or update tests for behavior changes.
- PRs targeting `main` or `develop` run CI, CodeQL, and dependency review. Keep these checks green:
  - `CI / Canonical Frontend (Root)` — install, lint, test, and build.
  - `CI / Backend Lint & Test` — Prisma generate/migrate, lint, test, and build against PostgreSQL 16.
  - `CI / Inner frontend Lint & Test` — install, lint, test, and build.
  - `CodeQL / Analyze (JavaScript/TypeScript)`.
  - `Dependency Review / dependency-review`.
- PRs targeting `main` also run the `Deploy to Azure` workflow, including build, deployment, and health-check jobs.
- GitHub's active repository rules do not currently configure merge-required status checks; the workflow checks above are the project acceptance bar.
