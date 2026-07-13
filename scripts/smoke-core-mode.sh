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
