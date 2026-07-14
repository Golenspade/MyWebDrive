#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
FIXTURES=$(mktemp -d "${TMPDIR:-/tmp}/mywebdrive-smoke-mode.XXXXXX")
cleanup() {
  local exit_code=$?
  rm -rf "$FIXTURES"
  exit "$exit_code"
}
trap cleanup EXIT

source "$ROOT_DIR/scripts/smoke-core-mode.sh"

assert_equal() {
  local actual=$1 expected=$2 label=$3
  if [[ "$actual" != "$expected" ]]; then
    printf '%s: expected <%s>, got <%s>\n' "$label" "$expected" "$actual" >&2
    exit 1
  fi
}

CALL_LOG="$FIXTURES/docker.log"
docker() {
  printf '%s\n' "$*" >> "$CALL_LOG"
  if [[ "$1 $2" == 'image inspect' && "$3" == *missing* ]]; then return 1; fi
}

smoke_configure_images 0 local-run
assert_equal "$CORE_IMAGE" 'mywebdrive-smoke:local-run-core' 'local Core image'
assert_equal "$SMOKE_OWNS_IMAGES" 1 'local image ownership'
assert_equal "${#SMOKE_OWNED_IMAGES[@]}" 7 'local owned image count'
smoke_cleanup_owned_images
grep -F 'image rm mywebdrive-smoke:local-run-core' "$CALL_LOG" >/dev/null

: > "$CALL_LOG"
SMOKE_CORE_API_IMAGE=mywebdrive-core-api:ci
SMOKE_EMAIL_PROVIDER_IMAGE=mywebdrive-email-provider:ci
SMOKE_STORAGE_IMAGE=mywebdrive-storage:ci
SMOKE_WEB_IMAGE=mywebdrive-web:ci
SMOKE_NGINX_IMAGE=mywebdrive-nginx:ci
SMOKE_PROMETHEUS_IMAGE=mywebdrive-prometheus:ci
SMOKE_FAKE_EMAIL_IMAGE=mywebdrive-fake-email:test-ci
smoke_configure_images 1 ignored
assert_equal "$SMOKE_OWNS_IMAGES" 0 'reuse image ownership'
smoke_validate_reuse_images
smoke_cleanup_owned_images
if grep -F 'image rm' "$CALL_LOG" >/dev/null; then
  printf 'reuse mode removed a shared image\n' >&2
  exit 1
fi

SMOKE_FAKE_EMAIL_IMAGE=mywebdrive-fake-email:missing
smoke_configure_images 1 ignored
if smoke_validate_reuse_images >/dev/null 2>&1; then
  printf 'reuse mode accepted a missing required image\n' >&2
  exit 1
fi

: > "$CALL_LOG"
unset SMOKE_UPDATE_SNAPSHOTS
assert_equal "$(smoke_snapshot_update_arg "${SMOKE_UPDATE_SNAPSHOTS:-0}")" '' 'absent snapshot update argument'
smoke_validate_snapshot_update_policy 0 0 '' "$ROOT_DIR"
if [[ -s "$CALL_LOG" ]]; then
  printf 'compare mode invoked Docker provenance validation\n' >&2
  exit 1
fi
assert_equal "$(smoke_snapshot_update_arg 0)" '' 'zero snapshot update argument'
assert_equal "$(smoke_snapshot_update_arg 1)" '--update-snapshots=all' 'enabled snapshot update argument'
RUN_LOG="$FIXTURES/run.log"
record_command() {
  printf '<%s>\n' "$*" >> "$RUN_LOG"
}
: > "$RUN_LOG"
smoke_run_snapshot_command 0 record_command playwright test --grep @healthy
assert_equal "$(cat "$RUN_LOG")" '<playwright test --grep @healthy>' 'compare command has no empty argument'
: > "$RUN_LOG"
smoke_run_snapshot_command 1 record_command playwright test --grep @healthy
assert_equal "$(cat "$RUN_LOG")" '<playwright test --grep @healthy --update-snapshots=all>' 'update command has exact argument'
assert_equal "$(smoke_normalize_exit_status 0 1)" 0 'completed success exit status'
assert_equal "$(smoke_normalize_exit_status 7 0)" 7 'preserved failure exit status'
assert_equal "$(smoke_normalize_exit_status 0 0)" 1 'premature zero exit becomes failure'
if bash -c '
  source "$1"
  completed=0
  cleanup() {
    local status=$?
    status=$(smoke_normalize_exit_status "$status" "$completed")
    exit "$status"
  }
  trap cleanup EXIT
  set -u
  : "$INTENTIONALLY_UNSET"
' _ "$ROOT_DIR/scripts/smoke-core-mode.sh" 2>/dev/null; then
  printf 'nounset abort was reported as success\n' >&2
  exit 1
else
  nounset_status=$?
fi
if [[ "$nounset_status" == 0 ]]; then
  printf 'nounset abort was normalized to success\n' >&2
  exit 1
fi
if smoke_snapshot_update_arg yes >/dev/null 2>&1; then
  printf 'snapshot update accepted a non-boolean value\n' >&2
  exit 1
fi

if smoke_validate_snapshot_update_policy 1 0 '' "$ROOT_DIR" >/dev/null 2>&1; then
  printf 'snapshot update accepted a disabled browser gate\n' >&2
  exit 1
fi
if smoke_validate_snapshot_update_policy 1 1 '' "$ROOT_DIR" >/dev/null 2>&1; then
  printf 'snapshot update accepted a missing browser container\n' >&2
  exit 1
fi

docker() {
  printf '%s\n' "$*" >> "$CALL_LOG"
  case "$*" in
    *snapshot-darwin*|*snapshot-arbitrary*) return 1 ;;
    *snapshot-linux-verified*) return 0 ;;
    *) return 0 ;;
  esac
}
for invalid in snapshot-darwin snapshot-arbitrary; do
  if smoke_validate_snapshot_update_policy 1 1 "$invalid" "$ROOT_DIR" >/dev/null 2>&1; then
    printf 'snapshot update accepted invalid provenance: %s\n' "$invalid" >&2
    exit 1
  fi
done
smoke_validate_snapshot_update_policy 1 1 snapshot-linux-verified "$ROOT_DIR"
grep -F 'snapshot-linux-verified' "$CALL_LOG" >/dev/null

printf 'smoke image mode contracts: ok\n'
