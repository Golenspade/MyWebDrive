#!/usr/bin/env bash
set -euo pipefail

# One-off builder for Node workspace (packages/* + services/*)
# - Installs dependencies with PNPM in isolated linker mode (local node_modules per project)
# - Builds shared packages
# - Generates Prisma clients and builds services
# - Applies SQLite schema best-effort (migrate deploy, fallback to db push)
#
# Requirements on target host:
# - Docker available (this script runs inside a Node 20 container)
# - Repo mounted at $REMOTE_DIR (when invoked remotely)

# Allow overriding registry
NPM_REGISTRY_URL=${NPM_REGISTRY_URL:-https://registry.npmmirror.com}
PNPM_VERSION=${PNPM_VERSION:-9.7.0}

run_builder() {
  docker run --rm \
    -e PNPM_NODE_LINKER=isolated \
    -e PNPM_HOME=/usr/local/share/pnpm \
    -v "$(pwd)":/workspace \
    -w /workspace \
    node:20-bullseye \
    sh -lc "set -e; \
      npm config set registry ${NPM_REGISTRY_URL} && npm i -g pnpm@${PNPM_VERSION} && \
      export PNPM_NODE_LINKER=isolated PNPM_STORE_DIR=/workspace/.pnpm-store; \
      echo '[1/4] Install + build shared packages'; \
      pnpm --dir ./packages/common install && pnpm --dir ./packages/common run build; \
      pnpm --dir ./packages/observability install && pnpm --dir ./packages/observability run build; \
      echo '[2/4] Install services'; \
      pnpm --dir ./services/auth install; \
      pnpm --dir ./services/user install; \
      pnpm --dir ./services/metadata install; \
      pnpm --dir ./services/storage install; \
      pnpm --dir ./services/sharing install; \
      echo '[3/4] Prisma generate for all services'; \
      (cd services/auth && DATABASE_URL='file:./services/auth/prisma/auth.db' pnpm run prisma:generate) && \
      (cd services/user && DATABASE_URL='file:./services/user/prisma/user.db' pnpm run prisma:generate) && \
      (cd services/metadata && METADATA_DATABASE_URL='file:./services/metadata/prisma/metadata.db' pnpm run prisma:generate) && \
      (cd services/storage && STORAGE_DATABASE_URL='file:./services/storage/prisma/storage.db' pnpm run prisma:generate) && \
      (cd services/sharing && SHARING_DATABASE_URL='file:./services/sharing/prisma/sharing.db' pnpm run prisma:generate) && \
      echo '[4/4] Build services'; \
      pnpm --dir ./services/auth run build; \
      pnpm --dir ./services/user run build; \
      pnpm --dir ./services/metadata run build; \
      pnpm --dir ./services/storage run build; \
      pnpm --dir ./services/sharing run build; \
      echo '[Post] Best-effort SQLite schema apply'; \
      (cd services/auth && DATABASE_URL='file:./services/auth/prisma/auth.db' pnpm run migrate:deploy || pnpm run db:push || true); \
      (cd services/user && DATABASE_URL='file:./services/user/prisma/user.db' pnpm run migrate:deploy || pnpm run db:push || true); \
      (cd services/metadata && METADATA_DATABASE_URL='file:./services/metadata/prisma/metadata.db' pnpm run migrate:deploy || pnpm run db:push || true); \
      (cd services/storage && STORAGE_DATABASE_URL='file:./services/storage/prisma/storage.db' pnpm run migrate:deploy || pnpm run db:push || true); \
      (cd services/sharing && SHARING_DATABASE_URL='file:./services/sharing/prisma/sharing.db' pnpm run migrate:deploy || pnpm run db:push || true); \
      echo 'Build completed.'"
}

run_builder

