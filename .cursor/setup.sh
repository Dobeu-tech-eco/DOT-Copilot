#!/usr/bin/env bash
# Idempotent Cloud Agent install script for DOT-Copilot.
# Provisions PostgreSQL, installs dependencies for the root frontend and the
# Express + Prisma backend, applies migrations, and seeds demo data.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$REPO_ROOT/cursor-projects/DOT-Copilot/backend"

echo "==> [1/6] Ensuring PostgreSQL is installed"
if ! command -v pg_ctlcluster >/dev/null 2>&1; then
  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq postgresql postgresql-contrib
fi

PG_VER="$(ls /usr/lib/postgresql | sort -n | tail -1)"

echo "==> [2/6] Starting PostgreSQL (cluster ${PG_VER}/main)"
sudo pg_ctlcluster "$PG_VER" main start 2>/dev/null || true
for _ in $(seq 1 30); do
  if sudo -u postgres pg_isready -q; then break; fi
  sleep 1
done

echo "==> [3/6] Ensuring 'dot_copilot' database and postgres password"
sudo -u postgres psql -v ON_ERROR_STOP=1 <<'SQL'
ALTER USER postgres WITH PASSWORD 'postgres';
SELECT 'CREATE DATABASE dot_copilot'
  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'dot_copilot')\gexec
SQL

echo "==> [4/6] Writing dev env files (only if missing)"
if [ ! -f "$BACKEND_DIR/.env" ]; then
  cat > "$BACKEND_DIR/.env" <<'EOF'
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/dot_copilot?schema=public
PORT=3001
NODE_ENV=development
JWT_SECRET=dev-local-jwt-secret-at-least-32-characters-long-000
JWT_REFRESH_SECRET=dev-local-refresh-secret-at-least-32-characters-000
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
FRONTEND_URL=http://localhost:5000
ENABLE_DOCS=true
EOF
fi
if [ ! -f "$REPO_ROOT/.env" ]; then
  cat > "$REPO_ROOT/.env" <<EOF
# The canonical frontend talks to Supabase directly. Provide a real project
# URL + anon key (e.g. via Cloud Agent secrets) to enable live auth/data.
VITE_SUPABASE_URL=${VITE_SUPABASE_URL:-https://placeholder.supabase.co}
VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY:-placeholder-anon-key}
VITE_API_URL=http://localhost:3001/api
EOF
fi

echo "==> [5/6] Installing npm dependencies"
( cd "$REPO_ROOT" && npm install )
( cd "$BACKEND_DIR" && npm install )

echo "==> [6/6] Prisma generate + migrate deploy + seed"
cd "$BACKEND_DIR"
npx prisma generate
npx prisma migrate deploy
npm run db:seed

echo "==> Setup complete."
