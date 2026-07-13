#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
MANAGER="$ROOT_DIR/manage-services.sh"
ENV_FILE="$ROOT_DIR/.state/core-dev.env"
BASE_COMPOSE="$ROOT_DIR/infrastructure/alicloud/docker-compose.core.yml"
DEV_COMPOSE="$ROOT_DIR/infrastructure/docker-compose.core-dev.yml"
PROJECT_NAME=mywebdrive-core-dev
FIXTURES=$(mktemp -d "${TMPDIR:-/tmp}/mywebdrive-core-dev-contract.XXXXXX")
ENV_BACKUP="$FIXTURES/core-dev.env.backup"
ORIGINAL_PATH=$PATH
HAD_ENV=0
FAKE_EMAIL_PID=''

if [[ -f "$ENV_FILE" ]]; then
  HAD_ENV=1
  cp "$ENV_FILE" "$ENV_BACKUP"
fi

cleanup() {
  local status=$?
  trap - EXIT INT TERM
  if [[ -n "$FAKE_EMAIL_PID" ]]; then
    kill "$FAKE_EMAIL_PID" 2>/dev/null || true
    wait "$FAKE_EMAIL_PID" 2>/dev/null || true
  fi
  if (( HAD_ENV == 1 )); then
    mkdir -p "$(dirname "$ENV_FILE")"
    cp "$ENV_BACKUP" "$ENV_FILE"
    chmod 600 "$ENV_FILE"
  else
    rm -f "$ENV_FILE"
    rmdir "$(dirname "$ENV_FILE")" 2>/dev/null || true
  fi
  rm -rf "$FIXTURES"
  exit "$status"
}
trap cleanup EXIT INT TERM

fail() {
  printf 'core dev contract failed: %s\n' "$1" >&2
  exit 1
}

assert_contains() {
  local haystack=$1 needle=$2 label=$3
  [[ "$haystack" == *"$needle"* ]] || fail "$label is missing '$needle'"
}

assert_not_contains() {
  local haystack=$1 needle=$2 label=$3
  [[ "$haystack" != *"$needle"* ]] || fail "$label disclosed '$needle'"
}

env_value() {
  local key=$1
  sed -n "s/^${key}=//p" "$ENV_FILE"
}

env_checksum() {
  cksum "$ENV_FILE" | awk '{ print $1 ":" $2 }'
}

assert_secret_output_safe() {
  local output=$1 label=$2 key value
  for key in \
    POSTGRES_PASSWORD REDIS_PASSWORD MINIO_ROOT_PASSWORD CORE_SESSION_SECRET \
    OTP_PEPPER STORAGE_GRANT_SECRET CORE_CALLBACK_SECRET EMAIL_PROVIDER_TOKEN; do
    value=$(env_value "$key")
    [[ -n "$value" ]] || fail "$key was not generated"
    assert_not_contains "$output" "$value" "$label"
  done
}

rm -f "$ENV_FILE"

help_output=$(/bin/bash "$MANAGER" --help)
default_output=$(/bin/bash "$MANAGER")
[[ "$default_output" == "$help_output" ]] || fail 'the default command must show the same help as --help'

discovered_commands=$(awk '
  /^Public commands:$/ { listing=1; next }
  listing && /^$/ { exit }
  listing {
    line=$0
    sub(/^  /, "", line)
    sub(/[[:space:]][[:space:]]+.*/, "", line)
    print line
  }
' <<<"$help_output")
expected_commands=$(printf '%s\n' \
  setup \
  start \
  stop \
  status \
  'logs [service]' \
  config \
  smoke \
  quality \
  'reset --confirm' \
  'legacy:<command>')
[[ "$discovered_commands" == "$expected_commands" ]] || {
  printf 'expected public commands:\n%s\nactual public commands:\n%s\n' "$expected_commands" "$discovered_commands" >&2
  fail 'help does not expose the exact Core-first command surface'
}
assert_contains "$help_output" 'http://127.0.0.1:8080' 'help output'
assert_contains "$help_output" "$PROJECT_NAME" 'help output'

fake_email_port=$((28000 + ($$ % 1000)))
fake_email_token=$(node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))")
EMAIL_PROVIDER_PORT="$fake_email_port" EMAIL_PROVIDER_TOKEN="$fake_email_token" \
  node "$ROOT_DIR/scripts/smoke/fake-email/server.mjs" >"$FIXTURES/fake-email.log" 2>&1 &
FAKE_EMAIL_PID=$!
fake_email_ready=0
for _ in $(seq 1 40); do
  if curl --silent --fail "http://127.0.0.1:$fake_email_port/healthz" >/dev/null 2>&1; then
    fake_email_ready=1
    break
  fi
  sleep 0.05
done
[[ $fake_email_ready -eq 1 ]] || fail 'fake email did not honor EMAIL_PROVIDER_PORT'
fake_email_status=$(curl --silent --output /dev/null --write-out '%{http_code}' \
  -H "Authorization: Bearer $fake_email_token" \
  -H 'Content-Type: application/json' \
  --data '{"to":"dev@example.test","code":"123456","ttlSeconds":600,"purpose":"login"}' \
  "http://127.0.0.1:$fake_email_port/v1/messages/otp")
[[ "$fake_email_status" == 204 ]] || fail 'fake email did not honor EMAIL_PROVIDER_TOKEN'
kill "$FAKE_EMAIL_PID"
wait "$FAKE_EMAIL_PID" 2>/dev/null || true
FAKE_EMAIL_PID=''

mkdir -p "$FIXTURES/bin"
apply_stub_log="$FIXTURES/stub.log"
: >"$apply_stub_log"

cat >"$FIXTURES/bin/corepack" <<'STUB'
#!/bin/sh
printf 'corepack cwd=%s args=%s\n' "$PWD" "$*" >>"$COMMAND_STUB_LOG"
STUB
cat >"$FIXTURES/bin/docker" <<'STUB'
#!/bin/sh
printf 'docker args=%s\n' "$*" >>"$COMMAND_STUB_LOG"
STUB
cat >"$FIXTURES/bin/make" <<'STUB'
#!/bin/sh
printf 'make args=%s\n' "$*" >>"$COMMAND_STUB_LOG"
STUB
cat >"$FIXTURES/bin/bash" <<'STUB'
#!/bin/sh
printf 'bash args=%s\n' "$*" >>"$COMMAND_STUB_LOG"
STUB
cat >"$FIXTURES/bin/pnpm" <<'STUB'
#!/bin/sh
printf 'pnpm cwd=%s args=%s\n' "$PWD" "$*" >>"$COMMAND_STUB_LOG"
STUB
chmod +x "$FIXTURES/bin/corepack" "$FIXTURES/bin/docker" "$FIXTURES/bin/make" "$FIXTURES/bin/bash" "$FIXTURES/bin/pnpm"

setup_output=$(PATH="$FIXTURES/bin:$ORIGINAL_PATH" COMMAND_STUB_LOG="$apply_stub_log" /bin/bash "$MANAGER" setup 2>&1)
[[ -f "$ENV_FILE" ]] || fail 'setup did not create the stable local env file'
permissions=$(stat -f '%Lp' "$ENV_FILE" 2>/dev/null || stat -c '%a' "$ENV_FILE")
[[ "$permissions" == 600 ]] || fail "local env permissions must be 600, got $permissions"
grep -F "corepack cwd=$ROOT_DIR args=pnpm install --frozen-lockfile" "$apply_stub_log" >/dev/null || fail 'setup did not run the frozen workspace install from the repository root'
assert_secret_output_safe "$setup_output" 'setup output'

# Prove that start independently bootstraps the stable env on a fresh checkout.
rm -f "$ENV_FILE"
: >"$apply_stub_log"
start_output=$(PATH="$FIXTURES/bin:$ORIGINAL_PATH" COMMAND_STUB_LOG="$apply_stub_log" /bin/bash "$MANAGER" start 2>&1)
[[ -f "$ENV_FILE" ]] || fail 'start did not create the stable local env file'
permissions=$(stat -f '%Lp' "$ENV_FILE" 2>/dev/null || stat -c '%a' "$ENV_FILE")
[[ "$permissions" == 600 ]] || fail "local env permissions must be 600, got $permissions"

secret_values=''
for key in \
  POSTGRES_PASSWORD REDIS_PASSWORD MINIO_ROOT_PASSWORD CORE_SESSION_SECRET \
  OTP_PEPPER STORAGE_GRANT_SECRET CORE_CALLBACK_SECRET EMAIL_PROVIDER_TOKEN; do
  value=$(env_value "$key")
  [[ "$value" =~ ^[0-9a-f]{64}$ ]] || fail "$key is not a 256-bit hexadecimal secret"
  secret_values+="$value"$'\n'
done
[[ $(printf '%s' "$secret_values" | sort -u | grep -c .) -eq 8 ]] || fail 'generated local secrets must be pairwise distinct'
assert_secret_output_safe "$start_output" 'start output'

env_checksum_before=$(env_checksum)
compose_prefix="compose --env-file $ENV_FILE --project-name $PROJECT_NAME -f $BASE_COMPOSE -f $DEV_COMPOSE"
grep -F "docker args=$compose_prefix up --detach --build --remove-orphans --wait" "$apply_stub_log" >/dev/null || fail 'start did not build and start the fixed Core-first project'

config_output=$(PATH="$ORIGINAL_PATH" /bin/bash "$MANAGER" config 2>&1)
expected_services=$(printf '%s\n' \
  postgres redis minio minio-init core-migrate email-provider core-api \
  analytics-worker storage-api storage-worker prometheus web nginx)
[[ $(sort <<<"$config_output") == $(sort <<<"$expected_services") ]] || {
  printf 'expected services:\n%s\nactual config output:\n%s\n' "$expected_services" "$config_output" >&2
  fail 'config must validate Compose and print only the authoritative service list'
}
assert_secret_output_safe "$config_output" 'config output'

compose_args=(
  --env-file "$ENV_FILE"
  --project-name "$PROJECT_NAME"
  -f "$BASE_COMPOSE"
  -f "$DEV_COMPOSE"
)
docker compose "${compose_args[@]}" config --quiet
direct_services=$(docker compose "${compose_args[@]}" config --services)
[[ $(sort <<<"$direct_services") == $(sort <<<"$config_output") ]] || fail 'config did not print the Compose service set'
docker compose "${compose_args[@]}" config --format json >"$FIXTURES/compose.json"
node - "$FIXTURES/compose.json" "$ROOT_DIR" "$ENV_FILE" <<'NODE'
const fs = require('node:fs')

const compose = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
const root = process.argv[3]
const localEnv = Object.fromEntries(
  fs.readFileSync(process.argv[4], 'utf8').trim().split('\n').map((line) => line.split(/=(.*)/s, 2)),
)
const expected = [
  'postgres',
  'redis',
  'minio',
  'minio-init',
  'core-migrate',
  'email-provider',
  'core-api',
  'analytics-worker',
  'storage-api',
  'storage-worker',
  'prometheus',
  'web',
  'nginx',
]

if (compose.name !== 'mywebdrive-core-dev') process.exit(1)
if (JSON.stringify(Object.keys(compose.services).sort()) !== JSON.stringify(expected.sort())) process.exit(1)
if (compose.services['email-provider'].build?.dockerfile !== 'scripts/smoke/fake-email/Dockerfile') process.exit(1)
if (compose.services['email-provider'].healthcheck?.test?.join(' ').includes('8025/healthz') !== true) process.exit(1)
if (compose.services['core-api'].environment?.EMAIL_PROVIDER_URL !== 'http://email-provider:8025') process.exit(1)
if (compose.services['email-provider'].environment?.EMAIL_PROVIDER_TOKEN !== localEnv.EMAIL_PROVIDER_TOKEN) process.exit(1)
if (compose.services['core-api'].environment?.EMAIL_PROVIDER_TOKEN !== localEnv.EMAIL_PROVIDER_TOKEN) process.exit(1)
if (compose.services.nginx.ports?.length !== 1 || compose.services.nginx.ports[0]?.host_ip !== '127.0.0.1' || compose.services.nginx.ports[0]?.published !== '8080') process.exit(1)
if (compose.services['email-provider'].ports?.[0]?.host_ip !== '127.0.0.1' || compose.services['email-provider'].ports?.[0]?.published !== '8025') process.exit(1)
if (compose.services['core-api'].build?.context !== root) process.exit(1)
NODE

: >"$apply_stub_log"
second_start_output=$(PATH="$FIXTURES/bin:$ORIGINAL_PATH" COMMAND_STUB_LOG="$apply_stub_log" /bin/bash "$MANAGER" start 2>&1)
[[ $(env_checksum) == "$env_checksum_before" ]] || fail 'a repeated start rotated the stable local env'
assert_secret_output_safe "$second_start_output" 'repeated start output'

stop_output=$(PATH="$FIXTURES/bin:$ORIGINAL_PATH" COMMAND_STUB_LOG="$apply_stub_log" /bin/bash "$MANAGER" stop 2>&1)
[[ $(env_checksum) == "$env_checksum_before" ]] || fail 'stop changed or removed the stable local env'
grep -F "docker args=$compose_prefix stop" "$apply_stub_log" >/dev/null || fail 'stop did not target the fixed Core-first project'
assert_secret_output_safe "$stop_output" 'stop output'

PATH="$FIXTURES/bin:$ORIGINAL_PATH" COMMAND_STUB_LOG="$apply_stub_log" /bin/bash "$MANAGER" status >/dev/null
PATH="$FIXTURES/bin:$ORIGINAL_PATH" COMMAND_STUB_LOG="$apply_stub_log" /bin/bash "$MANAGER" logs core-api >/dev/null
grep -F "docker args=$compose_prefix ps" "$apply_stub_log" >/dev/null || fail 'status did not target the fixed Core-first project'
grep -F "docker args=$compose_prefix logs --tail 200 core-api" "$apply_stub_log" >/dev/null || fail 'logs did not target the requested service in the fixed project'

before_unconfirmed_reset=$(wc -l <"$apply_stub_log" | tr -d ' ')
set +e
reset_output=$(PATH="$FIXTURES/bin:$ORIGINAL_PATH" COMMAND_STUB_LOG="$apply_stub_log" /bin/bash "$MANAGER" reset 2>&1)
reset_status=$?
set -e
[[ $reset_status -eq 64 ]] || fail "reset without --confirm must exit 64, got $reset_status"
assert_contains "$reset_output" 'reset --confirm' 'unconfirmed reset output'
after_unconfirmed_reset=$(wc -l <"$apply_stub_log" | tr -d ' ')
[[ "$after_unconfirmed_reset" == "$before_unconfirmed_reset" ]] || fail 'unconfirmed reset reached a Docker mutation'
[[ $(env_checksum) == "$env_checksum_before" ]] || fail 'unconfirmed reset changed the stable local env'

PATH="$FIXTURES/bin:$ORIGINAL_PATH" COMMAND_STUB_LOG="$apply_stub_log" /bin/bash "$MANAGER" reset --confirm >/dev/null
grep -F "docker args=$compose_prefix down --volumes --remove-orphans" "$apply_stub_log" >/dev/null || fail 'confirmed reset did not remove Core-first volumes and orphans'
[[ $(env_checksum) == "$env_checksum_before" ]] || fail 'confirmed reset changed or removed the stable local env'

for retired_command in start-backend start-frontend start-next db:start; do
  set +e
  retired_output=$(PATH="$ORIGINAL_PATH" /bin/bash "$MANAGER" "$retired_command" 2>&1)
  retired_status=$?
  set -e
  [[ $retired_status -eq 64 ]] || fail "$retired_command must exit 64"
  assert_contains "$retired_output" 'SOFT-RETIRED' "$retired_command output"
  assert_contains "$retired_output" './manage-services.sh start' "$retired_command output"
done

legacy_output=$(PATH="$ORIGINAL_PATH" /bin/bash "$MANAGER" legacy:help 2>&1)
assert_contains "$legacy_output" 'observation cycle' 'legacy:help output'
assert_contains "$legacy_output" 'SOFT-RETIRED' 'legacy:help output'
assert_contains "$legacy_output" 'start-backend' 'legacy:help output'

: >"$apply_stub_log"
PATH="$FIXTURES/bin:$ORIGINAL_PATH" COMMAND_STUB_LOG="$apply_stub_log" /bin/bash "$MANAGER" legacy:build >/dev/null 2>&1
grep -F "pnpm cwd=$ROOT_DIR args=build:all" "$apply_stub_log" >/dev/null || fail 'the archived manager did not resolve the legacy workspace from its new location'

: >"$apply_stub_log"
PATH="$FIXTURES/bin:$ORIGINAL_PATH" COMMAND_STUB_LOG="$apply_stub_log" /bin/bash "$MANAGER" quality >/dev/null
PATH="$FIXTURES/bin:$ORIGINAL_PATH" COMMAND_STUB_LOG="$apply_stub_log" /bin/bash "$MANAGER" smoke >/dev/null
grep -F "make args=-C $ROOT_DIR quality-check" "$apply_stub_log" >/dev/null || fail 'quality did not forward to the repository quality gate'
grep -F "bash args=$ROOT_DIR/scripts/smoke-core-e2e.sh" "$apply_stub_log" >/dev/null || fail 'smoke did not forward to the Core smoke script'

printf 'core dev contract tests: ok\n'
