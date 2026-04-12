# Ozwell Studio

A Docker container image that provides a complete web-based development environment — terminal, IDE, AI-powered tooling, and a live preview of your application — all accessible through a unified browser interface on a single port.

## Quick Start

Pull the image from GitHub Container Registry:

```bash
# Latest stable release
docker pull ghcr.io/mieweb/ozwell-studio:latest

# Bleeding edge (latest commit on main)
docker pull ghcr.io/mieweb/ozwell-studio:main

# Specific version
docker pull ghcr.io/mieweb/ozwell-studio:v1.0.0
```

Run it:

```bash
docker run --privileged -p 6080:6080 ghcr.io/mieweb/ozwell-studio:latest
```

Open `http://localhost:6080` to access the studio. The **Application** tab previews your app (serve it on port 3000 inside the container), **Terminal** gives you a shell, and **Editor** opens VS Code.

## Architecture

The workspace runs as a systemd-managed container. NGINX on port 6080 serves everything under path-based routing:

| Path | Upstream | Description |
|------|----------|-------------|
| `/` | Static files | Studio dashboard (React app) |
| `/preview/` | `127.0.0.1:3000` | User's application (prefix stripped) |
| `/ttyd/` | `127.0.0.1:7681` | Web terminal via ttyd (base-path aware) |
| `/code/` | `127.0.0.1:8080` | VS Code via code-server (prefix stripped, abs-proxy-base-path) |
| `/mcp/` | `127.0.0.1:8000` | MCP proxy (prefix stripped) |

Port 3000 is also exposed directly for the user's application.

An external orchestrator handles authentication, TLS termination, and hostname→port routing — this image only serves plain HTTP.

### Component Details

**Studio Dashboard** — A React + Vite app using [@mieweb/ui](https://www.npmjs.com/package/@mieweb/ui) components that embeds the terminal, IDE, and user application in a tabbed interface. The Application tab includes a browser-style navigation bar with back/forward/reload and a read-only URL display.

**ttyd** — Web terminal launching a tmux session (`tmux new-session -A -s main`) so sessions persist across reconnects. Uses `-b /ttyd` base-path so NGINX passes requests through without prefix stripping.

**code-server** — VS Code in the browser. Configured via `/etc/ozwell/code-server/config.yaml` with auth disabled (the orchestrator handles auth), telemetry and update checks off, and `abs-proxy-base-path: /code` so it generates correct URLs behind the reverse proxy. Pre-installed extensions: ESLint, Prettier, Tailwind CSS IntelliSense.

**MCP Proxy** — Aggregates [Model Context Protocol](https://modelcontextprotocol.io/) servers into a single HTTP/SSE endpoint. Servers are fetched on demand via `npx`/`uvx`:

- **filesystem** — File read/write/search/diff/patch within `/workspace` ([j0hanz/filesystem-mcp](https://github.com/j0hanz/filesystem-mcp))
- **tmux** — Control the shared tmux session visible in the Terminal tab ([nickgnd/tmux-mcp](https://github.com/nickgnd/tmux-mcp))
- **git** — Git operations on `/workspace`

**NGINX** — Single server on port 6080 handling all routing. Proxies ttyd without prefix stripping (base-path aware), strips `/code/`, `/mcp/`, and `/preview/` prefixes for their respective upstreams. When nothing is running on port 3000, the `/preview/` route serves a getting-started page. All proxy blocks use `$http_host` (not `$host`) to preserve the port in the Host header.

## Repository Structure

```
├── Dockerfile                    # Multi-stage build
├── docker-compose.yml            # Local dev (exposes port 6080)
├── package.json                  # Vite workspace frontend
├── vite.config.ts
├── tsconfig.json
├── src/
│   ├── index.html                # Entry point
│   ├── index.css                 # Tailwind + Ozwell brand theme
│   ├── main.tsx                  # React root
│   └── App.tsx                   # Tabbed iframe interface with preview nav
├── contrib/
│   ├── nginx/
│   │   └── nginx.conf            # NGINX site config (port 6080, sites-enabled)
│   ├── systemd/
│   │   ├── ttyd.service
│   │   ├── code-server.service
│   │   └── mcp-proxy.service
│   ├── code-server/
│   │   ├── config.yaml           # code-server options
│   │   └── settings.json         # VS Code settings
│   ├── mcp/
│   │   └── servers.json          # MCP server definitions
│   └── workspace/
│       ├── README.md             # Placed in /workspace at build time
│       └── getting-started.html  # Fallback when port 3000 is not running
```

## Building

```bash
npm run build          # TypeScript check + Vite production build → dist/
docker build -t ozwell-studio .
```

## Running

```bash
docker compose up --build  # Builds image and exposes port 6080
```

The container requires `privileged: true` for systemd. Open `http://localhost:6080` to access the studio.

## Running Your Application

Bind your application to port 3000 inside the container. It will appear in the **Application** tab at `/preview/`, or access it directly on port 3000.

The `/workspace` directory is the default working directory for the terminal, IDE, and filesystem MCP server. It is pre-initialized as a git repository with a README.
