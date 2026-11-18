# RLS repair acceptance — November 18, 2026

Verdict: PASS for the five authorized foundation findings on disposable local Supabase. Branch `feature/supabase-foundation`; rollback/base `36b6fd82eca7cb903f0e9952c1c342fe4d4244ea`. Historical migrations are unchanged.

## Replay evidence

PostgreSQL 17.11, Supabase CLI 2.121.0, Docker 29.9.3. Application migrations use ON_ERROR_STOP and one transaction per file. Browser probes run as authenticated, neither superuser nor BYPASSRLS. Mutations roll back after each probe. Denials accept SQLSTATE 42501 only; unrelated errors fail.

- Full history: 12 historical migrations plus repair, all 13 succeed; 27 cases twice = 54/54 pass.
- July baseline plus repair: both files succeed; 27 cases twice = 54/54 pass.
- Total: **108/108 executions pass**. Historical-only testing reproduced the original failures before repair.

| Finding | Final evidence across both paths |
| --- | --- |
| Self-promote to platform admin | deny_self_platform_admin: 4/4 |
| Change own role/fleet | deny_self_role and deny_self_fleet: 8/8 |
| Inactive driver retains access | deny_inactive_training and deny_inactive_profile_update: 8/8 |
| Cross-fleet completion insert | deny_cross_fleet_completion: 4/4; self-scored inserts, update and delete also denied |
| Invite produces fleet-less DRIVER | Trusted insert and two-step Auth fixtures pass; actual local GoTrue invite creates ADMIN in reserved fleet and consumes reservation |

Full per-case results and migration hashes are in [SQL evidence](evidence/20261118-rls-repair/sql-acceptance.json). Actual Auth results are in [invite evidence](evidence/20261118-rls-repair/real-invite.json).

## Real Auth and repair details

The first real GoTrue experiment exposed INSERT-before-invited_at ordering, which synthetic insert-only fixtures missed. The repair records private user/transaction markers and attaches the reservation on the invited_at transition only within the creation transaction, to an untouched default profile. The rerun returned HTTP 200, ADMIN, correct fleet, invited_at present and zero remaining reservations. Re-inviting returned HTTP 200 without consuming a new reservation; provision-fleet therefore verifies the returned user has the new active ADMIN/fleet profile before reporting success. Existing identities cannot be reassigned by the trigger.

Authority comes from service-only reservations, never raw user metadata. Profile authority changes and completion writes require a server role. Active-identity restrictive policies intersect historical permissive policies. Safe own-profile edits and scoped reads remain covered.

## Reproduction

Start a fresh isolated Supabase project named `dot-foundation-replay-<suffix>` with unique local ports. Run `python3 scripts/test-foundation-rls.py supabase_db_<project> --output <evidence-dir>`, then `python3 scripts/test-local-foundation-invite.py <project> <auth-evidence-dir>`. Both reject targets outside the disposable namespace. SQL replay refuses a nonempty application source schema. The Auth test runs last because it installs application SQL in the Auth database. Stop only that project with `--no-backup`. No external DB URL or credentials are accepted.

Machine-local detailed logs remain under `.harness/runs/20261118-rls-repair/`; durable JSON evidence accompanies this report.

## Limits and merge gate

Validation receipt: root `npm test` 68/68 across five files, `npm run lint`, `npm run build`, and `deno check --no-lock --node-modules-dir=none supabase/functions/provision-fleet/index.ts` all pass. Build retains existing Browserslist and large-chunk warnings. Independent security and correctness reviewers found no blocking issue in this bounded repair. Rollback point is the base commit above; no application migration has been applied outside disposable local databases.

This proves local database/Auth behavior, not deployed state or full browser/Edge Function integration. The function typechecks; its complete HTTP orchestration was not exercised. Full-history and baseline schemas remain different. The absent create-user function, pilot policy decisions, detailed assessment/assignment validation and full training workflow remain open. Browser role/fleet/activity management and completion writes fail closed until server workflows support them. Provisioning may leave a fleet after invitation failure; expired reservations need server cleanup.

No production changes, live migrations, merge or deploy. Jeremy owns the merge decision.
