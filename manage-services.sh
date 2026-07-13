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

Unprefixed split-service lifecycle commands are SOFT-RETIRED and never start
the archived stack.
USAGE
}

usage_error() {
  printf '%s\n' "$1" >&2
  printf 'Use "./manage-services.sh help" for the supported Core-first interface.\n' >&2
  exit "$EX_USAGE"
}

require_no_args() {
  local command=$1
  shift
  (( $# == 0 )) || usage_error "$command does not accept additional arguments."
}

random_secret() {
  node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))"
}

validate_local_env() {
  local key
  [[ -s "$ENV_FILE" ]] || usage_error "Local environment is incomplete: $ENV_FILE"
  for key in \
    POSTGRES_PASSWORD REDIS_PASSWORD MINIO_ROOT_USER MINIO_ROOT_PASSWORD \
    CORE_DATABASE_URL REDIS_URL CORE_SESSION_SECRET OTP_PEPPER \
    STORAGE_GRANT_SECRET CORE_CALLBACK_SECRET EMAIL_PROVIDER_TOKEN \
    REGISTRY IMAGE_TAG; do
    grep -q "^${key}=" "$ENV_FILE" || usage_error "Local environment is missing $key: $ENV_FILE"
  done
  chmod 600 "$ENV_FILE"
}

ensure_local_env() {
  if [[ -e "$ENV_FILE" ]]; then
    validate_local_env
    return
  fi

  umask 077
  mkdir -p "$STATE_DIR"

  local postgres_password redis_password minio_password
  local session_secret otp_pepper storage_secret callback_secret email_token temp_file
  postgres_password=$(random_secret)
  redis_password=$(random_secret)
  minio_password=$(random_secret)
  session_secret=$(random_secret)
  otp_pepper=$(random_secret)
  storage_secret=$(random_secret)
  callback_secret=$(random_secret)
  email_token=$(random_secret)
  temp_file=$(mktemp "$STATE_DIR/.core-dev.env.XXXXXX")

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
  } >"$temp_file"
  chmod 600 "$temp_file"

  if ln "$temp_file" "$ENV_FILE" 2>/dev/null; then
    rm -f "$temp_file"
  else
    rm -f "$temp_file"
  fi
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
    ensure_local_env
    compose up --detach --build --remove-orphans --wait
    printf 'Core-first development stack is ready at http://127.0.0.1:8080\n'
    ;;
  stop)
    require_no_args "$command" "$@"
    ensure_local_env
    compose stop
    ;;
  status)
    require_no_args "$command" "$@"
    ensure_local_env
    compose ps
    ;;
  logs)
    (( $# <= 1 )) || usage_error 'logs accepts at most one service name.'
    ensure_local_env
    compose logs --tail 200 "$@"
    ;;
  config)
    require_no_args "$command" "$@"
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
