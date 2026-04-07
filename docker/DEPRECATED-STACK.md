# Docker stack under `docker/` (non-canonical)

The compose files in this directory (FastAPI `api_server`, MCP gateway, Auth0-oriented wiring) are **not** the same runtime as:

- the **root** Supabase + Vite app (`/src`), or  
- the **inner** Express + Prisma backend (`cursor-projects/DOT-Copilot/backend`).

For DOT-Copilot local development, prefer:

1. **Root SPA:** `npm run dev` at repo root (with Supabase env vars).  
2. **Inner backend:** Postgres via `cursor-projects/DOT-Copilot/docker-compose.dev.yml` and `npm run dev` in `cursor-projects/DOT-Copilot/backend`.

Keep this folder only if you are actively productizing the MCP gateway path; otherwise treat it as experimental infrastructure.
