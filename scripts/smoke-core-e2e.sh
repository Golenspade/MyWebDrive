#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
COMPOSE_FILE="$ROOT_DIR/infrastructure/alicloud/docker-compose.core.yml"
source "$ROOT_DIR/scripts/smoke-core-mode.sh"
source "$ROOT_DIR/scripts/smoke-core-health.sh"
source "$ROOT_DIR/scripts/smoke-core-artifacts.sh"

SMOKE_REUSE_IMAGES=${SMOKE_REUSE_IMAGES:-0}
SMOKE_BROWSER_GATE=${SMOKE_BROWSER_GATE:-0}
SMOKE_UPDATE_SNAPSHOTS=${SMOKE_UPDATE_SNAPSHOTS:-0}
[[ "$SMOKE_REUSE_IMAGES" == 0 || "$SMOKE_REUSE_IMAGES" == 1 ]] || { printf 'SMOKE_REUSE_IMAGES must be 0 or 1\n' >&2; exit 64; }
[[ "$SMOKE_BROWSER_GATE" == 0 || "$SMOKE_BROWSER_GATE" == 1 ]] || { printf 'SMOKE_BROWSER_GATE must be 0 or 1\n' >&2; exit 64; }
smoke_validate_snapshot_update_policy \
  "$SMOKE_UPDATE_SNAPSHOTS" \
  "$SMOKE_BROWSER_GATE" \
  "${SMOKE_BROWSER_CONTAINER_IMAGE:-}" \
  "$ROOT_DIR"
RUN_ID="$(date -u +%Y%m%d%H%M%S)-$$"
SHA_TAG="sha-$(printf '%040x' "$$")"
PROJECT="mwd-core-smoke-$RUN_ID"
smoke_configure_images "$SMOKE_REUSE_IMAGES" "$RUN_ID"
TEMP_DIR=$(mktemp -d "${TMPDIR:-/tmp}/mywebdrive-core-smoke.XXXXXX")
OVERRIDE_FILE="$TEMP_DIR/compose.smoke.yml"
COOKIE_JAR="$TEMP_DIR/cookies.txt"
HTTP_PORT=${SMOKE_HTTP_PORT:-$((18080 + ($$ % 1000)))}
FAKE_EMAIL_HOST_PORT=${SMOKE_FAKE_EMAIL_PORT:-$((20080 + ($$ % 1000)))}
BASE_URL="http://127.0.0.1:$HTTP_PORT"
FAKE_EMAIL_TEST_TOKEN="smoke-mailbox-${RUN_ID}-000000000000000000"
SMOKE_ARTIFACT_DIR=${SMOKE_ARTIFACT_DIR:-}
PLAYWRIGHT_OUTPUT_DIR="$TEMP_DIR/test-results"
PLAYWRIGHT_REPORT_DIR="$TEMP_DIR/playwright-report"
SMOKE_COMPLETED=0

export COMPOSE_PROJECT_NAME="$PROJECT"
export POSTGRES_PASSWORD="smoke-postgres-$RUN_ID"
export REDIS_PASSWORD="smoke-redis-$RUN_ID"
export MINIO_ROOT_USER="smoke-minio-user"
export MINIO_ROOT_PASSWORD="smoke-minio-$RUN_ID"
export MINIO_BUCKET="mywebdrive-smoke"
export CORE_DATABASE_URL="postgresql://mywebdrive:${POSTGRES_PASSWORD}@postgres:5432/mywebdrive_core?schema=public"
export REDIS_URL="redis://:${REDIS_PASSWORD}@redis:6379/0"
export CORE_SESSION_SECRET="smoke-core-session-secret-${RUN_ID}-000000000000"
export OTP_PEPPER="smoke-otp-pepper-${RUN_ID}-000000000000000000"
export STORAGE_GRANT_SECRET="smoke-storage-grant-${RUN_ID}-000000000000000"
export CORE_CALLBACK_SECRET="smoke-core-callback-${RUN_ID}-000000000000000"
export EMAIL_PROVIDER_URL="http://fake-email:8025"
export EMAIL_PROVIDER_TOKEN="smoke-email-token"
export DEFAULT_USER_QUOTA_BYTES="10485760"
export CORE_ADMIN_EMAILS="smoke-admin@example.test"
export REGISTRY="registry.invalid"
export IMAGE_TAG="$SHA_TAG"
export GIT_SHA="${SHA_TAG#sha-}"
export HTTP_PORT
export CORE_API_IMAGE="$CORE_IMAGE"
export EMAIL_PROVIDER_IMAGE="$EMAIL_PROVIDER_IMAGE"
export STORAGE_IMAGE="$STORAGE_IMAGE"
export WEB_IMAGE="$WEB_IMAGE"
export NGINX_IMAGE="$NGINX_IMAGE"
export PROMETHEUS_IMAGE="$PROMETHEUS_IMAGE"

compose() {
  docker compose -f "$COMPOSE_FILE" -f "$OVERRIDE_FILE" "$@"
}

fail() {
  printf 'core smoke failed: %s\n' "$1" >&2
  exit 1
}

on_error() {
  local line=$1 status=$2
  printf 'core smoke failed at line %s (exit %s)\n' "$line" "$status" >&2
  exit "$status"
}

redact_stream() {
  node "$ROOT_DIR/scripts/verify-smoke-artifacts.mjs" redact
}

collect_failure_artifacts() {
  [[ -n "$SMOKE_ARTIFACT_DIR" ]] || return 0
  if [[ -e "$SMOKE_ARTIFACT_DIR" || -L "$SMOKE_ARTIFACT_DIR" ]]; then
    printf 'core smoke warning: artifact directory must not already exist: %s\n' "$SMOKE_ARTIFACT_DIR" >&2
    return 1
  fi
  mkdir -m 700 -p "$SMOKE_ARTIFACT_DIR/compose"
  compose ps --all 2>&1 | redact_stream >"$SMOKE_ARTIFACT_DIR/compose/ps.txt" || true
  compose config --services 2>&1 | redact_stream >"$SMOKE_ARTIFACT_DIR/compose/services.txt" || true
  compose config --images 2>&1 | redact_stream >"$SMOKE_ARTIFACT_DIR/compose/images.txt" || true
  compose logs --no-color 2>&1 | redact_stream >"$SMOKE_ARTIFACT_DIR/compose/logs.txt" || true
  smoke_copy_safe_playwright_report \
    "$PLAYWRIGHT_REPORT_DIR" \
    "$SMOKE_ARTIFACT_DIR/playwright-report" \
    "$ROOT_DIR/scripts/verify-smoke-artifacts.mjs"
  if [[ -d "$PLAYWRIGHT_OUTPUT_DIR" ]]; then
    while IFS= read -r -d '' file; do
      [[ -f "$file" && ! -L "$file" ]] || continue
      relative=${file#"$PLAYWRIGHT_OUTPUT_DIR"/}
      mkdir -p "$SMOKE_ARTIFACT_DIR/test-results/$(dirname "$relative")"
      cp "$file" "$SMOKE_ARTIFACT_DIR/test-results/$relative"
    done < <(find "$PLAYWRIGHT_OUTPUT_DIR" -type f -name '*.png' -print0)
  fi
  node "$ROOT_DIR/scripts/verify-smoke-artifacts.mjs" verify "$SMOKE_ARTIFACT_DIR"
}

cleanup_compose_resources() {
  if [[ -f "$OVERRIDE_FILE" ]]; then
    compose down --volumes --remove-orphans >/dev/null 2>&1
  fi
}

cleanup_temporary_directory() {
  rm -rf "$TEMP_DIR"
}

cleanup() {
  local status=$?
  trap - EXIT INT TERM ERR
  set +Ee
  smoke_cleanup_and_exit \
    "$status" \
    "$SMOKE_COMPLETED" \
    collect_failure_artifacts \
    cleanup_compose_resources \
    smoke_cleanup_owned_images \
    cleanup_temporary_directory
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
trap 'on_error "$LINENO" "$?"' ERR

json_get() {
  node -e '
const fs = require("node:fs")
const value = process.argv[2].split(".").reduce((current, key) => current?.[key], JSON.parse(fs.readFileSync(process.argv[1], "utf8")))
if (value === undefined || value === null) process.exit(2)
process.stdout.write(String(value))
' "$1" "$2"
}

request() {
  local expected=$1 output=$2
  shift 2
  local status
  status=$(curl --silent --show-error --output "$output" --write-out '%{http_code}' "$@")
  [[ "$status" == "$expected" ]] || fail "HTTP assertion $(basename "$output") failed: expected $expected, got $status"
}

fetch_system_dashboard() {
  local output=$1 status
  status=$(curl --silent --show-error --output "$output" --write-out '%{http_code}' \
    -H "Authorization: Bearer $ACCESS" "$BASE_URL/api/v1/admin/dashboard/system?range=today")
  [[ "$status" == 200 ]]
}

fetch_business_dashboard() {
  local output=$1 status
  status=$(curl --silent --show-error --output "$output" --write-out '%{http_code}' \
    -H "Authorization: Bearer $ACCESS" "$BASE_URL/api/v1/admin/dashboard/business?range=today")
  [[ "$status" == 200 ]]
}

wait_ready_status() {
  local service=$1 url=$2 expected=$3
  for _ in $(seq 1 40); do
    local actual
    actual=$(compose exec -T "$service" node -e "fetch('$url').then(r=>process.stdout.write(String(r.status))).catch(()=>process.stdout.write('000'))")
    if [[ "$actual" == "$expected" ]]; then return 0; fi
    sleep 1
  done
  fail "$service $url never reached HTTP $expected"
}

run_browser_gate() {
  local scenario=$1 email grep_pattern snapshot_mode_display
  [[ "$SMOKE_BROWSER_GATE" == 1 ]] || return 0
  case "$scenario" in
    healthy)
      email=browser-healthy-admin@example.test
      grep_pattern=@healthy
      ;;
    prometheus-down)
      email=browser-degraded-admin@example.test
      grep_pattern=@degraded
      ;;
    *) fail "unknown browser gate scenario: $scenario" ;;
  esac
  snapshot_mode_display=$(smoke_snapshot_update_arg "$SMOKE_UPDATE_SNAPSHOTS")
  [[ -n "$snapshot_mode_display" ]] || snapshot_mode_display='(compare)'
  printf 'core smoke browser command: playwright test --grep %s %s\n' \
    "$grep_pattern" "$snapshot_mode_display"

  if [[ -n "${SMOKE_BROWSER_CONTAINER_IMAGE:-}" ]]; then
    smoke_run_browser_container \
      "$SMOKE_UPDATE_SNAPSHOTS" \
      "${SMOKE_BROWSER_CONTAINER_IMAGE}" \
      "$grep_pattern" \
      --rm \
      --network "${PROJECT}_default" \
      --read-only \
      --tmpfs "/tmp:uid=$(id -u),gid=$(id -g),mode=1777" \
      --user "$(id -u):$(id -g)" \
      --volume "$ROOT_DIR:/work:rw" \
      --volume "$TEMP_DIR:/smoke-output:rw" \
      --workdir /work \
      --env CI=1 \
      --env HOME=/tmp \
      --env E2E_BASE_URL=http://nginx:8080 \
      --env E2E_MAILBOX_BASE_URL=http://fake-email:8025 \
      --env E2E_MAILBOX_TOKEN="$FAKE_EMAIL_TEST_TOKEN" \
      --env E2E_ADMIN_EMAIL="$email" \
      --env E2E_OUTPUT_DIR=/smoke-output/test-results \
      --env E2E_REPORT_DIR=/smoke-output/playwright-report
    return
  fi

  CI=1 \
  E2E_BASE_URL="$BASE_URL" \
  E2E_MAILBOX_BASE_URL="http://127.0.0.1:$FAKE_EMAIL_HOST_PORT" \
  E2E_MAILBOX_TOKEN="$FAKE_EMAIL_TEST_TOKEN" \
  E2E_ADMIN_EMAIL="$email" \
  E2E_OUTPUT_DIR="$PLAYWRIGHT_OUTPUT_DIR" \
  E2E_REPORT_DIR="$PLAYWRIGHT_REPORT_DIR" \
    smoke_run_snapshot_command "$SMOKE_UPDATE_SNAPSHOTS" \
      corepack pnpm exec playwright test --grep "$grep_pattern"
}

cat >"$OVERRIDE_FILE" <<EOF
services:
  fake-email:
    image: $FAKE_EMAIL_IMAGE
    read_only: true
    cap_drop: ["ALL"]
    security_opt: ["no-new-privileges:true"]
    tmpfs:
      - /tmp:uid=1000,gid=1000,mode=1777
    environment:
      EMAIL_PROVIDER_PORT: "8025"
      EMAIL_PROVIDER_TOKEN: smoke-email-token
      FAKE_EMAIL_TEST_TOKEN: $FAKE_EMAIL_TEST_TOKEN
    ports:
      - "127.0.0.1:$FAKE_EMAIL_HOST_PORT:8025"
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:8025/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
      interval: 2s
      timeout: 2s
      retries: 20
  core-api:
    environment:
      NODE_ENV: development
      EMAIL_PROVIDER_URL: http://fake-email:8025
      EMAIL_PROVIDER_TOKEN: smoke-email-token
      CORE_ADMIN_EMAILS: smoke-admin@example.test,browser-healthy-admin@example.test,browser-healthy-admin-retry1@example.test,browser-degraded-admin@example.test,browser-degraded-admin-retry1@example.test
    depends_on:
      fake-email:
        condition: service_healthy
EOF

for volume in postgres-data redis-data minio-data; do
  if docker volume inspect "${PROJECT}_${volume}" >/dev/null 2>&1; then
    fail "smoke volume already exists: ${PROJECT}_${volume}"
  fi
done

node -e '
const net = require("node:net")
const server = net.createServer()
server.once("error", () => process.exit(1))
server.listen(Number(process.argv[1]), "127.0.0.1", () => server.close(() => process.exit(0)))
' "$HTTP_PORT" || fail "selected smoke HTTP port is unavailable"
node -e '
const net = require("node:net")
const server = net.createServer()
server.once("error", () => process.exit(1))
server.listen(Number(process.argv[1]), "127.0.0.1", () => server.close(() => process.exit(0)))
' "$FAKE_EMAIL_HOST_PORT" || fail "selected fake-email host port is unavailable"

if [[ "$SMOKE_REUSE_IMAGES" == 1 ]]; then
  smoke_validate_reuse_images
else
  docker build --file "$ROOT_DIR/services/core-api/Dockerfile" --tag "$CORE_IMAGE" "$ROOT_DIR"
  docker build --file "$ROOT_DIR/services/email-provider/Dockerfile" --tag "$EMAIL_PROVIDER_IMAGE" "$ROOT_DIR"
  docker build --file "$ROOT_DIR/services/storage/Dockerfile" --tag "$STORAGE_IMAGE" "$ROOT_DIR"
  if [[ $(docker info --format '{{.OperatingSystem}}') == 'Docker Desktop' ]]; then
    sed '1{/^# syntax=/d;}' "$ROOT_DIR/frontend/cruip-landing/Dockerfile" >"$TEMP_DIR/web.Dockerfile"
    docker build --file "$TEMP_DIR/web.Dockerfile" --tag "$WEB_IMAGE" "$ROOT_DIR"
  else
    docker build --file "$ROOT_DIR/frontend/cruip-landing/Dockerfile" --tag "$WEB_IMAGE" "$ROOT_DIR"
  fi
  docker build --file "$ROOT_DIR/infrastructure/alicloud/prometheus/Dockerfile" --tag "$PROMETHEUS_IMAGE" "$ROOT_DIR/infrastructure/alicloud/prometheus"
  if [[ $(docker info --format '{{.OperatingSystem}}') == 'Docker Desktop' ]]; then
    # Docker Desktop 28.4 on macOS can leave the BuildKit client waiting after
    # a successful Nginx image export. The narrow-context legacy path is local-only.
    # Removing the optional syntax directive also avoids a network-only frontend
    # lookup; Linux CI keeps the canonical BuildKit path below.
    sed '1{/^# syntax=/d;}' "$ROOT_DIR/infrastructure/alicloud/nginx/Dockerfile" >"$TEMP_DIR/nginx.Dockerfile"
    DOCKER_BUILDKIT=0 docker build --file "$TEMP_DIR/nginx.Dockerfile" --tag "$NGINX_IMAGE" "$ROOT_DIR/infrastructure/alicloud/nginx"
  else
    docker build --provenance=false --file "$ROOT_DIR/infrastructure/alicloud/nginx/Dockerfile" --tag "$NGINX_IMAGE" "$ROOT_DIR/infrastructure/alicloud/nginx"
  fi
  docker build --file "$ROOT_DIR/scripts/smoke/fake-email/Dockerfile" --tag "$FAKE_EMAIL_IMAGE" "$ROOT_DIR"
fi

while IFS= read -r image; do
  [[ "$(docker run --rm --entrypoint sh "$image" -c 'id -u')" != "0" ]] || fail "$image runs as root"
done < <(smoke_required_images)
docker run --rm --read-only --tmpfs /tmp --entrypoint node "$WEB_IMAGE" -e "process.stdout.write('web readonly ok')" >/dev/null

services=$(compose config --services)
for retired in auth user metadata sharing api-gateway-node gateway; do
  if grep -Fxq "$retired" <<<"$services"; then fail "retired service is active: $retired"; fi
done

compose up -d --wait fake-email postgres redis minio
compose up --no-deps minio-init
compose up --no-deps core-migrate
compose up -d --wait --no-deps core-api
compose up -d --wait --no-deps analytics-worker
compose up -d --wait --no-deps storage-api
compose up -d --wait --no-deps storage-worker
compose up -d --wait --no-deps prometheus
compose up -d --wait --no-deps web
docker run --rm --network "${PROJECT}_default" --read-only \
  --tmpfs /tmp:uid=101,gid=101,mode=1777 \
  --tmpfs /var/cache/nginx:uid=101,gid=101,mode=0755 \
  --tmpfs /var/run:uid=101,gid=101,mode=0755 \
  "$NGINX_IMAGE" nginx -t
compose up -d --wait --no-deps nginx
compose run --rm --no-deps core-migrate

request 200 "$TEMP_DIR/nginx-health.json" "$BASE_URL/healthz"
request 200 "$TEMP_DIR/web-home.html" "$BASE_URL/"
request 200 "$TEMP_DIR/web-publish.html" "$BASE_URL/admin/publish"
request 404 "$TEMP_DIR/internal-exact.json" "$BASE_URL/api/v1/internal"
request 404 "$TEMP_DIR/internal.json" "$BASE_URL/api/v1/internal/probe"
request 404 "$TEMP_DIR/public-metrics.json" "$BASE_URL/metrics"
wait_ready_status core-api http://127.0.0.1:8080/ready 200
wait_ready_status analytics-worker http://127.0.0.1:8081/ready 200
wait_ready_status storage-api http://127.0.0.1:7084/ready 200
wait_ready_status storage-worker http://127.0.0.1:7085/ready 200
STORAGE_WORKER_IDENTITY=$(smoke_capture_container_identity storage-worker) || \
  fail 'storage-worker identity baseline could not be captured'
compose exec -T core-api node -e "fetch('http://127.0.0.1:8080/version').then(async r=>{const b=await r.json();if(r.status!==200||b.gitSha!=='$GIT_SHA'||b.buildId!=='$IMAGE_TAG')process.exit(1)})"

EMAIL="smoke-admin@example.test"
request 202 "$TEMP_DIR/challenge.json" -H 'Content-Type: application/json' --data "{\"email\":\"$EMAIL\"}" "$BASE_URL/api/v1/auth/email/request"
CHALLENGE_ID=$(json_get "$TEMP_DIR/challenge.json" challengeId)
compose exec -T fake-email node -e "fetch('http://127.0.0.1:8025/v1/test/mailboxes/latest?recipient=smoke-admin%40example.test',{headers:{'X-Test-Mailbox-Token':'$FAKE_EMAIL_TEST_TOKEN'}}).then(async r=>{if(!r.ok)process.exit(1);process.stdout.write(await r.text())})" >"$TEMP_DIR/email.json"
OTP=$(json_get "$TEMP_DIR/email.json" code)
[[ $(json_get "$TEMP_DIR/email.json" to) == "$EMAIL" ]] || fail 'fake email recipient mismatch'

request 200 "$TEMP_DIR/verify.json" --cookie-jar "$COOKIE_JAR" -H 'Content-Type: application/json' --data "{\"challengeId\":\"$CHALLENGE_ID\",\"email\":\"$EMAIL\",\"code\":\"$OTP\"}" "$BASE_URL/api/v1/auth/email/verify"
ACCESS_INITIAL=$(json_get "$TEMP_DIR/verify.json" accessToken)
ROLE=$(json_get "$TEMP_DIR/verify.json" user.role)
[[ "$ROLE" == 'admin' ]] || fail 'admin allowlist did not bootstrap the first user'
REFRESH_INITIAL=$(awk '$6 == "mwd_refresh" { value=$7 } END { print value }' "$COOKIE_JAR")
[[ -n "$REFRESH_INITIAL" ]] || fail 'refresh cookie missing after verification'

request 200 "$TEMP_DIR/refresh.json" --cookie "$COOKIE_JAR" --cookie-jar "$COOKIE_JAR" -X POST "$BASE_URL/api/v1/auth/refresh"
ACCESS=$(json_get "$TEMP_DIR/refresh.json" accessToken)
REFRESH_ROTATED=$(awk '$6 == "mwd_refresh" { value=$7 } END { print value }' "$COOKIE_JAR")
[[ -n "$REFRESH_ROTATED" && "$REFRESH_ROTATED" != "$REFRESH_INITIAL" ]] || fail 'refresh credential did not rotate'
request 200 "$TEMP_DIR/me.json" -H "Authorization: Bearer $ACCESS" "$BASE_URL/api/v1/auth/me"
[[ $(json_get "$TEMP_DIR/me.json" email) == "$EMAIL" ]] || fail 'refreshed access token is not usable'

request 200 "$TEMP_DIR/quota.json" -H "Authorization: Bearer $ACCESS" "$BASE_URL/api/v1/quota"
[[ $(json_get "$TEMP_DIR/quota.json" limitBytes) == "$DEFAULT_USER_QUOTA_BYTES" ]] || fail 'default quota mismatch'

request 200 "$TEMP_DIR/business-initial.json" -H "Authorization: Bearer $ACCESS" "$BASE_URL/api/v1/admin/dashboard/business?range=today"
node -e '
const fs=require("node:fs")
const value=JSON.parse(fs.readFileSync(process.argv[1],"utf8"))
for (const field of [value.totals.totalUsers,value.totals.liveFiles,value.totals.committedStorageBytes]) {
  if (typeof field!=="string") process.exit(1)
}
' "$TEMP_DIR/business-initial.json" || fail 'initial Business Analytics contract is invalid'

printf 'core-first-storage-smoke-%s' "$RUN_ID" >"$TEMP_DIR/payload.bin"
SIZE_BYTES=$(wc -c <"$TEMP_DIR/payload.bin" | tr -d ' ')
request 201 "$TEMP_DIR/intent.json" -H "Authorization: Bearer $ACCESS" -H 'Content-Type: application/json' -H "Idempotency-Key: smoke-$RUN_ID" --data "{\"fileName\":\"smoke.bin\",\"sizeBytes\":\"$SIZE_BYTES\",\"mimeType\":\"application/octet-stream\"}" "$BASE_URL/api/v1/upload-intents"
INTENT_ID=$(json_get "$TEMP_DIR/intent.json" id)
OBJECT_KEY=$(json_get "$TEMP_DIR/intent.json" objectKey)
UPLOAD_GRANT=$(json_get "$TEMP_DIR/intent.json" uploadGrant)
request 204 "$TEMP_DIR/part.out" -X PUT -H "Authorization: Bearer $UPLOAD_GRANT" -H 'Content-Type: application/octet-stream' --data-binary "@$TEMP_DIR/payload.bin" "$BASE_URL/api/v1/storage/uploads/$OBJECT_KEY/parts/1"
request 202 "$TEMP_DIR/complete.json" -H "Authorization: Bearer $UPLOAD_GRANT" -H 'Content-Type: application/json' --data '{"parts":1}' "$BASE_URL/api/v1/storage/uploads/$OBJECT_KEY/complete"

FILE_ID=''
for _ in $(seq 1 60); do
  request 200 "$TEMP_DIR/files.json" -H "Authorization: Bearer $ACCESS" "$BASE_URL/api/v1/files"
  FILE_ID=$(node -e 'const fs=require("node:fs");const p=JSON.parse(fs.readFileSync(process.argv[1]));const f=p.items.find(x=>x.name==="smoke.bin"&&x.currentVersion);if(f)process.stdout.write(f.id)' "$TEMP_DIR/files.json")
  if [[ -n "$FILE_ID" ]]; then break; fi
  sleep 1
done
[[ -n "$FILE_ID" ]] || fail 'worker callback did not create a visible file version'

request 200 "$TEMP_DIR/versions.json" -H "Authorization: Bearer $ACCESS" "$BASE_URL/api/v1/files/$FILE_ID/versions"
[[ $(json_get "$TEMP_DIR/versions.json" items.0.sizeBytes) == "$SIZE_BYTES" ]] || fail 'version size mismatch'

request 200 "$TEMP_DIR/private-ticket.json" -H "Authorization: Bearer $ACCESS" -H 'Content-Type: application/json' --data '{}' "$BASE_URL/api/v1/files/$FILE_ID/download-ticket"
PRIVATE_OBJECT=$(json_get "$TEMP_DIR/private-ticket.json" objectKey)
PRIVATE_GRANT=$(json_get "$TEMP_DIR/private-ticket.json" downloadGrant)
request 200 "$TEMP_DIR/private-download.bin" -H "Authorization: Bearer $PRIVATE_GRANT" "$BASE_URL/api/v1/storage/objects/$PRIVATE_OBJECT"
cmp "$TEMP_DIR/payload.bin" "$TEMP_DIR/private-download.bin" >/dev/null || fail 'private download bytes mismatch'
request 401 "$TEMP_DIR/private-replay.json" -H "Authorization: Bearer $PRIVATE_GRANT" "$BASE_URL/api/v1/storage/objects/$PRIVATE_OBJECT"

if ! smoke_wait_for_exact_business_activity 1 "$SIZE_BYTES" 1 "$SIZE_BYTES" \
  60 1 fetch_business_dashboard "$TEMP_DIR/business-after-private.json"; then
  fail 'private download analytics did not reconcile before the intentional Core outage'
fi

request 201 "$TEMP_DIR/share.json" -H "Authorization: Bearer $ACCESS" -H 'Content-Type: application/json' --data '{"maxDownloads":1}' "$BASE_URL/api/v1/files/$FILE_ID/shares"
SHARE_TOKEN=$(json_get "$TEMP_DIR/share.json" token)
compose stop core-api
share_down_status=$(curl --silent --show-error --output "$TEMP_DIR/share-upstream-down.json" --write-out '%{http_code}' -H 'Content-Type: application/json' --data '{}' "$BASE_URL/api/v1/shares/$SHARE_TOKEN/download-ticket")
[[ "$share_down_status" == 502 || "$share_down_status" == 504 ]] || fail "share upstream failure returned $share_down_status"
compose up -d --wait --no-deps core-api
wait_ready_status core-api http://127.0.0.1:8080/ready 200
curl --silent --show-error --output "$TEMP_DIR/share-ticket-1.json" --write-out '%{http_code}' -H 'Content-Type: application/json' --data '{}' "$BASE_URL/api/v1/shares/$SHARE_TOKEN/download-ticket" >"$TEMP_DIR/share-status-1" &
PID_ONE=$!
curl --silent --show-error --output "$TEMP_DIR/share-ticket-2.json" --write-out '%{http_code}' -H 'Content-Type: application/json' --data '{}' "$BASE_URL/api/v1/shares/$SHARE_TOKEN/download-ticket" >"$TEMP_DIR/share-status-2" &
PID_TWO=$!
wait "$PID_ONE"
wait "$PID_TWO"
STATUS_ONE=$(<"$TEMP_DIR/share-status-1")
STATUS_TWO=$(<"$TEMP_DIR/share-status-2")
[[ "$STATUS_ONE $STATUS_TWO" == '200 404' || "$STATUS_ONE $STATUS_TWO" == '404 200' ]] || fail "maxDownloads race returned $STATUS_ONE/$STATUS_TWO"
if [[ "$STATUS_ONE" == '200' ]]; then SHARE_TICKET="$TEMP_DIR/share-ticket-1.json"; else SHARE_TICKET="$TEMP_DIR/share-ticket-2.json"; fi
SHARE_OBJECT=$(json_get "$SHARE_TICKET" objectKey)
SHARE_GRANT=$(json_get "$SHARE_TICKET" downloadGrant)
request 200 "$TEMP_DIR/share-download.bin" -H "Authorization: Bearer $SHARE_GRANT" "$BASE_URL/api/v1/storage/objects/$SHARE_OBJECT"
cmp "$TEMP_DIR/payload.bin" "$TEMP_DIR/share-download.bin" >/dev/null || fail 'share download bytes mismatch'

request 200 "$TEMP_DIR/publication.json" -X PUT -H "Authorization: Bearer $ACCESS" -H 'Content-Type: application/json' --data '{"slug":"smoke-release","status":"published"}' "$BASE_URL/api/v1/files/$FILE_ID/publication"
request 200 "$TEMP_DIR/catalog.json" "$BASE_URL/api/v1/publications"
[[ $(json_get "$TEMP_DIR/catalog.json" items.0.slug) == 'smoke-release' ]] || fail 'publication missing from catalog'
request 200 "$TEMP_DIR/publication-ticket.json" -H 'Content-Type: application/json' --data '{}' "$BASE_URL/api/v1/publications/smoke-release/download-ticket"
PUBLIC_OBJECT=$(json_get "$TEMP_DIR/publication-ticket.json" objectKey)
PUBLIC_GRANT=$(json_get "$TEMP_DIR/publication-ticket.json" downloadGrant)
request 200 "$TEMP_DIR/publication-download.bin" -H "Authorization: Bearer $PUBLIC_GRANT" "$BASE_URL/api/v1/storage/objects/$PUBLIC_OBJECT"
cmp "$TEMP_DIR/payload.bin" "$TEMP_DIR/publication-download.bin" >/dev/null || fail 'publication download bytes mismatch'

if ! smoke_wait_for_exact_business_activity 1 "$SIZE_BYTES" 3 "$((SIZE_BYTES * 3))" \
  60 1 fetch_business_dashboard "$TEMP_DIR/business.json"; then
  printf 'dashboard diagnostic response:\n' >&2
  sed -E 's/("generatedAt"|"readModelUpdatedAt")[[:space:]]*:[[:space:]]*"[^"]+"/\1:"<timestamp>"/g' "$TEMP_DIR/business.json" >&2
  compose exec -T postgres psql -U mywebdrive -d mywebdrive_core -c \
    'SELECT "topic", ("processedAt" IS NOT NULL) AS processed, COUNT(*) FROM "OutboxEvent" GROUP BY 1,2 ORDER BY 1,2;' >&2
  compose exec -T postgres psql -U mywebdrive -d mywebdrive_core -c \
    'SELECT "status", COUNT(*) FROM "DownloadAttempt" GROUP BY 1 ORDER BY 1;' >&2
  compose exec -T postgres psql -U mywebdrive -d mywebdrive_core -c \
    'SELECT "date", "uploadsCount", "uploadsBytes", "downloadsCount", "downloadsBytes" FROM "AnalyticsDaily" ORDER BY "date";' >&2
  compose logs --no-color --tail=80 core-api analytics-worker storage-api storage-worker >&2
  fail 'Business Analytics did not reconcile upload/download facts'
fi

if smoke_wait_for_exact_availability available 30 1 fetch_system_dashboard "$TEMP_DIR/system.json" && node -e '
const fs=require("node:fs")
const value=JSON.parse(fs.readFileSync(process.argv[1],"utf8"))
if(typeof value.traffic.requestsCount!=="string")process.exit(1)
' "$TEMP_DIR/system.json"; then
  :
else
  fail 'System Health did not become available'
fi

run_browser_gate healthy

compose stop prometheus
request 200 "$TEMP_DIR/business-without-prometheus.json" -H "Authorization: Bearer $ACCESS" "$BASE_URL/api/v1/admin/dashboard/business?range=today"
request 200 "$TEMP_DIR/system-without-prometheus.json" -H "Authorization: Bearer $ACCESS" "$BASE_URL/api/v1/admin/dashboard/system?range=today"
smoke_has_exact_availability "$TEMP_DIR/system-without-prometheus.json" partial || fail 'System Health did not isolate Prometheus failure'
request 200 "$TEMP_DIR/page-without-prometheus.html" "$BASE_URL/admin/overview"
run_browser_gate prometheus-down
compose up -d --wait --no-deps prometheus
smoke_wait_for_exact_availability available 60 1 fetch_system_dashboard "$TEMP_DIR/system-recovered.json" || \
  fail 'System Health did not recover to available'

compose stop analytics-worker
request 200 "$TEMP_DIR/private-ticket-pending.json" -H "Authorization: Bearer $ACCESS" -H 'Content-Type: application/json' --data '{}' "$BASE_URL/api/v1/files/$FILE_ID/download-ticket"
PENDING_OBJECT=$(json_get "$TEMP_DIR/private-ticket-pending.json" objectKey)
PENDING_GRANT=$(json_get "$TEMP_DIR/private-ticket-pending.json" downloadGrant)
request 200 "$TEMP_DIR/private-download-pending.bin" -H "Authorization: Bearer $PENDING_GRANT" "$BASE_URL/api/v1/storage/objects/$PENDING_OBJECT"
cmp "$TEMP_DIR/payload.bin" "$TEMP_DIR/private-download-pending.bin" >/dev/null || fail 'pending analytics download bytes mismatch'
sleep 2
request 200 "$TEMP_DIR/business-worker-stopped.json" -H "Authorization: Bearer $ACCESS" "$BASE_URL/api/v1/admin/dashboard/business?range=today"
[[ $(json_get "$TEMP_DIR/business-worker-stopped.json" activity.downloads.count) == 3 ]] || fail 'stopped Analytics Worker changed projections'
compose up -d --wait --no-deps analytics-worker
worker_drained=0
for _ in $(seq 1 60); do
  request 200 "$TEMP_DIR/business-worker-drained.json" -H "Authorization: Bearer $ACCESS" "$BASE_URL/api/v1/admin/dashboard/business?range=today"
  if [[ $(json_get "$TEMP_DIR/business-worker-drained.json" activity.downloads.count) == 4 ]]; then worker_drained=1; break; fi
  sleep 1
done
[[ "$worker_drained" == 1 ]] || fail 'Analytics Worker did not drain pending completion'
compose restart analytics-worker >/dev/null
compose up -d --wait --no-deps analytics-worker
sleep 2
request 200 "$TEMP_DIR/business-worker-replayed.json" -H "Authorization: Bearer $ACCESS" "$BASE_URL/api/v1/admin/dashboard/business?range=today"
[[ $(json_get "$TEMP_DIR/business-worker-replayed.json" activity.downloads.count) == 4 ]] || fail 'Analytics Worker replay double-counted completion'

compose exec -T postgres psql -U mywebdrive -d mywebdrive_core -v ON_ERROR_STOP=1 -c \
  'UPDATE "AnalyticsCoverage" SET "startedAt" = (date_trunc('\''day'\'', NOW() AT TIME ZONE '\''Asia/Shanghai'\'') AT TIME ZONE '\''Asia/Shanghai'\''), "complete" = TRUE, "gapStartedAt" = NULL;' >/dev/null
request 200 "$TEMP_DIR/business-before-unknown.json" -H "Authorization: Bearer $ACCESS" "$BASE_URL/api/v1/admin/dashboard/business?range=today"
[[ $(json_get "$TEMP_DIR/business-before-unknown.json" coverage.complete) == true ]] || fail 'coverage fixture did not become complete before unknown transition'
request 200 "$TEMP_DIR/private-ticket-unknown.json" -H "Authorization: Bearer $ACCESS" -H 'Content-Type: application/json' --data '{}' "$BASE_URL/api/v1/files/$FILE_ID/download-ticket"
UNKNOWN_GRANT=$(json_get "$TEMP_DIR/private-ticket-unknown.json" downloadGrant)
UNKNOWN_ATTEMPT=$(node -e '
const payload = process.argv[1].split(".")[1]
if (!payload) process.exit(1)
const value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))
if (typeof value.downloadAttemptId !== "string") process.exit(1)
process.stdout.write(value.downloadAttemptId)
' "$UNKNOWN_GRANT")
[[ "$UNKNOWN_ATTEMPT" =~ ^[0-9a-f-]{36}$ ]] || fail 'download attempt id is invalid'
compose exec -T postgres psql -U mywebdrive -d mywebdrive_core -v ON_ERROR_STOP=1 -c \
  "UPDATE \"DownloadAttempt\" SET \"status\" = 'started', \"issuedAt\" = NOW() - INTERVAL '10 minutes', \"startedAt\" = NOW() - INTERVAL '10 minutes' WHERE \"id\" = '$UNKNOWN_ATTEMPT';" >/dev/null
compose restart analytics-worker >/dev/null
compose up -d --wait --no-deps analytics-worker
unknown_degraded=0
for _ in $(seq 1 30); do
  request 200 "$TEMP_DIR/business-after-unknown.json" -H "Authorization: Bearer $ACCESS" "$BASE_URL/api/v1/admin/dashboard/business?range=today"
  request 200 "$TEMP_DIR/system-after-unknown.json" -H "Authorization: Bearer $ACCESS" "$BASE_URL/api/v1/admin/dashboard/system?range=today"
  if [[ $(json_get "$TEMP_DIR/business-after-unknown.json" coverage.complete) == false ]] && \
    [[ $(json_get "$TEMP_DIR/system-after-unknown.json" pipeline.downloadTelemetry) == degraded ]]; then
    unknown_degraded=1
    break
  fi
  sleep 1
done
[[ "$unknown_degraded" == 1 ]] || fail 'unknown download did not degrade Dashboard coverage and telemetry'

request 204 "$TEMP_DIR/logout.out" --cookie "$COOKIE_JAR" -X POST "$BASE_URL/api/v1/auth/logout"
request 401 "$TEMP_DIR/revoked.json" --cookie "$COOKIE_JAR" -X POST "$BASE_URL/api/v1/auth/refresh"

compose stop postgres
wait_ready_status core-api http://127.0.0.1:8080/ready 503
compose start postgres
compose up -d --wait --no-deps postgres
compose up -d --wait --no-deps core-api
wait_ready_status core-api http://127.0.0.1:8080/ready 200

compose stop redis
wait_ready_status core-api http://127.0.0.1:8080/ready 503
wait_ready_status storage-api http://127.0.0.1:7084/ready 503
wait_ready_status storage-worker http://127.0.0.1:7085/ready 503
compose start redis
compose up -d --wait --no-deps redis
wait_ready_status core-api http://127.0.0.1:8080/ready 200
wait_ready_status storage-api http://127.0.0.1:7084/ready 200
wait_ready_status storage-worker http://127.0.0.1:7085/ready 200
smoke_assert_container_identity_unchanged storage-worker "$STORAGE_WORKER_IDENTITY" || \
  fail 'storage-worker was replaced or restarted during Redis recovery'

compose stop minio
wait_ready_status storage-api http://127.0.0.1:7084/ready 503
wait_ready_status storage-worker http://127.0.0.1:7085/ready 503
compose start minio
compose up -d --wait --no-deps minio
compose run --rm --no-deps minio-init
wait_ready_status storage-api http://127.0.0.1:7084/ready 200
wait_ready_status storage-worker http://127.0.0.1:7085/ready 200
smoke_assert_container_identity_unchanged storage-worker "$STORAGE_WORKER_IDENTITY" || \
  fail 'storage-worker was replaced or restarted during MinIO recovery'

compose logs --no-color >"$TEMP_DIR/compose.log"
for sensitive in "$EMAIL" "$OTP" "$CHALLENGE_ID" "$ACCESS_INITIAL" "$ACCESS" "$REFRESH_INITIAL" "$REFRESH_ROTATED" "$UPLOAD_GRANT" "$PRIVATE_GRANT" "$SHARE_TOKEN" "$SHARE_GRANT" "$PUBLIC_GRANT" "$PENDING_GRANT" "$UNKNOWN_GRANT"; do
  [[ -n "$sensitive" ]] || fail 'sensitive scan input is empty'
  if grep -Fq -- "$sensitive" "$TEMP_DIR/compose.log"; then fail 'sensitive value appeared in logs'; fi
done
if grep -Eiq '(^|[[:space:]])(Authorization|Cookie):' "$TEMP_DIR/compose.log"; then fail 'credential header appeared in logs'; fi

printf 'core empty-environment smoke: ok\n'
SMOKE_COMPLETED=1
