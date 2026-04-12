# DB Migration Plan — Supabase ↔ Prisma Schema Synchronization

## Context

DOT-Copilot currently maintains two parallel database schemas:

| System | Location | Auth | Used by |
|---|---|---|---|
| **Supabase** | `supabase/migrations/` | Supabase Auth (JWT via `auth.uid()`) | Root frontend (`src/`) |
| **Prisma** | `cursor-projects/DOT-Copilot/backend/prisma/` | Custom JWT (bcrypt + jsonwebtoken) | Inner backend (Express API) |

Both target PostgreSQL but use different connection methods, auth models, and migration tooling. ADR-0005 (proposed, unresolved) documents the decision to consolidate — until that decision lands, both schemas must be kept in sync manually.

This document defines the phased plan to close the current gap and prevent future drift.

---

## Current Schema Gap (as of 2026-04-10)

Tables present in **Prisma** but **missing from Supabase**:

| Table | Prisma model | Notes |
|---|---|---|
| `btw_sessions` | `BtwSession` | BTW training sessions with dual signatures |
| `webhooks` | `Webhook` | Fleet webhook registrations |
| `webhook_deliveries` | `WebhookDelivery` | Delivery attempt log |
| `password_reset_tokens` | `PasswordResetToken` | Custom auth; not needed in Supabase (uses built-in auth) |
| `training_program_translations` | `TrainingProgramTranslation` | i18n; low priority |
| `scheduled_reports` | `ScheduledReport` | Reporting; low priority |
| `training_triggers` | `TrainingTrigger` | Automation; low priority |
| `reminders` | `Reminder` | Notification scheduling |
| `devices` | `Device` | Push notification tokens |

Tables present in **Supabase** but **missing from Prisma**:

| Table | Notes |
|---|---|
| `audit_logs` | Exists in both — field names differ slightly |
| `driver_stats` | Exists in both — field names differ slightly |

Field-level differences (same table, different columns):

| Table | Supabase | Prisma | Notes |
|---|---|---|---|
| `btw_sessions` | has `fleet_id` | was missing `fleet_id` | Fixed in this session |
| `webhooks` | `events text[]` | `events WebhookEventType[]` | Type mismatch — Prisma uses enum array |
| `profiles` | `id` = auth.users FK | `id` = cuid() | Auth model difference |

---

## Phase 0 — Document the Gap (complete)

✅ Gap documented above.
✅ ADR-0005 written (canonical stack decision pending).

---

## Phase 1 — Close the Critical Gap (this session)

**Goal:** Add the three highest-priority missing tables to both systems.

### Deliverables (completed)

- `supabase/migrations/20260410232616_add_btw_sessions_and_webhooks.sql`
  - Adds `btw_sessions`, `webhooks`, `webhook_deliveries` to Supabase
  - RLS policies, indexes, FK constraints included

- `cursor-projects/DOT-Copilot/backend/prisma/migrations/20260410232616_add_btw_webhooks/migration.sql`
  - Adds same three tables to Prisma-managed Postgres
  - Adds `fleet_id` to `BtwSession` (was missing from original model)

- `cursor-projects/DOT-Copilot/backend/prisma/schema.prisma`
  - `BtwSession` model updated with `fleetId`, indexes, and `Fleet` relation
  - `Fleet` model updated with `btwSessions` back-relation

### Validation queries

Run after applying both migrations:

```sql
-- Confirm all three tables exist in both DBs
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('btw_sessions', 'webhooks', 'webhook_deliveries')
ORDER BY table_name;
-- Expected: 3 rows

-- Confirm FK integrity on btw_sessions
SELECT conname, conrelid::regclass AS "table", confrelid::regclass AS "references"
FROM pg_constraint
WHERE contype = 'f' AND conrelid::regclass::text = 'btw_sessions';
-- Expected: trainee_id → users, trainer_id → users, fleet_id → fleets

-- Confirm RLS is enabled (Supabase only)
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename IN ('btw_sessions', 'webhooks', 'webhook_deliveries');
-- Expected: rowsecurity = true for all three

-- Confirm indexes
SELECT indexname, tablename
FROM pg_indexes
WHERE tablename IN ('btw_sessions', 'webhooks', 'webhook_deliveries')
ORDER BY tablename, indexname;
```

---

## Phase 2 — Automated Schema Diff Check (CI gate)

**Goal:** Prevent future drift by failing PRs that change one schema without updating the other.

**Trigger:** Any PR that modifies files under `supabase/migrations/` or `cursor-projects/DOT-Copilot/backend/prisma/`.

**Implementation:**

1. Add a GitHub Actions workflow (`.github/workflows/schema-sync-check.yml`):

```yaml
name: Schema Sync Check
on:
  pull_request:
    paths:
      - 'supabase/migrations/**'
      - 'cursor-projects/DOT-Copilot/backend/prisma/**'

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Extract Supabase table names
        run: |
          grep -h "^CREATE TABLE" supabase/migrations/*.sql \
            | sed 's/CREATE TABLE IF NOT EXISTS //;s/ (.*//' \
            | sort > /tmp/supabase-tables.txt
      - name: Extract Prisma table names
        run: |
          grep '@@map(' cursor-projects/DOT-Copilot/backend/prisma/schema.prisma \
            | sed 's/.*@@map("//;s/").*//' \
            | sort > /tmp/prisma-tables.txt
      - name: Diff tables
        run: |
          diff /tmp/supabase-tables.txt /tmp/prisma-tables.txt \
            || (echo "Schema drift detected — update both Supabase and Prisma migrations" && exit 1)
```

2. Add the Ona automation stub (see `.ona/automations.yaml` — Phase 6).

**Estimated effort:** 2 hours.

---

## Phase 3 — Decision Point (pending ADR-0006)

**Goal:** Resolve ADR-0005/ADR-0006 — choose one canonical database system.

**Options:**

### Option A — Supabase as system of record
- Prisma schema becomes read-only legacy
- Inner backend connects to Supabase Postgres directly (same DB, different connection string)
- Supabase RLS replaces custom JWT fleet-scoping in Express routes
- Prisma migrations deprecated; all future changes go through `supabase/migrations/`
- **Effort:** High (auth model migration, RLS policy audit)

### Option B — Prisma/Express as system of record
- Root frontend (`src/`) migrated to call the Express API instead of Supabase directly
- Supabase project retired; `supabase/migrations/` archived
- Custom JWT auth replaces Supabase Auth
- **Effort:** Medium (frontend API client swap, auth flow changes)

### Option C — Hybrid (BFF pattern)
- Supabase handles auth and real-time subscriptions
- Express handles business logic, webhooks, BTW sessions, file uploads
- Both schemas maintained in sync via Phase 2 CI gate
- **Effort:** Low short-term, high long-term (permanent dual maintenance)

**Decision owner:** Engineering lead. See ADR-0006 for full analysis.

---

## Phase 4 — Deprecate the Losing System

*Executed after Phase 3 decision.*

### If Option A (Supabase wins):

```sql
-- 1. Verify all data is in Supabase
SELECT COUNT(*) FROM users;          -- compare with Prisma DB
SELECT COUNT(*) FROM assignments;    -- compare with Prisma DB

-- 2. Archive Prisma migrations (do not delete — keep for audit trail)
git mv cursor-projects/DOT-Copilot/backend/prisma/migrations \
       cursor-projects/DOT-Copilot/backend/prisma/migrations.archived

-- 3. Update backend DATABASE_URL to point to Supabase Postgres
-- 4. Remove prisma migrate deploy from CI
-- 5. Remove Prisma client from backend (replace with Supabase JS client or pg directly)
```

### If Option B (Prisma wins):

```bash
# 1. Export Supabase data
supabase db dump --data-only > supabase-data-export.sql

# 2. Import into Prisma-managed Postgres
psql $DATABASE_URL < supabase-data-export.sql

# 3. Migrate auth.users → users table (custom password hash required)
# 4. Update root frontend to use Express API client instead of supabase-js
# 5. Archive supabase/ directory
git mv supabase/ _archive/supabase/
```

---

## Phase 5 — Ongoing Maintenance

After consolidation:

1. **Single migration source** — all schema changes go through one system
2. **CI gate** — `prisma migrate status` or `supabase migration list` in every PR
3. **Quarterly schema review** — check for unused tables, missing indexes, RLS policy gaps
4. **Type generation** — run `supabase gen types typescript` or `prisma generate` after every migration and commit the generated types

---

## Quick Reference: Apply Migrations Now

```bash
# Apply Supabase migration (local)
npx supabase start
npx supabase db push

# Apply Prisma migration (local)
cd cursor-projects/DOT-Copilot/backend
npx prisma migrate deploy   # production-safe: applies pending only
# or
npx prisma migrate dev      # dev only: creates new migration if schema changed
```
