# Supabase foundation — implementation checkpoint

Base: 36b6fd82eca7cb903f0e9952c1c342fe4d4244ea. Branch: feature/supabase-foundation.

## Done-when for this first change

Record the accepted target architecture, map the customer workflow and blockers, and make canonical session admission fail closed for missing/inactive profiles, confirmation-pending signup, lookup failure, and stale initialization after logout. Verify with local regression tests, typecheck, and build. This does not prove database authorization or end-to-end readiness.

## Ordered acceptance map

| Step | Existing path | Remaining evidence or implementation |
|---|---|---|
| Provision fleet | admin/NewFleetWizard -> provision-fleet Edge Function | Disposable identity/RLS replay, partial-failure recovery and idempotency |
| Invite first admin | provision-fleet -> Auth invite -> WelcomePage | Latest migration replaces invite-aware handle_new_user; reconcile history before relying on fleet attachment |
| Add driver | profiles.service -> create-user | Edge Function absent from checkout; resolve invitation policy before implementation |
| Create and assign training | TrainingPage -> training.service/modules.service | Real database authorization and relational consistency tests |
| Driver completes assessment | Backend completion/quiz routes exist | Canonical UI completion journey and server-authoritative scoring contract not established |
| Retrieve evidence | ReportsPage / completion_records | Agree evidence semantics and prove export completeness |

## Verified baseline and risks

Root UI authenticates and queries Supabase. Express uses custom HS256 tokens; root API helper passes Supabase tokens. No compatibility proof exists. Root and inner UI both remain in CI. CI configuration is not a current run result.

July 7 migration trusts raw user metadata for role/fleet and profile policies permit own-row updates. July 26 init migration later replaces handle_new_user without invite metadata handling. Therefore the earlier migration alone cannot establish the effective signup behavior. Replay the full ordered migration chain and inspect effective grants/policies/triggers in a disposable database. Do not rewrite applied historical files.

Provisioning inserts the fleet before sending its invitation, leaving partial state on errors. The canonical create-user endpoint is missing. Customer workflow is not end-to-end verified.

## Blockers requiring facts, not guesses

- Pilot fleet, training formats, acceptance criteria, support owner, and reporting requirements.
- Which deployments, databases, identities, and migrations are active. Local source comments claiming prior live application are not current verification.
- Invitation vs self-signup policy and authorized role-management rules.
- Completion, assessment, signature, content-version and retention requirements.

## Next authorized work in dependency order

1. Obtain pilot acceptance and read-only operating inventory; continue independent local verification meanwhile.
2. Replay both historical schema representations in disposable environments and capture effective schema/RLS differences; never target live databases.
3. Add denial tests for privilege escalation, cross-fleet access and inactive users, then implement forward-only fixes against confirmed policy.
4. Implement recoverable fleet/admin/driver invitation workflow under agreed policy.
5. Connect one agreed training/assessment workflow and evidence export; prove it with real local database and browser tests.
6. Retire duplicate paths only after migration/parity evidence. Seek per-item merge approval; deployment is a separate charge.

## Validation receipt — 2026-11-17

- `npm ci --ignore-scripts`: exit 0; lockfile unchanged. Audit summary reports 22 findings (3 moderate, 19 high); not adjudicated or automatically upgraded.
- `npm test`: exit 0, 41 tests across 5 files, including 8 new auth admission cases.
- `npm run lint`: exit 0 after correcting the existing hand-authored database type's row inference at the new profile check.
- `npm run build`: exit 0. Existing stale Browserslist and large-chunk warnings remain.
- `git diff --check`: exit 0.
- Disposable database replay blocked: Docker API socket `/Users/amywilliams/.docker/run/docker.sock` unavailable. No live database was contacted.
- Evidence scope: mocked auth/session regressions and local compile/bundle only. No real Auth, RLS, browser, deployment or end-to-end proof.
- Pre-existing `.claude/dts2-harness.local.md` preserved. No commit, push, PR, merge, deploy or live migration performed.

## Continuation receipt — November 17, 2026, fresh Codex owner

Preserved the inherited branch/base and ADR. Loaded dt5.3.0; Mac verification confirmed all installed dt paths resolve to5.3.0. Its onboard remains orientation-only. User authorized setup routing; bounded .harness end state/config/plan now exist. Executed sizing/probe, plan gate, standard-tier build, deterministic gates, independent correctness/security diagnosis/review, verifier and final review. Full companion/bootstrap parity and automatic roadmap-file approval are not claimed; no approval file was edited.

Auth now serializes local SDK mutations; skips superseded queued work; reconciles current SDK identity before admission; guards stale profile/errors; settles initialized; handles failed logout. Failed explicit auth operations fence admission until explicit retry so surviving SDK sessions cannot silently restore local access. This fence is in-memory and resets on reload, not transport/server revocation.

Final validation: 68 tests/5 files pass (35 auth cases, retaining inherited8), typecheck/lint pass, build pass, diff-check0, secret and protected-path scans pass without skips. Three pre-existing documentation examples were changed to explicit token placeholders to clear13 baseline secret-scan findings; no scanner suppression added. Existing Browserslist/chunk warnings remain.

Independent verifier: VERIFIED bounded local slice. Final reviewer: APPROVE LOCAL SLICE, no remaining blocking finding. Receipt/logs/hashes: .harness/runs/20261117-foundation/.

Disposable database replay still blocked by missing Docker socket; PostgreSQL utilities absent on PATH. No real Auth, RLS, browser, CI or production proof. create-user, invitation policy, pilot scope and evidence semantics remain open. No commit/push/PR/merge/deploy or live migration. Next: provide a disposable local database runtime and replay full ordered migrations before claiming database foundation complete; retain existing historical migrations.

## Disposable database replay — November 17, 2026, after Docker recovery

Docker29.9.3 answered immediately. Created an isolated temporary Supabase project with distinct ports; unrelated new-dobeu-net containers untouched. CLI2.121.0, PostgreSQL17.11. Used actual local Supabase auth schema; application SQL as postgres, probes SET ROLE authenticated (not superuser, not BYPASSRLS). No remote database connection or application migration edits.

All12 historical migration files applied in order with ON_ERROR_STOP and one transaction per file. July26 baseline alone also applied in a separate database. The full chain has21 public tables/100 policies; baseline-only has15/37. Their signup function is identical, but they are not equivalent schemas; full chain retains additional tables, columns and policies.

Seven probes ran twice per schema path with identical results (28 probe executions). Direct cross-fleet training read returned0 before tampering. FAILURES in both paths: own-profile platform-admin escalation succeeds and exposes the other fleet training; own role can become ADMIN; own fleet can be reassigned to read the other fleet; inactive driver still reads its fleet training; driver can insert a passed completion with its own user_id and another fleet_id. Invite-shaped metadata inserted into auth.users creates DRIVER/null-fleet, not invited ADMIN/fleet.

These are reproducible database findings, not speculative source concerns. The invite test invokes the real DB trigger via synthetic auth.users fixtures; it does not prove GoTrue invite/email/HTTP integration. Mutating probes rollback. All input migration hashes unchanged. First empty-schema clone attempt failed due to postgres parameter privilege; retried bootstrap in separate databases as supabase_admin, then application SQL as postgres. That setup failure was not an application migration failure.

Evidence/scripts/catalogs: .harness/runs/20261117-foundation/database-replay/. Environmental blocker D1 cleared; database acceptance remains BLOCKED on D6 policy/schema repair. Next: forward-only policy repair with denial tests covering both schema histories, plus invite attachment contract and schema convergence. Do not rewrite applied history or infer deployed state. No live changes, commits, PRs or deploys.

## Authorized RLS repair — November 18, 2026

Five verified RLS findings repaired locally with forward-only SQL and service-owned invitation reservations. Both histories replay: 27 cases twice per history pass (108/108). Real GoTrue invitation returns ADMIN in the reserved fleet and consumes its reservation. Auth INSERT/UPDATE ordering is covered; later invitations cannot reassign an existing identity. See [complete acceptance report](rls-repair-acceptance.md) and committed JSON evidence. Root tests68/68, lint, build, Deno check pass. Security and correctness reviews find no blocker. This supersedes the five-flaw D6 blocker; schema convergence, create-user and complete server workflows remain open. No live or production changes.
