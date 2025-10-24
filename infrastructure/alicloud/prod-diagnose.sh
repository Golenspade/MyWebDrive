#!/usr/bin/env bash
set -euo pipefail

# MyWebDrive production diagnostics
# Usage: bash infrastructure/alicloud/prod-diagnose.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if docker compose version >/dev/null 2>&1; then
  DCMD=(docker compose)
elif docker-compose version >/dev/null 2>&1; then
  DCMD=(docker-compose)
else
  echo "[x] Docker Compose is not installed" >&2
  exit 1
fi

COMPOSE_FILE="docker-compose.production.yml"
if [ ! -f "$COMPOSE_FILE" ]; then
  echo "[x] $COMPOSE_FILE not found in $(pwd)" >&2
  exit 1
fi

echo "=== Basic host info ==="
uname -a || true
echo "Docker: $(docker --version 2>/dev/null || echo 'missing')"
echo "Compose: $(${DCMD[@]} version 2>/dev/null || echo 'missing')"
echo

echo "=== Compose status ==="
${DCMD[@]} -f "$COMPOSE_FILE" ps || true
echo

echo "=== Port listeners (80,443,3100,9090,7091-7095) ==="
if command -v ss >/dev/null 2>&1; then
  ss -ltnp | awk 'NR==1 || $4 ~ /:(80|443|3100|9090|709[1-5])$/' || true
else
  netstat -tulpn 2>/dev/null | grep -E ':(80|443|3100|9090|7091|7092|7093|7094|7095)\s' || true
fi
echo

echo "=== Health checks ==="
declare -A targets=(
  [gateway]="http://localhost:9090/health"
  [auth]="http://localhost:7091/health"
  [user]="http://localhost:7092/health"
  [metadata]="http://localhost:7093/health"
  [storage]="http://localhost:7094/health"
  [sharing]="http://localhost:7095/health"
)
for name in "${!targets[@]}"; do
  url="${targets[$name]}"
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 "$url" || echo 000)
  echo "- $name: $code $url"
done
echo

echo "=== Frontend probe ==="
curl -sI "http://localhost:3100/" | tr -d '\r' || true
curl -sI "http://localhost:3100/download" | tr -d '\r' || true
echo

echo "=== Recent logs (last 120 lines) ==="
for svc in api-gateway auth user metadata storage sharing frontend; do
  echo "--- $svc ---"
  ${DCMD[@]} -f "$COMPOSE_FILE" logs --tail=120 "$svc" 2>/dev/null || echo "(no logs)"
  echo
done

echo "=== Firewall / SELinux (best-effort) ==="
if command -v ufw >/dev/null 2>&1; then ufw status || true; fi
if command -v firewall-cmd >/dev/null 2>&1; then firewall-cmd --list-all || true; fi
if command -v getenforce >/dev/null 2>&1; then getenforce || true; fi

echo "=== Done ==="

