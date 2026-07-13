#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR=${VERIFY_TRACKED_ARTIFACTS_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}

git -C "$ROOT_DIR" rev-parse --is-inside-work-tree >/dev/null

if ! tracked_files=$(git -C "$ROOT_DIR" ls-files); then
  printf 'unable to inspect Git index for generated artifacts\n' >&2
  exit 2
fi

forbidden_pattern='(^|/)dist(/|$)|(^|/)\.next(/|$)|\.tsbuildinfo$|(^|/)\.?prisma/(client|generated)(/|$)|(^|/)generated/prisma(/|$)|(^|/)(libquery_engine|query_engine|query-engine|schema-engine|migration-engine|introspection-engine)[^/]*(\.node|\.dylib|\.so|\.dll|\.exe)$|(^|/)(query-engine|schema-engine|migration-engine|introspection-engine|prisma-fmt)-[^/]+$|\.pid$|(^|/)(apps|frontend)(/[^/]*)*/package-lock\.json$'
grep_status=0
forbidden=$(printf '%s\n' "$tracked_files" | grep -E "$forbidden_pattern") || grep_status=$?
if (( grep_status > 1 )); then
  printf 'unable to evaluate generated artifact policy\n' >&2
  exit 2
fi

if [[ -n "$forbidden" ]]; then
  printf 'tracked generated artifacts are forbidden:\n%s\n' "$forbidden" >&2
  exit 1
fi

printf 'tracked generated artifacts: none\n'
