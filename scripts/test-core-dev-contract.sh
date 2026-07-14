#!/usr/bin/env bash
set -Eeuo pipefail

SOURCE_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
REAL_ENV_FILE="$SOURCE_ROOT/.state/core-dev.env"
FIXTURES=$(mktemp -d "${TMPDIR:-/tmp}/mywebdrive-core-dev-contract.XXXXXX")
FIXTURES=$(cd "$FIXTURES" && pwd -P)
ROOT_DIR="$FIXTURES/repo with spaces"
MANAGER="$ROOT_DIR/manage-services.sh"
ENV_FILE="$ROOT_DIR/.state/core-dev.env"
BASE_COMPOSE="$ROOT_DIR/infrastructure/alicloud/docker-compose.core.yml"
DEV_COMPOSE="$ROOT_DIR/infrastructure/docker-compose.core-dev.yml"
PROJECT_NAME=mywebdrive-core-dev
ORIGINAL_PATH=$PATH
FAKE_EMAIL_PID=''

path_fingerprint() {
  local path=$1 metadata checksum=''
  if [[ -L "$path" ]]; then
    printf 'symlink:%s\n' "$(readlink "$path")"
    return
  fi
  if [[ ! -e "$path" ]]; then
    printf 'absent\n'
    return
  fi
  metadata=$(stat -f '%d:%i:%u:%g:%p:%l:%m:%z' "$path" 2>/dev/null || stat -c '%d:%i:%u:%g:%f:%h:%Y:%s' "$path")
  if [[ -f "$path" ]]; then checksum=$(cksum "$path" | awk '{ print $1 ":" $2 }'); fi
  printf 'present:%s:%s\n' "$metadata" "$checksum"
}

REAL_ENV_BEFORE=$(path_fingerprint "$REAL_ENV_FILE")

cleanup() {
  local status=$? real_env_after
  trap - EXIT INT TERM
  if [[ -n "$FAKE_EMAIL_PID" ]]; then
    kill "$FAKE_EMAIL_PID" 2>/dev/null || true
    wait "$FAKE_EMAIL_PID" 2>/dev/null || true
  fi
  rm -rf "$FIXTURES"
  real_env_after=$(path_fingerprint "$REAL_ENV_FILE")
  if [[ "$real_env_after" != "$REAL_ENV_BEFORE" ]]; then
    printf 'core dev contract failed: the real repository core-dev.env changed\n' >&2
    status=1
  fi
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

assert_protected_absent() {
  local haystack=$1 needle=$2 label=$3 key=$4
  if [[ "$haystack" == *"$needle"* ]]; then
    printf 'core dev contract failed: %s disclosed %s\n' "$label" "$key" >&2
    return 1
  fi
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
    assert_protected_absent "$output" "$value" "$label" "$key"
  done
}

copy_fixture_file() {
  local relative=$1
  mkdir -p "$ROOT_DIR/$(dirname "$relative")"
  cp "$SOURCE_ROOT/$relative" "$ROOT_DIR/$relative"
}

mkdir -p "$ROOT_DIR"
for relative in \
  manage-services.sh \
  infrastructure/alicloud/docker-compose.core.yml \
  infrastructure/docker-compose.core-dev.yml \
  infrastructure/alicloud/nginx/Dockerfile \
  infrastructure/alicloud/prometheus/Dockerfile \
  services/core-api/Dockerfile \
  services/storage/Dockerfile \
  frontend/cruip-landing/Dockerfile \
  scripts/smoke/fake-email/Dockerfile \
  scripts/smoke/fake-email/server.mjs \
  scripts/smoke-core-e2e.sh \
  archive/legacy-split-control-plane-2026-07-13/manage-services.sh; do
  copy_fixture_file "$relative"
done
chmod +x "$MANAGER" "$ROOT_DIR/archive/legacy-split-control-plane-2026-07-13/manage-services.sh"

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
  setup start stop status 'logs [service]' config smoke quality \
  'reset --confirm' legacy:help legacy:status)
[[ "$discovered_commands" == "$expected_commands" ]] || fail 'help does not expose the exact Core-first command surface'
assert_contains "$help_output" 'http://127.0.0.1:8080' 'help output'
assert_contains "$help_output" "$PROJECT_NAME" 'help output'
assert_contains "$help_output" '2.24.4' 'help output'

sentinel_secret='DO-NOT-PRINT-SENTINEL-SECRET'
set +e
sentinel_failure=$(assert_protected_absent "prefix-$sentinel_secret-suffix" "$sentinel_secret" 'sentinel output' 'SENTINEL_SECRET' 2>&1)
sentinel_status=$?
set -e
[[ $sentinel_status -eq 1 ]] || fail 'protected-value assertion did not fail for the sentinel'
assert_contains "$sentinel_failure" 'SENTINEL_SECRET' 'protected-value assertion'
[[ "$sentinel_failure" != *"$sentinel_secret"* ]] || fail 'protected-value assertion printed the sentinel secret'

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
COMMAND_STUB_LOG="$FIXTURES/stub.log"
STUB_SERVICES=$(printf '%s\n' \
  postgres redis minio minio-init core-migrate email-provider core-api \
  analytics-worker storage-api storage-worker prometheus web nginx)
export COMMAND_STUB_LOG STUB_SERVICES
: >"$COMMAND_STUB_LOG"

cat >"$FIXTURES/bin/docker" <<'STUB'
#!/bin/sh
{
  printf 'tool=docker\n'
  index=0
  for argument do
    printf 'arg[%s]=%s\n' "$index" "$argument"
    index=$((index + 1))
  done
  printf 'end\n'
} >>"$COMMAND_STUB_LOG"

is_version=0
is_services=0
for argument do
  [ "$argument" = version ] && is_version=1
  [ "$argument" = --services ] && is_services=1
done
if [ "$is_version" = 1 ]; then
  printf '%s\n' "${STUB_COMPOSE_VERSION:-2.39.2}"
elif [ "$is_services" = 1 ]; then
  printf '%s\n' "$STUB_SERVICES"
fi
STUB

for tool in corepack make bash pnpm; do
  cat >"$FIXTURES/bin/$tool" <<'STUB'
#!/bin/sh
{
  printf 'tool=%s\n' "$(basename "$0")"
  index=0
  for argument do
    printf 'arg[%s]=%s\n' "$index" "$argument"
    index=$((index + 1))
  done
  printf 'cwd=%s\nend\n' "$PWD"
} >>"$COMMAND_STUB_LOG"
STUB
  chmod +x "$FIXTURES/bin/$tool"
done
chmod +x "$FIXTURES/bin/docker"

# Compose versions older than the first release supporting !override must fail
# before local state creation or any lifecycle mutation.
rm -rf "$ROOT_DIR/.state"
: >"$COMMAND_STUB_LOG"
set +e
old_version_output=$(PATH="$FIXTURES/bin:$ORIGINAL_PATH" STUB_COMPOSE_VERSION=2.23.9 /bin/bash "$MANAGER" start 2>&1)
old_version_status=$?
set -e
[[ $old_version_status -eq 64 ]] || fail "old Compose must exit 64, got $old_version_status"
assert_contains "$old_version_output" '2.24.4' 'old Compose output'
[[ ! -e "$ROOT_DIR/.state" ]] || fail 'old Compose created local state before failing'
if grep -Eq '^arg\[[0-9]+\]=up$' "$COMMAND_STUB_LOG"; then fail 'old Compose reached the start mutation'; fi

# State-path attacks must fail before chmod, read, publish, or Compose config.
outside_dir="$FIXTURES/outside-state"
mkdir -p "$outside_dir"
printf 'outside-sentinel\n' >"$outside_dir/sentinel"
outside_checksum=$(cksum "$outside_dir/sentinel")
ln -s "$outside_dir" "$ROOT_DIR/.state"
set +e
state_symlink_output=$(PATH="$FIXTURES/bin:$ORIGINAL_PATH" /bin/bash "$MANAGER" config 2>&1)
state_symlink_status=$?
set -e
[[ $state_symlink_status -eq 64 ]] || fail 'a symlink state directory must exit 64'
assert_contains "$state_symlink_output" 'state directory must not be a symbolic link' 'state symlink output'
[[ $(cksum "$outside_dir/sentinel") == "$outside_checksum" ]] || fail 'state symlink handling touched an outside file'
[[ ! -e "$outside_dir/core-dev.env" ]] || fail 'state symlink handling published outside the fixture state directory'
rm -f "$ROOT_DIR/.state"

mkdir -p "$ROOT_DIR/.state"
outside_env="$FIXTURES/outside.env"
printf 'outside-env-sentinel\n' >"$outside_env"
outside_env_checksum=$(cksum "$outside_env")
ln -s "$outside_env" "$ENV_FILE"
set +e
env_symlink_output=$(PATH="$FIXTURES/bin:$ORIGINAL_PATH" /bin/bash "$MANAGER" config 2>&1)
env_symlink_status=$?
set -e
[[ $env_symlink_status -eq 64 ]] || fail 'a symlink env file must exit 64'
assert_contains "$env_symlink_output" 'environment must not be a symbolic link' 'env symlink output'
[[ $(cksum "$outside_env") == "$outside_env_checksum" ]] || fail 'env symlink handling touched an outside file'
rm -f "$ENV_FILE"

mkdir "$ENV_FILE"
set +e
nonregular_output=$(PATH="$FIXTURES/bin:$ORIGINAL_PATH" /bin/bash "$MANAGER" config 2>&1)
nonregular_status=$?
set -e
[[ $nonregular_status -eq 64 ]] || fail 'a non-regular env path must exit 64'
assert_contains "$nonregular_output" 'environment is not a regular file' 'non-regular env output'
rmdir "$ENV_FILE"

printf 'not-a-valid-environment\n' >"$ENV_FILE"
ln "$ENV_FILE" "$ROOT_DIR/.state/core-dev.env.second-link"
set +e
hardlink_output=$(PATH="$FIXTURES/bin:$ORIGINAL_PATH" /bin/bash "$MANAGER" config 2>&1)
hardlink_status=$?
set -e
[[ $hardlink_status -eq 64 ]] || fail 'a multiply-linked env file must exit 64'
assert_contains "$hardlink_output" 'exactly one hard link' 'hard-link env output'
rm -f "$ENV_FILE" "$ROOT_DIR/.state/core-dev.env.second-link"

# Ownership failures must be detected before the manager changes permissions or
# reads the environment. A stat shim keeps this deterministic without requiring
# root privileges or changing ownership on the host.
mkdir -p "$FIXTURES/wrong-owner-bin"
REAL_STAT=$(command -v stat)
export REAL_STAT
cat >"$FIXTURES/wrong-owner-bin/stat" <<'STUB'
#!/bin/sh
last_argument=''
for argument do last_argument=$argument; done
if [ "$last_argument" = "$WRONG_OWNER_PATH" ]; then
  printf '4294967294\n'
  exit 0
fi
exec "$REAL_STAT" "$@"
STUB
chmod +x "$FIXTURES/wrong-owner-bin/stat"

chmod 755 "$ROOT_DIR/.state"
set +e
wrong_state_owner_output=$(WRONG_OWNER_PATH="$ROOT_DIR/.state" PATH="$FIXTURES/wrong-owner-bin:$FIXTURES/bin:$ORIGINAL_PATH" /bin/bash "$MANAGER" config 2>&1)
wrong_state_owner_status=$?
set -e
[[ $wrong_state_owner_status -eq 64 ]] || fail 'a wrong-owner state directory must exit 64'
assert_contains "$wrong_state_owner_output" 'state directory is not owned by the current user' 'wrong-owner state output'
state_permissions=$(stat -f '%Lp' "$ROOT_DIR/.state" 2>/dev/null || stat -c '%a' "$ROOT_DIR/.state")
[[ "$state_permissions" == 755 ]] || fail 'wrong-owner state handling changed directory permissions'

printf 'owner-check-sentinel\n' >"$ENV_FILE"
chmod 644 "$ENV_FILE"
set +e
wrong_env_owner_output=$(WRONG_OWNER_PATH="$ENV_FILE" PATH="$FIXTURES/wrong-owner-bin:$FIXTURES/bin:$ORIGINAL_PATH" /bin/bash "$MANAGER" config 2>&1)
wrong_env_owner_status=$?
set -e
[[ $wrong_env_owner_status -eq 64 ]] || fail 'a wrong-owner env file must exit 64'
assert_contains "$wrong_env_owner_output" 'environment is not owned by the current user' 'wrong-owner env output'
env_permissions=$(stat -f '%Lp' "$ENV_FILE" 2>/dev/null || stat -c '%a' "$ENV_FILE")
[[ "$env_permissions" == 644 ]] || fail 'wrong-owner env handling changed file permissions'
rm -f "$ENV_FILE"

# Failed and interrupted atomic publication must leave no secret temp file.
mkdir -p "$FIXTURES/fail-bin" "$FIXTURES/signal-bin"
cat >"$FIXTURES/fail-bin/ln" <<'STUB'
#!/bin/sh
exit 1
STUB
cat >"$FIXTURES/signal-bin/ln" <<'STUB'
#!/bin/sh
kill -TERM "$PPID"
sleep 1
exit 1
STUB
chmod +x "$FIXTURES/fail-bin/ln" "$FIXTURES/signal-bin/ln"

rm -rf "$ROOT_DIR/.state"
set +e
PATH="$FIXTURES/fail-bin:$FIXTURES/bin:$ORIGINAL_PATH" /bin/bash "$MANAGER" setup >/dev/null 2>&1
publish_failure_status=$?
set -e
[[ $publish_failure_status -ne 0 ]] || fail 'a failed atomic publish unexpectedly succeeded'
[[ ! -e "$ENV_FILE" ]] || fail 'a failed atomic publish left a local env file'
[[ -z $(find "$ROOT_DIR/.state" -maxdepth 1 -name '.core-dev.env.*' -print -quit 2>/dev/null) ]] || fail 'a failed atomic publish left a secret temp file'

rm -rf "$ROOT_DIR/.state"
set +e
PATH="$FIXTURES/signal-bin:$FIXTURES/bin:$ORIGINAL_PATH" /bin/bash "$MANAGER" setup >/dev/null 2>&1
publish_signal_status=$?
set -e
[[ $publish_signal_status -ne 0 ]] || fail 'an interrupted atomic publish unexpectedly succeeded'
[[ ! -e "$ENV_FILE" ]] || fail 'an interrupted atomic publish left a local env file'
[[ -z $(find "$ROOT_DIR/.state" -maxdepth 1 -name '.core-dev.env.*' -print -quit 2>/dev/null) ]] || fail 'an interrupted atomic publish left a secret temp file'

rm -rf "$ROOT_DIR/.state"
: >"$COMMAND_STUB_LOG"
setup_output=$(PATH="$FIXTURES/bin:$ORIGINAL_PATH" /bin/bash "$MANAGER" setup 2>&1)
[[ -f "$ENV_FILE" && ! -L "$ENV_FILE" ]] || fail 'setup did not create a regular local env file'
permissions=$(stat -f '%Lp' "$ENV_FILE" 2>/dev/null || stat -c '%a' "$ENV_FILE")
links=$(stat -f '%l' "$ENV_FILE" 2>/dev/null || stat -c '%h' "$ENV_FILE")
owner=$(stat -f '%u' "$ENV_FILE" 2>/dev/null || stat -c '%u' "$ENV_FILE")
[[ "$permissions" == 600 && "$links" == 1 && "$owner" == "$(id -u)" ]] || fail 'local env metadata is not secure'
setup_invocation=$(awk '
  $0 == "tool=corepack" { capture = 1 }
  capture { print }
  capture && $0 == "end" { exit }
' "$COMMAND_STUB_LOG")
expected_setup_invocation=$(printf '%s\n' \
  'tool=corepack' \
  'arg[0]=pnpm' \
  'arg[1]=install' \
  'arg[2]=--frozen-lockfile' \
  "cwd=$ROOT_DIR" \
  'end')
[[ "$setup_invocation" == "$expected_setup_invocation" ]] || fail 'setup did not preserve the exact frozen-install argv and repository cwd'
assert_secret_output_safe "$setup_output" 'setup output'

# A concurrent publisher briefly leaves the winning env with two links until it
# removes its temp name. Readers must wait for that bounded window to close.
transient_temp="$ROOT_DIR/.state/.core-dev.env.transient"
transient_publisher_marker="$FIXTURES/transient-publisher-cleaned"
ln "$ENV_FILE" "$transient_temp"
(
  sleep 0.1
  rm -- "$transient_temp"
  touch "$transient_publisher_marker"
) &
transient_cleanup_pid=$!
set +e
PATH="$FIXTURES/bin:$ORIGINAL_PATH" /bin/bash "$MANAGER" config >/dev/null 2>&1
transient_window_status=$?
set -e
wait "$transient_cleanup_pid"
[[ $transient_window_status -eq 0 ]] || fail 'a transient two-link publication window was not accepted'
[[ ! -e "$transient_temp" ]] || fail 'the transient publication temp link was not cleaned up'
[[ -f "$transient_publisher_marker" ]] || fail 'the reader removed an active publisher temp instead of waiting'

# A process killed after publication can leave its temp name behind. Once the
# retry window expires, a same-inode generated temp in the private state
# directory is safe to unlink and must not force manual state repair.
crash_temp="$ROOT_DIR/.state/.core-dev.env.crash-left"
ln "$ENV_FILE" "$crash_temp"
set +e
PATH="$FIXTURES/bin:$ORIGINAL_PATH" /bin/bash "$MANAGER" config >/dev/null 2>&1
crash_recovery_status=$?
set -e
[[ $crash_recovery_status -eq 0 ]] || fail 'a crash-left same-inode publication temp was not recovered'
[[ ! -e "$crash_temp" ]] || fail 'crash recovery did not remove the same-inode temp name'
[[ -f "$ENV_FILE" ]] || fail 'crash recovery removed the stable local env'

# A link outside the private state directory cannot be explained or repaired by
# the manager. It must remain untouched while validation fails closed. An
# unrelated temp-shaped file inside state must also remain untouched.
external_link="$FIXTURES/external-core-dev.env"
unrelated_temp="$ROOT_DIR/.state/.core-dev.env.unrelated"
ln "$ENV_FILE" "$external_link"
printf 'unrelated-temp-sentinel\n' >"$unrelated_temp"
unrelated_checksum=$(cksum "$unrelated_temp")
set +e
external_link_output=$(PATH="$FIXTURES/bin:$ORIGINAL_PATH" /bin/bash "$MANAGER" config 2>&1)
external_link_status=$?
set -e
[[ $external_link_status -eq 64 ]] || fail 'an unexplained external hard link must exit 64'
assert_contains "$external_link_output" 'exactly one hard link' 'external hard-link output'
[[ -f "$external_link" && "$external_link" -ef "$ENV_FILE" ]] || fail 'external hard-link validation removed or replaced the outside link'
[[ $(cksum "$unrelated_temp") == "$unrelated_checksum" ]] || fail 'external hard-link recovery touched an unrelated state file'
rm -f "$external_link" "$unrelated_temp"

secret_values=''
for key in \
  POSTGRES_PASSWORD REDIS_PASSWORD MINIO_ROOT_PASSWORD CORE_SESSION_SECRET \
  OTP_PEPPER STORAGE_GRANT_SECRET CORE_CALLBACK_SECRET EMAIL_PROVIDER_TOKEN; do
  value=$(env_value "$key")
  [[ "$value" =~ ^[0-9a-f]{64}$ ]] || fail "$key is not a 256-bit hexadecimal secret"
  secret_values+="$value"$'\n'
done
[[ $(printf '%s' "$secret_values" | sort -u | grep -c .) -eq 8 ]] || fail 'generated local secrets must be pairwise distinct'

env_checksum_before=$(env_checksum)
: >"$COMMAND_STUB_LOG"
start_output=$(PATH="$FIXTURES/bin:$ORIGINAL_PATH" /bin/bash "$MANAGER" start 2>&1)
[[ $(env_checksum) == "$env_checksum_before" ]] || fail 'start rotated the stable local env'
assert_secret_output_safe "$start_output" 'start output'
grep -Fx "arg[2]=$ENV_FILE" "$COMMAND_STUB_LOG" >/dev/null || fail 'the env-file path with spaces was not preserved as one argv element'
grep -Fx 'arg[9]=up' "$COMMAND_STUB_LOG" >/dev/null || fail 'start did not reach Compose up after version validation'

config_output=$(PATH="$ORIGINAL_PATH" /bin/bash "$MANAGER" config 2>&1)
expected_services=$STUB_SERVICES
[[ $(sort <<<"$config_output") == $(sort <<<"$expected_services") ]] || fail 'config did not print the authoritative service set'
assert_secret_output_safe "$config_output" 'config output'

compose_args=(
  --env-file "$ENV_FILE"
  --project-name "$PROJECT_NAME"
  -f "$BASE_COMPOSE"
  -f "$DEV_COMPOSE"
)
docker compose "${compose_args[@]}" config --quiet
direct_services=$(docker compose "${compose_args[@]}" config --services)
[[ $(sort <<<"$direct_services") == $(sort <<<"$config_output") ]] || fail 'config did not print the real Compose service set'
docker compose "${compose_args[@]}" config --format json >"$FIXTURES/compose.json"
node - "$FIXTURES/compose.json" "$ROOT_DIR" "$ENV_FILE" <<'NODE'
const fs = require('node:fs')
const path = require('node:path')

const compose = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
const root = process.argv[3]
const localEnv = Object.fromEntries(
  fs.readFileSync(process.argv[4], 'utf8').trim().split('\n').map((line) => line.split(/=(.*)/s, 2)),
)
const expectedServices = [
  'analytics-worker', 'core-api', 'core-migrate', 'email-provider', 'minio',
  'minio-init', 'nginx', 'postgres', 'prometheus', 'redis', 'storage-api',
  'storage-worker', 'web',
]
const owned = {
  'core-migrate': ['mywebdrive-core-dev-core-api:local', root, 'services/core-api/Dockerfile'],
  'core-api': ['mywebdrive-core-dev-core-api:local', root, 'services/core-api/Dockerfile'],
  'analytics-worker': ['mywebdrive-core-dev-core-api:local', root, 'services/core-api/Dockerfile'],
  'storage-api': ['mywebdrive-core-dev-storage:local', root, 'services/storage/Dockerfile'],
  'storage-worker': ['mywebdrive-core-dev-storage:local', root, 'services/storage/Dockerfile'],
  'email-provider': ['mywebdrive-core-dev-fake-email:local', root, 'scripts/smoke/fake-email/Dockerfile'],
  prometheus: ['mywebdrive-core-dev-prometheus:local', path.join(root, 'infrastructure/alicloud/prometheus'), 'Dockerfile'],
  web: ['mywebdrive-core-dev-web:local', root, 'frontend/cruip-landing/Dockerfile'],
  nginx: ['mywebdrive-core-dev-nginx:local', path.join(root, 'infrastructure/alicloud'), 'nginx/Dockerfile'],
}

function assert(ok, message) {
  if (!ok) throw new Error(message)
}

assert(compose.name === 'mywebdrive-core-dev', 'wrong Compose project name')
assert(JSON.stringify(Object.keys(compose.services).sort()) === JSON.stringify(expectedServices), 'wrong service set')
for (const [serviceName, [image, context, dockerfile]] of Object.entries(owned)) {
  const service = compose.services[serviceName]
  assert(service.image === image, `${serviceName} image is not local`)
  assert(service.build?.context === context, `${serviceName} build context is wrong`)
  assert(service.build?.dockerfile === dockerfile, `${serviceName} Dockerfile is wrong`)
}
assert(compose.services['email-provider'].healthcheck?.test?.join(' ').includes('8025/healthz') === true, 'fake email healthcheck is wrong')
assert(compose.services['core-api'].environment?.EMAIL_PROVIDER_URL === 'http://email-provider:8025', 'Core fake email URL is wrong')
assert(compose.services['email-provider'].environment?.EMAIL_PROVIDER_TOKEN === localEnv.EMAIL_PROVIDER_TOKEN, 'fake email token differs')
assert(compose.services['core-api'].environment?.EMAIL_PROVIDER_TOKEN === localEnv.EMAIL_PROVIDER_TOKEN, 'Core email token differs')
assert(compose.services.nginx.ports?.length === 1 && compose.services.nginx.ports[0]?.host_ip === '127.0.0.1' && compose.services.nginx.ports[0]?.published === '8080', 'nginx is not loopback-only')
assert(compose.services['email-provider'].ports?.length === 1 && compose.services['email-provider'].ports[0]?.host_ip === '127.0.0.1' && compose.services['email-provider'].ports[0]?.published === '8025', 'fake email is not loopback-only')
NODE

: >"$COMMAND_STUB_LOG"
stop_output=$(PATH="$FIXTURES/bin:$ORIGINAL_PATH" /bin/bash "$MANAGER" stop 2>&1)
[[ $(env_checksum) == "$env_checksum_before" ]] || fail 'stop changed or removed the stable local env'
assert_secret_output_safe "$stop_output" 'stop output'
if grep -Eq '^arg\[[0-9]+\]=(down|--volumes)$' "$COMMAND_STUB_LOG"; then fail 'stop used a destructive Compose operation'; fi

PATH="$FIXTURES/bin:$ORIGINAL_PATH" /bin/bash "$MANAGER" status >/dev/null

for invalid_service in --follow --help does-not-exist; do
  : >"$COMMAND_STUB_LOG"
  set +e
  invalid_logs_output=$(PATH="$FIXTURES/bin:$ORIGINAL_PATH" /bin/bash "$MANAGER" logs "$invalid_service" 2>&1)
  invalid_logs_status=$?
  set -e
  [[ $invalid_logs_status -eq 64 ]] || fail "logs $invalid_service must exit 64"
  assert_contains "$invalid_logs_output" 'logs' "logs $invalid_service output"
  if grep -Eq '^arg\[[0-9]+\]=logs$' "$COMMAND_STUB_LOG"; then fail "logs $invalid_service reached Compose logs"; fi
done

: >"$COMMAND_STUB_LOG"
PATH="$FIXTURES/bin:$ORIGINAL_PATH" /bin/bash "$MANAGER" logs core-api >/dev/null
grep -Fx 'arg[9]=config' "$COMMAND_STUB_LOG" >/dev/null || fail 'valid logs did not validate the Compose service set'
grep -Fx 'arg[9]=logs' "$COMMAND_STUB_LOG" >/dev/null || fail 'valid logs did not call Compose logs'
grep -Fx 'arg[12]=--' "$COMMAND_STUB_LOG" >/dev/null || fail 'valid logs did not terminate Compose options'
grep -Fx 'arg[13]=core-api' "$COMMAND_STUB_LOG" >/dev/null || fail 'valid logs did not preserve the service operand boundary'

before_unconfirmed_reset=$(wc -l <"$COMMAND_STUB_LOG" | tr -d ' ')
set +e
reset_output=$(PATH="$FIXTURES/bin:$ORIGINAL_PATH" /bin/bash "$MANAGER" reset 2>&1)
reset_status=$?
set -e
[[ $reset_status -eq 64 ]] || fail "reset without --confirm must exit 64, got $reset_status"
assert_contains "$reset_output" 'reset --confirm' 'unconfirmed reset output'
after_unconfirmed_reset=$(wc -l <"$COMMAND_STUB_LOG" | tr -d ' ')
[[ "$after_unconfirmed_reset" == "$before_unconfirmed_reset" ]] || fail 'unconfirmed reset reached Docker'
[[ $(env_checksum) == "$env_checksum_before" ]] || fail 'unconfirmed reset changed the local env'

: >"$COMMAND_STUB_LOG"
PATH="$FIXTURES/bin:$ORIGINAL_PATH" /bin/bash "$MANAGER" reset --confirm >/dev/null
grep -Eq '^arg\[[0-9]+\]=down$' "$COMMAND_STUB_LOG" || fail 'confirmed reset did not call Compose down'
grep -Eq '^arg\[[0-9]+\]=--volumes$' "$COMMAND_STUB_LOG" || fail 'confirmed reset did not remove volumes'
[[ $(env_checksum) == "$env_checksum_before" ]] || fail 'confirmed reset changed the local env'

for retired_command in start-backend start-frontend start-next db:start; do
  set +e
  retired_output=$(PATH="$ORIGINAL_PATH" /bin/bash "$MANAGER" "$retired_command" 2>&1)
  retired_status=$?
  set -e
  [[ $retired_status -eq 64 ]] || fail "$retired_command must exit 64"
  assert_contains "$retired_output" 'SOFT-RETIRED' "$retired_command output"
  assert_contains "$retired_output" './manage-services.sh start' "$retired_command output"
  assert_contains "$retired_output" './manage-services.sh legacy:help' "$retired_command output"
  [[ "$retired_output" != *"legacy:$retired_command"* ]] || fail "$retired_command suggested a blocked legacy passthrough"
done

legacy_output=$(PATH="$ORIGINAL_PATH" /bin/bash "$MANAGER" legacy:help 2>&1)
assert_contains "$legacy_output" 'observation cycle' 'legacy:help output'
assert_contains "$legacy_output" 'SOFT-RETIRED' 'legacy:help output'
assert_contains "$legacy_output" 'legacy:status' 'legacy:help output'

legacy_status_output=$(PATH="$ORIGINAL_PATH" /bin/bash "$MANAGER" legacy:status 2>&1)
assert_contains "$legacy_status_output" 'SOFT-RETIRED' 'legacy:status output'
assert_contains "$legacy_status_output" 'Legacy split-control-plane socket observation' 'legacy:status output'

for blocked_legacy_command in start build generate deploy reset db:reset unknown; do
  : >"$COMMAND_STUB_LOG"
  set +e
  blocked_legacy_output=$(PATH="$FIXTURES/bin:$ORIGINAL_PATH" /bin/bash "$MANAGER" "legacy:$blocked_legacy_command" 2>&1)
  blocked_legacy_status=$?
  set -e
  [[ $blocked_legacy_status -eq 64 ]] || fail "legacy:$blocked_legacy_command must exit 64"
  assert_contains "$blocked_legacy_output" 'SOFT-RETIRED' "legacy:$blocked_legacy_command output"
  assert_contains "$blocked_legacy_output" 'observation-only' "legacy:$blocked_legacy_command output"
  [[ $blocked_legacy_output != *'This split-control-plane manager'* ]] || fail "legacy:$blocked_legacy_command invoked the archived manager"
  [[ ! -s "$COMMAND_STUB_LOG" ]] || fail "legacy:$blocked_legacy_command invoked a tool"
done

: >"$COMMAND_STUB_LOG"
PATH="$FIXTURES/bin:$ORIGINAL_PATH" /bin/bash "$MANAGER" quality >/dev/null
PATH="$FIXTURES/bin:$ORIGINAL_PATH" /bin/bash "$MANAGER" smoke >/dev/null
grep -Fx 'tool=make' "$COMMAND_STUB_LOG" >/dev/null || fail 'quality did not forward to make'
grep -Fx 'tool=bash' "$COMMAND_STUB_LOG" >/dev/null || fail 'smoke did not forward to bash'

[[ $(path_fingerprint "$REAL_ENV_FILE") == "$REAL_ENV_BEFORE" ]] || fail 'the real repository core-dev.env changed during the contract'
printf 'core dev contract tests: ok\n'
