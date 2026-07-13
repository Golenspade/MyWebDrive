#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
command=${1:-help}

usage() {
  cat <<'USAGE'
Usage: ./manage-services.sh <command>

Supported commands:
  help      Show this help.
  quality   Run the fail-closed Core-first quality gate.
  smoke     Run the destructive, isolated Core end-to-end smoke test.

All former split-service lifecycle commands are SOFT-RETIRED. This shim never
starts the retired stack.
USAGE
}

case "$command" in
  help|-h|--help)
    usage
    ;;
  quality)
    exec make -C "$ROOT_DIR" quality-check
    ;;
  smoke)
    exec bash "$ROOT_DIR/scripts/smoke-core-e2e.sh"
    ;;
  *)
    printf 'SOFT-RETIRED: manage-services.sh %s is no longer an active workflow.\n' "$command" >&2
    printf 'Use "./manage-services.sh help" for the Core-first authority surface.\n' >&2
    exit 64
    ;;
esac
