#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.core.yml"
ENV_FILE=${MYWEBDRIVE_ENV_FILE:-"$SCRIPT_DIR/.env"}
STATE_DIR=${DEPLOY_STATE_DIR:-/var/lib/mywebdrive/releases}
state_tmp=''
current_tmp=''
probe_tmp=''
probe_dest=''
lock_dir=''
lock_owner=''
lock_owner_tmp=''
lock_acquired=0
ANALYTICS_WORKER_ENABLED=1

trap 'printf "deployment failed at line %s\n" "$LINENO" >&2' ERR

cleanup() {
  local code=$? path recorded_owner=''
  trap - EXIT
  for path in "$state_tmp" "$current_tmp" "$probe_tmp" "$probe_dest" "$lock_owner_tmp"; do
    [[ -z "$path" ]] || rm -f "$path"
  done
  if (( lock_acquired )); then
    if [[ -f "$lock_dir/owner" ]]; then recorded_owner=$(sed -n '1p' "$lock_dir/owner"); fi
    if [[ "$recorded_owner" == "$lock_owner" ]]; then
      rm -f "$lock_dir/owner"
      if ! rmdir "$lock_dir"; then
        printf 'deployment lock cleanup failed; manual inspection required: %s\n' "$lock_dir" >&2
        (( code != 0 )) || code=74
      fi
    else
      printf 'deployment lock ownership changed; refusing cleanup: %s\n' "$lock_dir" >&2
      (( code != 0 )) || code=74
    fi
  fi
  exit "$code"
}
trap cleanup EXIT

validate_release_tag() {
  [[ "$1" =~ ^sha-[0-9a-f]{40}$ ]] || {
    printf 'release tag must be content-addressed as sha-<40 lowercase hex>\n' >&2
    exit 64
  }
}

validate_digest_ref() {
  [[ "$1" =~ ^[A-Za-z0-9][A-Za-z0-9._:/-]*@sha256:[0-9a-f]{64}$ ]] || {
    printf 'invalid immutable image digest reference\n' >&2
    exit 65
  }
}

preflight_state_dir() {
  [[ "$STATE_DIR" == /* ]] || { printf 'DEPLOY_STATE_DIR must be an absolute path\n' >&2; exit 64; }
  mkdir -p "$STATE_DIR/history"
  probe_tmp=$(mktemp "$STATE_DIR/.write-probe.XXXXXX")
  printf 'state-write-probe\n' > "$probe_tmp"
  probe_dest="$STATE_DIR/history/.write-probe-$$"
  mv "$probe_tmp" "$probe_dest"
  probe_tmp=''
  [[ "$(sed -n '1p' "$probe_dest")" == state-write-probe ]] || { printf 'deployment state probe verification failed\n' >&2; exit 73; }
  rm -f "$probe_dest"
  probe_dest=''
}

acquire_deploy_lock() {
  lock_dir="$STATE_DIR/.deploy.lock"
  lock_owner="pid=$$:started=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  if ! mkdir "$lock_dir"; then
    printf 'another deployment holds %s; stale locks require manual inspection\n' "$lock_dir" >&2
    exit 75
  fi
  lock_acquired=1
  lock_owner_tmp="$lock_dir/.owner.$$"
  printf '%s\n' "$lock_owner" > "$lock_owner_tmp"
  mv "$lock_owner_tmp" "$lock_dir/owner"
  lock_owner_tmp=''
}

parse_manifest() {
  local manifest=$1 line key value
  local seen_tag=0 seen_core=0 seen_email=0 seen_storage=0 seen_web=0 seen_nginx=0 seen_prometheus=0 seen_analytics_worker=0
  [[ -f "$manifest" ]] || { printf 'release manifest not found: %s\n' "$manifest" >&2; exit 66; }
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" == *=* ]] || { printf 'invalid release manifest line\n' >&2; exit 65; }
    key=${line%%=*}
    value=${line#*=}
    case "$key" in
      IMAGE_TAG)
        (( seen_tag == 0 )) || { printf 'duplicate IMAGE_TAG in manifest\n' >&2; exit 65; }
        validate_release_tag "$value"; IMAGE_TAG=$value; seen_tag=1
        ;;
      CORE_API_IMAGE)
        (( seen_core == 0 )) || { printf 'duplicate CORE_API_IMAGE in manifest\n' >&2; exit 65; }
        validate_digest_ref "$value"; CORE_API_IMAGE=$value; seen_core=1
        ;;
      EMAIL_PROVIDER_IMAGE)
        (( seen_email == 0 )) || { printf 'duplicate EMAIL_PROVIDER_IMAGE in manifest\n' >&2; exit 65; }
        validate_digest_ref "$value"; EMAIL_PROVIDER_IMAGE=$value; seen_email=1
        ;;
      STORAGE_IMAGE)
        (( seen_storage == 0 )) || { printf 'duplicate STORAGE_IMAGE in manifest\n' >&2; exit 65; }
        validate_digest_ref "$value"; STORAGE_IMAGE=$value; seen_storage=1
        ;;
      WEB_IMAGE)
        (( seen_web == 0 )) || { printf 'duplicate WEB_IMAGE in manifest\n' >&2; exit 65; }
        validate_digest_ref "$value"; WEB_IMAGE=$value; seen_web=1
        ;;
      NGINX_IMAGE)
        (( seen_nginx == 0 )) || { printf 'duplicate NGINX_IMAGE in manifest\n' >&2; exit 65; }
        validate_digest_ref "$value"; NGINX_IMAGE=$value; seen_nginx=1
        ;;
      PROMETHEUS_IMAGE)
        (( seen_prometheus == 0 )) || { printf 'duplicate PROMETHEUS_IMAGE in manifest\n' >&2; exit 65; }
        validate_digest_ref "$value"; PROMETHEUS_IMAGE=$value; seen_prometheus=1
        ;;
      DEPLOYED_AT)
        [[ "$value" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$ ]] || { printf 'invalid DEPLOYED_AT in manifest\n' >&2; exit 65; }
        ;;
      ANALYTICS_WORKER_CONTAINER_IMAGE_ID)
        (( seen_analytics_worker == 0 )) || { printf 'duplicate ANALYTICS_WORKER_CONTAINER_IMAGE_ID in manifest\n' >&2; exit 65; }
        [[ "$value" =~ ^sha256:[0-9a-f]{64}$ ]] || { printf 'invalid container image ID in manifest\n' >&2; exit 65; }
        seen_analytics_worker=1
        ;;
      POSTGRES_CONTAINER_IMAGE_ID|REDIS_CONTAINER_IMAGE_ID|MINIO_CONTAINER_IMAGE_ID|CORE_API_CONTAINER_IMAGE_ID|EMAIL_PROVIDER_CONTAINER_IMAGE_ID|STORAGE_API_CONTAINER_IMAGE_ID|STORAGE_WORKER_CONTAINER_IMAGE_ID|WEB_CONTAINER_IMAGE_ID|NGINX_CONTAINER_IMAGE_ID|PROMETHEUS_CONTAINER_IMAGE_ID)
        [[ "$value" =~ ^sha256:[0-9a-f]{64}$ ]] || { printf 'invalid container image ID in manifest\n' >&2; exit 65; }
        ;;
      *) printf 'unknown release manifest key: %s\n' "$key" >&2; exit 65 ;;
    esac
  done < "$manifest"
  (( seen_tag && seen_core && seen_email && seen_storage && seen_web && seen_nginx )) || { printf 'release manifest is incomplete\n' >&2; exit 65; }
  if (( ! seen_prometheus )); then
    PROMETHEUS_IMAGE=$(sed -n 's/^PROMETHEUS_IMAGE=//p' "$STATE_DIR/current.env" | tail -n 1)
    [[ -n "$PROMETHEUS_IMAGE" ]] || { printf 'legacy rollback requires the current Prometheus image\n' >&2; exit 65; }
    validate_digest_ref "$PROMETHEUS_IMAGE"
  fi
  ANALYTICS_WORKER_ENABLED=$seen_analytics_worker
  export IMAGE_TAG CORE_API_IMAGE EMAIL_PROVIDER_IMAGE STORAGE_IMAGE WEB_IMAGE NGINX_IMAGE PROMETHEUS_IMAGE
}

resolve_repo_digest() {
  local tag_ref=$1 repository=$2 value existing
  local -a matches=()
  while IFS= read -r value; do
    [[ "$value" == "$repository"@sha256:* ]] || continue
    [[ "$value" =~ ^[A-Za-z0-9][A-Za-z0-9._:/-]*@sha256:[0-9a-f]{64}$ ]] || continue
    existing=0
    for match in "${matches[@]-}"; do
      [[ "$match" == "$value" ]] && existing=1
    done
    (( existing )) || matches+=("$value")
  done < <(docker image inspect --format '{{range .RepoDigests}}{{println .}}{{end}}' "$tag_ref")
  (( ${#matches[@]} == 1 )) || { printf 'could not resolve a unique RepoDigest for %s\n' "$tag_ref" >&2; exit 69; }
  printf '%s' "${matches[0]}"
}

resolve_tag_image() {
  local suffix=$1 value existing
  local -a matches=()
  while IFS= read -r value; do
    [[ "$value" == */"$suffix":"$IMAGE_TAG" ]] || continue
    existing=0
    for match in "${matches[@]-}"; do
      [[ "$match" == "$value" ]] && existing=1
    done
    (( existing )) || matches+=("$value")
  done <<< "$tag_images"
  (( ${#matches[@]} == 1 )) || { printf 'could not resolve a unique tag image for %s\n' "$suffix" >&2; exit 69; }
  printf '%s' "${matches[0]}"
}

[[ -r "$ENV_FILE" ]] || { printf 'environment file is missing or unreadable: %s\n' "$ENV_FILE" >&2; exit 66; }
[[ -f "$COMPOSE_FILE" ]] || { printf 'compose file is missing: %s\n' "$COMPOSE_FILE" >&2; exit 66; }

mode=tag
manifest=''
if [[ ${1:-} == --manifest ]]; then
  [[ $# -eq 2 || $# -eq 3 ]] || { printf 'usage: %s --manifest <release-manifest> [expected-release-tag]\n' "$0" >&2; exit 64; }
  mode=manifest
  manifest=$2
  expected_manifest_tag=${3:-}
  [[ -z "$expected_manifest_tag" ]] || validate_release_tag "$expected_manifest_tag"
else
  [[ $# -eq 1 ]] || { printf 'usage: %s sha-<40 lowercase hex>\n' "$0" >&2; exit 64; }
  IMAGE_TAG=$1
  validate_release_tag "$IMAGE_TAG"
fi

preflight_state_dir
acquire_deploy_lock
if [[ "$mode" == manifest ]]; then
  parse_manifest "$manifest"
  [[ -z "$expected_manifest_tag" || "$IMAGE_TAG" == "$expected_manifest_tag" ]] || { printf 'release manifest tag does not match rollback target\n' >&2; exit 65; }
fi

command -v docker >/dev/null
docker compose version >/dev/null

export IMAGE_TAG
compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

wait_healthy() {
  local service=$1 deadline container health_status
  deadline=$((SECONDS + 180))
  while (( SECONDS < deadline )); do
    container=$(compose ps -q "$service")
    if [[ -n "$container" ]]; then
      health_status=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container")
      [[ "$health_status" == healthy ]] && return 0
      [[ "$health_status" == exited || "$health_status" == dead ]] && break
    fi
    sleep 2
  done
  compose logs --tail=100 "$service" >&2
  printf 'service did not become healthy: %s\n' "$service" >&2
  return 1
}

if [[ "$mode" == tag ]]; then
  unset CORE_API_IMAGE EMAIL_PROVIDER_IMAGE STORAGE_IMAGE WEB_IMAGE NGINX_IMAGE PROMETHEUS_IMAGE
  compose config -q
  tag_images=$(compose config --images)
  core_tag=$(resolve_tag_image mywebdrive-core-api)
  email_tag=$(resolve_tag_image mywebdrive-email-provider)
  storage_tag=$(resolve_tag_image mywebdrive-storage)
  web_tag=$(resolve_tag_image mywebdrive-web)
  nginx_tag=$(resolve_tag_image mywebdrive-nginx)
  prometheus_tag=$(resolve_tag_image mywebdrive-prometheus)
  compose pull core-api email-provider storage-api web nginx prometheus
  core_repo=${core_tag%:"$IMAGE_TAG"}
  email_repo=${email_tag%:"$IMAGE_TAG"}
  storage_repo=${storage_tag%:"$IMAGE_TAG"}
  web_repo=${web_tag%:"$IMAGE_TAG"}
  nginx_repo=${nginx_tag%:"$IMAGE_TAG"}
  prometheus_repo=${prometheus_tag%:"$IMAGE_TAG"}
  CORE_API_IMAGE=$(resolve_repo_digest "$core_tag" "$core_repo")
  EMAIL_PROVIDER_IMAGE=$(resolve_repo_digest "$email_tag" "$email_repo")
  STORAGE_IMAGE=$(resolve_repo_digest "$storage_tag" "$storage_repo")
  WEB_IMAGE=$(resolve_repo_digest "$web_tag" "$web_repo")
  NGINX_IMAGE=$(resolve_repo_digest "$nginx_tag" "$nginx_repo")
  PROMETHEUS_IMAGE=$(resolve_repo_digest "$prometheus_tag" "$prometheus_repo")
  export CORE_API_IMAGE EMAIL_PROVIDER_IMAGE STORAGE_IMAGE WEB_IMAGE NGINX_IMAGE PROMETHEUS_IMAGE
fi

for ref in "$CORE_API_IMAGE" "$EMAIL_PROVIDER_IMAGE" "$STORAGE_IMAGE" "$WEB_IMAGE" "$NGINX_IMAGE" "$PROMETHEUS_IMAGE"; do
  validate_digest_ref "$ref"
  docker pull "$ref"
done

compose config -q
compose pull postgres redis minio minio-init
compose up -d --no-deps postgres redis minio
for service in postgres redis minio; do wait_healthy "$service"; done
compose run --rm --no-deps minio-init
compose run --rm --no-deps core-migrate
compose up -d --no-deps email-provider
wait_healthy email-provider
if (( ANALYTICS_WORKER_ENABLED )); then
  compose up -d --no-deps core-api analytics-worker storage-api storage-worker prometheus web nginx
  runtime_services=(core-api analytics-worker storage-api storage-worker prometheus web nginx)
else
  compose stop analytics-worker
  compose up -d --no-deps core-api storage-api storage-worker prometheus web nginx
  runtime_services=(core-api storage-api storage-worker prometheus web nginx)
fi
for service in "${runtime_services[@]}"; do wait_healthy "$service"; done

compose exec -T -e EXPECTED_BUILD_ID="$IMAGE_TAG" core-api node -e \
  "fetch('http://127.0.0.1:8080/version').then(async r=>{if(!r.ok)throw Error('version endpoint failed');const v=await r.json();if(v.buildId!==process.env.EXPECTED_BUILD_ID)throw Error('buildId mismatch')}).catch(e=>{console.error(e.message);process.exit(1)})"

state_tmp=$(mktemp "$STATE_DIR/.release.XXXXXX")
deployed_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
history_stamp=$(date -u +%Y%m%dT%H%M%SZ)
{
  printf 'IMAGE_TAG=%s\n' "$IMAGE_TAG"
  printf 'CORE_API_IMAGE=%s\n' "$CORE_API_IMAGE"
  printf 'EMAIL_PROVIDER_IMAGE=%s\n' "$EMAIL_PROVIDER_IMAGE"
  printf 'STORAGE_IMAGE=%s\n' "$STORAGE_IMAGE"
  printf 'WEB_IMAGE=%s\n' "$WEB_IMAGE"
  printf 'NGINX_IMAGE=%s\n' "$NGINX_IMAGE"
  printf 'PROMETHEUS_IMAGE=%s\n' "$PROMETHEUS_IMAGE"
  printf 'DEPLOYED_AT=%s\n' "$deployed_at"
  manifest_services=(postgres redis minio core-api email-provider storage-api storage-worker prometheus web nginx)
  if (( ANALYTICS_WORKER_ENABLED )); then manifest_services+=(analytics-worker); fi
  for service in "${manifest_services[@]}"; do
    container=$(compose ps -q "$service")
    image_id=$(docker inspect --format '{{.Image}}' "$container")
    key=$(printf '%s' "$service" | tr '[:lower:]-' '[:upper:]_')
    printf '%s_CONTAINER_IMAGE_ID=%s\n' "$key" "$image_id"
  done
} > "$state_tmp"
history_file="$STATE_DIR/history/$history_stamp-$IMAGE_TAG-$$.manifest"
mv "$state_tmp" "$history_file"
state_tmp=''
current_tmp=$(mktemp "$STATE_DIR/.current.XXXXXX")
cp "$history_file" "$current_tmp"
mv "$current_tmp" "$STATE_DIR/current.env"
current_tmp=''
printf 'deployed immutable release %s\n' "$IMAGE_TAG"
