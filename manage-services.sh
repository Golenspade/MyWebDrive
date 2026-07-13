#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
BASE_COMPOSE="$ROOT_DIR/infrastructure/alicloud/docker-compose.core.yml"
DEV_COMPOSE="$ROOT_DIR/infrastructure/docker-compose.core-dev.yml"
PROJECT_NAME=mywebdrive-core-dev
STATE_DIR="$ROOT_DIR/.state"
ENV_FILE="$STATE_DIR/core-dev.env"
LEGACY_MANAGER="$ROOT_DIR/archive/legacy-split-control-plane-2026-07-13/manage-services.sh"
EX_USAGE=64
SECRET_TEMP_FILE=''

usage() {
  cat <<'USAGE'
Usage: ./manage-services.sh <command>

Public commands:
  setup                  Install frozen workspace dependencies and prepare local state.
  start                  Build and start the Core-first development stack.
  stop                   Stop the Core-first stack without deleting data or secrets.
  status                 Show container status for the Core-first stack.
  logs [service]         Show the latest logs for the stack or one service.
  config                 Validate Compose and list the authoritative services.
  smoke                  Run the isolated Core-first end-to-end smoke test.
  quality                Run the fail-closed repository quality gate.
  reset --confirm        Remove local containers, volumes, and orphans; preserve secrets.
  legacy:<command>       Observe an archived split-control-plane command explicitly.

Site: http://127.0.0.1:8080
Fake email: http://127.0.0.1:8025
Compose project: mywebdrive-core-dev
Prerequisite: Docker Compose 2.24.4 or newer

Unprefixed split-service lifecycle commands are SOFT-RETIRED and never start
the archived stack.
USAGE
}

usage_error() {
  printf '%s\n' "$1" >&2
  printf 'Use "./manage-services.sh help" for the supported Core-first interface.\n' >&2
  exit "$EX_USAGE"
}

cleanup_secret_temp() {
  local temp_file=$SECRET_TEMP_FILE
  SECRET_TEMP_FILE=''
  if [[ -n "$temp_file" ]]; then rm -f -- "$temp_file"; fi
}

exit_after_secret_cleanup() {
  local status=$1
  cleanup_secret_temp
  exit "$status"
}

trap cleanup_secret_temp EXIT
trap 'exit_after_secret_cleanup 129' HUP
trap 'exit_after_secret_cleanup 130' INT
trap 'exit_after_secret_cleanup 143' TERM

require_no_args() {
  local command=$1
  shift
  (( $# == 0 )) || usage_error "$command does not accept additional arguments."
}

require_compose_version() {
  local version major minor patch
  if ! version=$(docker compose version --short 2>/dev/null); then
    usage_error 'Docker Compose 2.24.4 or newer is required.'
  fi
  if [[ ! $version =~ ^v?([0-9]+)\.([0-9]+)\.([0-9]+) ]]; then
    usage_error "Could not parse Docker Compose version '$version'; 2.24.4 or newer is required."
  fi
  major=${BASH_REMATCH[1]}
  minor=${BASH_REMATCH[2]}
  patch=${BASH_REMATCH[3]}
  if (( major < 2 || (major == 2 && minor < 24) || (major == 2 && minor == 24 && patch < 4) )); then
    usage_error "Docker Compose 2.24.4 or newer is required; found $version."
  fi
}

random_secret() {
  node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))"
}

path_owner() {
  stat -f '%u' "$1" 2>/dev/null || stat -c '%u' "$1"
}

path_link_count() {
  stat -f '%l' "$1" 2>/dev/null || stat -c '%h' "$1"
}

ensure_state_dir() {
  local owner
  if [[ -L "$STATE_DIR" ]]; then
    usage_error "Local state directory must not be a symbolic link: $STATE_DIR"
  fi
  if [[ -e "$STATE_DIR" && ! -d "$STATE_DIR" ]]; then
    usage_error "Local state path is not a directory: $STATE_DIR"
  fi
  if [[ ! -e "$STATE_DIR" ]]; then
    umask 077
    mkdir -p "$STATE_DIR"
  fi
  owner=$(path_owner "$STATE_DIR") || usage_error "Could not inspect local state directory ownership: $STATE_DIR"
  [[ "$owner" == "$(id -u)" ]] || usage_error "Local state directory is not owned by the current user: $STATE_DIR"
  chmod 700 "$STATE_DIR"
}

validate_local_env() {
  local key owner links
  if [[ -L "$ENV_FILE" ]]; then
    usage_error "Local environment must not be a symbolic link: $ENV_FILE"
  fi
  [[ -e "$ENV_FILE" ]] || usage_error "Local environment is missing: $ENV_FILE"
  [[ -f "$ENV_FILE" ]] || usage_error "Local environment is not a regular file: $ENV_FILE"
  owner=$(path_owner "$ENV_FILE") || usage_error "Could not inspect local environment ownership: $ENV_FILE"
  [[ "$owner" == "$(id -u)" ]] || usage_error "Local environment is not owned by the current user: $ENV_FILE"
  links=$(path_link_count "$ENV_FILE") || usage_error "Could not inspect local environment link count: $ENV_FILE"
  [[ "$links" == 1 ]] || usage_error "Local environment must have exactly one hard link: $ENV_FILE"
  chmod 600 "$ENV_FILE"
  [[ -s "$ENV_FILE" ]] || usage_error "Local environment is incomplete: $ENV_FILE"
  for key in \
    POSTGRES_PASSWORD REDIS_PASSWORD MINIO_ROOT_USER MINIO_ROOT_PASSWORD \
    CORE_DATABASE_URL REDIS_URL CORE_SESSION_SECRET OTP_PEPPER \
    STORAGE_GRANT_SECRET CORE_CALLBACK_SECRET EMAIL_PROVIDER_TOKEN \
    REGISTRY IMAGE_TAG; do
    grep -q "^${key}=" "$ENV_FILE" || usage_error "Local environment is missing $key: $ENV_FILE"
  done
}

ensure_local_env() {
  ensure_state_dir
  if [[ -e "$ENV_FILE" || -L "$ENV_FILE" ]]; then
    validate_local_env
    return
  fi

  umask 077

  local postgres_password redis_password minio_password
  local session_secret otp_pepper storage_secret callback_secret email_token
  postgres_password=$(random_secret)
  redis_password=$(random_secret)
  minio_password=$(random_secret)
  session_secret=$(random_secret)
  otp_pepper=$(random_secret)
  storage_secret=$(random_secret)
  callback_secret=$(random_secret)
  email_token=$(random_secret)
  SECRET_TEMP_FILE=$(mktemp "$STATE_DIR/.core-dev.env.XXXXXX")

  {
    printf 'POSTGRES_PASSWORD=%s\n' "$postgres_password"
    printf 'REDIS_PASSWORD=%s\n' "$redis_password"
    printf 'MINIO_ROOT_USER=mywebdrive\n'
    printf 'MINIO_ROOT_PASSWORD=%s\n' "$minio_password"
    printf 'MINIO_BUCKET=mywebdrive\n'
    printf 'CORE_DATABASE_URL=postgresql://mywebdrive:%s@postgres:5432/mywebdrive_core?schema=public\n' "$postgres_password"
    printf 'REDIS_URL=redis://:%s@redis:6379/0\n' "$redis_password"
    printf 'CORE_SESSION_SECRET=%s\n' "$session_secret"
    printf 'OTP_PEPPER=%s\n' "$otp_pepper"
    printf 'STORAGE_GRANT_SECRET=%s\n' "$storage_secret"
    printf 'CORE_CALLBACK_SECRET=%s\n' "$callback_secret"
    printf 'EMAIL_PROVIDER_TOKEN=%s\n' "$email_token"
    printf 'DEFAULT_USER_QUOTA_BYTES=10737418240\n'
    printf 'CORE_ADMIN_EMAILS=dev-admin@example.test\n'
    printf 'REGISTRY=local.invalid\n'
    printf 'IMAGE_TAG=local-dev\n'
    printf 'GIT_SHA=local-dev\n'
    printf 'HTTP_PORT=8080\n'
  } >"$SECRET_TEMP_FILE"
  chmod 600 "$SECRET_TEMP_FILE"

  if ! ln "$SECRET_TEMP_FILE" "$ENV_FILE" 2>/dev/null; then
    cleanup_secret_temp
    validate_local_env
    return
  fi
  cleanup_secret_temp
  validate_local_env
}

compose() {
  docker compose \
    --env-file "$ENV_FILE" \
    --project-name "$PROJECT_NAME" \
    -f "$BASE_COMPOSE" \
    -f "$DEV_COMPOSE" \
    "$@"
}

validate_logs_service() {
  local service=$1 services
  services=$(compose config --services)
  grep -Fxq -- "$service" <<<"$services" || usage_error "logs service is not defined in the Core-first topology: $service"
}

command=${1:-help}
if (( $# > 0 )); then shift; fi

case "$command" in
  help|-h|--help)
    require_no_args "$command" "$@"
    usage
    ;;
  setup)
    require_no_args "$command" "$@"
    ensure_local_env
    cd "$ROOT_DIR"
    exec corepack pnpm install --frozen-lockfile
    ;;
  start)
    require_no_args "$command" "$@"
    require_compose_version
    ensure_local_env
    compose up --detach --build --remove-orphans --wait
    printf 'Core-first development stack is ready at http://127.0.0.1:8080\n'
    ;;
  stop)
    require_no_args "$command" "$@"
    require_compose_version
    ensure_local_env
    compose stop
    ;;
  status)
    require_no_args "$command" "$@"
    require_compose_version
    ensure_local_env
    compose ps
    ;;
  logs)
    (( $# <= 1 )) || usage_error 'logs accepts at most one service name.'
    if (( $# == 1 )); then [[ "$1" != -* ]] || usage_error "logs service must not begin with '-': $1"; fi
    require_compose_version
    ensure_local_env
    if (( $# == 1 )); then
      validate_logs_service "$1"
      compose logs --tail 200 -- "$1"
    else
      compose logs --tail 200
    fi
    ;;
  config)
    require_no_args "$command" "$@"
    require_compose_version
    ensure_local_env
    compose config --quiet
    compose config --services
    ;;
  smoke)
    require_no_args "$command" "$@"
    exec bash "$ROOT_DIR/scripts/smoke-core-e2e.sh"
    ;;
  quality)
    require_no_args "$command" "$@"
    exec make -C "$ROOT_DIR" quality-check
    ;;
  reset)
    [[ ${1:-} == '--confirm' && $# -eq 1 ]] || usage_error 'Destructive reset requires: ./manage-services.sh reset --confirm'
    require_compose_version
    ensure_local_env
    compose down --volumes --remove-orphans
    ;;
  legacy:*)
    legacy_command=${command#legacy:}
    [[ -n "$legacy_command" ]] || usage_error 'legacy:<command> requires an archived command name.'
    [[ -x "$LEGACY_MANAGER" ]] || usage_error "Archived manager is unavailable: $LEGACY_MANAGER"
    printf 'WARNING: legacy:%s is for a time-boxed observation cycle only; it is not an active workflow.\n' "$legacy_command" >&2
    cd "$(dirname "$LEGACY_MANAGER")"
    exec "$LEGACY_MANAGER" "$legacy_command" "$@"
    ;;
  *)
    printf 'SOFT-RETIRED: manage-services.sh %s is not an active Core-first command.\n' "$command" >&2
    printf 'Use "./manage-services.sh start" for the supported local stack.\n' >&2
    printf 'Use "./manage-services.sh legacy:%s" only for an explicit observation cycle.\n' "$command" >&2
    exit "$EX_USAGE"
    ;;
esac
