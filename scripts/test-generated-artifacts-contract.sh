#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
VERIFIER="$ROOT_DIR/scripts/verify-no-generated-artifacts.sh"
FIXTURES=$(mktemp -d)
trap 'rm -rf "$FIXTURES"' EXIT

new_repo() {
  local name=$1 repo="$FIXTURES/$1"
  mkdir -p "$repo"
  git -C "$repo" init -q
  printf '%s\n' "$repo"
}

track() {
  local repo=$1 path=$2
  mkdir -p "$(dirname "$repo/$path")"
  printf 'fixture\n' > "$repo/$path"
  git -C "$repo" add -f -- "$path"
}

expect_rejected() {
  local label=$1 path=$2 repo output
  repo=$(new_repo "$label")
  track "$repo" "$path"
  if output=$(VERIFY_TRACKED_ARTIFACTS_ROOT="$repo" bash "$VERIFIER" 2>&1); then
    printf 'generated-artifact fixture unexpectedly passed: %s\n' "$label" >&2
    exit 1
  fi
  grep -Fq -- "$path" <<<"$output" || {
    printf 'rejection did not identify %s: %s\n' "$label" "$output" >&2
    exit 1
  }
  printf 'generated-artifact fixture rejected: %s\n' "$label"
}

clean_repo=$(new_repo clean)
track "$clean_repo" src/index.ts
track "$clean_repo" frontend/cruip-landing/pnpm-lock.yaml
VERIFY_TRACKED_ARTIFACTS_ROOT="$clean_repo" bash "$VERIFIER"

expect_rejected dist packages/common/dist/index.js
expect_rejected next frontend/cruip-landing/.next/server/app.js
expect_rejected tsbuildinfo packages/common/tsconfig.tsbuildinfo
expect_rejected prisma-client services/auth/prisma/client/index.js
expect_rejected prisma-dot-client services/core-api/.prisma/client/index.js
expect_rejected prisma-native services/core-api/prisma/query_engine-windows.dll.node
expect_rejected prisma-native-extensionless services/core-api/prisma/schema-engine-darwin-arm64
expect_rejected pid logs/core-api.pid
expect_rejected frontend-package-lock frontend/cruip-landing/package-lock.json

broken_index_repo=$(new_repo broken-index)
track "$broken_index_repo" src/index.ts
printf 'not a git index\n' > "$broken_index_repo/.git/index"
if output=$(VERIFY_TRACKED_ARTIFACTS_ROOT="$broken_index_repo" bash "$VERIFIER" 2>&1); then
  printf 'broken Git index unexpectedly reported success: %s\n' "$output" >&2
  exit 1
fi
grep -Fq 'unable to inspect Git index' <<<"$output" || {
  printf 'broken Git index failure was not explained: %s\n' "$output" >&2
  exit 1
}
if grep -Fq 'tracked generated artifacts: none' <<<"$output"; then
  printf 'broken Git index reported a false clean result\n' >&2
  exit 1
fi
printf 'generated-artifact fixture rejected: broken-git-index\n'

printf 'generated artifact contract tests: ok\n'
