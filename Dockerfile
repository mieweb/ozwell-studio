# syntax=docker/dockerfile:1

# ── Stage 1: Build workspace frontend ──────────────────────────
FROM ghcr.io/mieweb/opensource-server/nodejs:latest AS builder

WORKDIR /build
COPY . .
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
    && systemctl enable nginx ttyd code-server mcp-proxy

EXPOSE 3000 6080
LABEL org.mieweb.opensource-server.services.http.ozwell-studio.port=6000 \
      org.mieweb.opensource-server.services.http.ozwell-studio.hostnameSuffix=studio \
      org.mieweb.opensource-server.services.http.ozwell-studio.requireAuth=true
