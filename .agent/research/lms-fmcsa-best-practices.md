# LMS & FMCSA Compliance Research Findings

**Date**: 2026-04-06
**Sources**: Tavily deep search (3 queries, 18 results)
**Provenance**: Composio TAVILY_MCP_TAVILY_SEARCH, advanced depth

---

## 1. Fleet Compliance Software Landscape

### Key Competitors & Features
- **FleetDrive 360** (fleetdrive360.com) — Centralized FMCSA/DOT compliance document management, mobile-first, real-time alerts
- **HVI Fleet Compliance** (heavyvehicleinspection.com) — DOT/FMCSA features for 2026: automated inspection scheduling, ELD integration, driver qualification file management, CSA score tracking
- **Luma LMS** (lumalms.com) — Compliance-focused LMS with automated training assignment, certificate generation, audit trail
- **TalentLMS** — General LMS with compliance training templates

### Feature Baseline for Production-Ready Fleet LMS
1. **ELDT compliance** — Must report to FMCSA Training Provider Registry (TPR)
2. **Driver Qualification Files (DQF)** — CDL, medical card, MVR, employment history
3. **Automated expiration alerts** — 90/60/30/14/7 day windows (DOT-Copilot already has this)
4. **Certificate generation** — PDF certificates with digital signatures
5. **Audit trail** — Complete training history with timestamps, IP addresses, completion evidence
6. **Mobile-first** — Drivers in the field need responsive/PWA access
7. **Multi-language** — English, Spanish minimum (DOT-Copilot has en/es/ht)
8. **SCORM/xAPI support** — For third-party content integration
9. **CSA score integration** — Connect to FMCSA SAFER system

## 2. Multi-Tenant Security Architecture

### Best Practices (from techbuddies.io, oneuptime.com)
1. **Tenant identity in JWT** — fleetId/tenantId must be in the JWT claims, resolved during login from the user's profile
2. **RLS as defense-in-depth** — PostgreSQL RLS should be the LAST line of defense, not the only one
3. **Application-level scoping** — Every query must include `WHERE fleet_id = ?` even with RLS enabled
4. **Middleware pattern** — `scopeToFleet` middleware that extracts tenant from JWT and injects into all Prisma queries
5. **Test isolation** — Integration tests must prove cross-tenant access is impossible
6. **Connection-level tenant** — For maximum isolation, set `app.current_setting('app.tenant_id')` per connection and reference in RLS policies

### DOT-Copilot Gap Assessment
- **CRITICAL**: JWT does not carry `fleetId` — tenant identity must be resolved via DB lookup on every request
- **HIGH**: Several routes accept `fleetId` as query parameter — attacker can enumerate fleets
- **MEDIUM**: RLS policies are correctly hardened but application-level scoping is inconsistent

## 3. FMCSA ELDT Requirements

### Regulatory Requirements (from tpr.fmcsa.dot.gov)
1. **Training Provider Registry (TPR)** — All ELDT providers must register with FMCSA
2. **Electronic record submission** — Training certificates must be submitted electronically to TPR
3. **Curricula requirements** — Theory (classroom) + BTW (behind-the-wheel) components
4. **Record retention** — Training records must be retained for **3 years** minimum
5. **Assessment standards** — Written knowledge test + skills assessment with documented results
6. **Instructor qualifications** — Must meet specific experience and certification requirements

### Compliance Checklist for DOT-Copilot
- [ ] TPR integration for certificate submission
- [ ] 3-year record retention with audit trail
- [ ] Structured curricula matching FMCSA requirements
- [ ] BTW session recording with instructor credentials (partially implemented)
- [ ] Knowledge test integrity (proctoring, randomization)
- [ ] Completion evidence (time-on-task, video position tracking)

---

## Recommendations for Production Readiness

1. **Immediate** (Phase 0): Fix multi-tenant isolation — this is a regulatory liability, not just a security bug. FMCSA requires fleet-specific training records.
2. **Short-term** (Phase 3): Add tenant isolation tests that prove Fleet A cannot see Fleet B's training records — this is auditable evidence of data separation.
3. **Medium-term** (Phase 7): Research TPR API integration for automatic ELDT certificate submission.
4. **Long-term**: Consider SOC 2 Type II certification — competitors like FleetDrive 360 market this as a differentiator.

---

## Verified refresh (2026-04-07)

**Method:** Composio `COMPOSIO_SEARCH_TOOLS` + `COMPOSIO_MULTI_EXECUTE_TOOL` (`COMPOSIO_SEARCH_WEB`, `EXA_ANSWER`), session id recorded in repo [outputs/deepresearch-fleet-lms.provenance.md](../../outputs/deepresearch-fleet-lms.provenance.md).

**Confirmed / expanded:**

- TPR expects **electronic submission** of ELDT training records; **three-year retention** remains the documented baseline in FMCSA TPR materials (see PDFs linked in [outputs/deepresearch-fleet-lms.md](../../outputs/deepresearch-fleet-lms.md)).
- Multi-tenant LMS security aligns with **OWASP Multi-Tenant Cheat Sheet** and **Azure multitenancy checklist** (tenant context early, least privilege, audit trails).
- **SCORM** remains the dominant packaged-content standard; **xAPI** fits extended audit / cross-system activity evidence for compliance scenarios.

**Codebase actions taken (same date):** JWT payloads now carry `fleetId`; `/api/users` routes enforce fleet scoping; login password minimum aligned to 8 characters; optional `PASSWORD_RESET_SECRET` and `METRICS_API_KEY` in env validation; `x-request-id` correlation on API requests.
