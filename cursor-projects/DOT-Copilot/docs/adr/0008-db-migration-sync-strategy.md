# ADR-0008: Database Migration Sync Strategy

**Status:** Proposed — awaiting engineering lead sign-off  
**Date:** 2026-04-10  
**Deciders:** Engineering lead  
**Technical Story:** Schema drift identified in migration plan session; see `docs/migration-plan.md`

## Context

DOT-Copilot maintains two parallel database schemas targeting the same PostgreSQL instance (or two separate instances in some deployment configurations):

| System | Migration tool | Location | Tables |
|---|---|---|---|
| Supabase | `supabase` CLI | `supabase/migrations/` | ~15 tables |
| Prisma | `prisma migrate` | `cursor-projects/DOT-Copilot/backend/prisma/migrations/` | ~25+ models |

As of 2026-04-10, the schemas have drifted: `btw_sessions`, `webhooks`, and `webhook_deliveries` exist in Prisma but were missing from Supabase. The `BtwSession` Prisma model was also missing `fleet_id`, which exists in the Supabase equivalent.

Without a sync strategy, this drift will continue and worsen as features are added. The risk is:
- Data written via the Express API (Prisma) is not visible to the root frontend (Supabase queries)
- RLS policies in Supabase cannot protect data that doesn't exist in its schema
- Migrations applied to one system break the other silently

## Decision

**Adopt Prisma as the schema source of truth. Generate Supabase migrations from Prisma introspection.**

Workflow:
1. All schema changes are made in `prisma/schema.prisma` first
2. `npx prisma migrate dev` generates the SQL migration
3. The generated SQL is reviewed and adapted for Supabase (adding RLS policies, Supabase-specific types)
4. The adapted SQL is placed in `supabase/migrations/` with the same timestamp
5. A CI check (`schema-sync-check.yml`) verifies that all tables in Prisma have a corresponding Supabase migration

This is the **dual-migration pattern**: one source of truth (Prisma schema), two migration outputs.

If ADR-0006 Option A (Supabase as system of record) is accepted, this ADR is superseded: Supabase becomes the source of truth and Prisma is retired.

## Alternatives Considered

### Option A — Prisma as source of truth (recommended, interim)

**Pros:**
- Prisma schema is already more complete (25+ models vs 15 Supabase tables)
- `prisma migrate dev` generates clean SQL that can be adapted for Supabase
- TypeScript types generated from Prisma schema are used throughout the backend
- Consistent with the existing Express backend workflow

**Cons:**
- Requires manual adaptation of Prisma SQL for Supabase (adding RLS, `auth.uid()` references)
- Two migration files per schema change — more work per PR
- Does not resolve the dual-stack problem — only manages it

### Option B — Supabase as source of truth

**Pros:**
- Aligns with ADR-0006 Option A (recommended canonical stack)
- `supabase db pull` can introspect the DB and generate Prisma-compatible SQL
- Supabase Studio provides a visual schema editor

**Cons:**
- Supabase migrations are SQL-only — no TypeScript model generation
- Prisma client types must be regenerated from the Supabase schema via `prisma db pull`
- Supabase SQL dialect differs from Prisma's generated SQL (e.g., `gen_random_uuid()` vs `cuid()`)

### Option C — Manual dual-maintenance (current, broken)

**Pros:**
- No tooling changes required

**Cons:**
- Already causing drift (3 tables missing from Supabase)
- No automated detection of drift
- Scales poorly as the schema grows

### Option D — Single database, single migration tool

Retire one system entirely. Requires ADR-0006 to be resolved first.

**Pros:**
- Eliminates the sync problem entirely
- One migration tool, one schema, one set of types

**Cons:**
- Requires significant migration effort (auth model, connection strings, RLS policies)
- Blocked on ADR-0006 decision

## Decision Rationale

Option A is the lowest-risk interim strategy. It formalises the existing Prisma-first workflow, adds a CI gate to catch drift early, and is compatible with either outcome of ADR-0006:
- If ADR-0006 chooses Supabase: this ADR is superseded and Prisma is retired
- If ADR-0006 chooses Prisma: this ADR is superseded and Supabase is retired
- If ADR-0006 is deferred: this ADR prevents further drift in the meantime

## Consequences

### Positive
- Schema drift is caught automatically in CI before it reaches production
- Single source of truth for schema changes reduces cognitive overhead
- Prisma-generated SQL is well-tested and type-safe

### Negative
- Every schema change requires two migration files (Prisma + Supabase adaptation)
- RLS policies must be written manually — Prisma has no concept of `auth.uid()`
- CI check adds ~30 seconds to PR pipeline

### Neutral
- Existing migrations are not retroactively synced — only new migrations follow this pattern
- The `docs/migration-plan.md` documents the current gap and the backfill plan

## Implementation Notes

**Step 1: Add CI check** (`.github/workflows/schema-sync-check.yml`):

```yaml
name: Schema Sync Check
on:
  pull_request:
    paths:
      - 'supabase/migrations/**'
      - 'cursor-projects/DOT-Copilot/backend/prisma/**'
jobs:
  sync-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Check Prisma tables have Supabase migrations
        run: |
          # Extract table names from Prisma @@map annotations
          grep '@@map(' cursor-projects/DOT-Copilot/backend/prisma/schema.prisma \
            | sed 's/.*@@map("//;s/").*//' | sort > /tmp/prisma-tables.txt
          # Extract table names from Supabase CREATE TABLE statements
          grep -h "^CREATE TABLE" supabase/migrations/*.sql \
            | sed 's/CREATE TABLE IF NOT EXISTS //;s/ (.*//' \
            | sort -u > /tmp/supabase-tables.txt
          # Tables in Prisma but not in Supabase
          MISSING=$(comm -23 /tmp/prisma-tables.txt /tmp/supabase-tables.txt)
          if [ -n "$MISSING" ]; then
            echo "Tables in Prisma missing from Supabase migrations:"
            echo "$MISSING"
            exit 1
          fi
          echo "Schema sync check passed"
```

**Step 2: Migration workflow for new schema changes:**

```bash
# 1. Edit prisma/schema.prisma
# 2. Generate Prisma migration
cd cursor-projects/DOT-Copilot/backend
npx prisma migrate dev --name <description>
# 3. Copy and adapt the generated SQL for Supabase
TIMESTAMP=$(date -u +%Y%m%d%H%M%S)
cp prisma/migrations/<timestamp>_<description>/migration.sql \
   ../../../supabase/migrations/${TIMESTAMP}_<description>.sql
# 4. Edit the Supabase migration to add:
#    - ALTER TABLE ... ENABLE ROW LEVEL SECURITY;
#    - CREATE POLICY ... USING (fleet_id IN (SELECT fleet_id FROM profiles WHERE id = auth.uid()))
#    - Any Supabase-specific types (uuid DEFAULT gen_random_uuid() instead of cuid())
```

**Step 3: Add Ona automation** (see `.ona/automations.yaml` — Phase 6 of this session).

## Related Decisions

- [ADR-0005: Canonical application stack (proposed)](./0005-canonical-application-stack.md)
- [ADR-0006: Canonical application stack decision](./0006-canonical-application-stack-decision.md)
- [ADR-0007: Token storage strategy](./0007-token-storage-strategy.md)

## References

- `docs/migration-plan.md` — phased schema sync plan
- `supabase/migrations/20260410232616_add_btw_sessions_and_webhooks.sql` — first migration following this pattern
- `cursor-projects/DOT-Copilot/backend/prisma/migrations/20260410232616_add_btw_webhooks/migration.sql` — corresponding Prisma migration

---

**Last Updated:** 2026-04-10
