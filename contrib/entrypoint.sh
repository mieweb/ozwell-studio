#!/bin/bash
# Ozwell Studio entrypoint
# Writes runtime env files, then starts services.
# Works both with systemd (production) and without (QEMU / local dev).

set -euo pipefail

# ── Write Continue .env from container environment ──
mkdir -p /root/.continue
printenv | grep -E '^(ANTHROPIC_|OPENAI_)' > /root/.continue/.env 2>/dev/null || true

# ── Inject API keys into Continue config ──
if [[ -n "${ANTHROPIC_API_KEY:-}" ]]; then
    sed -i "s|ANTHROPIC_API_KEY_PLACEHOLDER|${ANTHROPIC_API_KEY}|g" /root/.continue/config.yaml
fi

# ── Try systemd first (production path) ──
if [[ -x /lib/systemd/systemd ]] && /lib/systemd/systemd --test 2>/dev/null; then
    exec /lib/systemd/systemd "$@"
fi

# ── Fallback: start services directly (QEMU / local dev) ──
echo "[entrypoint] systemd unavailable, starting services directly"

cleanup() {
    echo "[entrypoint] shutting down"
    kill $(jobs -p) 2>/dev/null || true
    wait
}
trap cleanup SIGTERM SIGINT

nginx

ttyd -p 7681 -b /ttyd bash &

HOME=/root SHELL=/bin/bash \
    code-server --config /etc/ozwell/code-server/config.yaml /workspace &

HOME=/root SHELL=/bin/bash \
    /opt/openvscode-server/bin/openvscode-server \
    --host 127.0.0.1 --port 8081 \
    --server-base-path /vscode \
    --without-connection-token --telemetry-level off &

/opt/mcp-proxy/bin/mcp-proxy \
    --named-server-config /etc/ozwell/mcp/servers.json \
    --host 127.0.0.1 --port 8000 \
    --allow-origin "*" &

echo "[entrypoint] all services started"

# Wait forever — if any child exits, log it but keep running
while true; do
    wait -n 2>/dev/null || true
done
