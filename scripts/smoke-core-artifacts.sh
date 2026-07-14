#!/usr/bin/env bash

smoke_copy_safe_playwright_report() {
  local source=$1 destination=$2 verifier=$3
  local report="$source/results.json"
  local temporary="$destination/.results.json.$$"
  [[ -f "$report" && ! -L "$report" ]] || return 0
  mkdir -p "$destination"
  if node "$verifier" redact-json < "$report" > "$temporary"; then
    mv "$temporary" "$destination/results.json"
    return 0
  fi
  rm -f "$temporary"
  rmdir "$destination" 2>/dev/null || true
  printf 'core smoke warning: invalid Playwright JSON report omitted\n' >&2
  return 0
}
