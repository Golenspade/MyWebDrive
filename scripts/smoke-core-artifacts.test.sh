#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
FIXTURES=$(mktemp -d "${TMPDIR:-/tmp}/mywebdrive-smoke-artifacts.XXXXXX")
TEST_COMPLETED=0
cleanup() {
  local exit_code=$?
  trap - EXIT
  if [[ "$TEST_COMPLETED" != 1 && "$exit_code" == 0 ]]; then exit_code=1; fi
  rm -rf "$FIXTURES"
  exit "$exit_code"
}
trap cleanup EXIT

source "$ROOT_DIR/scripts/smoke-core-artifacts.sh"

SOURCE_DIR="$FIXTURES/source"
DESTINATION="$FIXTURES/destination"
mkdir -p "$SOURCE_DIR"
printf '%s\n' '{"status":"failed","errors":[{"message":"safe diagnostic: Authorization: Bearer reviewer.secret.token"}],"accessToken":"secret-access"}' > "$SOURCE_DIR/results.json"
smoke_copy_safe_playwright_report "$SOURCE_DIR" "$DESTINATION" "$ROOT_DIR/scripts/verify-smoke-artifacts.mjs"
node -e '
const fs = require("node:fs")
const value = JSON.parse(fs.readFileSync(process.argv[1], "utf8"))
if (value.status !== "failed") process.exit(1)
if (!value.errors[0].message.includes("safe diagnostic:")) process.exit(1)
if (JSON.stringify(value).includes("reviewer.secret.token")) process.exit(1)
if (JSON.stringify(value).includes("secret-access")) process.exit(1)
' "$DESTINATION/results.json"

rm -rf "$DESTINATION"
printf '%s\n' '{"status":' > "$SOURCE_DIR/results.json"
smoke_copy_safe_playwright_report "$SOURCE_DIR" "$DESTINATION" "$ROOT_DIR/scripts/verify-smoke-artifacts.mjs"
if [[ -e "$DESTINATION/results.json" ]]; then
  printf 'invalid Playwright JSON was retained for upload\n' >&2
  exit 1
fi

printf 'smoke artifact copy contracts: ok\n'
TEST_COMPLETED=1
