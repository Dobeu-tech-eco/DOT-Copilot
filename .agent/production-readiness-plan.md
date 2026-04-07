# DOT-Copilot Production-Readiness Plan (MERGED)

**Created**: 2026-04-06
**Status**: Draft — awaiting user confirmation before execution
**Sources**: Plan A (Claude Code) + Plan B (Cursor `.cursor/plans/dot-copilot_production_path_b8b5a3d4.plan.md`)

---

## Architectural Context

The repo contains two application layers sharing a git root:

1. **Root Supabase Frontend** (`/src`) — React 19 + Vite 6 + Tailwind 3 + Zustand 5, querying Supabase directly. This is the active, newer frontend.
2. **Inner Monorepo** (`/cursor-projects/DOT-Copilot/`) — Express 4.21 backend with Prisma 7, plus an older React frontend under `frontend/`. Original implementation.
3. **Docker Infrastructure** (`/docker/`) — References FastAPI, Auth0, MongoDB, MCP gateway — disconnected from actual stack.
4. **CI Workflows** (`/cursor-projects/DOT-Copilot/.github/`) — GitHub Actions exist but under inner monorepo. GitHub only reads `.github/` from repo root — **these workflows never execute**.

---

## Phase 0: Critical Security and Structural Fixes

**Must ship before any traffic.**

### 0.1 — Canonical frontend decision [S]
**Agent**: architect | **Files**: `/src/`, `/cursor-projects/DOT-Copilot/frontend/`

Two frontends exist. Decide: deprecate the inner frontend (likely choice — root is the active one) or merge. Blocks CI fixes.

### 0.2 — Move .github/ to repo root [M]
**Agent**: build-error-resolver | **Depends on**: 0.1
**Files**: `cursor-projects/DOT-Copilot/.github/workflows/{ci,deploy,azure-deploy}.yml`

GitHub Actions only reads `.github/` from repo root. All three workflows are under `cursor-projects/` and never execute.

### 0.3 — Remove JWT fallback secrets [S]
**Agent**: security-reviewer
**Files**: `backend/src/utils/jwt.ts`, `backend/src/routes/auth.ts:146,162`, `backend/src/config/env.ts`

`'fallback-secret-change-me'` in 3 places. Remove all `||` fallbacks, import from env.ts.

### 0.4 — Gate the registration endpoint [S]
**Agent**: security-reviewer | **Files**: `backend/src/routes/auth.ts`

Open registration — anyone can create ADMIN accounts. Add `authenticate` + `requireRole` middleware.

### 0.5 — Enforce multi-tenant route isolation [L]
**Agent**: security-reviewer
**Files**: `backend/src/routes/users.ts:17`, `trainingPrograms.ts:20`, `assignments.ts`, `compliance.ts`, `middleware/auth.ts`

Routes allow cross-fleet access. JWT doesn't carry `fleetId`. Fix: add `fleetId` to JWT, create `scopeToFleet` middleware, audit all routes.

### 0.6 — Implement token blacklisting for logout [M]
**Agent**: security-reviewer
**Files**: `backend/src/utils/jwt.ts`, `backend/src/routes/auth.ts`, new `backend/src/services/tokenBlacklist.ts`

Logout is a no-op. Add `jti` claim, blacklist on logout, check in `/refresh`.

### 0.7 — Replace custom HMAC reset token with JWT [S]
**Agent**: security-reviewer | **Depends on**: 0.3
**Files**: `backend/src/routes/auth.ts`, `backend/src/config/env.ts`

Timing-attack surface (`!==` vs `timingSafeEqual`). Replace with `jwt.sign`/`jwt.verify`.

### 0.8 — Fix SSRF on webhook outbound fetch [M]
**Agent**: security-reviewer
**Files**: `backend/src/routes/webhooks.ts`, `backend/src/services/eventDispatcher.ts`

`fetch(webhook.url)` to attacker-controlled destination. Add HTTPS-only, reject private IPs, domain allowlist, timeouts.

### 0.9 — Fix upload path traversal [S]
**Agent**: security-reviewer | **Files**: `backend/src/routes/uploads.ts:55-60`

`req.body.folder` passed unsanitized. Allowlist folders, sanitize filenames, generate server-side UUIDs.

### 0.10 — Fix metrics endpoint weak auth [S]
**Agent**: security-reviewer | **Files**: `backend/src/server.ts:201-208`

Checks `!req.headers.authorization` (presence only). Any `Authorization: garbage` passes.

### 0.11 — Verify RLS policy deployment [S]
**Agent**: security-reviewer | **Files**: new `scripts/verify-rls-policies.sql`

Verify hardened policies from migration 20260227014402 are applied in production.

---

## Phase 1: Backend Production Hardening

### 1.1 — Implement graceful shutdown [M]
**Files**: `backend/src/server.ts` — Close server, disconnect Prisma, flush Sentry, 10s timeout.

### 1.2 — Fix health check Prisma leak [S]
**Files**: `backend/src/server.ts:103-197` — Uses `new PrismaClient()` per request. Use singleton.

### 1.3 — Fix middleware ordering [S]
**Files**: `backend/src/server.ts` — 404 handler after error handler. Swap order.

### 1.4 — Replace console.error with structured logger [M]
**Files**: All 28 backend source files (143 occurrences). Use existing Winston `logError`.

### 1.5 — Configure Prisma connection pooling [S]
**Files**: `backend/src/db.ts`, `backend/prisma/schema.prisma`

### 1.6 — Wire env.ts validation into server startup [S]
**Depends on**: 0.3 | **Files**: `backend/src/server.ts`

---

## Phase 2: Frontend Production Readiness

### 2.1 — Add React Error Boundary [S]
### 2.2 — Add form validation to LoginPage [S]
### 2.3 — Remove external image dependency [S]
### 2.4 — Implement NotificationsPage [M]
### 2.5 — Fix `as never` type casts [S]
### 2.6 — Add ESLint to root frontend [S]
### 2.7 — Generate Supabase types from schema [S]

---

## Phase 3: Testing Infrastructure

### 3.1 — Expand auth test coverage [M] — Depends on: 0.4, 0.6, 0.7
### 3.2 — Add multi-tenant isolation tests [M] — Depends on: 0.5
### 3.3 — Add route-level integration tests [L] — Depends on: 1.1, 1.2
### 3.4 — Set up Vitest for root frontend [M]
### 3.5 — Add store and component tests [M] — Depends on: 3.4
### 3.6 — Add Playwright E2E smoke tests [M] — Depends on: 3.4

---

## Phase 4: CI/CD and Infrastructure

### 4.1 — Fix CI working directory paths [S] — Depends on: 0.2
### 4.2 — Add root frontend to CI pipeline [S] — Depends on: 0.1, 0.2
### 4.3 — Pin CI action versions [S] — `trivy-action@master` → SHA-pinned
### 4.4 — Replace AZURE_CREDENTIALS with OIDC [M]
### 4.5 — Add CodeQL and dependency-review [M] — Depends on: 0.2
### 4.6 — Reconcile Docker with actual stack [L]
### 4.7 — Add staging environment [M] — Depends on: 4.1

---

## Phase 5: Monitoring & Observability

### 5.1 — Add request correlation IDs [S] — Depends on: 1.4
### 5.2 — Add frontend Sentry [S] — Depends on: 2.1
### 5.3 — Add Supabase health monitoring [S] — Depends on: 2.1

---

## Phase 6: Performance & Polish

### 6.1 — Add loading/error states to all pages [M]
### 6.2 — Add accessibility basics [M]
### 6.3 — Optimize Supabase query patterns [S]

---

## Phase 7: Agent-Native Architecture Roadmap

### 7.1 — UI/API surface alignment audit [M]
### 7.2 — Shared service layer design [L] — Depends on: 7.1
### 7.3 — Async worker architecture for RAG [L] — Depends on: 7.2
### 7.4 — Composio deep-research integration [M]

---

## Execution Priority (Sprint Order)

| Sprint | Week | Tasks | Focus |
|--------|------|-------|-------|
| 1 | 1 | 0.1, 0.3, 0.4, 0.9, 0.10, 0.11 | Quick security wins, frontend decision |
| 2 | 2 | 0.2, 0.5 (start), 0.6, 0.7, 0.8 | Structural fix, multi-tenant, remaining security |
| 3 | 3 | 0.5 (finish), 1.1-1.6 | Complete multi-tenant, backend hardening |
| 4 | 4 | 2.1-2.7, 3.4 | Frontend readiness, test infra |
| 5 | 5 | 3.1-3.3, 3.5, 3.6 | Testing |
| 6 | 6 | 4.1-4.5, 4.7 | CI/CD |
| 7 | 7 | 5.1-5.3, 6.1-6.3 | Monitoring, polish |
| 8+ | 8+ | 7.1-7.4 | Agent-native roadmap |

## Complexity Summary

| Size | Count |
|------|-------|
| S (< 2h) | 18 |
| M (2-8h) | 18 |
| L (1-3d) | 5 |
| **Total** | **41** |

## Critical Files (touched by multiple tasks)

| File | Tasks |
|------|-------|
| `backend/src/routes/auth.ts` | 0.3, 0.4, 0.6, 0.7 |
| `backend/src/server.ts` | 0.10, 1.1, 1.2, 1.3, 1.6 |
| `backend/src/utils/jwt.ts` | 0.3, 0.6 |
| `backend/src/routes/webhooks.ts` | 0.5, 0.8 |
| `.github/workflows/ci.yml` | 4.1, 4.2, 4.3 |
| `src/App.tsx` | 2.1, 2.4, 5.3 |
