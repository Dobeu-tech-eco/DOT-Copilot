#!/usr/bin/env bash
# Per-boot startup: bring the PostgreSQL cluster up reliably.
# Idempotent and safe to run when the cluster is already running or when a
# stale postmaster.pid was captured in a snapshot while Postgres was running.
set -uo pipefail

PG_VER="$(ls /usr/lib/postgresql 2>/dev/null | sort -n | tail -1)"
if [ -z "${PG_VER:-}" ]; then
  echo "PostgreSQL is not installed yet; nothing to start." >&2
  exit 0
fi

if sudo -u postgres pg_isready -q 2>/dev/null; then
  echo "PostgreSQL already running."
  exit 0
fi

# Clear a stale pid file left over from a snapshot of a running server.
sudo rm -f "/var/lib/postgresql/${PG_VER}/main/postmaster.pid" 2>/dev/null || true

sudo pg_ctlcluster "$PG_VER" main start 2>/dev/null || true

for _ in $(seq 1 30); do
  if sudo -u postgres pg_isready -q 2>/dev/null; then
    echo "PostgreSQL is ready."
    exit 0
  fi
  sleep 1
done

echo "WARNING: PostgreSQL did not become ready within 30s." >&2
exit 0
