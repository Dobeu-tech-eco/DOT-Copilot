# Code Tour — DOT-Copilot End-to-End Flows

A narrative walkthrough of five key features for engineers new to the codebase.
Each section traces the full stack: UI component → Zustand store → HTTP API → Express route → Prisma → PostgreSQL, calling out side effects along the way.

---

## Table of Contents

1. [Auth Flow](#1-auth-flow)
2. [Training Assignment Flow](#2-training-assignment-flow)
3. [Compliance Tracking Flow](#3-compliance-tracking-flow)
4. [Dashboard Data Loading](#4-dashboard-data-loading)
5. [BTW Session Flow](#5-btw-session-flow)

---

## 1. Auth Flow

**Path:** `LoginPage` → `authStore.login` → `api.ts` → `POST /api/auth/login` → `authService` → Prisma → JWT → `ProtectedRoute`

### 1.1 Entry point — `src/pages/LoginPage.tsx`

The user lands on `/` which renders `LoginPage`. The component holds local state for `email`, `password`, `showPassword`, and `validationError`.

On form submit, `handleSubmit` runs client-side validation first using a local Zod schema:

```ts
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})
```

If validation passes, it calls `useAuthStore().login(email, password)`. Errors thrown by the store are caught silently here because the store sets `error` state directly.

### 1.2 Zustand store — `src/store/authStore.ts`

`login()` sets `loading: true`, then calls:

```ts
api.post<{ data: any }>('/auth/login', { email, password })
```

`api` is the Axios instance configured in `src/lib/supabase.ts` (which doubles as `api.ts`). It targets `/api` which Vite proxies to `http://localhost:3001` in development.

On success, the response contains `{ user, accessToken, refreshToken }`. The store calls `setTokens(accessToken, refreshToken)` which writes both to `localStorage` and to module-level variables. It then maps the raw user object to a typed `Profile` and sets `isAuthenticated: true`.

On failure, the error message is written to `state.error` and re-thrown so the caller can react if needed.

### 1.3 Token persistence — `src/lib/supabase.ts` (api module)

`setTokens` stores tokens in two places:
- Module-level variables (`accessToken`, `refreshToken`) — used for the current session
- `localStorage` — used to restore the session on next page load via `loadTokens()`

The Axios instance has a request interceptor that attaches `Authorization: Bearer <accessToken>` to every outgoing request. A response interceptor handles `401` responses by attempting a token refresh via `POST /api/auth/refresh` before retrying the original request once.

### 1.4 Backend route — `cursor-projects/DOT-Copilot/backend/src/routes/auth.ts`

`POST /api/auth/login` is rate-limited (10 requests per 15 minutes via `authLimiter`). The request body is validated by `loginSchema` via the `validateBody` middleware before the handler runs.

The handler delegates to `authService.login(email, password)`.

### 1.5 Service — `src/services/authService.ts`

```
prisma.user.findUnique({ where: { email }, include: { fleet: true } })
```

If the user exists and has a `passwordHash`, `verifyPassword` (bcrypt compare) is called. On success:
1. `prisma.user.update` sets `lastLoginAt` — **DB write side effect**
2. `generateTokenPair` creates a signed JWT access token (default 15m) and refresh token (default 7d) using `jsonwebtoken`
3. Returns `{ accessToken, refreshToken, user }`

### 1.6 Session restoration — `authStore.initialize()`

On every app mount, `App.tsx` calls `initialize()`. This calls `loadTokens()` to read from `localStorage`, then hits `GET /api/users/me` with the stored token. If the token is valid, the user profile is restored and `isAuthenticated` is set to `true` without requiring a new login.

### 1.7 Route protection — `src/App.tsx`

`ProtectedRoute` reads `isAuthenticated` from the store. If `false`, it redirects to `/`. `RoleRoute` additionally checks `user.role` against an allowed list, redirecting to `/dashboard` if the role is insufficient.

```
/ (LoginPage)
  └─ isAuthenticated → /dashboard
       └─ ProtectedRoute wraps all inner routes
            └─ RoleRoute gates /vehicles, /users, /settings by role
```

**Side effects summary:** `lastLoginAt` DB update, tokens written to `localStorage`.

---

## 2. Training Assignment Flow

**Path:** `TrainingPage` → `appStore` → `POST /api/assignments` → Prisma → `Notification` DB write

### 2.1 Entry point — `src/pages/TrainingPage.tsx`

`TrainingPage` renders two tabs: **Programs** (training programs list) and **Assignments** (driver assignment list). On mount it fetches:

```ts
fetchTrainingPrograms(user.fleet_id)
fetchAssignments(user.fleet_id)
fetchProfiles(user.fleet_id)   // for the driver selector in the modal
```

The "Assign Training" button opens a `Modal` with a form. Fields: driver (select from profiles), training program (select), due date, priority, notes.

### 2.2 Form submission — `appStore.addAssignment()`

On submit, the store calls:

```ts
api.post('/assignments', {
  userId: assignment.user_id,
  fleetId: assignment.fleet_id,
  trainingProgramId: assignment.training_program_id,
  dueDate: assignment.due_date,
  priority: assignment.priority,
})
```

After the API call succeeds, it immediately calls `fetchAssignments(fleet.id)` to refresh the list from the server (rather than optimistically inserting the new record).

### 2.3 Backend route — `src/routes/assignments.ts`

`POST /assignments` requires `authenticate` + `requireRole('ADMIN', 'SUPERVISOR')`. The body is validated by `createAssignmentSchema`.

The handler calls:

```ts
prisma.assignment.create({
  data: req.body,
  include: { user, fleet, module, trainingProgram },
})
```

**Side effect — Notification:** Immediately after creating the assignment, the route creates a `Notification` record:

```ts
prisma.notification.create({
  data: {
    message: `You have been assigned a new training: ${programName}`,
    notificationType: 'ASSIGNMENT',
    userId: assignment.userId,
    fleetId: assignment.fleetId,
    relatedAssignmentId: assignment.id,
  },
})
```

This notification appears in the driver's notification bell on next `fetchNotifications` call.

### 2.4 Prisma model — `Assignment`

Key fields in `prisma/schema.prisma`:
- `userId` — FK to `User`
- `fleetId` — FK to `Fleet` (tenancy scope)
- `trainingProgramId` — FK to `TrainingProgram` (nullable; can also assign a single `moduleId`)
- `status` — enum: `pending | in_progress | completed | overdue`
- `priority` — enum: `low | normal | high | urgent`
- `dueDate` — used by a scheduled reminder job to send alerts

### 2.5 Status lifecycle

Assignments start as `pending`. Status transitions happen via `PUT /assignments/:id` (called from the UI's edit modal or from the driver's training progress view). The `overdue` status is set by a background reminder job (`src/routes/reminders.ts`) that runs on a schedule and updates assignments past their `dueDate`.

**Side effects summary:** `Assignment` DB insert, `Notification` DB insert.

---

## 3. Compliance Tracking Flow

**Path:** `CompliancePage` → `appStore` → `GET /api/compliance/drivers` + `GET /api/compliance/requirements` → Prisma → expiry calculation → dashboard stats

### 3.1 Entry point — `src/pages/CompliancePage.tsx`

`CompliancePage` renders two sub-tabs: **Compliance Records** (per-driver compliance status) and **Documents** (CDL, medical cards, etc.). On mount:

```ts
fetchComplianceRecords(user.fleet_id)
fetchComplianceRequirements(user.fleet_id)
fetchDocuments(user.fleet_id)
fetchProfiles(user.fleet_id)
```

### 3.2 Fetching compliance records — `appStore.fetchComplianceRecords()`

Calls `GET /api/compliance/drivers`. The backend handler queries:

```ts
prisma.driverCompliance.findMany({
  where: { OR: [{ fleetId: user.fleetId }, { fleetId: null }] },
  include: { complianceRequirement: true, user: true },
})
```

Each `DriverCompliance` record has a `status` field (`COMPLIANT | EXPIRING_SOON | EXPIRED | NOT_STARTED | IN_PROGRESS | WAIVED`) and an `expirationDate`. The status is set when the record is created or updated — there is no automatic background recalculation; status must be updated explicitly via `PUT /compliance/drivers/:id`.

### 3.3 Fetching requirements — `appStore.fetchComplianceRequirements()`

Calls `GET /api/compliance/requirements`. The backend returns both fleet-specific requirements (`fleetId = user.fleetId`) and system-wide templates (`fleetId = null`). Each requirement has:
- `alertDays` — array of day thresholds (e.g., `[90, 60, 30, 14, 7]`) at which notifications should fire
- `renewalPeriod` — months until renewal is required
- `appliesTo` — array of `UserRole` strings

### 3.4 Document expiry tracking — `appStore.fetchDocuments()`

Calls `GET /api/documents`. Documents (`DriverDocument`) have an `expirationDate`. The frontend calculates expiry status locally:

```ts
const daysLeft = Math.ceil(
  (new Date(d.expiration_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
)
// Displayed as EXPIRING_SOON if daysLeft <= 14, else COMPLIANT
```

This client-side calculation means the displayed status can differ from the `status` field stored in the DB if the DB record hasn't been updated recently.

### 3.5 Adding / editing records

The "Add Compliance Record" modal calls `appStore.addComplianceRecord()`, which currently logs a warning and does nothing (`// API not yet implemented`). The "Add Document" modal calls `appStore.addDocument()`, which does call `POST /api/documents` and then re-fetches the document list.

### 3.6 Feeding into dashboard stats

`fetchDashboardStats` (called from `DashboardPage`) reads the already-loaded `documents` array from the store and computes:

```ts
const expiringDocs = documents.filter(d => {
  const exp = new Date(d.expiration_date)
  return exp > now && exp <= thirtyDays
})
```

This means dashboard stats are derived from client-side state, not a dedicated server aggregation endpoint. The stats are only as fresh as the last `fetchDocuments` call.

**Side effects summary:** No writes in the read path. Writes (`addDocument`) trigger a `POST /api/documents` DB insert followed by a re-fetch.

---

## 4. Dashboard Data Loading

**Path:** `DashboardPage` → `appStore` (multiple fetches) → `fetchDashboardStats` (client-side aggregation) → Zustand → React render

### 4.1 Entry point — `src/pages/DashboardPage.tsx`

On mount, a single `useEffect` fires a sequential load:

```ts
// Phase 1 — parallel fetches
await Promise.all([
  fetchProfiles(user.fleet_id),
  fetchVehicles(user.fleet_id),
  fetchAssignments(user.fleet_id),
  fetchComplianceRecords(user.fleet_id),
  fetchDocuments(user.fleet_id),
])
// Phase 2 — aggregation (reads from already-loaded store state)
await fetchDashboardStats(user.fleet_id)
```

The two-phase approach is intentional: `fetchDashboardStats` reads from the Zustand store (not the API), so it must run after the data fetches complete.

### 4.2 Parallel data fetches

Each fetch function follows the same pattern:
1. Set `loading.<key>: true`
2. Call `api.get(endpoint)` — Axios with Bearer token
3. Map the raw API response (camelCase from backend) to the frontend's snake_case types via inline mapping or `snakeToCamelProfile()`
4. Set the mapped array into store state
5. Set `loading.<key>: false` in both success and error paths

The five parallel fetches hit these backend endpoints:

| Store action | Endpoint | Prisma model |
|---|---|---|
| `fetchProfiles` | `GET /api/users?page=1&limit=500` | `User` |
| `fetchVehicles` | *(stub — returns `[]`)* | — |
| `fetchAssignments` | `GET /api/assignments?page=1&limit=500` | `Assignment` |
| `fetchComplianceRecords` | `GET /api/compliance/drivers` | `DriverCompliance` |
| `fetchDocuments` | `GET /api/documents` | `DriverDocument` |

### 4.3 Client-side aggregation — `fetchDashboardStats()`

This function does **no network I/O**. It reads from `get()` (the Zustand store snapshot) and computes:

```ts
const drivers = profiles.filter(p => p.role === 'DRIVER')
const activeDrivers = drivers.filter(p => p.is_active)
const overdueAssignments = assignments.filter(a => a.status === 'overdue')
const expiringDocs = documents.filter(d => exp > now && exp <= thirtyDays)
```

The result is written to `dashboardStats` in the store. React components subscribed to `dashboardStats` re-render automatically.

### 4.4 Rendering — charts and stat cards

`DashboardPage` renders:
- **4 + 4 `StatsCard` components** — read from `dashboardStats`
- **`BarChart` (Recharts)** — `assignmentsByStatus` computed inline from `assignments`
- **`PieChart` (Recharts)** — `complianceDistribution` computed inline from `complianceRecords`
- **Recent Assignments list** — `assignments.slice(0, 5)`
- **Expiring Documents list** — documents expiring within 60 days, sliced to 5

The loading gate is `if (loading.dashboard) return <LoadingSpinner />`. Because `loading.dashboard` is set to `false` by `fetchDashboardStats` (which runs after the parallel fetches), the spinner covers the full load sequence.

### 4.5 Data flow diagram

```
DashboardPage (mount)
  │
  ├─ Promise.all([...])
  │    ├─ GET /api/users          → profiles[]
  │    ├─ GET /api/assignments    → assignments[]
  │    ├─ GET /api/compliance/drivers → complianceRecords[]
  │    └─ GET /api/documents      → documents[]
  │
  └─ fetchDashboardStats()        (reads store, no I/O)
       └─ dashboardStats → StatsCard, BarChart, PieChart, lists
```

**Side effects summary:** None — this is a read-only flow. All writes happen on other pages.

---

## 5. BTW Session Flow

**Path:** `POST /api/btw/sessions` → Prisma `BtwSession` → trainer/trainee signatures → `completeSession` → webhook dispatch

### 5.1 Overview

Behind-the-Wheel (BTW) training is the hands-on driving evaluation component. A DRIVER_COACH or SUPERVISOR creates a session, evaluates the trainee against a skills checklist, both parties sign digitally, and the session is marked complete. There is currently no dedicated BTW page in the root frontend (`src/`); this flow lives entirely in the backend API and is consumed by the inner frontend or external clients.

### 5.2 Session creation — `POST /api/btw/sessions`

Requires `authenticate` + `requireRole('ADMIN', 'SUPERVISOR', 'DRIVER_COACH')`.

The request body is validated by `btwSessionSchema`:

```ts
z.object({
  traineeId: z.string(),
  sessionDate: z.string().datetime(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  routeType: z.enum(['city', 'highway', 'rural', 'backing', 'dock', 'mountain', 'mixed']),
  skillsChecklist: z.record(z.boolean()).default({}),
  overallRating: z.number().int().min(1).max(5).optional(),
  trainerNotes: z.string().optional(),
})
```

The handler creates a `BtwSession` record in Prisma:

```ts
prisma.btwSession.create({
  data: {
    traineeId,
    trainerId: req.user!.userId,   // trainer = authenticated user
    fleetId: req.user!.fleetId,
    sessionDate, startTime, endTime,
    totalMinutes,                  // computed from start/end
    routeType, skillsChecklist,
    overallRating, trainerNotes,
    status: 'pending',
  },
})
```

**Side effect:** `BtwSession` DB insert.

### 5.3 Trainer signature — `POST /api/btw/sessions/:id/trainer-sign`

Requires `authenticate`. Only the trainer (the user who created the session) can sign:

```ts
if (session.trainerId !== user.userId) {
  return res.status(403).json({ error: 'Only the trainer can sign' })
}
```

Updates `trainerSignature` and `trainerSignedAt` on the session. If the trainee has already signed, `completeSession()` is called immediately.

### 5.4 Trainee signature — `POST /api/btw/sessions/:id/trainee-sign`

Same pattern — only the trainee can sign. After updating `traineeSignature` and `traineeSignedAt`, if the trainer has already signed, `completeSession()` is called.

### 5.5 Session completion — `completeSession()`

This is a private helper function in `btw.ts`:

```ts
async function completeSession(sessionId: string) {
  return prisma.btwSession.update({
    where: { id: sessionId },
    data: { status: 'completed' },
  })
}
```

**Side effect — Webhook dispatch:** After `completeSession` returns, the route calls:

```ts
eventDispatcher.btwSessionCompleted(updated, session.trainee.fleetId)
```

`EventDispatcher` queries `prisma.webhook.findMany` for all active webhooks on the fleet subscribed to the `BTW_SESSION_COMPLETED` event, then POSTs the session payload to each webhook URL with up to 3 retries and exponential backoff. Results are logged but not surfaced to the caller.

**Missing side effect:** `completeSession` does **not** create a `CompletionRecord`. This means BTW completions are invisible to the dashboard's `completedTrainings` counter and to the driver's training history. A `CompletionRecord` linked to the trainee and the session should be created here.

### 5.6 Manual completion — `POST /api/btw/sessions/:id/complete`

Requires `ADMIN | SUPERVISOR | DRIVER_COACH`. Validates that both signatures are present before calling `completeSession()`. This is the fallback path if the signature-triggered auto-completion fails.

### 5.7 Trainee summary — `GET /api/btw/trainee/:traineeId/summary`

Returns aggregated stats for a trainee:
- `totalHours` — sum of `totalMinutes` across completed sessions ÷ 60
- `averageRating` — mean of `overallRating` across rated sessions
- `skillsPracticed` — frequency count of each skill from `skillsChecklist` records
- `hoursByRouteType` — hours broken down by `routeType`
- `recentSessions` — last 5 completed sessions

This is a read-only aggregation — all computation happens in JavaScript after fetching the sessions from Prisma. For large trainee histories this could be slow; a DB-level aggregation query would be more efficient.

### 5.8 Data flow diagram

```
Client (DRIVER_COACH)
  │
  ├─ POST /api/btw/sessions          → BtwSession (status: pending)
  │
  ├─ POST /api/btw/sessions/:id/trainer-sign
  │    └─ trainerSignature set
  │
  ├─ POST /api/btw/sessions/:id/trainee-sign
  │    └─ traineeSignature set
  │         └─ both signed? → completeSession()
  │                             ├─ BtwSession.status = 'completed'
  │                             └─ eventDispatcher.btwSessionCompleted()
  │                                  └─ POST to fleet webhooks (async, retried)
  │
  └─ GET /api/btw/trainee/:id/summary  → aggregated stats (read-only)
```

**Side effects summary:** `BtwSession` insert (creation), `BtwSession` update (signatures + completion), webhook HTTP POSTs (async, fire-and-forget from the caller's perspective).
