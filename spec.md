# Spec: Cost Review + Code Review + CLI Reference + DB Migrations + Git Cleanup + ADRs + Automations

## Problem Statement

Nine developer-experience and architecture tasks need to be executed against the DOT-Copilot monorepo:

1. **Cost Review** (`/cost-review`) — Evaluate Azure IaC (Bicep) for over-provisioned or incorrectly sized resources; estimate savings; recommend right-sizing and serverless alternatives.
2. **Code Review** (`/reviewer`) — Senior-engineer audit of the latest diff (devcontainer changes + pending docs) for correctness, security, and convention issues.
3. **CLI Workflow** (`/cli-workflow`) — Comprehensive copy-pastable CLI reference covering local dev, test/lint, Azure deploy, and DB migrations for both Supabase and Prisma.
4. **Migration Create** (`/migration-create`) — New Supabase migration adding `btw_sessions` and `webhooks`/`webhook_deliveries` tables with RLS, indexes, and FK constraints.
5. **Migration Plan** (`/migration-plan`) — Phased plan for keeping Supabase and Prisma schemas in sync (or consolidating to one), with the first incremental step implemented.
6. **DB Migration** (`/db-migration`) — Backward-compatible Prisma migration adding the same BTW + webhook tables, with rollback plan and validation queries.
7. **Git Cleanup** (`/git-cleanup`) — Delete stale remote branches (50+ dependabot + merged feature branches) and propose a squash/reorder plan for recent `main` commits.
8. **Design Record** (`/design-record`) — Three new ADRs: ADR-0006 (canonical stack), ADR-0007 (token storage strategy), ADR-0008 (DB migration/sync strategy).
9. **Automation Plan** (`/automation-plan`) — Three Ona automation YAML stubs: nightly build+test, weekly stale branch cleanup, PR-triggered migration sync check.

**Output files:**
- `docs/cli-reference.md` — CLI workflow reference
- `supabase/migrations/<timestamp>_add_btw_sessions_and_webhooks.sql` — Supabase migration
- `cursor-projects/DOT-Copilot/backend/prisma/migrations/<timestamp>_add_btw_webhooks/migration.sql` — Prisma migration
- `docs/migration-plan.md` — Phased schema sync plan
- `cursor-projects/DOT-Copilot/docs/adr/0006-canonical-application-stack-decision.md`
- `cursor-projects/DOT-Copilot/docs/adr/0007-token-storage-strategy.md`
- `cursor-projects/DOT-Copilot/docs/adr/0008-db-migration-sync-strategy.md`
- `.ona/automations.yaml` — Three automation stubs
- Cost review and code review findings delivered as inline annotations

Outputs: `spec.md` drives the plan; code review findings are delivered as inline annotations; dotfiles recommendations and code tour narratives are written to dedicated markdown docs.

---

## Requirements

### 1. Cost Review (`/cost-review`)

Audit `cursor-projects/DOT-Copilot/infrastructure/azure/main.bicep` and parameter files:
- Identify over-provisioned resources (App Service `P1V2`, Postgres `Standard_D2s_v3`, Log Analytics `PerGB2018`)
- Estimate monthly cost delta for right-sizing alternatives
- Recommend serverless alternatives where applicable (e.g., Azure Container Apps vs App Service)
- Summarize trade-offs for each recommendation
- Deliver findings as inline code annotations on `main.bicep` and `parameters.prod.json`

### 2. Code Review (`/reviewer`)

Review the current diff (`.devcontainer/Dockerfile`, `.devcontainer/devcontainer.json`) plus the three pending docs files:
- Correctness: Dockerfile layer ordering, NVM PATH export, shell default
- Security: no secrets baked into image, Supabase CLI pinned version
- Convention: follows project Conventional Commits, devcontainer spec
- Deliver findings as inline code annotations

### 3. CLI Workflow Reference — `docs/cli-reference.md`

Five sections, all commands copy-pastable with one-line explanations and required env vars noted:

#### 3a. Local dev setup (from scratch)
Clone → install all three npm dep trees → configure `.env` files → start Docker services → start backend + frontend dev servers

#### 3b. Run tests + lint
Root frontend (`tsc --noEmit`, `vite build`), backend (`npm test`, `npm run test:coverage`, `tsc --noEmit`), inner frontend (`vitest run`, `tsc --noEmit`)

#### 3c. Deploy to Azure
Build artifacts → `az login` → App Service deploy → Static Web App deploy → staging slot swap

#### 3d. DB migrations — Prisma
`prisma migrate dev`, `prisma db push`, `prisma studio`, rollback with `prisma migrate resolve`

#### 3e. DB migrations — Supabase
`supabase migration new`, `supabase db push`, `supabase db reset`, `supabase status`

### 4. Supabase Migration — `supabase/migrations/<timestamp>_add_btw_sessions_and_webhooks.sql`

Add tables missing from Supabase that exist in Prisma schema:

**`btw_sessions`**
- `id` uuid PK, `fleet_id` uuid FK → `fleets`, `trainee_id` uuid FK → `profiles`, `trainer_id` uuid FK → `profiles`
- `session_date`, `start_time`, `end_time` timestamptz
- `total_minutes` int, `route_type` text, `vehicle_type` text, `vehicle_id` uuid nullable
- `skills_checklist` jsonb default `{}`
- `overall_rating` int (1–5), `trainer_notes` text, `areas_for_improvement` text
- `trainer_signature` text, `trainer_signed_at` timestamptz
- `trainee_signature` text, `trainee_signed_at` timestamptz
- `status` text default `'pending'` (pending | completed | cancelled)
- `created_at`, `updated_at` timestamptz

**`webhooks`**
- `id` uuid PK, `fleet_id` uuid FK → `fleets`
- `url` text NOT NULL, `secret` text, `events` text[] default `{}`
- `is_active` boolean default true
- `created_at`, `updated_at` timestamptz

**`webhook_deliveries`**
- `id` uuid PK, `webhook_id` uuid FK → `webhooks`
- `event_type` text, `payload` jsonb, `status_code` int
- `response_body` text, `delivered_at` timestamptz, `success` boolean
- `created_at` timestamptz

Requirements:
- RLS enabled on all three tables with fleet-scoped policies
- Indexes on `fleet_id`, `trainee_id`, `trainer_id`, `status`, `session_date`, `webhook_id`
- Timestamp naming: `YYYYMMDDHHMMSS_add_btw_sessions_and_webhooks.sql`
- Comments explaining non-obvious logic

### 5. Migration Plan — `docs/migration-plan.md`

Phased plan for Supabase ↔ Prisma schema synchronization:
- **Phase 0** (current): Two schemas diverging — document the gap
- **Phase 1** (this session): Add BTW + webhook tables to both systems
- **Phase 2**: Automated schema diff check on every PR (CI gate)
- **Phase 3**: Decision point — consolidate to one system per ADR-0008
- **Phase 4**: Deprecate the losing system with data migration scripts
- Include validation queries for each phase
- Implement Phase 1 (the actual migration files)

### 6. Prisma Migration — `cursor-projects/DOT-Copilot/backend/prisma/migrations/`

Backward-compatible migration adding the same BTW + webhook tables to Prisma:
- Create `migration.sql` with `CREATE TABLE IF NOT EXISTS` for `BtwSession`, `Webhook`, `WebhookDelivery`
- Match field names/types to existing Prisma schema conventions (camelCase model names, snake_case DB columns via `@map`)
- Include rollback plan (DROP TABLE statements in reverse dependency order)
- Include validation queries (row counts, FK integrity checks)
- Update `prisma/schema.prisma` with the new model definitions

### 7. Git Cleanup (`/git-cleanup`)

**Branch cleanup:**
- List all stale remote branches (merged dependabot + feature branches)
- Provide exact `git push origin --delete <branch>` commands for each
- Do NOT auto-execute — output commands for user review

**Commit history:**
- Inspect recent 15 commits on `main`
- Propose squash/reorder plan grouping related commits into logical units
- Provide exact `git rebase -i` commands
- Do NOT auto-execute — output plan for user review

### 8. Architecture Decision Records

Three new ADRs following the project template at `cursor-projects/DOT-Copilot/docs/adr/template.md`:

**ADR-0006** — `0006-canonical-application-stack-decision.md`
- Context: ADR-0005 left the Supabase vs Express/Prisma decision as "Proposed"
- Decision: Recommend Option A (Supabase as system of record) or Option B (Express/Prisma), with rationale
- Alternatives: both options from ADR-0005 plus hybrid BFF approach
- Consequences: migration path, CI changes, deprecation timeline

**ADR-0007** — `0007-token-storage-strategy.md`
- Context: JWT access + refresh tokens currently stored in `localStorage` (XSS risk flagged in code review)
- Decision: Move to memory-only access token + `HttpOnly` cookie refresh token
- Alternatives: localStorage (current), sessionStorage, HttpOnly cookies, silent refresh iframe
- Consequences: backend cookie endpoint changes, CORS config, mobile client impact

**ADR-0008** — `0008-db-migration-sync-strategy.md`
- Context: Supabase and Prisma schemas are diverging; no automated sync check exists
- Decision: Adopt a schema-first approach with Prisma as source of truth, generate Supabase migrations from Prisma introspection
- Alternatives: manual dual-maintenance (current), Supabase as source of truth, consolidate to one DB system
- Consequences: CI gate, tooling changes, Phase 2–4 of migration plan

### 9. Ona Automations — `.ona/automations.yaml`

Three automation stubs:

**Automation 1 — Nightly build + test**
- Trigger: schedule (nightly, e.g., 02:00 UTC)
- Actions: `tsc --noEmit` (root + backend + inner frontend), `npm test` (backend), `vitest run` (inner frontend)
- On failure: create a GitHub issue or send notification

**Automation 2 — Weekly stale branch cleanup**
- Trigger: schedule (weekly, Monday 06:00 UTC)
- Actions: list branches merged into `main` older than 14 days, delete them
- Guard: never delete `main`, `staging`, `bolt-dev`

**Automation 3 — PR migration sync check**
- Trigger: pull_request opened/synchronized
- Condition: any file in `supabase/migrations/` or `prisma/` changed
- Actions: run a diff check between Supabase schema and Prisma schema; fail PR if tables diverge

---

## Acceptance Criteria

- [ ] Cost review annotations on `main.bicep` covering App Service, Postgres, Log Analytics SKUs
- [ ] Code review annotations on `.devcontainer/Dockerfile` and `.devcontainer/devcontainer.json`
- [ ] `docs/cli-reference.md` exists with all five sections, all commands annotated
- [ ] `supabase/migrations/<timestamp>_add_btw_sessions_and_webhooks.sql` exists with RLS, indexes, FKs
- [ ] `docs/migration-plan.md` exists with 5-phase plan
- [ ] Prisma `migration.sql` + updated `schema.prisma` with BTW + webhook models
- [ ] Git cleanup commands output (branch list + rebase plan) — not auto-executed
- [ ] `cursor-projects/DOT-Copilot/docs/adr/0006-canonical-application-stack-decision.md` exists
- [ ] `cursor-projects/DOT-Copilot/docs/adr/0007-token-storage-strategy.md` exists
- [ ] `cursor-projects/DOT-Copilot/docs/adr/0008-db-migration-sync-strategy.md` exists
- [ ] `.ona/automations.yaml` exists with three automation stubs

---

## Implementation Approach

### Phase 1 — Cost Review + Code Review (annotations)
1. Read `main.bicep`, `parameters.prod.json`, `parameters.dev.json` — apply cost review annotations
2. Read `.devcontainer/Dockerfile`, `.devcontainer/devcontainer.json` — apply code review annotations

### Phase 2 — CLI Reference
3. Write `docs/cli-reference.md` with five sections

### Phase 3 — DB Migrations
4. Write Supabase migration SQL (`btw_sessions`, `webhooks`, `webhook_deliveries` with RLS + indexes)
5. Write Prisma `migration.sql` + update `prisma/schema.prisma` with new models
6. Write `docs/migration-plan.md` with 5-phase sync plan

### Phase 4 — Git Cleanup
7. List stale remote branches with delete commands (output only, no execution)
8. Propose commit squash/reorder plan with `git rebase -i` commands (output only)

### Phase 5 — ADRs
9. Write ADR-0006 (canonical stack decision)
10. Write ADR-0007 (token storage strategy)
11. Write ADR-0008 (DB migration sync strategy)

### Phase 6 — Automations
12. Write `.ona/automations.yaml` with three automation stubs
