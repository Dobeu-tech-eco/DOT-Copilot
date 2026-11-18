# PR 312 follow-up — November 18, 2026

## Vercel diagnosis

Deployment `dpl_J9tkKhzDw4X4j6C5EEfngp9MPyiN` is a preview in project `prj_CxtQ5fBDzLj0fm96XoeEtb6JkWBn` (dobeutechnology/dot-copilot).

Authenticated CLI inspection and GET `/v13/deployments/<id>` report `readyState: ERROR`, `errorCode: BUILD_FAILED`, `errorMessage: Resource provisioning failed`, and no build statistics. CLI `inspect --logs` returns only Error; GET `/v3/deployments/<id>/events?direction=forward&limit=100` returns an empty array. There is no compiler/install log error to fix.

Effective settings match the repo: framework vite, buildCommand npm run build, outputDirectory dist. Node version is 24.x. Build Machine is fixed Standard (4 cores, 8192 MB), selected by project-setting. Neither concurrent-build nor system-build queue flag is set.

Evidence locates the failure at Vercel resource provisioning, before an application build log is available. It does NOT identify an account limit or a misconfigured setting. Build Machine is an observed setting, not a proven cause. Vercel project/account investigation or support must explain this deployment's provisioning error; do not silently change region, machine, plan, Node version or environment values. No deployment retry or setting change was performed. Merge remains held.

## Review disposition

- Copilot 4613029011: fixed. Explicit login with missing/inactive profile rejects with an actionable store error; initialization still fails closed.
- Copilot 4613029045 and Codex P2 4612883284: fixed together. Same-user TOKEN_REFRESHED/USER_UPDATED preserves the mounted authenticated route while deferred session/profile validation runs. Failed validation still revokes admission; sign-out/account-change events still clear identity immediately.
- Copilot 4613028954: explicitly deferred and remains open. The current completion policy hides historical fleet-A evidence after a driver transfers to fleet B. Removing the current-owner check would re-expose historically forged/mis-associated rows. A safe repair requires trusted immutable fleet-at-completion provenance, an audit/backfill rule for legacy rows and transfer/retention acceptance tests. This is beyond the five-flaw repair and cannot be inferred from mutable profiles. This limitation needs owner adjudication before merge; the comment is not resolved.

## Receipt

Four new auth regression cases pass; total 72 tests across five files. Lint/build pass; existing Browserslist and bundle-size warnings persist. SQL is unchanged, so prior 108/108 replay evidence remains applicable. No live database changes, merge or manual deployment. Rollback point for this follow-up: f8ed84ff39c3a15c03cfdccadb01316a5b2ef558.
