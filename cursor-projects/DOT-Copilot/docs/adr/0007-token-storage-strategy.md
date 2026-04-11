# ADR-0007: Token Storage Strategy

**Status:** Proposed — awaiting engineering lead sign-off  
**Date:** 2026-04-10  
**Deciders:** Engineering lead, security reviewer  
**Technical Story:** Flagged in code review session (annotation on `src/store/authStore.ts`)

## Context

The current Express backend issues JWT access tokens (15-minute lifetime) and refresh tokens (7-day lifetime). Both are stored in `localStorage` by the root frontend (`src/lib/supabase.ts` / `api.ts`):

```ts
// src/lib/supabase.ts (api module)
localStorage.setItem('accessToken', accessToken)
localStorage.setItem('refreshToken', refreshToken)
```

`localStorage` is accessible to any JavaScript executing on the page. This means:

1. **XSS vulnerability**: A single XSS injection (e.g., via a malicious npm package, a stored XSS in a user-supplied field, or a compromised CDN asset) can exfiltrate both tokens. The attacker gains a 7-day session window via the refresh token.
2. **Token persistence**: Tokens survive tab close and browser restart. A shared or public computer leaves tokens accessible to the next user.
3. **No `SameSite` protection**: `localStorage` has no equivalent of `SameSite=Strict` — tokens are available to any script on the origin regardless of how the page was navigated to.

This decision applies to the Express JWT layer. If ADR-0006 is accepted (Supabase as system of record), Supabase Auth handles token storage via its own secure session management and this ADR becomes partially moot — but the pattern documented here should still be applied to the Express BFF layer.

## Decision

**Move to memory-only access token + `HttpOnly` cookie refresh token.**

- **Access token**: stored in a JavaScript module-level variable only (not `localStorage`, not `sessionStorage`). Lost on page refresh — recovered via silent refresh.
- **Refresh token**: stored in an `HttpOnly`, `Secure`, `SameSite=Strict` cookie set by the backend on login and refresh. Never accessible to JavaScript.
- **Silent refresh**: on page load (or when the access token is absent from memory), the frontend calls `POST /api/auth/refresh` with the cookie automatically attached by the browser. The backend validates the cookie and returns a new access token in the response body.

## Alternatives Considered

### Option A — Memory-only access token + HttpOnly cookie refresh token (recommended)

**Pros:**
- Refresh token is never accessible to JavaScript — XSS cannot exfiltrate it
- Access token loss on refresh is acceptable given the 15-minute lifetime and silent refresh
- `SameSite=Strict` prevents CSRF on the refresh endpoint
- No changes to the access token format or validation logic

**Cons:**
- Requires backend changes: `POST /api/auth/login` and `POST /api/auth/refresh` must set/read a cookie
- CORS configuration must allow credentials (`credentials: 'include'` on the Axios instance)
- Mobile clients (React Native, if applicable) cannot use `HttpOnly` cookies — need a separate strategy
- Silent refresh adds one network round-trip on every page load

### Option B — Keep localStorage (current)

**Pros:**
- No changes required
- Works identically across web and mobile

**Cons:**
- XSS can exfiltrate both tokens
- 7-day refresh token window gives attackers extended access
- Violates OWASP ASVS Level 2 session management requirements

### Option C — sessionStorage for access token + localStorage for refresh token

**Pros:**
- Access token cleared on tab close
- Slightly reduces the window for shared-computer attacks

**Cons:**
- Both are still accessible to JavaScript — XSS impact unchanged
- Refresh token still persists across sessions

### Option D — Supabase Auth (if ADR-0006 Option A is accepted)

Supabase Auth stores sessions in `localStorage` by default but supports `persistSession: false` (memory-only) and can be configured to use cookies via a custom storage adapter.

**Pros:**
- Managed by Supabase — no custom implementation
- Supports PKCE flow for additional security

**Cons:**
- Requires ADR-0006 Option A to be accepted first
- Supabase's default `localStorage` storage has the same XSS risk unless explicitly configured

## Decision Rationale

Option A provides the strongest security posture achievable without a full auth system replacement. The `HttpOnly` cookie pattern is the industry standard for web application session management (OWASP, RFC 6749 Section 10.3).

The implementation cost is bounded: 3 backend route changes (login, refresh, logout) + 2 frontend changes (Axios `withCredentials`, remove `localStorage` calls).

## Consequences

### Positive
- Refresh token is inaccessible to JavaScript — eliminates the primary XSS token theft vector
- Compliant with OWASP ASVS Level 2 session management (V3.3, V3.4)
- Access token in memory means it cannot be read by browser extensions or devtools storage inspection

### Negative
- Page refresh requires a silent refresh round-trip (~50–100ms added to initial load)
- CORS must be configured to allow credentials — `Access-Control-Allow-Origin` cannot be `*`
- Mobile clients need a separate token storage strategy (secure keychain / encrypted storage)
- The in-memory blacklist issue (ADR context: process restart clears blacklist) is not resolved by this change — still requires Redis (see code review annotation on `src/utils/jwt.ts`)

### Neutral
- `logout` endpoint must clear the cookie (`res.clearCookie('refreshToken')`) in addition to blacklisting the token
- The `loadTokens()` function in `api.ts` is replaced by a `silentRefresh()` call on app init

## Implementation Notes

**Backend changes (`cursor-projects/DOT-Copilot/backend/`):**

```ts
// POST /api/auth/login — set HttpOnly cookie
res.cookie('refreshToken', refreshToken, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  path: '/api/auth/refresh',        // scope cookie to refresh endpoint only
})
res.json({ accessToken, user })     // do NOT include refreshToken in body

// POST /api/auth/refresh — read from cookie
const refreshToken = req.cookies.refreshToken
if (!refreshToken) return res.status(401).json({ error: 'No refresh token' })

// POST /api/auth/logout — clear cookie
res.clearCookie('refreshToken', { path: '/api/auth/refresh' })
```

**Frontend changes (`src/lib/supabase.ts` / `api.ts`):**

```ts
// Remove localStorage calls
// localStorage.setItem('accessToken', ...) → delete
// localStorage.setItem('refreshToken', ...) → delete

// Store access token in module-level variable only
let accessToken: string | null = null

// Add withCredentials to Axios instance
const api = axios.create({
  baseURL: '/api',
  withCredentials: true,  // sends cookies on every request
})

// Replace loadTokens() with silentRefresh()
export async function silentRefresh(): Promise<string | null> {
  try {
    const res = await axios.post('/api/auth/refresh', {}, { withCredentials: true })
    accessToken = res.data.accessToken
    return accessToken
  } catch {
    return null
  }
}
```

**CORS configuration (`server.ts`):**

```ts
app.use(cors({
  origin: process.env.FRONTEND_URL,  // must be explicit, not '*'
  credentials: true,
}))
```

## Related Decisions

- [ADR-0006: Canonical application stack decision](./0006-canonical-application-stack-decision.md)
- [ADR-0008: DB migration sync strategy](./0008-db-migration-sync-strategy.md)

## References

- OWASP ASVS V3 Session Management Requirements
- [OWASP JWT Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html)
- Code review annotation: `src/store/authStore.ts` lines 1–5 (JWT in localStorage)
- Code review annotation: `cursor-projects/DOT-Copilot/backend/src/utils/jwt.ts` (in-memory blacklist)

---

**Last Updated:** 2026-04-10
