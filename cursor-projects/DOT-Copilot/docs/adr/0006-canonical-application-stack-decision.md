# ADR-0006: Canonical Application Stack Decision

**Status:** Proposed — awaiting engineering lead sign-off  
**Date:** 2026-04-10  
**Deciders:** Engineering lead, product owner  
**Technical Story:** Resolves ADR-0005 (Proposed, unresolved)  
**Supersedes:** [ADR-0005: Canonical application stack](./0005-canonical-application-stack.md)

## Context

ADR-0005 documented the dual-stack problem but deferred the decision. The monorepo now has:

- **Root frontend** (`src/`): React 19 + Vite + Supabase JS client. Auth via Supabase Auth (magic link / OAuth). Data via Supabase RLS-protected tables. 6 migrations in `supabase/migrations/`.
- **Inner backend** (`cursor-projects/DOT-Copilot/backend/`): Express 4 + Prisma 7 + custom JWT (bcrypt). 2 migrations in `prisma/migrations/`. 22 route files. Full business logic (BTW sessions, webhooks, compliance, notifications, Azure Blob storage).
- **Inner frontend** (`cursor-projects/DOT-Copilot/frontend/`): React 19 + Axios. Calls the Express API. Largely feature-equivalent to the root frontend.

Running both stacks in production means:
- Two auth systems (Supabase Auth vs custom JWT) — users cannot share sessions
- Two databases (or one DB with two connection pools and diverging schemas)
- Two CI pipelines, two deployment targets, two sets of migrations
- Security findings (localStorage JWT, open `/register` endpoint) exist in the Express layer only

The code review session (previous ADR context) identified 25 security/correctness issues, the majority in the Express backend. The Supabase layer has fewer issues because RLS enforces tenancy at the DB level.

## Decision

**Recommended: Option A — Supabase + root `src/` as the production system of record.**

The Express backend is retained as a **Backend-for-Frontend (BFF)** for operations that require server-side secrets or cannot run in the browser:
- Webhook dispatch (HMAC signing, retry logic)
- Email / SMS notifications (Nodemailer, Twilio)
- Azure Blob Storage uploads (SAS token generation)
- BTW session completion (dual-signature workflow)
- Long-running background jobs

All other data operations (CRUD for drivers, assignments, compliance, training programs) move to direct Supabase queries from the root frontend, protected by RLS.

The inner frontend (`cursor-projects/DOT-Copilot/frontend/`) is deprecated and archived.

## Alternatives Considered

### Option A — Supabase + root `src/` as system of record (recommended)

The root frontend calls Supabase directly for data and the Express BFF for server-side operations.

**Pros:**
- Supabase RLS enforces fleet tenancy at the DB level — eliminates the class of fleet-scoping bugs found in Express routes
- Supabase Auth handles token rotation, session management, and MFA — eliminates the localStorage JWT vulnerability
- Real-time subscriptions available via Supabase Realtime (notifications, live dashboard)
- Reduces backend surface area to ~5 BFF routes instead of 22
- Supabase free tier covers early-stage usage; scales to Pro without infrastructure changes

**Cons:**
- Requires migrating existing Express route logic to Supabase RLS policies and Edge Functions
- Custom auth (bcrypt + JWT) must be replaced — existing user passwords need re-hashing or a migration flow
- Supabase vendor lock-in for auth and real-time features
- Edge Functions have cold-start latency (~200ms) for infrequent operations

### Option B — Express + Prisma as system of record

The root frontend is deprecated; the inner frontend becomes the sole UI.

**Pros:**
- No auth migration required — existing JWT flow continues
- Full control over auth, caching, and business logic
- No vendor lock-in

**Cons:**
- All 25 security/correctness issues from the code review remain and must be fixed
- Fleet tenancy bugs in Express routes require manual fixes for every new route
- Loses Supabase RLS as a safety net — tenancy enforcement is entirely application-layer
- Requires maintaining Azure App Service + Postgres infrastructure (higher cost than Supabase)
- Inner frontend is less polished than root frontend (missing Tailwind design system)

### Option C — Hybrid (permanent dual-stack)

Both stacks maintained indefinitely. Express handles writes; Supabase handles reads and auth.

**Pros:**
- No migration required immediately
- Incremental transition possible

**Cons:**
- Permanent dual maintenance burden
- Two auth systems means users need two sessions or a token bridge
- Schema drift between Supabase and Prisma is already occurring (see `docs/migration-plan.md`)
- Does not resolve the root cause — complexity grows over time

## Decision Rationale

Option A is recommended because:

1. **Security posture**: Supabase RLS eliminates the entire class of fleet-tenancy bugs found in the Express routes (assignments, BTW sessions, compliance). These bugs require per-route fixes in Option B.
2. **Auth safety**: Supabase Auth handles token rotation and session management correctly. The current Express JWT implementation has a timing attack vulnerability, non-rotating refresh tokens, and an in-memory blacklist that breaks under multi-instance deployment.
3. **Operational cost**: Supabase Pro (~$25/month) vs Azure App Service P1V2 + Postgres D2s_v3 (~$200+/month). Even with the BFF retained on a smaller App Service SKU, Option A is significantly cheaper.
4. **Developer velocity**: Direct Supabase queries from the frontend eliminate the round-trip through Express for simple CRUD, reducing latency and the number of files to change per feature.

## Consequences

### Positive
- Fleet tenancy enforced at DB level via RLS — no per-route fixes needed
- Auth vulnerabilities resolved by adopting Supabase Auth
- ~$150/month infrastructure cost reduction (see cost review annotations on `main.bicep`)
- Real-time dashboard updates via Supabase Realtime

### Negative
- Auth migration required: existing users' bcrypt password hashes must be migrated to Supabase Auth (invite-based re-registration or admin-triggered password reset)
- Express BFF must be maintained for server-side operations (~5 routes)
- Inner frontend (`cursor-projects/DOT-Copilot/frontend/`) becomes dead code

### Neutral
- Prisma schema becomes read-only reference; `prisma/migrations/` archived after data migration
- CI pipeline simplified: remove inner frontend build, retain Express BFF build

## Implementation Notes

**Phase 1 (immediate):** Continue using both stacks. Apply the BTW + webhook migrations to both systems (done in this session).

**Phase 2 (next sprint):** Migrate remaining Express CRUD routes to Supabase RLS policies. Start with assignments and compliance (highest traffic).

**Phase 3:** Migrate auth. Create Supabase Auth users for all existing users. Send password-reset emails. Retire custom JWT endpoint.

**Phase 4:** Reduce Express to BFF-only (webhooks, email, storage, BTW completion). Deploy on `B1` App Service SKU instead of `P1V2`.

**Phase 5:** Archive inner frontend and Prisma migrations. Update CI.

## Related Decisions

- [ADR-0005: Canonical application stack (proposed)](./0005-canonical-application-stack.md)
- [ADR-0007: Token storage strategy](./0007-token-storage-strategy.md)
- [ADR-0008: DB migration sync strategy](./0008-db-migration-sync-strategy.md)

## References

- `docs/migration-plan.md` — schema sync plan
- `docs/code-tour.md` — end-to-end flow documentation
- Code review annotations on `src/store/authStore.ts`, `cursor-projects/DOT-Copilot/backend/src/routes/assignments.ts`

---

**Last Updated:** 2026-04-10
