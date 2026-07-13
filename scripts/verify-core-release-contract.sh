#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
COMPOSE_FILE=${1:-"$ROOT_DIR/infrastructure/alicloud/docker-compose.core.yml"}
DEPLOY_SCRIPT=${RELEASE_CONTRACT_DEPLOY_SCRIPT:-"$ROOT_DIR/infrastructure/alicloud/deploy.sh"}
ROLLBACK_SCRIPT=${RELEASE_CONTRACT_ROLLBACK_SCRIPT:-"$ROOT_DIR/infrastructure/alicloud/rollback.sh"}
CI_FILE=${RELEASE_CONTRACT_CI_FILE:-"$ROOT_DIR/.github/workflows/ci.yml"}
PACKAGE_FILE=${RELEASE_CONTRACT_PACKAGE_FILE:-"$ROOT_DIR/package.json"}
MAKEFILE=${RELEASE_CONTRACT_MAKEFILE:-"$ROOT_DIR/Makefile"}
LEGACY_TEST_SCRIPT="$ROOT_DIR/scripts/run-legacy-tests.sh"

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

for file in "$COMPOSE_FILE" "$DEPLOY_SCRIPT" "$ROLLBACK_SCRIPT" "$CI_FILE" "$PACKAGE_FILE" "$MAKEFILE" "$LEGACY_TEST_SCRIPT" "$ROOT_DIR/services/core-api/Dockerfile" "$ROOT_DIR/services/email-provider/Dockerfile" "$ROOT_DIR/services/storage/Dockerfile" "$ROOT_DIR/frontend/cruip-landing/Dockerfile" "$ROOT_DIR/infrastructure/alicloud/nginx/Dockerfile" "$ROOT_DIR/infrastructure/alicloud/nginx/nginx.conf" "$ROOT_DIR/infrastructure/alicloud/prometheus/Dockerfile" "$ROOT_DIR/infrastructure/alicloud/prometheus/prometheus.yml"; do
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
export EMAIL_PROVIDER_URL=http://email-provider:8090
export EMAIL_PROVIDER_TOKEN=contract-email-provider-token-0000000001
export REGISTRY=registry.invalid
export IMAGE_TAG=sha-0123456789abcdef0123456789abcdef01234567
export SOURCE_DIR="$ROOT_DIR"
unset CORE_API_IMAGE EMAIL_PROVIDER_IMAGE STORAGE_IMAGE WEB_IMAGE NGINX_IMAGE PROMETHEUS_IMAGE

docker compose -f "$COMPOSE_FILE" config --format json | node -e '
const fs = require("node:fs")
const config = JSON.parse(fs.readFileSync(0, "utf8"))
const services = config.services || {}
const expected = ["analytics-worker", "core-api", "core-migrate", "email-provider", "minio", "minio-init", "nginx", "postgres", "prometheus", "redis", "storage-api", "storage-worker", "web"]
const actual = Object.keys(services).sort()
function assert(ok, message) { if (!ok) throw new Error(message) }
function same(actual, expected) { return JSON.stringify(actual) === JSON.stringify(expected) }
assert(JSON.stringify(actual) === JSON.stringify(expected), `services must be exactly ${expected.join(",")}`)
for (const [name, service] of Object.entries(services)) {
  assert(!service.build, `${name} must not build from source in production compose`)
  for (const mount of service.volumes || []) assert(mount.type !== "bind", `${name} contains a bind mount`)
  assert(typeof service.image === "string" && !service.image.endsWith(":latest"), `${name} must have a non-latest image`)
}
const infrastructureImages = {
  postgres: "postgres:16.6-alpine3.21@sha256:1d04b9ba1d4996401f2552b51beda8187f175c0645c091e4781134fc9c9a3eef",
  redis: "redis:7.4.2-alpine3.21@sha256:02419de7eddf55aa5bcf49efb74e88fa8d931b4d77c07eff8a6b2144472b6952",
  minio: "minio/minio:RELEASE.2025-04-22T22-12-26Z@sha256:a1ea29fa28355559ef137d71fc570e508a214ec84ff8083e39bc5428980b015e",
  "minio-init": "minio/mc:RELEASE.2025-04-16T18-13-26Z@sha256:aead63c77f9db9107f1696fb08ecb0faeda23729cde94b0f663edf4fe09728e3",
}
for (const [name, image] of Object.entries(infrastructureImages)) assert(services[name].image === image, `${name} image is not the approved tag and digest`)
const healthchecks = {
  postgres: { test: ["CMD-SHELL", "pg_isready -U mywebdrive -d mywebdrive_core"], interval: "5s", timeout: "3s", retries: 20 },
  redis: { test: ["CMD-SHELL", "redis-cli -a \"$${REDIS_PASSWORD}\" ping | grep -q PONG"], interval: "5s", timeout: "3s", retries: 20 },
  minio: { test: ["CMD", "curl", "--fail", "--silent", "http://127.0.0.1:9000/minio/health/live"], interval: "5s", timeout: "3s", retries: 20 },
  "core-api": { test: ["CMD", "node", "-e", "fetch('\''http://127.0.0.1:8080/ready'\'').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"], interval: "5s", timeout: "3s", retries: 20 },
  "analytics-worker": { test: ["CMD", "node", "-e", "fetch('\''http://127.0.0.1:8081/ready'\'').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"], interval: "5s", timeout: "3s", retries: 20 },
  "email-provider": { test: ["CMD", "node", "-e", "fetch('\''http://127.0.0.1:8090/ready'\'').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"], interval: "5s", timeout: "3s", retries: 20 },
  "storage-api": { test: ["CMD", "node", "-e", "fetch('\''http://127.0.0.1:7084/ready'\'').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"], interval: "5s", timeout: "3s", retries: 20 },
  "storage-worker": { test: ["CMD", "node", "-e", "fetch('\''http://127.0.0.1:7085/ready'\'').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"], interval: "5s", timeout: "3s", retries: 20 },
  prometheus: { test: ["CMD", "wget", "--spider", "-q", "http://127.0.0.1:9090/-/ready"], interval: "5s", timeout: "3s", retries: 20 },
  web: { test: ["CMD", "node", "-e", "fetch('\''http://127.0.0.1:4323/'\'').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"], interval: "10s", timeout: "5s", retries: 12 },
  nginx: { test: ["CMD-SHELL", "wget -qO- http://127.0.0.1:8080/healthz >/dev/null"], interval: "10s", timeout: "5s", retries: 12 },
}
for (const [name, expectedHealth] of Object.entries(healthchecks)) {
  const health = services[name].healthcheck
  assert(health && health.disable !== true, `${name} needs an enabled healthcheck`)
  assert(same(health.test, expectedHealth.test), `${name} healthcheck command is invalid`)
  assert(health.interval === expectedHealth.interval && health.timeout === expectedHealth.timeout && health.retries === expectedHealth.retries, `${name} healthcheck timing is invalid`)
}
for (const name of ["minio-init", "core-migrate", "core-api", "analytics-worker", "email-provider", "storage-api", "storage-worker", "prometheus", "web", "nginx"]) {
  const service = services[name]
  assert(service.read_only === true, `${name} must be read-only`)
  assert((service.cap_drop || []).includes("ALL"), `${name} must drop all capabilities`)
  assert((service.security_opt || []).includes("no-new-privileges:true"), `${name} must set no-new-privileges`)
}
assert(same(services["core-migrate"].command, ["sh", "-c", "./node_modules/.bin/prisma migrate deploy"]), "core-migrate command is invalid")
assert(same(services["core-api"].command, ["node", "dist/index.js", "api"]), "core-api command is invalid")
assert(same(services["analytics-worker"].command, ["node", "dist/index.js", "analytics-worker"]), "analytics-worker command is invalid")
assert(same(services["storage-api"].command, ["node", "dist/index.js", "api"]), "storage-api command is invalid")
assert(same(services["storage-worker"].command, ["node", "dist/index.js", "worker"]), "storage-worker command is invalid")
assert(services["core-api"].depends_on?.["core-migrate"]?.condition === "service_completed_successfully", "core-api must wait for migration")
assert(services["analytics-worker"].depends_on?.["core-migrate"]?.condition === "service_completed_successfully", "analytics-worker must wait for migration")
assert(Object.keys(services["analytics-worker"].environment || {}).sort().join(",") === "ANALYTICS_WORKER_PORT,BUILD_ID,CORE_DATABASE_URL,GIT_SHA,NODE_ENV", "analytics-worker must receive only its least-privilege environment")
assert(services["core-api"].depends_on?.["email-provider"]?.condition === "service_healthy", "core-api must wait for email-provider")
assert(services["core-api"].environment?.EMAIL_PROVIDER_URL === "http://email-provider:8090", "Core must use the private email-provider origin")
assert(services["core-api"].environment?.EMAIL_PROVIDER_TOKEN === services["email-provider"].environment?.EMAIL_PROVIDER_TOKEN, "Core and email-provider must share one internal token")
assert(!services["email-provider"].ports, "email-provider must not publish a host port")
assert(services["email-provider"].environment?.ALIBABA_CLOUD_ECS_METADATA === "MyWebDriveDirectMailRole", "email-provider must use the approved ECS RAM role")
assert(services["email-provider"].environment?.ALIBABA_CLOUD_IMDSV1_DISABLE === "true", "email-provider must require IMDSv2")
assert(!services["email-provider"].environment?.ALIBABA_CLOUD_ACCESS_KEY_ID && !services["email-provider"].environment?.ALIBABA_CLOUD_ACCESS_KEY_SECRET, "email-provider must not receive persistent AccessKey credentials")
assert(services["core-api"].environment?.PROMETHEUS_URL === "http://prometheus:9090", "Core must use the private Prometheus origin")
assert(!services.prometheus.ports, "prometheus must not publish a host port")
assert(same(services.prometheus.command, ["--config.file=/etc/prometheus/prometheus.yml", "--storage.tsdb.path=/prometheus", "--storage.tsdb.retention.time=30d", "--web.listen-address=0.0.0.0:9090"]), "prometheus command is invalid")
const prometheusVolume = (services.prometheus.volumes || []).find((mount) => mount.target === "/prometheus")
assert(prometheusVolume?.type === "volume" && prometheusVolume.source === "prometheus-data" && prometheusVolume.read_only !== true, "prometheus needs its writable persistent data volume")
for (const name of ["storage-api", "storage-worker"]) assert(services[name].depends_on?.["minio-init"]?.condition === "service_completed_successfully", `${name} must wait for minio-init`)
assert(services["storage-worker"].depends_on?.["core-api"]?.condition === "service_healthy", "storage-worker must wait for Core")
assert(same(services["minio-init"].entrypoint, ["/bin/sh", "-c"]), "minio-init entrypoint is invalid")
assert(same(services["minio-init"].command, ["mc alias set local http://minio:9000 \"$${MINIO_ROOT_USER}\" \"$${MINIO_ROOT_PASSWORD}\" && mc mb --ignore-existing \"local/$${MINIO_BUCKET}\""]), "minio-init command is invalid")
const tag = process.env.IMAGE_TAG
const registry = process.env.REGISTRY
const expectedImages = {
  "core-api": `${registry}/mywebdrive-core-api:${tag}`,
  "analytics-worker": `${registry}/mywebdrive-core-api:${tag}`,
  "core-migrate": `${registry}/mywebdrive-core-api:${tag}`,
  "email-provider": `${registry}/mywebdrive-email-provider:${tag}`,
  "storage-api": `${registry}/mywebdrive-storage:${tag}`,
  "storage-worker": `${registry}/mywebdrive-storage:${tag}`,
  web: `${registry}/mywebdrive-web:${tag}`,
  nginx: `${registry}/mywebdrive-nginx:${tag}`,
  prometheus: `${registry}/mywebdrive-prometheus:${tag}`,
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
require_pattern 'compose up -d --no-deps email-provider' "$DEPLOY_SCRIPT" 'deploy.sh must start the private email provider'
require_pattern 'analytics-worker' "$DEPLOY_SCRIPT" 'deploy.sh must start and record the analytics worker'
require_pattern 'PROMETHEUS_IMAGE' "$DEPLOY_SCRIPT" 'deploy.sh must resolve and persist the Prometheus image'
require_pattern '/version' "$DEPLOY_SCRIPT" 'deploy.sh must verify Core build metadata'
require_pattern 'current.env' "$DEPLOY_SCRIPT" 'deploy.sh must record current release state'
require_pattern 'mkdir "\$lock_dir"' "$DEPLOY_SCRIPT" 'deploy.sh must acquire an atomic state lock'
require_pattern 'exit 75' "$DEPLOY_SCRIPT" 'deploy.sh must fail concurrent deployment with EX_TEMPFAIL'
require_pattern 'exec .*deploy\.sh.*--manifest' "$ROLLBACK_SCRIPT" 'rollback.sh must use deploy manifest mode'
reject_pattern '\|[[:space:]]*node[[:space:]]+-e|^[[:space:]]*node[[:space:]]+-e' "$DEPLOY_SCRIPT" 'deploy.sh must not require Node.js on the production host'

reject_pattern '\|\|[[:space:]]*true|--no-frozen-lockfile|SQLite|sqlite|services/(auth|user|metadata|sharing)|api-gateway' "$CI_FILE" 'CI contains a best-effort, mutable install, SQLite, or split-control-plane path'
for pattern in '--frozen-lockfile' 'postgres:' 'redis:' 'prisma migrate deploy' 'verify-core-release-contract\.sh' 'test-core-cutover-contract\.sh' 'pnpm run build:all' 'pnpm run typecheck' 'pnpm run lint:all' 'pnpm run test:all' 'packages/observability test' 'docker build.*services/core-api/Dockerfile' 'docker build.*services/email-provider/Dockerfile' 'docker build.*services/storage/Dockerfile' 'docker build.*frontend/cruip-landing/Dockerfile' 'docker build.*infrastructure/alicloud/nginx/Dockerfile' 'docker build.*infrastructure/alicloud/prometheus/Dockerfile' 'mywebdrive-prometheus' 'packages:[[:space:]]*write' 'docker login ghcr\.io' 'release_tag=sha-\$\{GITHUB_SHA\}' 'docker push' '--read-only' '--tmpfs' 'id -u'; do
  require_pattern "$pattern" "$CI_FILE" "CI is missing required gate: $pattern"
done
for upstream in storage-api core-api web; do
  require_pattern "--add-host[[:space:]]+$upstream:127\\.0\\.0\\.1" "$CI_FILE" "CI Nginx syntax smoke must resolve the $upstream upstream"
done
require_pattern 'createDirectMailRuntime' "$CI_FILE" 'CI must construct the installed DirectMail SDK through the production ESM image'
for mount in '/tmp:uid=101,gid=101,mode=1777' '/var/cache/nginx:uid=101,gid=101,mode=0755' '/var/run:uid=101,gid=101,mode=0755'; do
  require_pattern "--tmpfs[[:space:]]+$mount" "$CI_FILE" "CI Nginx syntax smoke must provide a writable $mount tmpfs"
done

script_value() {
  node -e 'const pkg = require(process.argv[1]); process.stdout.write(pkg.scripts[process.argv[2]] || "")' "$PACKAGE_FILE" "$1"
}

authority_filters="--filter './packages/common' --filter './packages/observability' --filter './services/core-api' --filter './services/email-provider' --filter './services/storage' --filter './frontend/cruip-landing'"
[[ "$(script_value build)" == 'pnpm run build:all' ]] || fail 'build must delegate to the Core-first build'
[[ "$(script_value build:all)" == "pnpm $authority_filters run build" ]] || fail 'build:all selectors are not exact'
[[ "$(script_value typecheck)" == "pnpm $authority_filters exec tsc -b --pretty false" ]] || fail 'typecheck selectors are not exact'
[[ "$(script_value lint:all)" == "pnpm --if-present $authority_filters run lint" ]] || fail 'lint:all selectors are not exact'
[[ "$(script_value test:all)" == "pnpm --if-present $authority_filters run test && pnpm run test:generated && pnpm run verify:generated" ]] || fail 'test:all selectors are not exact'
[[ "$(script_value test:legacy)" == 'bash scripts/run-legacy-tests.sh' ]] || fail 'test:legacy must remain explicit'
[[ "$(script_value verify:generated)" == 'bash scripts/verify-no-generated-artifacts.sh' ]] || fail 'generated artifact verifier is not exposed'
require_pattern 'SOFT-RETIRED' "$LEGACY_TEST_SCRIPT" 'legacy test warning is missing'
for legacy in auth user metadata sharing api-gateway-node; do
  require_pattern "--filter '\./services/$legacy'" "$LEGACY_TEST_SCRIPT" "legacy test discovery is missing $legacy"
done
reject_pattern '\|\|[[:space:]]*true' "$MAKEFILE" 'Makefile must fail closed'
for pattern in 'pnpm run build:all' 'pnpm run typecheck' 'pnpm run lint:all' 'pnpm run test:all' 'pnpm run verify:generated' 'verify-core-release-contract\.sh'; do require_pattern "$pattern" "$MAKEFILE" "Makefile quality-check is missing: $pattern"; done

for dockerfile in "$ROOT_DIR/services/core-api/Dockerfile" "$ROOT_DIR/services/email-provider/Dockerfile" "$ROOT_DIR/services/storage/Dockerfile"; do
  require_pattern '^FROM .+ AS build$' "$dockerfile" "$(basename "$(dirname "$dockerfile")") Dockerfile must be multi-stage"
  require_pattern '^USER node$' "$dockerfile" "$(basename "$(dirname "$dockerfile")") Dockerfile must run as node"
  reject_pattern ':[[:space:]]*latest([[:space:]]|$)' "$dockerfile" 'Dockerfile base images must not use latest'
done

require_pattern '^USER node$' "$ROOT_DIR/frontend/cruip-landing/Dockerfile" 'web Dockerfile must run as node'
require_pattern '^USER nginx$' "$ROOT_DIR/infrastructure/alicloud/nginx/Dockerfile" 'nginx Dockerfile must run as nginx'
require_pattern '^FROM prom/prometheus:v3\.5\.0@sha256:63805ebb8d2b3920190daf1cb14a60871b16fd38bed42b857a3182bc621f4996$' "$ROOT_DIR/infrastructure/alicloud/prometheus/Dockerfile" 'Prometheus base image must use the approved tag and digest'
require_pattern '^COPY prometheus\.yml /etc/prometheus/prometheus\.yml$' "$ROOT_DIR/infrastructure/alicloud/prometheus/Dockerfile" 'Prometheus config must be baked into the image'
require_pattern '^USER nobody$' "$ROOT_DIR/infrastructure/alicloud/prometheus/Dockerfile" 'Prometheus image must run as nobody'
require_pattern '^[[:space:]]*scrape_interval:[[:space:]]*15s$' "$ROOT_DIR/infrastructure/alicloud/prometheus/prometheus.yml" 'Prometheus scrape interval must be 15 seconds'
for target in core-api:8080 storage-api:7084 storage-worker:7085; do
  require_pattern "^[[:space:]]*-[[:space:]]*'$target'$" "$ROOT_DIR/infrastructure/alicloud/prometheus/prometheus.yml" "Prometheus is missing scrape target $target"
done
actual_prometheus_targets=$(sed -n "s/^[[:space:]]*-[[:space:]]*'\([^']*\)'[[:space:]]*$/\1/p" "$ROOT_DIR/infrastructure/alicloud/prometheus/prometheus.yml")
[[ "$actual_prometheus_targets" == $'core-api:8080\nstorage-api:7084\nstorage-worker:7085' ]] || fail 'Prometheus must scrape exactly the approved three targets'
reject_pattern 'localhost|127\.0\.0\.1|api-gateway|host\.docker\.internal' "$ROOT_DIR/infrastructure/alicloud/prometheus/prometheus.yml" 'Prometheus config contains an unapproved scrape target'
reject_pattern 'API_BASE_URL|rewrites|gateway' "$ROOT_DIR/frontend/cruip-landing/next.config.js" 'frontend must use same-origin API routes'

printf 'core release contract: ok\n'
