# 0010: One Supabase identity and data system

Status: Direction accepted by Jeremy, relayed in the implementation charge on 2026-11-17. Implementation and release gates remain open.

Supersedes the competing target architectures in ADR-0005/0006 and the permanent schema-sync proposal. Historical migrations remain intact.

## Decision

Retain root `src/` as the customer application. Supabase Auth is the target identity authority; Supabase Postgres and its migration history are the target data authority. Privileged business operations run server-side. Retain useful Express logic selectively, but do not connect the canonical UI to custom JWT endpoints without an explicit migration contract. Do not extend the deprecated inner frontend.

This is a target architecture, not a statement that deployed identities or data have already migrated. No existing data store may be retired until its active use and migration requirements are verified. Do not share customer data or identities with RouteReady as part of this decision.

RLS is a defense requiring tests, not a guarantee. Service-role operations must independently authorize callers. Role/fleet/platform privileges must not be derived from client-editable metadata. Completion evidence needs server-controlled semantics.

## Rationale and alternatives

The canonical UI already uses Supabase sessions and queries. Consolidating there preserves that investment. Root UI plus Express/Prisma remains a fallback only if verified operating constraints require reconsideration. A permanent dual identity/schema system is rejected. A rewrite, microservices migration, and mandatory Edge-only architecture are unnecessary for the first customer workflow.

## Gates

No deployment, production changes, or live database migration is authorized. PRs stop for Jeremy's per-item merge approval. Pilot scope, active deployment/data inventory, retention obligations, and completion/assessment semantics remain unresolved. See `docs/foundation-progress.md` for evidence and ordered next work.
