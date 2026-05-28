# syntax=docker/dockerfile:1

# ── Stage 1: Build workspace frontend ──────────────────────────
FROM ghcr.io/mieweb/opensource-server/nodejs:latest AS builder

WORKDIR /build
COPY . .
RUN npm ci && npm run build

# ── Stage 1b: Build opencode from upstream PR #28326 ───────────
# PR #28326 adds --base-path support so opencode web can be hosted
# behind a reverse proxy at /opencode/. Once it merges and ships in
# a release, drop this stage and switch back to `curl | bash` against
# the official installer.
FROM oven/bun:1.3.14 AS opencode-builder

ARG OPENCODE_REPO=https://github.com/fabiovincenzi/opencode
ARG OPENCODE_REF=feat/base-path-support

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        git ca-certificates python3 build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /src
RUN git clone --depth=1 --branch "${OPENCODE_REF}" "${OPENCODE_REPO}" .
RUN bun install --frozen-lockfile
# --single builds only the current platform; output lands at
# packages/opencode/dist/opencode-linux-<arch>/bin/opencode
RUN bun run --cwd packages/opencode build -- --single \
    && cp "$(find packages/opencode/dist -name opencode -type f | head -1)" /opencode

# ── Stage 2: Production image ──────────────────────────────────
FROM ghcr.io/mieweb/opensource-server/nodejs:latest

RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx python3 python3-venv git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ARG TTYD_VERSION=1.7.7
ADD --chmod=0755 \
    https://github.com/tsl0922/ttyd/releases/download/${TTYD_VERSION}/ttyd.x86_64 \
    /usr/local/bin/ttyd

ARG CODE_SERVER_VERSION=4.115.0
RUN --mount=type=tmpfs,target=/tmp \
    curl -fsSL -o /tmp/code-server.deb \
      "https://github.com/coder/code-server/releases/download/v${CODE_SERVER_VERSION}/code-server_${CODE_SERVER_VERSION}_amd64.deb" \
    && dpkg -i /tmp/code-server.deb

# Use VS Code Marketplace (persists for both build-time installs and runtime)
ENV EXTENSIONS_GALLERY='{"serviceUrl":"https://marketplace.visualstudio.com/_apis/public/gallery","itemUrl":"https://marketplace.visualstudio.com/items"}'

# Pre-install code-server extensions
RUN code-server --install-extension GitHub.copilot-chat \
    && code-server --install-extension ms-python.python \
    && code-server --install-extension ms-python.vscode-pylance \
    && code-server --install-extension ms-python.debugpy \
    && code-server --install-extension ms-vscode.cpptools \
    && code-server --install-extension esbenp.prettier-vscode

ARG UV_VERSION=0.11.6
RUN curl -fsSL "https://github.com/astral-sh/uv/releases/download/${UV_VERSION}/uv-x86_64-unknown-linux-gnu.tar.gz" \
    | tar -xzf - --strip-components=1 -C /usr/local/bin \
      uv-x86_64-unknown-linux-gnu/uv uv-x86_64-unknown-linux-gnu/uvx

RUN python3 -m venv /opt/mcp-proxy \
    && /opt/mcp-proxy/bin/pip install --no-cache-dir mcp-proxy

# OpenCode AI - bundled binary from stage 1b
COPY --from=opencode-builder /opencode /usr/local/bin/opencode
RUN chmod +x /usr/local/bin/opencode

COPY --from=builder /build/dist /opt/ozwell-studio/dist/
COPY contrib/nginx/nginx.conf /etc/nginx/sites-enabled/studio
COPY contrib/systemd/ /etc/systemd/system/
COPY contrib/code-server/config.yaml /etc/ozwell/code-server/config.yaml
COPY contrib/code-server/User/ /root/.local/share/code-server/User/
COPY contrib/mcp/servers.json /etc/ozwell/mcp/servers.json
COPY contrib/tmux/tmux.conf /etc/tmux.conf

COPY contrib/studio/getting-started.html /opt/ozwell-studio/getting-started.html
COPY contrib/workspace/ /workspace/

RUN rm -f /etc/nginx/sites-enabled/default \
    && cd /workspace && git init \
    && systemctl enable nginx ttyd code-server mcp-proxy opencode

# Kerebron server
COPY contrib/kerebron-server /opt/kerebron-server
RUN cd /opt/kerebron-server && npm ci
RUN systemctl enable kerebron

# Kerebron extension
COPY contrib/kerebron-extension /opt/kerebron-extension
RUN cd /opt/kerebron-extension && npm ci && npm run package
RUN code-server --install-extension /opt/kerebron-extension/kerebron-extension-0.0.1.vsix

EXPOSE 3000 6080
LABEL org.mieweb.opensource-server.services.http.ozwell-studio.port=6080 \
      org.mieweb.opensource-server.services.http.ozwell-studio.hostnameSuffix=studio \
      org.mieweb.opensource-server.services.http.ozwell-studio.requireAuth=true
