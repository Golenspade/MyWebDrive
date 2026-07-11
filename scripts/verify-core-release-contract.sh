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
  if grep -Eiq -- "$pattern" "$file"; then fail "$message"; fi
}

for file in "$COMPOSE_FILE" "$DEPLOY_SCRIPT" "$ROLLBACK_SCRIPT" "$CI_FILE" "$PACKAGE_FILE" "$MAKEFILE" "$ROOT_DIR/services/core-api/Dockerfile" "$ROOT_DIR/services/storage/Dockerfile"; do
  require_file "$file"
done

export POSTGRES_PASSWORD=contract-postgres-password
export REDIS_PASSWORD=contract-redis-password
export MINIO_ROOT_USER=contract-user
export MINIO_ROOT_PASSWORD=contract-minio-password
export CORE_DATABASE_URL='postgresql://contract:contract@postgres:5432/contract'
export REDIS_URL='redis://:contract@redis:6379/0'
export CORE_SESSION_SECRET=contract-core-session-secret-0000000000000001
export OTP_PEPPER=contract-otp-pepper-secret-000000000000000001
export STORAGE_GRANT_SECRET=contract-storage-grant-secret-00000000000001
export CORE_CALLBACK_SECRET=contract-core-callback-secret-0000000000001
export EMAIL_PROVIDER_URL=https://mail.invalid
export EMAIL_PROVIDER_TOKEN=contract-email-token
export REGISTRY=registry.invalid
export IMAGE_TAG=sha-0123456789abcdef0123456789abcdef01234567
export SOURCE_DIR="$ROOT_DIR"
unset CORE_API_IMAGE STORAGE_IMAGE WEB_IMAGE NGINX_IMAGE

docker compose -f "$COMPOSE_FILE" config --format json | node -e '
const fs = require("node:fs")
const config = JSON.parse(fs.readFileSync(0, "utf8"))
const services = config.services || {}
const expected = ["core-api", "core-migrate", "minio", "minio-init", "nginx", "postgres", "redis", "storage-api", "storage-worker", "web"]
const actual = Object.keys(services).sort()
function assert(ok, message) { if (!ok) throw new Error(message) }
assert(JSON.stringify(actual) === JSON.stringify(expected), `services must be exactly ${expected.join(",")}`)
for (const [name, service] of Object.entries(services)) {
  assert(!service.build, `${name} must not build from source in production compose`)
  for (const mount of service.volumes || []) assert(mount.type !== "bind", `${name} contains a bind mount`)
  assert(typeof service.image === "string" && !service.image.endsWith(":latest"), `${name} must have a non-latest image`)
}
for (const name of ["postgres", "redis", "minio", "minio-init"]) assert(/@sha256:[0-9a-f]{64}$/.test(services[name].image), `${name} image must be pinned by digest`)
for (const name of ["postgres", "redis", "minio", "core-api", "storage-api", "storage-worker", "web", "nginx"]) {
  const health = services[name].healthcheck
  assert(health && health.disable !== true && Array.isArray(health.test) && health.test.length > 0, `${name} needs an enabled healthcheck`)
}
for (const name of ["minio-init", "core-migrate", "core-api", "storage-api", "storage-worker", "web", "nginx"]) {
  const service = services[name]
  assert(service.read_only === true, `${name} must be read-only`)
  assert((service.cap_drop || []).includes("ALL"), `${name} must drop all capabilities`)
  assert((service.security_opt || []).includes("no-new-privileges:true"), `${name} must set no-new-privileges`)
}
const migrate = (services["core-migrate"].command || []).join(" ")
assert(/(^|\s)(\S*\/)?prisma\s+migrate\s+deploy(\s|$)/.test(migrate), "core-migrate must execute prisma migrate deploy")
assert(services["core-api"].depends_on?.["core-migrate"]?.condition === "service_completed_successfully", "core-api must wait for migration")
for (const name of ["storage-api", "storage-worker"]) assert(services[name].depends_on?.["minio-init"]?.condition === "service_completed_successfully", `${name} must wait for minio-init`)
assert(services["storage-worker"].depends_on?.["core-api"]?.condition === "service_healthy", "storage-worker must wait for Core")
const init = (services["minio-init"].command || []).join(" ")
assert(/mc alias set/.test(init) && /mc mb --ignore-existing/.test(init), "minio-init must idempotently create the bucket")
assert(services["minio-init"].image.startsWith("minio/mc:") && !services["minio-init"].image.endsWith(":latest"), "minio-init must use pinned minio/mc")
assert((services.minio.healthcheck.test || []).join(" ").includes("/minio/health/live"), "MinIO must use its live probe")
const tag = process.env.IMAGE_TAG
const registry = process.env.REGISTRY
const expectedImages = {
  "core-api": `${registry}/mywebdrive-core-api:${tag}`,
  "core-migrate": `${registry}/mywebdrive-core-api:${tag}`,
  "storage-api": `${registry}/mywebdrive-storage:${tag}`,
  "storage-worker": `${registry}/mywebdrive-storage:${tag}`,
  web: `${registry}/mywebdrive-web:${tag}`,
  nginx: `${registry}/mywebdrive-nginx:${tag}`,
}
for (const [name, image] of Object.entries(expectedImages)) assert(services[name].image === image, `${name} image contract is invalid`)
' || fail 'compose structure is invalid'

for script in "$DEPLOY_SCRIPT" "$ROLLBACK_SCRIPT"; do
  require_pattern '^set -Eeuo pipefail$' "$script" "$(basename "$script") must use strict mode"
  require_pattern 'docker-compose\.core\.yml' "$script" "$(basename "$script") must use the Core compose file"
  reject_pattern '\|\|[[:space:]]*true|(^|[^[:alnum:]_])git([[:space:]]|$)|rsync|(^|[[:space:]])docker-compose([[:space:]]|$)|compose[[:space:]]+down|down([[:space:]]+-v|[^\n]*--volumes)|volume[[:space:]]+(rm|prune)|system[[:space:]]+prune([^\n]*--volumes)?|rm[[:space:]]+-rf[[:space:]]+/data|SCRIPT_DIR/\.deploy-state' "$script" "$(basename "$script") contains a forbidden operation"
done
require_pattern 'docker compose' "$DEPLOY_SCRIPT" 'deploy.sh must use Docker Compose v2'
require_pattern 'compose config -q' "$DEPLOY_SCRIPT" 'deploy.sh must validate compose'
require_pattern 'compose run --rm --no-deps core-migrate' "$DEPLOY_SCRIPT" 'deploy.sh must run Core migrations'
require_pattern 'compose run --rm --no-deps minio-init' "$DEPLOY_SCRIPT" 'deploy.sh must initialize object storage'
require_pattern '/version' "$DEPLOY_SCRIPT" 'deploy.sh must verify Core build metadata'
require_pattern 'current.env' "$DEPLOY_SCRIPT" 'deploy.sh must record current release state'
require_pattern 'exec .*deploy\.sh.*--manifest' "$ROLLBACK_SCRIPT" 'rollback.sh must use deploy manifest mode'

reject_pattern '\|\|[[:space:]]*true|--no-frozen-lockfile|SQLite|sqlite|services/(auth|user|metadata|sharing)|api-gateway' "$CI_FILE" 'CI contains a best-effort, mutable install, SQLite, or split-control-plane path'
for pattern in '--frozen-lockfile' 'postgres:' 'redis:' 'prisma migrate deploy' 'verify-core-release-contract\.sh' 'pnpm run build:all' 'pnpm run typecheck' 'pnpm run lint:all' 'pnpm run test:all' 'docker build.*services/core-api/Dockerfile' 'docker build.*services/storage/Dockerfile' '--read-only' '--tmpfs' 'id -u'; do
  require_pattern "$pattern" "$CI_FILE" "CI is missing required gate: $pattern"
done

require_pattern '"build:all":[[:space:]]*"pnpm --filter '\''\./packages/\*'\'' --filter '\''\./services/\*'\'' --filter '\''\./apps/\*'\'' --filter '\''\./frontend/\*'\'' run build"' "$PACKAGE_FILE" 'build:all selectors are not exact'
require_pattern '"test:all":[[:space:]]*"pnpm --if-present --filter '\''\./services/\*'\'' --filter '\''\./apps/\*'\'' --filter '\''\./frontend/\*'\'' run test"' "$PACKAGE_FILE" 'test:all selectors are not exact'
require_pattern '"lint:all":[[:space:]]*"pnpm --if-present --filter '\''\./services/\*'\'' --filter '\''\./apps/\*'\'' --filter '\''\./frontend/\*'\'' run lint"' "$PACKAGE_FILE" 'lint:all selectors are not exact'
reject_pattern '\|\|[[:space:]]*true' "$MAKEFILE" 'Makefile must fail closed'
for pattern in 'pnpm run build:all' 'pnpm run typecheck' 'pnpm run lint:all' 'pnpm run test:all' 'verify-core-release-contract\.sh'; do require_pattern "$pattern" "$MAKEFILE" "Makefile quality-check is missing: $pattern"; done

for dockerfile in "$ROOT_DIR/services/core-api/Dockerfile" "$ROOT_DIR/services/storage/Dockerfile"; do
  require_pattern '^FROM .+ AS build$' "$dockerfile" "$(basename "$(dirname "$dockerfile")") Dockerfile must be multi-stage"
  require_pattern '^USER node$' "$dockerfile" "$(basename "$(dirname "$dockerfile")") Dockerfile must run as node"
  reject_pattern ':[[:space:]]*latest([[:space:]]|$)' "$dockerfile" 'Dockerfile base images must not use latest'
done

printf 'core release contract: ok\n'
