#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
FIXTURES=$(mktemp -d "${TMPDIR:-/tmp}/mywebdrive-smoke-mode.XXXXXX")
trap 'rm -rf "$FIXTURES"' EXIT

source "$ROOT_DIR/scripts/smoke-core-mode.sh"

CALL_LOG="$FIXTURES/docker.log"
docker() {
  printf '%s\n' "$*" >> "$CALL_LOG"
  if [[ "$1 $2" == 'image inspect' && "$3" == *missing* ]]; then return 1; fi
}

smoke_configure_images 0 local-run
[[ "$CORE_IMAGE" == 'mywebdrive-smoke:local-run-core' ]]
[[ "$SMOKE_OWNS_IMAGES" == 1 && ${#SMOKE_OWNED_IMAGES[@]} -eq 7 ]]
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
[[ "$SMOKE_OWNS_IMAGES" == 0 ]]
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

printf 'smoke image mode contracts: ok\n'
