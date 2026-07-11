#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.core.yml"
ENV_FILE=${MYWEBDRIVE_ENV_FILE:-"$SCRIPT_DIR/.env"}
STATE_DIR=${DEPLOY_STATE_DIR:-/var/lib/mywebdrive/releases}
IMAGE_TAG=${1:-}
state_tmp=''
current_tmp=''

trap 'printf "deployment failed at line %s\n" "$LINENO" >&2' ERR
trap '[[ -z "$state_tmp" ]] || rm -f "$state_tmp"; [[ -z "$current_tmp" ]] || rm -f "$current_tmp"' EXIT

if [[ -z "$IMAGE_TAG" || "$IMAGE_TAG" == latest ]]; then
  printf 'usage: %s <immutable-image-tag> (latest is forbidden)\n' "$0" >&2
  exit 64
fi
if [[ ! "$IMAGE_TAG" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$ ]]; then
  printf 'invalid immutable image tag: %s\n' "$IMAGE_TAG" >&2
  exit 64
fi
[[ -r "$ENV_FILE" ]] || { printf 'environment file is missing or unreadable: %s\n' "$ENV_FILE" >&2; exit 66; }
[[ "$STATE_DIR" == /* ]] || { printf 'DEPLOY_STATE_DIR must be an absolute path\n' >&2; exit 64; }
command -v docker >/dev/null
docker compose version >/dev/null

export IMAGE_TAG
compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

wait_healthy() {
  local service=$1 deadline container status
  deadline=$((SECONDS + 180))
  while (( SECONDS < deadline )); do
    container=$(compose ps -q "$service")
    if [[ -n "$container" ]]; then
      status=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container")
      [[ "$status" == healthy ]] && return 0
      [[ "$status" == exited || "$status" == dead ]] && break
    fi
    sleep 2
  done
  compose logs --tail=100 "$service" >&2
  printf 'service did not become healthy: %s\n' "$service" >&2
  return 1
}

compose config -q
compose pull postgres redis minio minio-init core-migrate core-api storage-api storage-worker web nginx
compose up -d --no-deps postgres redis minio
for service in postgres redis minio; do wait_healthy "$service"; done
compose run --rm --no-deps minio-init
compose run --rm --no-deps core-migrate
compose up -d --no-deps core-api storage-api storage-worker web nginx
for service in core-api storage-api storage-worker web nginx; do wait_healthy "$service"; done

compose exec -T -e EXPECTED_BUILD_ID="$IMAGE_TAG" core-api node -e \
  "fetch('http://127.0.0.1:8080/version').then(async r=>{if(!r.ok)throw Error('version endpoint failed');const v=await r.json();if(v.buildId!==process.env.EXPECTED_BUILD_ID)throw Error('buildId mismatch')}).catch(e=>{console.error(e.message);process.exit(1)})"

mkdir -p "$STATE_DIR/history"
[[ -w "$STATE_DIR" && -w "$STATE_DIR/history" ]] || { printf 'deployment state directory is not writable: %s\n' "$STATE_DIR" >&2; exit 73; }
state_tmp=$(mktemp "$STATE_DIR/.release.XXXXXX")
deployed_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
history_stamp=$(date -u +%Y%m%dT%H%M%SZ)
{
  printf 'IMAGE_TAG=%s\n' "$IMAGE_TAG"
  printf 'DEPLOYED_AT=%s\n' "$deployed_at"
  for service in postgres redis minio core-api storage-api storage-worker web nginx; do
    container=$(compose ps -q "$service")
    digest=$(docker inspect --format '{{.Image}}' "$container")
    printf '%s=%s\n' "$service" "$digest"
  done
} > "$state_tmp"
history_file="$STATE_DIR/history/$history_stamp-$IMAGE_TAG-$$.env"
mv "$state_tmp" "$history_file"
state_tmp=''
current_tmp=$(mktemp "$STATE_DIR/.current.XXXXXX")
cp "$history_file" "$current_tmp"
mv "$current_tmp" "$STATE_DIR/current.env"
current_tmp=''
printf 'deployed immutable release %s\n' "$IMAGE_TAG"
