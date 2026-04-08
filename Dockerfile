# syntax=docker/dockerfile:1

# ── Stage 1: Build workspace frontend ──────────────────────────
FROM ghcr.io/mieweb/opensource-server/nodejs:latest AS builder

WORKDIR /build
COPY package.json package-lock.json* tsconfig.json vite.config.ts ./
COPY src/ ./src/
RUN npm ci && npm run build

# ── Stage 2: Production image ──────────────────────────────────
FROM ghcr.io/mieweb/opensource-server/nodejs:latest

RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx python3 python3-venv git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ARG TTYD_VERSION=1.7.7
ADD --chmod=0755 \
    https://github.com/tsl0922/ttyd/releases/download/${TTYD_VERSION}/ttyd.x86_64 \
    /usr/local/bin/ttyd

ARG CODE_SERVER_VERSION=4.114.1
RUN --mount=type=tmpfs,target=/tmp \
    curl -fsSL -o /tmp/code-server.deb \
      "https://github.com/coder/code-server/releases/download/v${CODE_SERVER_VERSION}/code-server_${CODE_SERVER_VERSION}_amd64.deb" \
    && dpkg -i /tmp/code-server.deb

# Pre-install code-server extensions (Open VSX)
RUN code-server --install-extension dbaeumer.vscode-eslint \
    && code-server --install-extension esbenp.prettier-vscode \
    && code-server --install-extension bradlc.vscode-tailwindcss

ARG UV_VERSION=0.11.3
RUN curl -fsSL "https://github.com/astral-sh/uv/releases/download/${UV_VERSION}/uv-x86_64-unknown-linux-gnu.tar.gz" \
    | tar -xzf - --strip-components=1 -C /usr/local/bin \
      uv-x86_64-unknown-linux-gnu/uv uv-x86_64-unknown-linux-gnu/uvx

RUN python3 -m venv /opt/mcp-proxy \
    && /opt/mcp-proxy/bin/pip install --no-cache-dir mcp-proxy

COPY --from=builder /build/dist /opt/ozwell-studio/dist/
COPY contrib/nginx/nginx.conf /etc/nginx/nginx.conf
COPY contrib/systemd/ /etc/systemd/system/
COPY contrib/code-server/config.yaml /etc/ozwell/code-server/config.yaml
COPY contrib/code-server/settings.json /root/.local/share/code-server/User/settings.json
COPY contrib/mcp/servers.json /etc/ozwell/mcp/servers.json

COPY contrib/workspace/getting-started.html /opt/ozwell-studio/getting-started.html
COPY contrib/workspace/README.md /workspace/README.md

RUN cd /workspace && git init \
    && systemctl enable nginx ttyd code-server mcp-proxy

EXPOSE 3000 5000
