#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
FIXTURES=$(mktemp -d "${TMPDIR:-/tmp}/mywebdrive-smoke-health.XXXXXX")
cleanup() {
  local exit_code=$?
  rm -rf "$FIXTURES"
  exit "$exit_code"
}
trap cleanup EXIT

[[ -f "$ROOT_DIR/scripts/smoke-core-health.sh" ]]
source "$ROOT_DIR/scripts/smoke-core-health.sh"

printf '{"availability":"available"}\n' > "$FIXTURES/available.json"
printf '{"availability":"partial"}\n' > "$FIXTURES/partial.json"

smoke_has_exact_availability "$FIXTURES/available.json" available
! smoke_has_exact_availability "$FIXTURES/available.json" partial
smoke_has_exact_availability "$FIXTURES/partial.json" partial
! smoke_has_exact_availability "$FIXTURES/partial.json" available

attempt=0
fetch_recovery_state() {
  local output=$1
  attempt=$((attempt + 1))
  if [[ $attempt -lt 3 ]]; then
    cp "$FIXTURES/partial.json" "$output"
  else
    cp "$FIXTURES/available.json" "$output"
  fi
}
smoke_wait_for_exact_availability available 3 0 fetch_recovery_state "$FIXTURES/recovery.json"
if [[ $attempt -ne 3 ]]; then
  printf 'availability polling stopped after %s attempts instead of 3\n' "$attempt" >&2
  exit 1
fi

attempt=0
if smoke_wait_for_exact_availability available 2 0 fetch_recovery_state "$FIXTURES/timeout.json"; then
  printf 'availability polling accepted partial state\n' >&2
  exit 1
fi

STUB_CONTAINER_ID=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
STUB_INSPECT_FAIL=0
STUB_INSPECT_OUTPUT="$STUB_CONTAINER_ID|42|2026-07-14T01:02:03.000000000Z|0"

compose() {
  [[ "$1" == ps && "$2" == -q && "$3" == storage-worker ]] || return 2
  printf '%s\n' "$STUB_CONTAINER_ID"
}

docker() {
  [[ "$1" == inspect && "$2" == --format ]] || return 2
  [[ "$3" == '{{.Id}}|{{.State.Pid}}|{{.State.StartedAt}}|{{.RestartCount}}' ]] || return 2
  [[ "$4" == "$STUB_CONTAINER_ID" ]] || return 2
  [[ "$STUB_INSPECT_FAIL" == 0 ]] || return 1
  printf '%s\n' "$STUB_INSPECT_OUTPUT"
}

worker_identity=$(smoke_capture_container_identity storage-worker)
smoke_assert_container_identity_unchanged storage-worker "$worker_identity"

assert_worker_identity_change_rejected() {
  local label=$1 changed_identity=$2
  STUB_INSPECT_OUTPUT=$changed_identity
  if smoke_assert_container_identity_unchanged storage-worker "$worker_identity"; then
    printf 'worker identity comparison accepted changed %s\n' "$label" >&2
    exit 1
  fi
}

assert_worker_identity_change_rejected id \
  "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb|42|2026-07-14T01:02:03.000000000Z|0"
assert_worker_identity_change_rejected pid \
  "$STUB_CONTAINER_ID|43|2026-07-14T01:02:03.000000000Z|0"
assert_worker_identity_change_rejected started-at \
  "$STUB_CONTAINER_ID|42|2026-07-14T01:02:04.000000000Z|0"
assert_worker_identity_change_rejected restart-count \
  "$STUB_CONTAINER_ID|42|2026-07-14T01:02:03.000000000Z|1"

STUB_INSPECT_OUTPUT="$STUB_CONTAINER_ID|42|2026-07-14T01:02:03.000000000Z|0"
STUB_INSPECT_FAIL=1
if smoke_capture_container_identity storage-worker >/dev/null; then
  printf 'worker identity capture accepted failed docker inspect\n' >&2
  exit 1
fi
if smoke_assert_container_identity_unchanged storage-worker "$worker_identity"; then
  printf 'worker identity comparison accepted failed docker inspect\n' >&2
  exit 1
fi

STUB_INSPECT_FAIL=0
for empty_identity in \
  '|42|2026-07-14T01:02:03.000000000Z|0' \
  "$STUB_CONTAINER_ID||2026-07-14T01:02:03.000000000Z|0" \
  "$STUB_CONTAINER_ID|42||0" \
  "$STUB_CONTAINER_ID|42|2026-07-14T01:02:03.000000000Z|"; do
  STUB_INSPECT_OUTPUT=$empty_identity
  if smoke_capture_container_identity storage-worker >/dev/null; then
    printf 'worker identity capture accepted an empty inspect field\n' >&2
    exit 1
  fi
done

STUB_INSPECT_OUTPUT="$STUB_CONTAINER_ID|42|2026-07-14T01:02:03.000000000Z|0"
STUB_CONTAINER_ID=''
if smoke_capture_container_identity storage-worker >/dev/null; then
  printf 'worker identity capture accepted an empty compose container id\n' >&2
  exit 1
fi

printf 'smoke health lifecycle contracts: ok\n'
