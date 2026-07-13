#!/usr/bin/env bash
set -Eeuo pipefail

printf '%s\n' 'WARNING: split-control-plane tests are SOFT-RETIRED and excluded from default quality gates.' >&2

pnpm --if-present \
  --filter './services/auth' \
  --filter './services/user' \
  --filter './services/metadata' \
  --filter './services/sharing' \
  --filter './services/api-gateway-node' \
  run prisma:generate

exec pnpm --if-present \
  --filter './services/auth' \
  --filter './services/user' \
  --filter './services/metadata' \
  --filter './services/sharing' \
  --filter './services/api-gateway-node' \
  run test:legacy "$@"
