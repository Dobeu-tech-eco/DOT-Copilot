# Git Cleanup Plan

**⚠️ None of the commands below are executed automatically. Review each section and run manually.**

---

## Part 1 — Delete Stale Remote Branches

There are **52 stale remote branches** to delete: 49 dependabot branches (all merged or superseded) and 3 feature branches that have been merged into `main`.

### 1.1 Verify a branch is merged before deleting

```bash
# Check if a branch has been merged into main
git branch -r --merged origin/main | grep <branch-name>
# If it appears in the output, it is safe to delete.
```

### 1.2 Delete all dependabot branches (batch)

All dependabot branches below have been superseded by newer versions or merged. Run in one pass:

```bash
git push origin --delete \
  dependabot/github_actions/actions/checkout-6 \
  dependabot/github_actions/actions/download-artifact-8 \
  dependabot/github_actions/actions/upload-artifact-7 \
  dependabot/github_actions/azure/login-3 \
  dependabot/github_actions/docker/setup-buildx-action-4 \
  dependabot/npm_and_yarn/cursor-projects/DOT-Copilot/backend/ajv-6.14.0 \
  dependabot/npm_and_yarn/cursor-projects/DOT-Copilot/backend/brace-expansion-1.1.13 \
  dependabot/npm_and_yarn/cursor-projects/DOT-Copilot/backend/development-0f3948e314 \
  dependabot/npm_and_yarn/cursor-projects/DOT-Copilot/backend/diff-4.0.4 \
  dependabot/npm_and_yarn/cursor-projects/DOT-Copilot/backend/express-rate-limit-8.2.2 \
  dependabot/npm_and_yarn/cursor-projects/DOT-Copilot/backend/express-rate-limit-8.3.2 \
  dependabot/npm_and_yarn/cursor-projects/DOT-Copilot/backend/flatted-3.4.2 \
  dependabot/npm_and_yarn/cursor-projects/DOT-Copilot/backend/handlebars-4.7.9 \
  dependabot/npm_and_yarn/cursor-projects/DOT-Copilot/backend/minimatch-3.1.5 \
  dependabot/npm_and_yarn/cursor-projects/DOT-Copilot/backend/multer-2.1.1 \
  dependabot/npm_and_yarn/cursor-projects/DOT-Copilot/backend/multi-53c5c826b6 \
  dependabot/npm_and_yarn/cursor-projects/DOT-Copilot/backend/multi-859649822f \
  dependabot/npm_and_yarn/cursor-projects/DOT-Copilot/backend/nodemailer-8.0.4 \
  dependabot/npm_and_yarn/cursor-projects/DOT-Copilot/backend/nodemailer-8.0.5 \
  dependabot/npm_and_yarn/cursor-projects/DOT-Copilot/backend/npm_and_yarn-eb4f97c0ca \
  dependabot/npm_and_yarn/cursor-projects/DOT-Copilot/backend/path-to-regexp-0.1.13 \
  dependabot/npm_and_yarn/cursor-projects/DOT-Copilot/backend/picomatch-2.3.2 \
  dependabot/npm_and_yarn/cursor-projects/DOT-Copilot/backend/production-7077fa1a4e \
  dependabot/npm_and_yarn/cursor-projects/DOT-Copilot/backend/qs-6.14.2 \
  dependabot/npm_and_yarn/cursor-projects/DOT-Copilot/backend/sentry/node-10.47.0 \
  dependabot/npm_and_yarn/cursor-projects/DOT-Copilot/frontend/axios-1.13.5 \
  dependabot/npm_and_yarn/cursor-projects/DOT-Copilot/frontend/axios-1.14.0 \
  dependabot/npm_and_yarn/cursor-projects/DOT-Copilot/frontend/axios-1.15.0 \
  dependabot/npm_and_yarn/cursor-projects/DOT-Copilot/frontend/development-bf1c11410c \
  dependabot/npm_and_yarn/cursor-projects/DOT-Copilot/frontend/jsdom-29.0.2 \
  dependabot/npm_and_yarn/cursor-projects/DOT-Copilot/frontend/picomatch-4.0.4 \
  dependabot/npm_and_yarn/cursor-projects/DOT-Copilot/frontend/production-d9de59cc9a \
  dependabot/npm_and_yarn/cursor-projects/DOT-Copilot/frontend/react-router-dom-7.14.0 \
  dependabot/npm_and_yarn/cursor-projects/DOT-Copilot/frontend/typescript-6.0.2 \
  dependabot/npm_and_yarn/cursor-projects/DOT-Copilot/frontend/vitejs/plugin-react-6.0.1 \
  dependabot/npm_and_yarn/cursor-projects/dobeuinfo/npm_and_yarn-405656d8aa \
  dependabot/npm_and_yarn/lucide-react-1.7.0 \
  dependabot/npm_and_yarn/npm_and_yarn-45563b5d42 \
  dependabot/npm_and_yarn/npm_and_yarn-526f54f916 \
  dependabot/npm_and_yarn/postcss-8.5.8 \
  dependabot/npm_and_yarn/react-router-dom-7.14.0 \
  dependabot/npm_and_yarn/recharts-3.8.1 \
  dependabot/npm_and_yarn/supabase/supabase-js-2.101.1 \
  dependabot/npm_and_yarn/tailwindcss-4.2.2 \
  dependabot/npm_and_yarn/typescript-6.0.2 \
  dependabot/npm_and_yarn/vite-8.0.5 \
  dependabot/npm_and_yarn/vitejs/plugin-react-6.0.1 \
  dependabot/pip/_archive/legacy-stack/docker-api/pip-b0e8020149 \
  dependabot/pip/docker/api/pip-51f24ed7e3
```

### 1.3 Delete merged feature branches

These branches have been merged into `main` via pull requests:

```bash
git push origin --delete \
  fix-hardcoded-credentials-1337461884490496986 \
  cursor/review-and-implement-to-dos-545c \
  cursor/to-do-list-implementation-77d2
```

### 1.4 Branches to keep

| Branch | Reason |
|---|---|
| `main` | Default branch |
| `bolt-dev` | Active development branch — verify with team before deleting |

### 1.5 Prevent future stale branches

Add to `.github/dependabot.yml` to auto-close superseded dependabot PRs:

```yaml
# In each package-ecosystem entry, add:
open-pull-requests-limit: 5   # keeps only the 5 most recent per ecosystem
```

Also consider enabling **"Automatically delete head branches"** in GitHub repo Settings → General.

### 1.6 Prune stale remote-tracking refs locally

After deleting remote branches, clean up local tracking refs:

```bash
git fetch --prune
# Verify
git branch -r | wc -l   # should be ~3 (main, HEAD, bolt-dev)
```

---

## Part 2 — Commit History Squash Plan

The recent `main` history has several issues:
- Duplicate commits with identical messages (`Task #2: Critical Security Fixes` appears 3 times)
- Non-Conventional Commit messages (`Task #1`, `Task #2`, `b0288dd Transitioned from Plan to Build mode`)
- Merge commits from direct pushes to `main` (no PR)
- Vague messages (`Update backend and frontend to support JWT authentication`)

### 2.1 Current history (last 20 commits)

```
254d4f5  Merge branch 'main' of https://github.com/dobeutech/DOT-Copilot
40a2a35  Improve frontend UX and development tooling
cb3a1b0  Remove demo mode and integrate real API calls
2559a43  Integrate Composio support and compliance automation
3609420  Update backend test suite for service refactor
137c8bc  Enhance API security and infrastructure
d2cd9e2  Refactor authentication and user logic into services
7bc87d4  Migrate console logging to unified logger service
ccb8068  Standardize API response and error formats
952e513  Adjust CI/CD workflows for new monorepo layout
8c31b6b  Archive legacy stack components
948fb08  Update architecture documentation and monorepo structure
002f73b  Update backend to correctly handle fleet IDs and skip TypeScript type checking
9677628  Add database connection and schema integration for the application
6f3c1a2  feat: security tenancy, root CI/CD, and backend merge with upstream
241d67e  Merge pull request #16 from dobeutech/fix-hardcoded-credentials-...
5a92c08  fix: remove hardcoded development credentials in authStore.ts
d8289f1  Update backend and frontend to support JWT authentication
b2b5b80  Task #2: Critical Security Fixes
39a23bc  Task #2: Critical Security Fixes
844ff04  Task #2: Critical Security Fixes
b0288dd  Transitioned from Plan to Build mode
79a9554  Implement role-based access control and new settings page
dadac14  Task #1: Demo user login (jeremyw / 3938)
```

### 2.2 Proposed squash groups

Group the messy commits into clean logical units:

| Squash group | Commits to squash | Proposed message |
|---|---|---|
| **A** | `b0288dd`, `dadac14`, `844ff04`, `39a23bc`, `b2b5b80` | `feat(auth): implement role-based access control and remove demo credentials` |
| **B** | `d8289f1`, `5a92c08`, `241d67e` | `fix(auth): replace hardcoded credentials with JWT authentication` |
| **C** | `6f3c1a2`, `9677628`, `002f73b` | `feat(backend): add fleet tenancy, DB schema integration, and CI/CD` |
| **D** | `948fb08`, `8c31b6b` | `docs(arch): update architecture docs and archive legacy stack` |
| Keep as-is | `952e513` through `254d4f5` | Already reasonably clean |

### 2.3 Interactive rebase commands

**⚠️ Only do this if `main` has not been shared with other developers, or coordinate a force-push window.**

```bash
# Start interactive rebase from before the messy commits
# (b59a69f is the commit just before the mess starts)
git rebase -i b59a69f

# In the editor that opens, change the action for commits to squash:
# Group A — squash b0288dd, dadac14, 844ff04, 39a23bc into b2b5b80
# pick b2b5b80 Task #2: Critical Security Fixes
# squash 39a23bc Task #2: Critical Security Fixes
# squash 844ff04 Task #2: Critical Security Fixes
# squash b0288dd Transitioned from Plan to Build mode
# squash dadac14 Task #1: Demo user login (jeremyw / 3938)
# → New message: feat(auth): implement role-based access control and remove demo credentials

# Group B — squash 5a92c08 and 241d67e into d8289f1
# pick d8289f1 Update backend and frontend to support JWT authentication
# squash 5a92c08 fix: remove hardcoded development credentials in authStore.ts
# squash 241d67e Merge pull request #16 ...
# → New message: fix(auth): replace hardcoded credentials with JWT authentication

# Group C — squash 9677628 and 002f73b into 6f3c1a2
# pick 6f3c1a2 feat: security tenancy, root CI/CD, and backend merge with upstream
# squash 9677628 Add database connection and schema integration
# squash 002f73b Update backend to correctly handle fleet IDs
# → New message: feat(backend): add fleet tenancy, DB schema integration, and CI/CD

# Group D — squash 8c31b6b into 948fb08
# pick 948fb08 Update architecture documentation and monorepo structure
# squash 8c31b6b Archive legacy stack components
# → New message: docs(arch): update architecture docs and archive legacy stack
```

After the rebase:

```bash
# Verify the new history looks correct
git log --oneline -20

# Force-push to remote (coordinate with team first)
git push origin main --force-with-lease
```

### 2.4 Prevent future history pollution

1. **Require PRs** for all changes to `main` (GitHub Settings → Branches → Branch protection rules)
2. **Squash merge** all PRs (GitHub Settings → General → "Allow squash merging" only)
3. **Enforce Conventional Commits** via a PR title check (add `.github/workflows/conventional-commits.yml`):

```yaml
name: Conventional Commits
on:
  pull_request:
    types: [opened, edited, synchronize]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: amannn/action-semantic-pull-request@v5
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```
