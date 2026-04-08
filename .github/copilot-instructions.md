# Ozwell Studio

## Build & Run

```bash
npm run build          # TypeScript check + Vite production build → dist/
npm run dev            # Vite dev server (frontend only)
docker compose up --build  # Full stack: workspace container on port 5000
```

The workspace container requires `privileged: true` (systemd as PID 1). There are no tests or linters configured.

## Architecture

This repo produces a single Docker image that runs a systemd-managed multi-service container exposing a complete web development environment. An external orchestrator handles authentication, TLS termination, and hostname→port routing — this image only serves plain HTTP.

### Port Layout

| Port | Listener | Purpose |
|------|----------|---------|
| 5000 | NGINX | All studio services via path-based routing |
| 3000 | (user app) | Direct access to user's application |

NGINX on port 5000 routes all paths:

| Path | Upstream | Notes |
|------|----------|-------|
| `/` | Static files from `/opt/ozwell-studio/dist` | Studio dashboard |
| `/preview/` | `127.0.0.1:3000` | Prefix stripped; fallback page when unavailable |
| `/ttyd/` | `127.0.0.1:7681` | Base-path aware (no prefix strip) |
| `/code/` | `127.0.0.1:8080` | Prefix stripped; code-server uses `abs-proxy-base-path` |
| `/mcp/` | `127.0.0.1:8000` | Prefix stripped |

All NGINX proxy blocks use `$http_host` (not `$host`) to preserve the port in the Host header — code-server validates Host against Origin for WebSocket connections.

### Dockerfile Conventions

- Multi-stage: stage 1 builds the Vite frontend, stage 2 is the production image.
- `# syntax=docker/dockerfile:1` enables BuildKit features (`--mount=type=tmpfs`, etc.).
- Base image is `ghcr.io/mieweb/opensource-server/nodejs:latest` (Debian 13 + systemd + Node.js 24).
- Vendor binaries use explicit GitHub release URLs with version ARGs placed near usage for layer caching.
- Use `ADD --chmod=0755` for single binaries, `--mount=type=tmpfs` to avoid layer bloat from .deb installs.
- COPY auto-creates destination directories; don't add `mkdir` for COPY targets.
- MCP servers are NOT pre-installed — `npx`/`uvx` fetch them on demand at runtime via `contrib/mcp/servers.json`.

## Key Conventions

### Frontend (`src/`)

- React 19 + TypeScript + Vite with Tailwind CSS 4 (`@import "tailwindcss"` syntax, not `@tailwind` directives).
- UI components come from `@mieweb/ui`. Always use Ozwell brand: `@import "@mieweb/ui/brands/ozwell.css"` in CSS.
- Vite root is `src/` (not repo root). Entry point is `src/index.html`. Build output goes to `dist/`.

### Config Files (`contrib/`)

- `contrib/nginx/nginx.conf` → `/etc/nginx/nginx.conf` — single server on port 5000 with path-based routing.
- `contrib/systemd/*.service` → `/etc/systemd/system/` — one unit per service (ttyd, code-server, mcp-proxy).
- `contrib/code-server/config.yaml` → `/etc/ozwell/code-server/config.yaml` — code-server options (bind address, auth, abs-proxy-base-path, telemetry).
- `contrib/code-server/settings.json` → `/root/.local/share/code-server/User/settings.json` — VS Code settings.
- `contrib/mcp/servers.json` → `/etc/ozwell/mcp/servers.json` — mcp-proxy named server definitions.
- `contrib/workspace/README.md` → `/workspace/README.md` — getting-started info for the user.
- `contrib/workspace/getting-started.html` → `/opt/ozwell-studio/getting-started.html` — fallback page when port 3000 is unavailable.

All runtime config lives under `/etc/ozwell/` in the container.
