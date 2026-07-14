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

printf 'smoke health lifecycle contracts: ok\n'
