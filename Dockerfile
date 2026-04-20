# syntax=docker/dockerfile:1

# ── Stage 1: Build workspace frontend ──────────────────────────
FROM ghcr.io/mieweb/opensource-server/nodejs:latest AS builder

WORKDIR /build
COPY package.json package-lock.json tsconfig.json vite.config.ts ./
COPY src/ src/
RUN npm ci && npm run build

# ── Stage 2: Production image ──────────────────────────────────
FROM ghcr.io/mieweb/opensource-server/nodejs:latest

RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx python3 python3-venv git ca-certificates iptables \
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
    && code-server --install-extension bradlc.vscode-tailwindcss \
    && code-server --install-extension Continue.continue

# Install Ozzy (rebranded Cline) extension from pre-built VSIX
COPY dist/ozzy.vsix /tmp/ozzy.vsix
RUN code-server --install-extension /tmp/ozzy.vsix

ARG OPENVSCODE_VERSION=1.109.5
RUN --mount=type=tmpfs,target=/tmp \
    curl -fsSL -o /tmp/openvscode.tar.gz \
      "https://github.com/gitpod-io/openvscode-server/releases/download/openvscode-server-v${OPENVSCODE_VERSION}/openvscode-server-v${OPENVSCODE_VERSION}-linux-x64.tar.gz" \
    && tar -xzf /tmp/openvscode.tar.gz -C /opt \
    && mv /opt/openvscode-server-v${OPENVSCODE_VERSION}-linux-x64 /opt/openvscode-server

# Pre-install openvscode-server extensions (Open VSX)
RUN /opt/openvscode-server/bin/openvscode-server --install-extension dbaeumer.vscode-eslint \
    && /opt/openvscode-server/bin/openvscode-server --install-extension esbenp.prettier-vscode \
    && /opt/openvscode-server/bin/openvscode-server --install-extension bradlc.vscode-tailwindcss \
    && /opt/openvscode-server/bin/openvscode-server --install-extension Continue.continue

# Install Ozzy extension for openvscode-server
RUN /opt/openvscode-server/bin/openvscode-server --install-extension /tmp/ozzy.vsix \
    && rm -f /tmp/ozzy.vsix

ARG UV_VERSION=0.11.3
RUN curl -fsSL "https://github.com/astral-sh/uv/releases/download/${UV_VERSION}/uv-x86_64-unknown-linux-gnu.tar.gz" \
    | tar -xzf - --strip-components=1 -C /usr/local/bin \
      uv-x86_64-unknown-linux-gnu/uv uv-x86_64-unknown-linux-gnu/uvx

RUN python3 -m venv /opt/mcp-proxy \
    && /opt/mcp-proxy/bin/pip install --no-cache-dir mcp-proxy

COPY --from=builder /build/dist /opt/ozwell-studio/dist/
COPY contrib/nginx/nginx.conf /etc/nginx/sites-enabled/studio
COPY contrib/systemd/ /etc/systemd/system/
COPY contrib/code-server/config.yaml /etc/ozwell/code-server/config.yaml
COPY contrib/code-server/settings.json /root/.local/share/code-server/User/settings.json
COPY contrib/code-server/settings.json /root/.openvscode-server/data/Machine/settings.json
COPY contrib/continue/config.yaml /root/.continue/config.yaml
COPY contrib/ozzy/AGENTS.md /workspace/AGENTS.md
COPY contrib/mcp/servers.json /etc/ozwell/mcp/servers.json
COPY contrib/firewall/allowlist.conf /etc/ozwell/firewall/allowlist.conf
COPY contrib/tmux/tmux.conf /etc/tmux.conf

COPY contrib/workspace/getting-started.html /opt/ozwell-studio/getting-started.html
COPY contrib/workspace/ /workspace/
COPY --chmod=0755 contrib/entrypoint.sh /opt/ozwell-studio/entrypoint.sh

RUN rm -f /etc/nginx/sites-enabled/default \
    && cd /workspace && git init \
    && systemctl enable nginx ttyd code-server openvscode-server mcp-proxy continue-env

ENTRYPOINT ["/opt/ozwell-studio/entrypoint.sh"]
EXPOSE 3000 6080
LABEL org.mieweb.opensource-server.services.http.ozwell-studio.port=6000 \
      org.mieweb.opensource-server.services.http.ozwell-studio.hostnameSuffix=studio \
      org.mieweb.opensource-server.services.http.ozwell-studio.requireAuth=true
