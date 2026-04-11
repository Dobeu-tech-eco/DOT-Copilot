# Game Day Scenarios — DOT-Copilot Resilience Testing

Incident simulation scenarios for exercising system resilience across all three layers.
Run in **staging** unless explicitly marked as safe for production.

Each scenario follows the same structure:
- **Failure injected** — what breaks and how to trigger it
- **Expected behavior** — what the system should do (graceful degradation, retry, error message)
- **Success criteria** — observable signals that the system handled it correctly
- **How to run safely** — exact commands or steps; production guard rails

---

## Layer 1 — Backend API

### Scenario 1.1 — JWT Blacklist Loss on Process Restart

**Failure injected:**
The Express backend stores the token blacklist in a module-level `Set` in memory. A process restart (crash, deploy, Azure App Service restart) wipes the blacklist. Tokens that were explicitly revoked (via logout) become valid again.

```bash
# Trigger: log out a user, capture the access token, then restart the process
TOKEN=$(curl -s -X POST https://staging-api.azurewebsites.net/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPass123!"}' \
  | jq -r '.accessToken')

# Log out (blacklists the token)
curl -X POST https://staging-api.azurewebsites.net/api/auth/logout \
  -H "Authorization: Bearer $TOKEN"

# Verify token is rejected (expect 401)
curl -s -o /dev/null -w "%{http_code}" \
  https://staging-api.azurewebsites.net/api/users/me \
  -H "Authorization: Bearer $TOKEN"
# Expected: 401

# Restart the App Service instance
az webapp restart --resource-group rg-dot-copilot-staging --name dot-copilot-backend-staging

# Wait for restart (~30s), then retry the blacklisted token
sleep 35
curl -s -o /dev/null -w "%{http_code}" \
  https://staging-api.azurewebsites.net/api/users/me \
  -H "Authorization: Bearer $TOKEN"
# BUG: returns 200 — blacklist was lost
```

**Expected behavior:**
The token should remain rejected after restart. The blacklist must survive process restarts.

**Success criteria:**
- `GET /api/users/me` with the blacklisted token returns `401` both before and after restart
- No `200` response for a previously logged-out token

**How to run safely:**
- Run in staging only
- Use a dedicated test user account
- The fix is to move the blacklist to Redis (already in the Docker Compose stack). See code review annotation on `src/utils/jwt.ts`.

---

### Scenario 1.2 — Database Connection Pool Exhaustion

**Failure injected:**
Simulate all Prisma connection pool slots being held by long-running queries, causing new requests to queue and eventually time out.

```bash
# Trigger: open many concurrent slow queries via a load test
# Install: npm install -g autocannon
autocannon \
  -c 50 \                          # 50 concurrent connections
  -d 30 \                          # 30 seconds
  -m GET \
  -H "Authorization: Bearer $TOKEN" \
  https://staging-api.azurewebsites.net/api/assignments?page=1&limit=500

# Simultaneously, watch the backend logs for pool exhaustion errors
az webapp log tail \
  --resource-group rg-dot-copilot-staging \
  --name dot-copilot-backend-staging \
  | grep -i "pool\|timeout\|connection"
```

**Expected behavior:**
- Requests that cannot acquire a connection within the timeout should return `503 Service Unavailable` with a `Retry-After` header
- The health endpoint (`GET /health`) should remain responsive even under pool pressure
- Pool exhaustion should trigger an alert (Azure Monitor CPU/connection metric)

**Success criteria:**
- `GET /health` returns `200` throughout the test
- Queued requests return `503` (not `500` or hang indefinitely)
- Pool recovers within 60 seconds after load stops
- Azure Monitor alert fires if `DATABASE_POOL_SIZE` connections are all active for >30s

**How to run safely:**
- Staging only; use a separate test database if possible
- Set `DATABASE_POOL_SIZE=5` in staging to make exhaustion easier to trigger
- Monitor `pg_stat_activity` during the test: `SELECT count(*) FROM pg_stat_activity WHERE datname = 'dot_copilot';`

---

### Scenario 1.3 — Rate Limiter Misconfiguration / Bypass

**Failure injected:**
The auth rate limiter (`authLimiter`: 10 requests per 15 minutes) is bypassed by rotating IP addresses or by a misconfigured `trust proxy` setting that allows `X-Forwarded-For` spoofing.

```bash
# Test 1: Verify rate limiter fires after 10 requests
for i in $(seq 1 12); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST https://staging-api.azurewebsites.net/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrong"}')
  echo "Request $i: $STATUS"
done
# Expected: requests 11+ return 429

# Test 2: Attempt bypass via X-Forwarded-For spoofing
for i in $(seq 1 12); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST https://staging-api.azurewebsites.net/api/auth/login \
    -H "Content-Type: application/json" \
    -H "X-Forwarded-For: 10.0.0.$i" \
    -d '{"email":"test@example.com","password":"wrong"}')
  echo "Request $i (spoofed IP): $STATUS"
done
# BUG if all return 200/401: rate limiter is using spoofed IP as key
```

**Expected behavior:**
- After 10 failed login attempts from the same IP, subsequent attempts return `429 Too Many Requests`
- `X-Forwarded-For` spoofing does not bypass the limiter (requires `app.set('trust proxy', 1)` with Azure's known proxy IP range)
- The `Retry-After` header is present on `429` responses

**Success criteria:**
- Request 11 returns `429` in Test 1
- Test 2 also triggers `429` after 10 requests (spoofed IPs do not each get their own 10-request window)
- `Retry-After` header present on `429` responses

**How to run safely:**
- Staging only; use a dedicated test account
- Reset the rate limiter between tests by restarting the process or waiting 15 minutes

---

### Scenario 1.4 — Auth Service Timeout (Prisma Query Hangs)

**Failure injected:**
Simulate a slow database by introducing an artificial delay in the Prisma query path, causing the login endpoint to hang and eventually time out.

```bash
# Trigger via pg_sleep in a concurrent session (requires DB access)
psql $STAGING_DATABASE_URL -c "
  SELECT pg_sleep(30);  -- holds a connection for 30s
" &

# Simultaneously attempt login
time curl -X POST https://staging-api.azurewebsites.net/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPass123!"}'
```

**Expected behavior:**
- The login endpoint should time out after a configurable threshold (e.g., 5 seconds) and return `503` or `504`
- The timeout should be logged with the query duration
- Other endpoints (health check, non-DB routes) should remain responsive

**Success criteria:**
- Login returns `503`/`504` within 5–10 seconds (not after 30s)
- `GET /health` returns `200` throughout
- Error is logged with `queryDuration` field
- No unhandled promise rejection in logs

**How to run safely:**
- Staging only
- The `pg_sleep` session will release automatically after 30s
- Add a Prisma query timeout: `datasources: { db: { url: process.env.DATABASE_URL + '&connect_timeout=5&statement_timeout=5000' } }`

---

## Layer 2 — Frontend / Zustand Store

### Scenario 2.1 — Access Token Expiry Mid-Session

**Failure injected:**
The access token expires (15-minute lifetime) while the user is actively using the dashboard. The next API call should trigger a silent refresh via the refresh token.

```bash
# Trigger: shorten the token lifetime for testing
# In staging backend .env:
JWT_EXPIRES_IN=30s   # 30-second access token

# Then in the browser:
# 1. Log in
# 2. Wait 35 seconds
# 3. Click any action that triggers an API call (e.g., navigate to Compliance page)
# 4. Observe network tab
```

**Expected behavior:**
- The first API call after expiry receives a `401`
- The Axios response interceptor catches the `401`, calls `POST /api/auth/refresh`
- The original request is retried with the new access token
- The user sees no error — the action completes transparently

**Success criteria:**
- No error toast or redirect to login page
- Network tab shows: original request → `401` → `POST /auth/refresh` → `200` → original request retry → `200`
- `localStorage` (or memory) contains a new access token after the refresh

**How to run safely:**
- Use `JWT_EXPIRES_IN=30s` in staging only; reset to `15m` after testing
- Test with a real user session, not a service account

---

### Scenario 2.2 — API Returns 500 During Dashboard Load

**Failure injected:**
One of the five parallel `fetchX` calls in `DashboardPage` returns a `500` error, leaving the Zustand store in a partially loaded state.

```bash
# Trigger: temporarily break one backend route in staging
# Option A: add a deliberate throw to the assignments route
# Option B: use a proxy to intercept and return 500 for /api/assignments

# Using mitmproxy (staging only):
mitmproxy --mode reverse:https://staging-api.azurewebsites.net \
  --modify-body '/api/assignments/~s/.*/{\"error\":\"Internal Server Error\"}' \
  --set response_code=500
```

**Expected behavior:**
- The failed fetch sets `loading.assignments = false` and `error.assignments = 'Failed to load assignments'`
- The dashboard renders with the data that did load (profiles, compliance, documents)
- An error state is shown in the Assignments section only (not a full-page error)
- The other four `fetchX` calls complete successfully

**Success criteria:**
- Dashboard renders (not blank, not spinner)
- Stats cards using `assignments` data show `0` or `—` rather than crashing
- An error message is visible in the Assignments section
- No unhandled React error boundary trigger
- `fetchDashboardStats` still runs and produces partial stats from available data

**How to run safely:**
- Use a staging environment with a proxy or feature flag
- Verify the error boundary in `src/components/ErrorBoundary.tsx` catches any uncaught errors

---

### Scenario 2.3 — Network Offline While Submitting a Form

**Failure injected:**
The user fills out the "Assign Training" modal and clicks Submit. The network goes offline between the button click and the API response.

```bash
# Trigger in browser DevTools:
# 1. Open the Assign Training modal and fill in all fields
# 2. Open DevTools → Network tab → set throttling to "Offline"
# 3. Click Submit
# 4. Observe the UI response
# 5. Restore network and observe recovery
```

**Expected behavior:**
- The submit button shows a loading state
- After the network timeout (Axios default: no timeout — this is a bug), the request fails with a network error
- An error toast or inline error message is shown: "Failed to save. Check your connection and try again."
- The modal remains open with the form data intact (not cleared)
- No duplicate submission occurs when the network is restored

**Success criteria:**
- Error message displayed within a reasonable timeout (≤10 seconds)
- Form data preserved in the modal after the error
- No duplicate assignment created when the user resubmits after restoring network
- Axios instance has a `timeout` configured (currently missing — see performance annotation)

**How to run safely:**
- Browser DevTools only; no backend changes needed
- Test in staging to avoid creating test data in production

---

### Scenario 2.4 — Stale Zustand State After Logout

**Failure injected:**
User A logs in, loads the dashboard (populating the Zustand store with fleet A's data). User A logs out. User B logs in on the same browser tab. User B's dashboard briefly shows User A's data before the store is refreshed.

```bash
# Trigger:
# 1. Log in as User A (fleet A)
# 2. Navigate to Dashboard — note the driver count and fleet name
# 3. Log out
# 4. Log in as User B (fleet B, different driver count)
# 5. Observe the dashboard immediately after login — before fetchDashboardStats completes
```

**Expected behavior:**
- On logout, `useAuthStore.logout()` calls a store reset that clears ALL Zustand state (profiles, assignments, compliance, etc.)
- User B's dashboard shows a loading spinner until fresh data is fetched
- No data from User A's session is ever visible to User B

**Success criteria:**
- After logout, `useAppStore.getState().profiles` is `[]`
- After logout, `useAppStore.getState().assignments` is `[]`
- User B never sees User A's fleet name, driver count, or assignment data
- The store reset happens synchronously in the `logout()` action before navigation

**How to run safely:**
- Requires two test accounts in different fleets
- Can be tested in production with test accounts (read-only observation, no data mutation)
- **Current status:** `logout()` in `authStore.ts` does NOT call `useAppStore.getState().reset()` — this is a data leak bug. Fix: add `useAppStore.getState().reset()` to the logout action.

---

## Layer 3 — Infrastructure / Azure

### Scenario 3.1 — App Service Instance Restart (Cold Start Latency)

**Failure injected:**
The Azure App Service instance is restarted, simulating a crash recovery, a deploy, or an auto-heal trigger. Measures cold start latency and verifies the health check passes within the expected window.

```bash
# Trigger: restart the App Service
az webapp restart \
  --resource-group rg-dot-copilot-staging \
  --name dot-copilot-backend-staging

# Measure time to first healthy response
START=$(date +%s%3N)
until curl -sf https://dot-copilot-backend-staging.azurewebsites.net/health > /dev/null; do
  sleep 1
done
END=$(date +%s%3N)
echo "Cold start time: $((END - START))ms"
```

**Expected behavior:**
- The health endpoint returns `200` within 30 seconds of restart
- In-flight requests during restart receive `503` (App Service returns this automatically during restart)
- The JWT blacklist is empty after restart (known limitation — see Scenario 1.1)
- No database connection errors in the first 10 seconds (connection pool warms up)

**Success criteria:**
- Cold start time < 30 seconds
- `GET /health` returns `200` with `{ status: 'ok', db: 'connected' }` after restart
- No `500` errors in the first 60 seconds of traffic after restart
- Azure Monitor "App Service Restart" alert fires (verify alert is configured)

**How to run safely:**
- Staging only for measurement; production restart should only happen via slot swap
- Schedule during low-traffic window if testing in production
- Verify `WEBSITE_WARMUP_PATH=/health` is set in App Service configuration to trigger warmup before traffic is routed

---

### Scenario 3.2 — PostgreSQL Flexible Server Failover

**Failure injected:**
Trigger a manual failover of the PostgreSQL Flexible Server to its standby replica (if ZoneRedundant HA is enabled) or simulate a connection loss.

```bash
# Option A: Manual failover (requires ZoneRedundant HA — currently recommended to disable per cost review)
az postgres flexible-server restart \
  --resource-group rg-dot-copilot-staging \
  --name dot-copilot-db-staging \
  --failover-mode PlannedFailover

# Option B: Simulate connection loss by temporarily blocking the DB port via NSG
az network nsg rule update \
  --resource-group rg-dot-copilot-staging \
  --nsg-name dot-copilot-nsg-staging \
  --name AllowPostgres \
  --access Deny

# Wait 60 seconds, then restore
sleep 60
az network nsg rule update \
  --resource-group rg-dot-copilot-staging \
  --nsg-name dot-copilot-nsg-staging \
  --name AllowPostgres \
  --access Allow

# Monitor backend logs during the outage
az webapp log tail \
  --resource-group rg-dot-copilot-staging \
  --name dot-copilot-backend-staging \
  | grep -i "error\|connection\|pool"
```

**Expected behavior:**
- During the outage: API endpoints that require DB return `503` with a `Retry-After` header
- Health endpoint returns `{ status: 'degraded', db: 'disconnected' }` (not `500`)
- After connection is restored: Prisma reconnects automatically within 30 seconds
- No data loss for in-flight write operations (Prisma transaction rollback)

**Success criteria:**
- `GET /health` returns `200` with `db: 'disconnected'` during outage (not `500`)
- API endpoints return `503` (not `500`) during outage
- Prisma reconnects within 30 seconds of DB restoration
- No orphaned transactions in `pg_stat_activity` after recovery
- Azure Monitor "DB Connection Failed" alert fires during outage

**How to run safely:**
- Staging only
- Option B (NSG rule) is safer than Option A (actual failover) for testing
- Restore the NSG rule immediately if the test needs to be aborted
- Verify `DATABASE_URL` includes `?connect_timeout=10&pool_timeout=10` to prevent indefinite hangs

---

### Scenario 3.3 — Azure Blob Storage Unavailable (Document Upload Path)

**Failure injected:**
Azure Blob Storage becomes unavailable, blocking document uploads (CDL scans, medical cards, training certificates).

```bash
# Trigger: revoke the App Service's managed identity access to the storage account
az role assignment delete \
  --assignee $(az webapp identity show \
    --resource-group rg-dot-copilot-staging \
    --name dot-copilot-backend-staging \
    --query principalId -o tsv) \
  --role "Storage Blob Data Contributor" \
  --scope $(az storage account show \
    --resource-group rg-dot-copilot-staging \
    --name dotcopilotdocsstaging \
    --query id -o tsv)

# Attempt a document upload
curl -X POST https://dot-copilot-backend-staging.azurewebsites.net/api/documents \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test-cdl.pdf" \
  -F "type=CDL"

# Restore access after testing
az role assignment create \
  --assignee <principal-id> \
  --role "Storage Blob Data Contributor" \
  --scope <storage-account-id>
```

**Expected behavior:**
- Document upload returns `503` with message: "Document storage temporarily unavailable. Please try again later."
- The error is logged with the Azure Storage error code
- Other API endpoints (not involving file storage) continue to work normally
- No partial document records are created in the DB (upload and DB insert should be transactional)

**Success criteria:**
- Upload endpoint returns `503` (not `500`) with a user-friendly message
- No `DriverDocument` record created in DB when storage fails
- Other endpoints (`GET /api/assignments`, `GET /api/compliance`) return `200`
- Azure Monitor "Storage Auth Failure" alert fires
- Role assignment restoration takes effect within 60 seconds

**How to run safely:**
- Staging only
- Restore the role assignment immediately after the test
- Verify the role assignment is restored: `az role assignment list --assignee <principal-id>`

---

### Scenario 3.4 — Azure Static Web App CDN Cache Stale After Deploy

**Failure injected:**
A new frontend build is deployed to Azure Static Web Apps. The CDN serves the old cached version to users, causing a version mismatch between the frontend JavaScript and the backend API.

```bash
# Trigger: deploy a new frontend build
npm run build
swa deploy ./dist \
  --app-name dot-copilot-frontend-staging \
  --resource-group rg-dot-copilot-staging \
  --env production

# Immediately check what version the CDN is serving
curl -I https://dot-copilot-staging.azurestaticapps.net/assets/index-*.js \
  | grep -i "cache-control\|etag\|last-modified\|x-azure-ref"

# Check if the old bundle hash is still being served
curl -s https://dot-copilot-staging.azurestaticapps.net/ \
  | grep -o 'src="/assets/index-[^"]*"'
```

**Expected behavior:**
- After deploy, the CDN should serve the new `index.html` immediately (HTML is not cached by default in SWA)
- Hashed JS/CSS assets (`index-abc123.js`) are cached indefinitely — this is correct because the hash changes on each build
- The old hashed assets remain accessible for users with open tabs (graceful degradation)
- Users who hard-refresh get the new version immediately

**Success criteria:**
- `index.html` `Cache-Control` header is `no-cache` or `max-age=0`
- New hashed JS bundle is served within 60 seconds of deploy
- Old hashed JS bundle still returns `200` for 24 hours (CDN retention)
- No `404` errors for JS/CSS assets in the first hour after deploy
- API version header (`X-API-Version`) in backend responses matches the frontend's expected version

**How to run safely:**
- Safe to run in staging and production (read-only observation)
- Add `staticwebapp.config.json` to control cache headers:

```json
{
  "routes": [
    {
      "route": "/assets/*",
      "headers": { "Cache-Control": "public, max-age=31536000, immutable" }
    },
    {
      "route": "/*",
      "headers": { "Cache-Control": "no-cache" }
    }
  ]
}
```

---

## Running All Scenarios

### Prerequisites

```bash
# Set staging environment variables
export STAGING_API=https://dot-copilot-backend-staging.azurewebsites.net
export STAGING_DB_URL=<staging-database-url>
export RESOURCE_GROUP=rg-dot-copilot-staging

# Get a test token
export TOKEN=$(curl -s -X POST $STAGING_API/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"gameday-test@example.com","password":"GameDay123!"}' \
  | jq -r '.accessToken')
```

### Scenario execution order (recommended)

Run in this order to avoid scenarios interfering with each other:

1. **3.4** (CDN cache) — read-only, safe first
2. **2.1** (token expiry) — browser only, no backend changes
3. **2.3** (offline form) — browser only, no backend changes
4. **2.4** (stale store) — browser only, no backend changes
5. **1.3** (rate limiter) — staging only, auto-resets after 15 min
6. **2.2** (500 during load) — staging proxy, reversible
7. **1.4** (auth timeout) — staging DB, auto-releases after 30s
8. **3.3** (blob storage) — staging only, restore role immediately after
9. **1.2** (pool exhaustion) — staging only, recovers automatically
10. **3.1** (App Service restart) — staging only, ~30s downtime
11. **3.2** (Postgres failover) — staging only, ~60s downtime
12. **1.1** (JWT blacklist loss) — staging only, requires process restart

### Tracking results

| Scenario | Date | Pass/Fail | Notes |
|---|---|---|---|
| 1.1 JWT blacklist loss | | | |
| 1.2 DB pool exhaustion | | | |
| 1.3 Rate limiter bypass | | | |
| 1.4 Auth timeout | | | |
| 2.1 Token expiry mid-session | | | |
| 2.2 500 during dashboard load | | | |
| 2.3 Offline form submit | | | |
| 2.4 Stale store after logout | | | |
| 3.1 App Service restart | | | |
| 3.2 Postgres failover | | | |
| 3.3 Blob storage unavailable | | | |
| 3.4 CDN cache stale | | | |
