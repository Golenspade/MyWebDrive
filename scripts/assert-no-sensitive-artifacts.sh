#!/usr/bin/env bash
set -euo pipefail

forbidden="$(git ls-files | rg '(^|/)([^/]+\.(db|sqlite|sqlite3)|\.env)$' || true)"

if [[ -n "$forbidden" ]]; then
  printf '%s\n' 'Tracked runtime data or environment files are forbidden:' >&2
  printf '%s\n' "$forbidden" >&2
  exit 1
fi
