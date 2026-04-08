# Ozwell Studio

## Build & Run

```bash
npm run build          # TypeScript check + Vite production build → dist/
npm run dev            # Vite dev server (frontend only)
docker compose up --build  # Full stack: workspace + orchestrator proxy
```

The workspace container requires `privileged: true` (systemd as PID 1). There are no tests or linters configured.

## Architecture

This repo produces a single Docker image that runs a systemd-managed multi-service container exposing a complete web development environment. An external orchestrator handles authentication, TLS termination, and hostname→port routing — this image only serves plain HTTP.

### Port Layout

| Port | Listener | Upstream |
|------|----------|----------|
| 80 | NGINX | User's app on `127.0.0.1:3000` |
| 5000 | NGINX | Static files from `/opt/ozwell-studio/dist` |
| 7681 | NGINX | ttyd on `127.0.0.1:7682` |
| 8000 | mcp-proxy | Direct (no NGINX) |
| 8080 | NGINX | code-server on `127.0.0.1:8081` |

NGINX proxied ports add `Content-Security-Policy: frame-ancestors *` to override the orchestrator's `X-Frame-Options: SAMEORIGIN`, enabling cross-subdomain iframe embedding. All NGINX proxy blocks must use `$http_host` (not `$host`) to preserve the port in the Host header — code-server validates Host against Origin for WebSocket connections.

### URL Discovery

The workspace frontend discovers sibling services from its own hostname. Served at `<host>-studio.<domain>`, it strips `-studio` from the first DNS label and constructs protocol-relative URLs (`//<host>-<service>.<domain>`). This means service URLs are never hardcoded and the same build works across any orchestrator domain.

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

- `contrib/nginx/nginx.conf` → `/etc/nginx/nginx.conf` — all HTTP proxy and static serving config.
- `contrib/systemd/*.service` → `/etc/systemd/system/` — one unit per service (ttyd, code-server, mcp-proxy).
- `contrib/code-server/config.yaml` → `/etc/ozwell/code-server/config.yaml` — code-server options (bind address, auth, telemetry).
- `contrib/code-server/settings.json` → `/root/.local/share/code-server/User/settings.json` — VS Code settings.
- `contrib/mcp/servers.json` → `/etc/ozwell/mcp/servers.json` — mcp-proxy named server definitions.

All runtime config lives under `/etc/ozwell/` in the container.

### Local Development (`dev/`)

`dev/proxy/` contains a lightweight NGINX container that emulates the orchestrator's hostname-based routing on port 80. It routes `local-*.localhost` hostnames to the workspace container's ports and adds `X-Frame-Options: SAMEORIGIN` to simulate production behavior.
