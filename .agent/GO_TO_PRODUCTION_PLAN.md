# DOT-Copilot — Go to Full Production + Go to Market Plan
**Status: DRAFT — awaiting Jeremy's final approval** | Date: 2026-07-06 | Author: Claude (Cowork session)
Repo: github.com/Dobeu-tech-eco/DOT-Copilot @ `5f0d9e4` | Vercel: team `dobeutechnology`, project `dot-copilot`

---

## 0. Repo Sync Status (completed this session)

- Local was 116 commits behind `Dobeu-tech-eco/DOT-Copilot` (0 ahead). HEAD ref updated to `5f0d9e4`; working-tree content synced via archive extraction.
- **One manual step for Jeremy**: Windows file locks (likely VS Code/GitHub Desktop) blocked full index rewrite. Close those apps, then run:
  `git remote set-url origin https://github.com/Dobeu-tech-eco/DOT-Copilot.git && git fetch origin && git reset --hard origin/main`
- `core.autocrlf=true` was set locally (correct for Windows). Stale lock files moved to `.git/_stale_cleanup/` — safe to delete.

## 1. Where the Product Stands (consolidated review verdict)

Two app layers exist. Neither ships alone today:

| Layer | State |
|---|---|
| Root app (`src/`) React 19 + Vite + Supabase (RLS) | Most feature-complete UI (compliance, vehicles, reports, settings). **Zero tests. Split-brain auth** (login via Express JWT/localStorage, register via Supabase Auth). |
| Inner backend (`cursor-projects/DOT-Copilot/backend`) Express + Prisma | More mature security baseline, but **cross-tenant IDOR in ~14 route files**, dead webhook router, mock password reset, notification dispatcher never invoked. |
| Inner frontend | Partially abandoned; component smoke tests only. Not the shipping UI. |

**Verdict:** production path = **root frontend + narrowed Express BFF**, per already-accepted ADR-0006, once auth is unified and tenant isolation is closed.

### Critical blockers (P0)
1. Unify auth: finish Supabase Auth migration in `authStore.ts` (or intentional proxied BFF auth w/ HttpOnly cookies per ADR-0007).
2. Fleet-scoping (IDOR) fixes across all ID-based backend routes.
3. Real password reset (token + email).
4. Wire `notificationDispatcher` to a scheduler — compliance-expiration alerts are the core FMCSA value prop and currently never fire.
5. Mount webhooks router; Redis-backed JWT blacklist.
6. Content playback: SCORM runtime + PDF/video viewers; BTW frontend UI (backend exists, no UI).
7. RLS verification against live Supabase + automated RLS tests (multi-tenant leak protection).

Full 20-item work list from code review is preserved in section 8.

## 2. Architecture Decision (ADR — proposed)

**Option B — Root Vite/Supabase app on Vercel (production frontend) + narrow Express BFF on a persistent host (Railway or Azure B1), not Vercel functions.**

Why: matches accepted ADR-0006; ~80% of CRUD is Supabase RLS-direct; BFF keeps server-secret and stateful work (webhook HMAC, Twilio/FCM, Azure Blob SAS, BTW signatures, `agentNative.ts` Composio/agent endpoints — Prisma pooling + Redis fight serverless cold starts).

Rejected: A) retire Express entirely (loses agent-native + stateful services), C) stay full Azure (contradicts ADR-0006 cost/security rationale).

Key config facts found:
- `cursor-projects/DOT-Copilot/vercel.json` targets the **wrong (legacy) stack** — must be removed/relabeled.
- Vercel project `dot-copilot` currently builds only **preview** deployments from `dobeutech/DOT-Copilot`; **no production deployment has ever been made**. Vercel Git integration should be repointed to `Dobeu-tech-eco/DOT-Copilot`, Root Directory = repo root, Vite preset, SPA rewrites.
- New root-level `vercel.json` to be added (rewrites + headers) so deploy config is auditable in-repo.

Codebase map written to `docs/CODEBASE_MAP.md` (directory purposes, mermaid data flows, live-vs-legacy, navigation guide).

## 3. Brand Architecture (Dobeu / Baldor)

- **Platform = Dobeu Tech Solutions product** ("DOT-Copilot by Dobeu"). Backend, docs, repo, Vercel org, Supabase org all Dobeu-branded.
- **Front end = per-tenant theme.** Baldor palette (already in `tailwind.config.js` as `baldor`) stays for the pilot tenant. Refactor to a theme-token layer (CSS variables per fleet: logo, palette, name) driven by the `fleets` table → white-label ready.
- Dobeu design tokens/system (dobeu-v0-design / dobeudesignsystem Vercel project) govern: marketing site, admin/ops surfaces, default theme for non-Baldor tenants.
- Rule: no Baldor branding hard-coded outside the theme layer; audit `slate-750/850` + `baldor` usages during Phase 2.

## 4. Execution Model (multi-agent, per your harness)

- **Orchestrator:** Claude (Cowork/Claude Code) plans, reviews, merges. **Workers:** parallel subagents (subagent-driven development) with one feature per agent, TDD-first, verification before completion.
- **Remote execution:** composio-fullstack-pipeline pattern — Composio toolkits confirmed available: **GitHub** (PRs, workflow runs, checks), **Supabase** (migrations, SQL, edge function deploy), **Vercel** (env vars, deployments, project create) + Composio Remote Workbench for bulk work. Vercel MCP is connected natively (used for this review).
- **Checkpoints:** `.agent/tasks.json` (feature list below → to be loaded), `.agent/progress.md`, git `[CHECKPOINT]` commits, one feature at a time, `passes=true` only after tests run.
- **Branch/PR discipline:** `feature/*` branches → PR → CI green (lint+test+build) → merge to `main` → Vercel preview → manual promote to production until Phase 4, then auto-promote.

## 5. Phased Plan

**Phase 0 — Foundation (Week 1)**
- Jeremy: finish local git sync (sec. 0); confirm Vercel Git repo = Dobeu-tech-eco; create/confirm separate **staging + production Supabase projects**.
- Remove stale `vercel.json`; add root `vercel.json`; set Vercel Root Directory/preset/env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` per environment); fail-fast in `src/lib/supabase.ts`.
- Load `.agent/tasks.json` with the P0–P2 backlog; delete dead `backend/src/models/index.ts` (hardcoded creds).

**Phase 1 — Security & Auth (Weeks 1–3) [parallel agents]**
- Agent A: Supabase Auth unification in root app (login/initialize/reset) + HttpOnly-cookie BFF session per ADR-0007.
- Agent B: fleet-scoping middleware + fixes across all 14 backend route files, with tenancy tests per route.
- Agent C: real password reset; Redis JWT blacklist; JWT algorithm allowlist; Zod validation for remaining routes; exact-match CORS.
- Gate: security re-review (subagent code-review) + `scripts/verify-rls-policies.sql` run against staging via Composio Supabase.

**Phase 2 — Feature completion (Weeks 3–6) [parallel agents]**
- Agent D: notification scheduler (cron on BFF host) wiring `notificationDispatcher` — compliance expiration alerts E2E (email/SMS/push; fix SMS false-success; FCM → HTTP v1).
- Agent E: content playback — SCORM runtime (`scorm-again`), PDF/video/PowerPoint viewers, lesson completion tracking.
- Agent F: BTW frontend (session list, evaluation, dual signature, completion) against existing backend.
- Agent G: schema reconciliation (Prisma ↔ Supabase: vehicles, i18n, reminders, triggers, scheduled reports) per ADR-0008; mount webhooks router + tests.
- Agent H: theme-token/white-label layer (sec. 3).

**Phase 3 — Test hardening (Weeks 5–7, overlaps)**
- Root app: Vitest + Testing Library (stores, services, Login/Dashboard/Compliance pages) — added to `ci.yml` as a required gate.
- RLS tests (pgTAP or scripted) proving cross-fleet isolation.
- Playwright E2E: login → dashboard → compliance CRUD → training assignment flow, run against staging Supabase in CI.
- Backend: extend Jest to compliance/training/assignments/BTW/documents/webhooks.
- Target: P0 paths 100% E2E covered; stores/services ≥70% unit.

**Phase 4 — Production cutover (Week 8)** — full checklist in section 7. Staging soak (1 week, Baldor pilot users) → promote.

**Phase 5 — Post-launch (Weeks 9+)**: retire Azure Bicep + inner frontend to `_archive/`; docs true-up (DR/runbook rewritten for Vercel+Supabase, rollback = Vercel instant rollback + Supabase PITR); monitoring dashboards; begin GTM motion (sec. 9).

## 6. Testing Strategy (summary)

| Layer | Now | Required for prod | Priority |
|---|---|---|---|
| Root app unit/integration | 0 tests, no runner | Vitest+TL: stores, services, critical pages | Critical |
| RLS / tenancy | Untested | Automated RLS isolation tests (2-fleet fixture) | Critical |
| E2E | None | Playwright core journeys vs staging | High |
| Backend routes | 5 suites (auth/users) | + compliance, training, BTW, webhooks, notifications | High |
| CI gates | Lint+build only for root | Tests required on PR; Trivy/CodeQL retained | High |

## 7. Production Deploy Checklist (Vercel cutover)

1. Supabase **prod** project created; all `supabase/migrations/` applied; RLS enabled + verified on every table.
2. No dev/test data in prod; seed minimal reference data.
3. Vercel Root Directory = repo root; Vite preset; build `npm run build`; output `dist`.
4. Prod + preview env vars set (prod ↔ prod Supabase, preview ↔ staging Supabase).
5. Root `vercel.json` with SPA rewrites committed; legacy `vercel.json` removed.
6. BFF host live (Railway/Azure B1): env secrets, Redis, cron scheduler, `/health` monitored; CORS locked to prod domain.
7. Custom domain + SSL verified before traffic.
8. Sentry initialized (frontend + BFF); Vercel Analytics on.
9. CI green including new test gates; branch protection on `main`.
10. Rollback documented: Vercel instant rollback + Supabase PITR/backup schedule confirmed.
11. Post-deploy smoke: login, role routing, one write, cross-fleet isolation check with two test fleets.
12. Rate/abuse limits confirmed (Supabase Auth limits + BFF express-rate-limit incl. refresh/logout).
13. On-call/alerting: uptime check on domain + BFF `/health`; Slack alert channel.
14. Ops runbook committed (`docs/RUNBOOK_VERCEL_SUPABASE.md`).
15. Sign-off: Jeremy approves promotion of the release deployment to Production.

## 8. Full Remaining-Work Register (from code review)

P0: auth unification; fleet-scoping IDOR fixes; password reset; notification scheduler; webhook router mount; SCORM/viewers; BTW UI; RLS verification.
P1: Redis JWT blacklist; Zod coverage (~15 files); JWT alg allowlist; delete legacy in-memory store; SMS false-success fix; schema reconciliation; remove stale vercel.json; replace `rolldown-vite` with stable Vite (or CI-validate); FCM HTTP v1.
P2: exact-match CORS; docs true-up (rate limiting, Prisma version, stale root architecture doc); fail-fast Supabase client; TS version alignment.

## 9. Go-to-Market Strategy

**Positioning:** "DOT-Copilot by Dobeu Tech Solutions — fleet driver training + DOT/FMCSA compliance, automated." Wedge: compliance-expiration automation (CDL/med-card/HAZMAT alerts) + BTW digital evaluations — the features competitors bolt on.

**Phase GTM-1: Baldor pilot (during Phases 2–4).** Success criteria: 100% driver onboarding, zero missed expiration alerts over 60 days, supervisor NPS ≥8. Output: case study + reference.

**Phase GTM-2: Design-partner cohort (Months 3–5).** 3–5 regional food-transport/refrigerated fleets (50–500 drivers) — leverage temperature-monitoring differentiator. Founder-led sales; Apollo/lead-research tooling already connected for prospecting.

**Phase GTM-3: Vertical expansion (Months 6+).** Broader FMCSA-regulated carriers; channel via insurance brokers + DOT compliance consultants (referral fee); content SEO on FMCSA compliance topics (searchfit/marketing skills available).

**Pricing (hypothesis, validate in pilot):** per-driver/month SaaS — Core $6–9 (training + compliance tracking), Pro $12–15 (+BTW, webhooks/API, white-label), Enterprise custom (SSO, SLA). Annual prepay discount. Implementation fee waived for design partners.

**White-label lever:** theme-token layer (Phase 2, Agent H) lets Dobeu offer branded portals to enterprise fleets and later a partner/reseller motion.

**Launch assets (Dobeu brand, via connected tooling):** dobeu.net product page, one-pager (pdf), demo video, Product Hunt-style launch skipped in favor of vertical trade channels (Transport Topics, FMCSA compliance newsletters).

## 10. Approval Gates for Jeremy

- G1 (now): approve this plan + architecture Option B + BFF host choice (Railway vs Azure B1).
- G2 (end Phase 1): security re-review results.
- G3 (end Phase 3): test evidence pack.
- G4 (Phase 4): production promotion sign-off.
- G5: GTM pricing/pilot terms before first external prospect outreach.
