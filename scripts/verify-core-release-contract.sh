#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
COMPOSE_FILE=${1:-"$ROOT_DIR/infrastructure/alicloud/docker-compose.core.yml"}
DEPLOY_SCRIPT=${RELEASE_CONTRACT_DEPLOY_SCRIPT:-"$ROOT_DIR/infrastructure/alicloud/deploy.sh"}
ROLLBACK_SCRIPT=${RELEASE_CONTRACT_ROLLBACK_SCRIPT:-"$ROOT_DIR/infrastructure/alicloud/rollback.sh"}
CI_FILE=${RELEASE_CONTRACT_CI_FILE:-"$ROOT_DIR/.github/workflows/ci.yml"}
PACKAGE_FILE=${RELEASE_CONTRACT_PACKAGE_FILE:-"$ROOT_DIR/package.json"}
MAKEFILE=${RELEASE_CONTRACT_MAKEFILE:-"$ROOT_DIR/Makefile"}

fail() {
  printf 'release contract violation: %s\n' "$*" >&2
  exit 1
}

require_file() {
  [[ -f "$1" ]] || fail "missing file: $1"
}

require_pattern() {
  local pattern=$1 file=$2 message=$3
  grep -Eq -- "$pattern" "$file" || fail "$message"
}

reject_pattern() {
  local pattern=$1 file=$2 message=$3
  if grep -Eiq -- "$pattern" "$file"; then
    fail "$message"
  fi
}

require_file "$COMPOSE_FILE"
require_file "$DEPLOY_SCRIPT"
require_file "$ROLLBACK_SCRIPT"
require_file "$CI_FILE"
require_file "$PACKAGE_FILE"
require_file "$MAKEFILE"
require_file "$ROOT_DIR/services/core-api/Dockerfile"
require_file "$ROOT_DIR/services/storage/Dockerfile"

if awk '
  /^    volumes:[[:space:]]*$/ { in_volumes=1; next }
  in_volumes && /^    [A-Za-z0-9_-]+:/ { in_volumes=0 }
  in_volumes && /^  [A-Za-z0-9_-]+:/ { in_volumes=0 }
  in_volumes && /type:[[:space:]]*bind([[:space:]]|$)/ { bad=1 }
  in_volumes && /source:[[:space:]]*["'\'' ]*(\/|\.\.?\/)/ { bad=1 }
  in_volumes && /^[[:space:]]*-[[:space:]]*["'\'' ]*(\/|\.\.?\/)/ { bad=1 }
  END { exit bad ? 0 : 1 }
' "$COMPOSE_FILE"; then
  fail 'source or bind mounts are forbidden'
fi
reject_pattern '\$\{PWD\}' "$COMPOSE_FILE" 'source or bind mounts are forbidden'
reject_pattern 'image:[[:space:]]*.*:latest([[:space:]#]|$)|image:[[:space:]]*[^#]+:[[:space:]#]*$' "$COMPOSE_FILE" 'latest or empty image tags are forbidden'
require_pattern '\$\{IMAGE_TAG:\?' "$COMPOSE_FILE" 'IMAGE_TAG must be required by compose expansion'

services=$(awk '
  /^services:[[:space:]]*$/ { in_services=1; next }
  in_services && /^[^[:space:]#]/ { exit }
  in_services && /^  [A-Za-z0-9_-]+:[[:space:]]*(#.*)?$/ {
    name=$1; sub(/:$/, "", name); print name
  }
' "$COMPOSE_FILE" | tr '\n' ' ' | sed 's/ $//')
expected='postgres redis minio minio-init core-migrate core-api storage-api storage-worker web nginx'
[[ "$services" == "$expected" ]] || fail "production services must be exactly: $expected"

for service in postgres redis minio core-api storage-api storage-worker web nginx; do
  block=$(awk -v wanted="$service" '
    $0 == "  " wanted ":" { capture=1; next }
    capture && /^  [A-Za-z0-9_-]+:/ { exit }
    capture && /^[^[:space:]#]/ { exit }
    capture { print }
  ' "$COMPOSE_FILE")
  grep -Eq '^[[:space:]]+healthcheck:' <<<"$block" || fail "$service must define a healthcheck"
done

for service in minio-init core-migrate core-api storage-api storage-worker web nginx; do
  block=$(awk -v wanted="$service" '
    $0 == "  " wanted ":" { capture=1; next }
    capture && /^  [A-Za-z0-9_-]+:/ { exit }
    capture && /^[^[:space:]#]/ { exit }
    capture { print }
  ' "$COMPOSE_FILE")
  grep -Eq '^[[:space:]]+read_only:[[:space:]]+true' <<<"$block" || fail "$service must be read-only"
  grep -Eq '^[[:space:]]+cap_drop:' <<<"$block" || fail "$service must drop capabilities"
  grep -Eq 'no-new-privileges:true' <<<"$block" || fail "$service must set no-new-privileges"
done

minio_init_block=$(awk '
  $0 == "  minio-init:" { capture=1; next }
  capture && /^  [A-Za-z0-9_-]+:/ { exit }
  capture && /^[^[:space:]#]/ { exit }
  capture { print }
' "$COMPOSE_FILE")
grep -Eq 'image:[[:space:]]+minio/mc:[^[:space:]#]+' <<<"$minio_init_block" || fail 'minio-init must use an explicitly tagged minio/mc image'
grep -Eq 'mc alias set' <<<"$minio_init_block" || fail 'minio-init must configure the object storage alias'
grep -Eq 'mc mb --ignore-existing' <<<"$minio_init_block" || fail 'minio-init must idempotently create the bucket'

require_pattern 'prisma[[:space:]]+migrate[[:space:]]+deploy' "$COMPOSE_FILE" 'core-migrate must run prisma migrate deploy'
require_pattern 'minio/health/live' "$COMPOSE_FILE" 'MinIO must use its unauthenticated liveness endpoint'
require_pattern 'mywebdrive-core-api:\$\{IMAGE_TAG:\?' "$COMPOSE_FILE" 'core-api image must use required IMAGE_TAG'
require_pattern 'mywebdrive-storage:\$\{IMAGE_TAG:\?' "$COMPOSE_FILE" 'storage image must use required IMAGE_TAG'
require_pattern 'mywebdrive-web:\$\{IMAGE_TAG:\?' "$COMPOSE_FILE" 'web image must use required IMAGE_TAG'
require_pattern 'mywebdrive-nginx:\$\{IMAGE_TAG:\?' "$COMPOSE_FILE" 'nginx image must use required IMAGE_TAG'

core_api_block=$(awk '
  $0 == "  core-api:" { capture=1; next }
  capture && /^  [A-Za-z0-9_-]+:/ { exit }
  capture && /^[^[:space:]#]/ { exit }
  capture { print }
' "$COMPOSE_FILE")
awk '/core-migrate:/ { dependency=1 } dependency && /condition:[[:space:]]*service_completed_successfully/ { ok=1 } END { exit ok ? 0 : 1 }' <<<"$core_api_block" || fail 'core-api must wait for core-migrate to complete successfully'

for storage_service in storage-api storage-worker; do
  storage_block=$(awk -v wanted="$storage_service" '
    $0 == "  " wanted ":" { capture=1; next }
    capture && /^  [A-Za-z0-9_-]+:/ { exit }
    capture && /^[^[:space:]#]/ { exit }
    capture { print }
  ' "$COMPOSE_FILE")
  awk '/minio-init:/ { dependency=1 } dependency && /condition:[[:space:]]*service_completed_successfully/ { ok=1 } END { exit ok ? 0 : 1 }' <<<"$storage_block" || fail "$storage_service must wait for minio-init to complete successfully"
done

for script in "$DEPLOY_SCRIPT" "$ROLLBACK_SCRIPT"; do
  require_pattern '^set -Eeuo pipefail$' "$script" "$(basename "$script") must use strict mode"
  require_pattern 'docker compose' "$script" "$(basename "$script") must use Docker Compose v2"
  require_pattern 'docker-compose\.core\.yml' "$script" "$(basename "$script") must use the Core compose file"
  require_pattern 'latest' "$script" "$(basename "$script") must explicitly reject latest"
  require_pattern '\^\[A-Za-z0-9\]' "$script" "$(basename "$script") must validate the image tag format"
  reject_pattern '\|\|[[:space:]]*true|(^|[^[:alnum:]_])git([[:space:]]|$)|rsync|(^|[[:space:]])docker-compose([[:space:]]|$)|compose[[:space:]]+down|down([[:space:]]+-v|[^\n]*--volumes)|volume[[:space:]]+(rm|prune)|rm[[:space:]]+-rf[[:space:]]+/data|SCRIPT_DIR/\.deploy-state' "$script" "$(basename "$script") contains a forbidden best-effort, source, or destructive operation"
done

for pattern in 'compose config -q' 'compose pull' 'compose run --rm --no-deps minio-init' 'compose run --rm --no-deps core-migrate' '/version' "'{{.Image}}'" 'history_file' 'current.env'; do
  require_pattern "$pattern" "$DEPLOY_SCRIPT" "deploy.sh is missing release operation: $pattern"
done
require_pattern 'exec .*deploy\.sh' "$ROLLBACK_SCRIPT" 'rollback.sh must reuse the validated immutable deploy path'

reject_pattern '\|\|[[:space:]]*true|--no-frozen-lockfile|SQLite|sqlite|services/(auth|user|metadata|sharing)|api-gateway' "$CI_FILE" 'CI contains a best-effort, mutable install, SQLite, or split-control-plane path'
for pattern in '--frozen-lockfile' 'postgres:' 'redis:' 'prisma migrate deploy' 'verify-core-release-contract\.sh' 'pnpm run build:all' 'pnpm run typecheck' 'pnpm run lint:all' 'pnpm run test:all'; do
  require_pattern "$pattern" "$CI_FILE" "CI is missing required gate: $pattern"
done

require_pattern '"build:all":[[:space:]]*"pnpm --filter '\''\./packages/\*'\'' --filter '\''\./services/\*'\'' --filter '\''\./apps/\*'\'' --filter '\''\./frontend/\*'\'' run build"' "$PACKAGE_FILE" 'build:all selectors are not exact'
require_pattern '"test:all":[[:space:]]*"pnpm --if-present --filter '\''\./services/\*'\'' --filter '\''\./apps/\*'\'' --filter '\''\./frontend/\*'\'' run test"' "$PACKAGE_FILE" 'test:all selectors are not exact'
require_pattern '"lint:all":[[:space:]]*"pnpm --if-present --filter '\''\./services/\*'\'' --filter '\''\./apps/\*'\'' --filter '\''\./frontend/\*'\'' run lint"' "$PACKAGE_FILE" 'lint:all selectors are not exact'
reject_pattern '\|\|[[:space:]]*true' "$MAKEFILE" 'Makefile must fail closed'
for pattern in 'pnpm run build:all' 'pnpm run typecheck' 'pnpm run lint:all' 'pnpm run test:all' 'verify-core-release-contract\.sh'; do
  require_pattern "$pattern" "$MAKEFILE" "Makefile quality-check is missing: $pattern"
done

for dockerfile in "$ROOT_DIR/services/core-api/Dockerfile" "$ROOT_DIR/services/storage/Dockerfile"; do
  require_pattern '^FROM .+ AS build$' "$dockerfile" "$(basename "$(dirname "$dockerfile")") Dockerfile must be multi-stage"
  require_pattern '^USER node$' "$dockerfile" "$(basename "$(dirname "$dockerfile")") Dockerfile must run as node"
  reject_pattern ':[[:space:]]*latest([[:space:]]|$)' "$dockerfile" 'Dockerfile base images must not use latest'
done

printf 'core release contract: ok\n'
