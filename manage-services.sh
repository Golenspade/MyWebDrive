#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
BASE_COMPOSE="$ROOT_DIR/infrastructure/alicloud/docker-compose.core.yml"
DEV_COMPOSE="$ROOT_DIR/infrastructure/docker-compose.core-dev.yml"
PROJECT_NAME=mywebdrive-core-dev
STATE_DIR="$ROOT_DIR/.state"
ENV_FILE="$STATE_DIR/core-dev.env"
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
  legacy:help            Show the strict legacy observation-only interface.
  legacy:status          Inspect the former local listener sockets without starting anything.

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

recover_local_env_temp_links() {
  local candidate links
  for candidate in "$STATE_DIR"/.core-dev.env.*; do
    [[ -e "$candidate" && ! -L "$candidate" && -f "$candidate" ]] || continue
    [[ "$candidate" -ef "$ENV_FILE" ]] || continue
    rm -f -- "$candidate" || return 1
  done
  links=$(path_link_count "$ENV_FILE") || return 1
  [[ "$links" == 1 ]]
}

wait_for_single_local_env_link() {
  local attempt links
  for attempt in 1 2 3 4 5; do
    links=$(path_link_count "$ENV_FILE") || return 1
    [[ "$links" == 1 ]] && return 0
    sleep 0.05
  done
  recover_local_env_temp_links
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
  local key owner
  if [[ -L "$ENV_FILE" ]]; then
    usage_error "Local environment must not be a symbolic link: $ENV_FILE"
  fi
  [[ -e "$ENV_FILE" ]] || usage_error "Local environment is missing: $ENV_FILE"
  [[ -f "$ENV_FILE" ]] || usage_error "Local environment is not a regular file: $ENV_FILE"
  owner=$(path_owner "$ENV_FILE") || usage_error "Could not inspect local environment ownership: $ENV_FILE"
  [[ "$owner" == "$(id -u)" ]] || usage_error "Local environment is not owned by the current user: $ENV_FILE"
  wait_for_single_local_env_link || usage_error "Local environment must have exactly one hard link: $ENV_FILE"
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
  env \
    -u POSTGRES_PASSWORD \
    -u REDIS_PASSWORD \
    -u MINIO_ROOT_USER \
    -u MINIO_ROOT_PASSWORD \
    -u MINIO_BUCKET \
    -u CORE_DATABASE_URL \
    -u REDIS_URL \
    -u CORE_SESSION_SECRET \
    -u OTP_PEPPER \
    -u STORAGE_GRANT_SECRET \
    -u CORE_CALLBACK_SECRET \
    -u EMAIL_PROVIDER_TOKEN \
    -u DEFAULT_USER_QUOTA_BYTES \
    -u CORE_ADMIN_EMAILS \
    -u REGISTRY \
    -u IMAGE_TAG \
    -u GIT_SHA \
    -u HTTP_PORT \
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

legacy_warning() {
  printf 'SOFT-RETIRED: legacy:%s is observation-only and never invokes the archived manager.\n' "$1" >&2
}

legacy_usage() {
  cat <<'USAGE'
Legacy observation-only commands:
  legacy:help            Show this whitelist.
  legacy:status          Inspect the former local listener sockets.

All lifecycle, build, generate, deploy, reset, database, and unknown legacy
commands are blocked with exit code 64.
USAGE
}

legacy_status() {
  local name port pid
  printf 'Legacy split-control-plane socket observation (no processes are started):\n'
  while read -r name port; do
    pid=''
    if command -v lsof >/dev/null 2>&1; then
      pid=$(lsof -nP -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)
    fi
    if [[ -n "$pid" ]]; then
      printf '%-12s 127.0.0.1:%s LISTEN pid=%s\n' "$name" "$port" "$pid"
    else
      printf '%-12s 127.0.0.1:%s STOPPED\n' "$name" "$port"
    fi
  done <<'PORTS'
gateway 9080
auth 7081
user 7082
metadata 7083
storage 7084
sharing 7085
frontend 3100
PORTS
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
    case "$legacy_command" in
      help)
        require_no_args "$command" "$@"
        legacy_warning "$legacy_command"
        printf 'This observation cycle does not make the retired architecture active.\n' >&2
        legacy_usage
        ;;
      status)
        require_no_args "$command" "$@"
        legacy_warning "$legacy_command"
        legacy_status
        ;;
      *)
        legacy_warning "$legacy_command"
        printf 'Blocked legacy command. Allowed commands are legacy:help and legacy:status.\n' >&2
        exit "$EX_USAGE"
        ;;
    esac
    ;;
  *)
    printf 'SOFT-RETIRED: manage-services.sh %s is not an active Core-first command.\n' "$command" >&2
    printf 'Use "./manage-services.sh start" for the supported local stack.\n' >&2
    printf 'Use "./manage-services.sh legacy:help" to view the observation-only whitelist.\n' >&2
    exit "$EX_USAGE"
    ;;
esac
