# 0009: Fleet Provisioning Architecture

## Status

Proposed

## Context

DOT-Copilot is multi-tenant: every domain row is scoped by `fleet_id`, and
today fleets are created ad hoc (manually, or as part of onboarding scripts).
As Dobeu takes on more customers (e.g. Baldor), platform staff need a
repeatable way to:

1. Create a new fleet row.
2. Get that customer's first admin user into the system, scoped to the new
   fleet, with the `ADMIN` role, without Dobeu staff ever handling or setting
   that user's password.

This is a platform-operator action, not a customer-facing one — it must be
restricted to a small set of trusted Dobeu staff accounts, independent of any
particular fleet's membership (a platform admin is not "in" any customer
fleet).

The root app has no backend server (`/src` talks directly to Supabase), so
any privileged, cross-tenant operation (inserting a fleet, calling
`auth.admin.inviteUserByEmail` with the service-role key) cannot run in the
browser. It needs to run somewhere with the service-role key held server-side.

A Railway-hosted BFF (backend-for-frontend) has been discussed for future
cross-cutting server logic, but does not exist yet.

## Decision

- Add a `profiles.is_platform_admin` boolean flag (independent of `role`/
  `fleet_id`) to identify Dobeu staff who may provision fleets.
- Add a `SECURITY DEFINER` helper, `public.is_platform_admin()`, so RLS
  policies (on `fleets` and `profiles`) can grant cross-fleet access to
  platform admins without recursive-RLS issues.
- Implement provisioning as a Supabase Edge Function
  (`supabase/functions/provision-fleet`), following the same conventions as
  the existing `send-notification` function:
  - Verifies the caller's JWT with an anon-scoped client, loads their
    `profiles` row, and requires `is_platform_admin = true` (403 otherwise).
  - Uses a service-role client only after that check passes, to insert the
    `fleets` row and call `auth.admin.inviteUserByEmail()`.
  - Passes `fleet_id`, `role: 'ADMIN'`, and `full_name` as invite metadata
    (`data`), which `handle_new_user()` reads when creating the invited
    user's `profiles` row — so the customer's initial admin lands already
    scoped to the correct fleet with the correct role.
  - Returns `409` with a clear message if the invited email already exists,
    since `inviteUserByEmail` cannot re-invite an existing account.
- The customer's initial admin user is created via Supabase Auth's
  invite-by-email flow (magic link to `${redirect_origin}/welcome`), not a
  password Dobeu staff ever sees or sets.

## Consequences

- Provisioning stays entirely inside Supabase (DB + Edge Functions); no new
  service to deploy or operate.
- The service-role key remains confined to server-side edge function
  execution — never shipped to any client bundle.
- `is_platform_admin()` being `SECURITY DEFINER` means it must be reviewed
  carefully on any future change; it deliberately only ever evaluates
  `auth.uid()` and cannot be parameterized by a caller-supplied id.
- Platform-admin RLS policies on `fleets`/`profiles` are additive to the
  existing consolidated policies (see
  `20260227034110_consolidate_permissive_policies.sql`), keeping the
  single-permissive-policy-per-action style rather than reintroducing
  duplicate policies.
- This migration and function are being shipped for review only; nothing is
  applied to the live Supabase project until a follow-up merge + `db push`.

## Alternatives Considered

- **Client-side service-role key usage (never).** Embedding or fetching the
  service-role key into the browser bundle would let any authenticated user
  (or a compromised client) provision arbitrary fleets and invite arbitrary
  admins. Rejected outright, not just deprioritized.
- **BFF endpoint on the planned Railway service (deferred).** A future
  general-purpose backend-for-frontend could host this instead of an Edge
  Function. Deferred until that service exists — building provisioning
  against infrastructure that doesn't exist yet would block shipping this
  feature, and Edge Functions already match the pattern established by
  `send-notification`. Revisit once the Railway BFF ships, at which point
  provisioning could move there if it needs to compose with other
  server-side logic.
