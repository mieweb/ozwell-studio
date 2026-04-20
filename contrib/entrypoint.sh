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

# ── Pre-configure Ozzy (Cline fork) ──
# ── Pre-configure Ozzy (Cline fork) API keys ──
# Seed ~/.cline/data/secrets.json so the user doesn't have to re-enter keys
# after every container rebuild. Supports common provider env vars.
OZZY_DATA_DIR="${HOME}/.cline/data"
OZZY_SECRETS="${OZZY_DATA_DIR}/secrets.json"
if [[ ! -f "${OZZY_SECRETS}" ]]; then
    mkdir -p "${OZZY_DATA_DIR}"
    # Build secrets JSON from available env vars
    _secrets="{"
    _first=true
    for _pair in \
        "apiKey:ANTHROPIC_API_KEY" \
        "openRouterApiKey:OPENROUTER_API_KEY" \
        "openAiApiKey:OPENAI_API_KEY" \
        "geminiApiKey:GEMINI_API_KEY" \
        "deepSeekApiKey:DEEPSEEK_API_KEY" \
        "groqApiKey:GROQ_API_KEY" \
        "mistralApiKey:MISTRAL_API_KEY" \
        "xaiApiKey:XAI_API_KEY" \
        "liteLlmApiKey:LITELLM_API_KEY" \
        "fireworksApiKey:FIREWORKS_API_KEY" \
        "togetherApiKey:TOGETHER_API_KEY" \
    ; do
        _key="${_pair%%:*}"
        _env="${_pair##*:}"
        _val="${!_env:-}"
        if [[ -n "${_val}" ]]; then
            $_first || _secrets+=","
            _secrets+="\"${_key}\":\"${_val}\""
            _first=false
        fi
    done
    _secrets+="}"
    if [[ "${_secrets}" != "{}" ]]; then
        echo "${_secrets}" > "${OZZY_SECRETS}"
        chmod 600 "${OZZY_SECRETS}"
        echo "[entrypoint] ozzy: seeded secrets.json with API keys from environment"
    fi
fi

# Seed globalState.json with default model if ANTHROPIC_API_KEY is set
# so the user doesn't have to pick a model on every container rebuild.
# Also marks onboarding as completed so the chat is shown immediately.
OZZY_GLOBAL="${OZZY_DATA_DIR}/globalState.json"
if [[ ! -f "${OZZY_GLOBAL}" && -n "${ANTHROPIC_API_KEY:-}" ]]; then
    _model="${OZZY_DEFAULT_MODEL:-claude-sonnet-4-20250514}"
    cat > "${OZZY_GLOBAL}" <<EOJSON
{
  "welcomeViewCompleted": true,
  "planModeApiProvider": "anthropic",
  "actModeApiProvider": "anthropic",
  "planModeApiModelId": "${_model}",
  "actModeApiModelId": "${_model}"
}
EOJSON
    echo "[entrypoint] ozzy: seeded globalState.json (provider=anthropic, model=${_model}, onboarding=skipped)"
fi

# ── Outbound firewall (allowlist-based) ──
# Resolves domains from /etc/ozwell/firewall/allowlist.conf to IPs, allows
# only those destinations + DNS. Set OZWELL_ALLOW_OUTBOUND=1 to skip entirely.
ALLOWLIST="/etc/ozwell/firewall/allowlist.conf"
if [[ -z "${OZWELL_ALLOW_OUTBOUND:-}" ]] && command -v iptables &>/dev/null; then
    # 1. Loopback — always allowed
    iptables -A OUTPUT -o lo -j ACCEPT
    # 2. Established/related — reply packets for accepted connections
    iptables -A OUTPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
    # 3. DNS — needed to resolve allowlist (Docker DNS + system resolvers)
    iptables -A OUTPUT -p udp --dport 53 -j ACCEPT
    iptables -A OUTPUT -p tcp --dport 53 -j ACCEPT

    # 4. Resolve each allowlisted domain and permit its IPs
    _allow_host() {
        local host="$1"
        # CIDR entries go straight to iptables
        if [[ "$host" == */* ]]; then
            iptables -A OUTPUT -d "$host" -j ACCEPT
            return
        fi
        # Resolve domain to IPv4 addresses
        local ips
        ips=$(getent ahostsv4 "$host" 2>/dev/null | awk '{print $1}' | sort -u) || true
        for ip in $ips; do
            iptables -A OUTPUT -d "$ip" -j ACCEPT
        done
    }

    # Process allowlist file
    if [[ -f "$ALLOWLIST" ]]; then
        while IFS= read -r line; do
            line="${line%%#*}"          # strip comments
            line="${line// /}"          # strip whitespace
            [[ -z "$line" ]] && continue
            _allow_host "$line"
        done < "$ALLOWLIST"
    fi

    # Process runtime OZWELL_ALLOW_HOSTS env var (comma-separated)
    if [[ -n "${OZWELL_ALLOW_HOSTS:-}" ]]; then
        IFS=',' read -ra _extra <<< "$OZWELL_ALLOW_HOSTS"
        for h in "${_extra[@]}"; do
            h="${h// /}"
            [[ -n "$h" ]] && _allow_host "$h"
        done
    fi

    # 5. Default: reject everything else
    iptables -A OUTPUT -j REJECT --reject-with icmp-net-unreachable

    _count=$(iptables -L OUTPUT -n | grep -c ACCEPT)
    echo "[entrypoint] firewall: $_count ACCEPT rules, default REJECT"
else
    echo "[entrypoint] firewall: skipped (OZWELL_ALLOW_OUTBOUND=1 or no iptables)"
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
