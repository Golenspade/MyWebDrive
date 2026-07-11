#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.core.yml"
TARGET_TAG=${1:-}

trap 'printf "rollback failed at line %s\n" "$LINENO" >&2' ERR

if [[ -z "$TARGET_TAG" || "$TARGET_TAG" == latest ]]; then
  printf 'usage: %s <previous-immutable-image-tag> (latest is forbidden)\n' "$0" >&2
  exit 64
fi
if [[ ! "$TARGET_TAG" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$ ]]; then
  printf 'invalid immutable image tag: %s\n' "$TARGET_TAG" >&2
  exit 64
fi
[[ -f "$COMPOSE_FILE" ]] || { printf 'compose file is missing: %s\n' "$COMPOSE_FILE" >&2; exit 66; }
command -v docker >/dev/null
docker compose version >/dev/null

printf 'rolling back to immutable release %s\n' "$TARGET_TAG"
exec "$SCRIPT_DIR/deploy.sh" "$TARGET_TAG"
