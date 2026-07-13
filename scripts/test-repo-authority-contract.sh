#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
MANAGER="$ROOT_DIR/manage-services.sh"
ACTIVE_DOCS=(
  "$ROOT_DIR/AGENTS.md"
  "$ROOT_DIR/CLAUDE.md"
  "$ROOT_DIR/README.md"
  "$ROOT_DIR/infrastructure/alicloud/ALIYUN_DEPLOY_GUIDE.md"
)
WORKFLOW_DOCS=(
  "$ROOT_DIR/AGENTS.md"
  "$ROOT_DIR/CLAUDE.md"
  "$ROOT_DIR/README.md"
)
SHIM_FIXTURES=$(mktemp -d)
trap 'rm -rf "$SHIM_FIXTURES"' EXIT
failures=0

record_failure() {
  printf 'repository authority contract failed: %s\n' "$1" >&2
  failures=$((failures + 1))
}

require_text() {
  local file=$1 text=$2 label=$3
  if ! grep -Fq -- "$text" "$file"; then
    record_failure "$label is missing '$text'"
  fi
}

reject_pattern() {
  local file=$1 pattern=$2 label=$3 matches
  if matches=$(grep -En -- "$pattern" "$file"); then
    printf '%s\n' "$matches" >&2
    record_failure "$label still advertises a retired workflow"
  fi
}

if [[ ! -f "$MANAGER" ]]; then
  record_failure 'manage-services.sh Core-first manager is missing'
elif [[ ! -x "$MANAGER" ]]; then
  record_failure 'manage-services.sh Core-first manager is not executable'
else
  help_output=$("$MANAGER" help 2>&1) || record_failure 'manage-services.sh help must succeed'
  if [[ ${help_output:-} != *quality* || ${help_output:-} != *smoke* ]]; then
    record_failure 'manage-services.sh help must list quality and smoke'
  fi
  default_output=$("$MANAGER" 2>&1) || record_failure 'manage-services.sh default help must succeed'
  if [[ ${default_output:-} != *quality* || ${default_output:-} != *smoke* ]]; then
    record_failure 'manage-services.sh default help must list quality and smoke'
  fi

  mkdir -p "$SHIM_FIXTURES/bin"
  cat > "$SHIM_FIXTURES/bin/make" <<'STUB'
#!/bin/sh
printf '%s\n' make "$@" > "$SHIM_LOG"
STUB
  cat > "$SHIM_FIXTURES/bin/bash" <<'STUB'
#!/bin/sh
printf '%s\n' bash "$@" > "$SHIM_LOG"
STUB
  chmod +x "$SHIM_FIXTURES/bin/make" "$SHIM_FIXTURES/bin/bash"

  quality_log="$SHIM_FIXTURES/quality.log"
  if ! PATH="$SHIM_FIXTURES/bin:$PATH" SHIM_LOG="$quality_log" /bin/bash "$MANAGER" quality; then
    record_failure 'manage-services.sh quality must forward successfully'
  elif [[ $(<"$quality_log") != $'make\n-C\n'"$ROOT_DIR"$'\nquality-check' ]]; then
    record_failure 'manage-services.sh quality must forward exactly to the root quality gate'
  fi

  smoke_log="$SHIM_FIXTURES/smoke.log"
  if ! PATH="$SHIM_FIXTURES/bin:$PATH" SHIM_LOG="$smoke_log" /bin/bash "$MANAGER" smoke; then
    record_failure 'manage-services.sh smoke must forward successfully'
  elif [[ $(<"$smoke_log") != $'bash\n'"$ROOT_DIR/scripts/smoke-core-e2e.sh" ]]; then
    record_failure 'manage-services.sh smoke must forward exactly to the Core smoke'
  fi

  for retired_command in start-backend start-frontend start-frontend-prod start-next db:start restart; do
    set +e
    retired_output=$("$MANAGER" "$retired_command" 2>&1)
    retired_status=$?
    set -e
    if (( retired_status != 64 )); then
      record_failure "manage-services.sh $retired_command must exit 64"
    fi
    if [[ $retired_output != *SOFT-RETIRED* ]]; then
      record_failure "manage-services.sh $retired_command must warn SOFT-RETIRED"
    fi
  done

  require_text "$MANAGER" 'make -C "$ROOT_DIR" quality-check' 'manage-services.sh quality forwarding'
  require_text "$MANAGER" 'scripts/smoke-core-e2e.sh' 'manage-services.sh smoke forwarding'
  reject_pattern "$MANAGER" 'services/(auth|user|metadata|sharing|api-gateway-node)|docker-compose\.(production|node|images|alicloud)\.yml' 'manage-services.sh'
fi

retired_command_pattern='\./manage-services\.sh (install|build|db:[^[:space:]`]+|restart|start-(backend|frontend|frontend-prod|next)|stop-(backend|frontend)|env:[^[:space:]`]+)'
retired_service_pattern='(pnpm|corepack pnpm)[^`]*(services/(auth|user|metadata|sharing|api-gateway-node)|--filter[^`]*(auth|user|metadata|sharing|api-gateway-node))'
retired_script_pattern='(scripts/)?(start-backend-dev|start-frontend-dev|quick-deploy|deploy-to-server|build-all-node|test_guest_download|test_invitation_system|test_invitation_flow|test_publish_api)\.sh'
retired_compose_pattern='docker-compose\.(production|node|images|alicloud)\.yml|infrastructure/alicloud/(remote-deploy|prod-diagnose|deploy-production)\.sh'

for doc in "${ACTIVE_DOCS[@]}"; do
  if [[ ! -f "$doc" ]]; then
    record_failure "active authority document is missing: ${doc#"$ROOT_DIR/"}"
    continue
  fi
  reject_pattern "$doc" "$retired_command_pattern" "${doc#"$ROOT_DIR/"}"
  reject_pattern "$doc" "$retired_service_pattern" "${doc#"$ROOT_DIR/"}"
  reject_pattern "$doc" "$retired_script_pattern" "${doc#"$ROOT_DIR/"}"
  reject_pattern "$doc" "$retired_compose_pattern" "${doc#"$ROOT_DIR/"}"
done

for doc in "${WORKFLOW_DOCS[@]}"; do
  require_text "$doc" './manage-services.sh quality' "${doc#"$ROOT_DIR/"}"
  require_text "$doc" './manage-services.sh smoke' "${doc#"$ROOT_DIR/"}"
  require_text "$doc" 'SOFT-RETIRED' "${doc#"$ROOT_DIR/"}"
done

deploy_guide="$ROOT_DIR/infrastructure/alicloud/ALIYUN_DEPLOY_GUIDE.md"
require_text "$deploy_guide" 'docker-compose.core.yml' 'Aliyun deployment guide'
require_text "$deploy_guide" 'infrastructure/alicloud/deploy.sh' 'Aliyun deployment guide'
require_text "$deploy_guide" 'infrastructure/alicloud/rollback.sh' 'Aliyun deployment guide'
require_text "$deploy_guide" 'scripts/smoke-core-e2e.sh' 'Aliyun deployment guide'

if (( failures > 0 )); then
  printf 'repository authority contract failures: %d\n' "$failures" >&2
  exit 1
fi

printf 'repository authority contract tests: ok\n'
