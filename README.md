# Ozwell Studio

A Docker container image that provides a complete web-based development environment — terminal, IDE, AI-powered tooling, and a live preview of your application — all accessible through a unified browser interface.

## Architecture

The workspace runs as a systemd-managed container with the following services:

| Service | Container Port | External URL | Description |
|---------|---------------|--------------|-------------|
| User Application | 80 | `<host>.<domain>` | NGINX proxy → localhost:3000 |
| Workspace Frontend | 5000 | `<host>-studio.<domain>` | Tabbed UI embedding all services |
| ttyd | 7681 | `<host>-ttyd.<domain>` | Web terminal (bash) |
| MCP Proxy | 8000 | `<host>-mcp.<domain>` | Model Context Protocol servers |
| code-server | 8080 | `<host>-code-server.<domain>` | VS Code in the browser |

All external URLs are served over HTTPS:443 by the orchestrator, which terminates TLS and proxies to the container on HTTP/1.1.

### Component Details

**ttyd** — Web-based terminal emulator exposing a bash shell. Listens on `127.0.0.1:7682`; NGINX on port 7681 proxies to it with WebSocket support and CSP headers.

**code-server** — VS Code running in the browser. Listens on `127.0.0.1:8081`; NGINX on port 8080 proxies to it. Configured via `/etc/ozwell/code-server/config.yaml` with auth disabled (the orchestrator handles auth), telemetry off, and update checks off. Pre-installed extensions: ESLint, Prettier, Tailwind CSS IntelliSense.

**MCP Proxy** — Aggregates six [Model Context Protocol](https://modelcontextprotocol.io/) servers into a single HTTP/SSE endpoint on port 8000. Servers are fetched on demand via `npx`/`uvx`:

- **filesystem** — File operations within `/workspace`
- **memory** — Persistent knowledge graph
- **sequential-thinking** — Structured reasoning
- **fetch** — HTTP fetching
- **git** — Git operations on `/workspace`
- **time** — Current time and timezone conversion

**Workspace Frontend** — A React + Vite app using [@mieweb/ui](https://www.npmjs.com/package/@mieweb/ui) components that embeds the terminal, IDE, and user application in a tabbed interface. Built at image build time and served as static files by NGINX on port 5000.

**NGINX** — Reverse proxy handling four concerns:
1. Proxying the user's application (port 80 → localhost:3000)
2. Proxying ttyd (port 7681 → 127.0.0.1:7682) and code-server (port 8080 → 127.0.0.1:8081) with WebSocket support
3. Serving the workspace frontend as static files (port 5000)
4. Adding `Content-Security-Policy: frame-ancestors *` to allow cross-subdomain iframe embedding (overrides the orchestrator's `X-Frame-Options: SAMEORIGIN`)

### URL Discovery

The workspace frontend at `<host>-studio.<domain>` derives other service URLs from its own hostname. Given `my-app-studio.example.com`, it strips `-studio` to get `my-app` and `example.com`, then constructs protocol-relative URLs:

- `//my-app.example.com` — User application
- `//my-app-ttyd.example.com` — Terminal
- `//my-app-code-server.example.com` — Editor

## Repository Structure

```
├── Dockerfile                    # Multi-stage build
├── docker-compose.yml            # Local dev with proxy emulating orchestrator
├── package.json                  # Vite workspace frontend
├── vite.config.ts
├── tsconfig.json
├── src/
│   ├── index.html                # Entry point
│   ├── index.css                 # Tailwind + Ozwell brand theme
│   ├── main.tsx                  # React root
│   └── App.tsx                   # Tabbed iframe interface
├── contrib/
│   ├── nginx/
│   │   └── nginx.conf            # NGINX config (ports 80, 5000, 7681, 8080)
│   ├── systemd/
│   │   ├── ttyd.service
│   │   ├── code-server.service
│   │   └── mcp-proxy.service
│   ├── code-server/
│   │   ├── config.yaml           # code-server options
│   │   └── settings.json         # VS Code settings (disables AI features)
│   └── mcp/
│       └── servers.json          # MCP server definitions
└── dev/
    └── proxy/
        ├── Dockerfile            # Lightweight NGINX proxy
        └── nginx.conf            # Routes local-*.localhost hostnames
```

## Building

```bash
docker build -t ozwell-studio .
```

## Local Development

A Docker Compose setup emulates the orchestrator's hostname-based routing:

```bash
docker compose up --build
```

This starts the workspace container and a lightweight NGINX proxy on port 80 that routes:

| URL | Service |
|-----|---------|
| `http://local.localhost` | User application |
| `http://local-studio.localhost` | Workspace frontend |
| `http://local-ttyd.localhost` | Terminal |
| `http://local-mcp.localhost` | MCP servers |
| `http://local-code-server.localhost` | Code editor |

The proxy also adds `X-Frame-Options: SAMEORIGIN` to emulate the orchestrator's behavior, which the workspace NGINX overrides with CSP headers.

> **Note**: The workspace container requires `privileged: true` for systemd.

## Running Your Application

Bind your application to `localhost:3000` inside the container. NGINX on port 80 proxies to it, and the orchestrator maps `<host>.<domain>` to port 80.

The `/workspace` directory is the default working directory for the terminal, IDE, and filesystem MCP server.

## Frontend Development

The workspace frontend source lives in `src/`. To develop locally:

```bash
npm install
npm run dev
```

The production build is compiled during the Docker image build (stage 1) and served as static files by NGINX on port 5000.
