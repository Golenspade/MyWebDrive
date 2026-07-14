#!/usr/bin/env bash

smoke_configure_images() {
  local reuse=$1 run_id=$2
  unset SMOKE_OWNED_IMAGES
  SMOKE_OWNS_IMAGES=0
  if [[ "$reuse" == 1 ]]; then
    CORE_IMAGE=${SMOKE_CORE_API_IMAGE:-mywebdrive-core-api:ci}
    EMAIL_PROVIDER_IMAGE=${SMOKE_EMAIL_PROVIDER_IMAGE:-mywebdrive-email-provider:ci}
    STORAGE_IMAGE=${SMOKE_STORAGE_IMAGE:-mywebdrive-storage:ci}
    WEB_IMAGE=${SMOKE_WEB_IMAGE:-mywebdrive-web:ci}
    NGINX_IMAGE=${SMOKE_NGINX_IMAGE:-mywebdrive-nginx:ci}
    PROMETHEUS_IMAGE=${SMOKE_PROMETHEUS_IMAGE:-mywebdrive-prometheus:ci}
    FAKE_EMAIL_IMAGE=${SMOKE_FAKE_EMAIL_IMAGE:-mywebdrive-fake-email:test-ci}
    return
  fi

  local prefix="mywebdrive-smoke:$run_id"
  SMOKE_OWNS_IMAGES=1
  CORE_IMAGE="$prefix-core"
  EMAIL_PROVIDER_IMAGE="$prefix-email-provider"
  STORAGE_IMAGE="$prefix-storage"
  WEB_IMAGE="$prefix-web"
  NGINX_IMAGE="$prefix-nginx"
  PROMETHEUS_IMAGE="$prefix-prometheus"
  FAKE_EMAIL_IMAGE="$prefix-fake-email"
  SMOKE_OWNED_IMAGES=(
    "$CORE_IMAGE"
    "$EMAIL_PROVIDER_IMAGE"
    "$STORAGE_IMAGE"
    "$WEB_IMAGE"
    "$NGINX_IMAGE"
    "$PROMETHEUS_IMAGE"
    "$FAKE_EMAIL_IMAGE"
  )
}

smoke_required_images() {
  printf '%s\n' \
    "$CORE_IMAGE" \
    "$EMAIL_PROVIDER_IMAGE" \
    "$STORAGE_IMAGE" \
    "$WEB_IMAGE" \
    "$NGINX_IMAGE" \
    "$PROMETHEUS_IMAGE" \
    "$FAKE_EMAIL_IMAGE"
}

smoke_validate_reuse_images() {
  local image
  while IFS= read -r image; do
    if ! docker image inspect "$image" >/dev/null 2>&1; then
      printf 'core smoke failed: required reuse image is missing: %s\n' "$image" >&2
      return 1
    fi
  done < <(smoke_required_images)
}

smoke_cleanup_owned_images() {
  local image
  [[ "$SMOKE_OWNS_IMAGES" == 1 ]] || return 0
  for image in "${SMOKE_OWNED_IMAGES[@]}"; do
    docker image rm "$image" >/dev/null 2>&1 || true
  done
}

smoke_snapshot_update_arg() {
  case "$1" in
    0) return 0 ;;
    1) printf '%s\n' '--update-snapshots=all' ;;
    *)
      printf 'SMOKE_UPDATE_SNAPSHOTS must be 0 or 1\n' >&2
      return 64
      ;;
  esac
}

smoke_run_snapshot_command() {
  local update=$1
  shift
  case "$update" in
    0) "$@" ;;
    1) "$@" --update-snapshots=all ;;
    *)
      printf 'SMOKE_UPDATE_SNAPSHOTS must be 0 or 1\n' >&2
      return 64
      ;;
  esac
}

smoke_normalize_exit_status() {
  local status=$1 completed=$2
  if [[ "$completed" != 1 && "$status" == 0 ]]; then
    status=1
  fi
  printf '%s\n' "$status"
}

smoke_validate_snapshot_update_policy() {
  local update=$1 browser_gate=$2 browser_image=$3 root_dir=$4
  case "$update" in
    0) return 0 ;;
    1) ;;
    *)
      printf 'SMOKE_UPDATE_SNAPSHOTS must be 0 or 1\n' >&2
      return 64
      ;;
  esac
  if [[ "$browser_gate" != 1 ]]; then
    printf 'snapshot updates require SMOKE_BROWSER_GATE=1\n' >&2
    return 64
  fi
  if [[ -z "$browser_image" ]]; then
    printf 'snapshot updates require SMOKE_BROWSER_CONTAINER_IMAGE\n' >&2
    return 64
  fi

  docker run --rm \
    --read-only \
    --tmpfs /tmp:mode=1777 \
    --env HOME=/tmp \
    --volume "$root_dir:/work:ro" \
    --workdir /work \
    "$browser_image" \
    sh -ceu '
      test "$(node -p "process.platform")" = linux
      test "$(node -p "require(\"@playwright/test/package.json\").version")" = 1.61.1
      corepack pnpm exec playwright --version | grep -Fx "Version 1.61.1" >/dev/null
      node --input-type=module -e "
        import { chromium } from \"@playwright/test\"
        const browser = await chromium.launch({ headless: true })
        if (!browser.version()) process.exitCode = 1
        await browser.close()
      "
    '
}
