#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR=${VERIFY_TRACKED_ARTIFACTS_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}

git -C "$ROOT_DIR" rev-parse --is-inside-work-tree >/dev/null

forbidden=$(git -C "$ROOT_DIR" ls-files | grep -E \
  '(^|/)dist(/|$)|(^|/)\.next(/|$)|\.tsbuildinfo$|(^|/)\.?prisma/(client|generated)(/|$)|(^|/)generated/prisma(/|$)|(^|/)(libquery_engine|query_engine|schema-engine|migration-engine)[^/]*(\.node|\.dylib|\.so|\.dll|\.exe)$|\.pid$|(^|/)(apps|frontend)(/[^/]*)*/package-lock\.json$' || true)

if [[ -n "$forbidden" ]]; then
  printf 'tracked generated artifacts are forbidden:\n%s\n' "$forbidden" >&2
  exit 1
fi

printf 'tracked generated artifacts: none\n'
