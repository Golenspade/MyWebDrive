#!/usr/bin/env bash
set -Eeuo pipefail

# Build all Go backend modules using a local HTTP/SOCKS proxy and local workspace modules
# - Assumes workspace go.work at repo root already includes backend/pkg/* and services
# - Injects temporary `replace` entries for internal modules to avoid any network lookup
# - Restores go.mod (drops replaces) after each build step

HTTP_PROXY_HOST="127.0.0.1"
HTTP_PROXY_PORT="${HTTP_PROXY_PORT:-7890}"
SOCKS_PROXY_PORT="${SOCKS_PROXY_PORT:-7891}"

export HTTP_PROXY="http://${HTTP_PROXY_HOST}:${HTTP_PROXY_PORT}"
export HTTPS_PROXY="http://${HTTP_PROXY_HOST}:${HTTP_PROXY_PORT}"
export ALL_PROXY="socks5://${HTTP_PROXY_HOST}:${SOCKS_PROXY_PORT}"
export NO_PROXY="127.0.0.1,localhost"
# Use public proxy (mirror) then direct; allow override via env GOPROXY
export GOPROXY="${GOPROXY:-https://goproxy.cn,direct,https://proxy.golang.org}"
# Mark internal modules as private to avoid checksum DB/proxy lookups
export GOPRIVATE="mywebdrive.local"
export GONOSUMDB="mywebdrive.local"

# Quick context
echo "HTTP_PROXY=$HTTP_PROXY"
echo "ALL_PROXY=$ALL_PROXY"
command -v go >/dev/null 2>&1 || { echo "Go toolchain not found in PATH"; exit 1; }
echo "Go: $(go version)"

# Ensure go.work is active
if [[ ! -f go.work ]]; then
  echo "ERROR: go.work not found at repo root"; exit 1
fi

# Helpers
inject_replaces() {
  # $1 = module dir (e.g., backend/api-gateway)
  ( cd "$1" && \
    go mod edit -replace mywebdrive.local/pkg/config=../pkg/config && \
    go mod edit -replace mywebdrive.local/pkg/database=../pkg/database && \
    go mod edit -replace mywebdrive.local/pkg/metrics=../pkg/metrics && \
    go mod edit -replace mywebdrive/common=../common )
}

drop_replaces() {
  # $1 = module dir
  ( cd "$1" && \
    go mod edit -dropreplace mywebdrive.local/pkg/config || true && \
    go mod edit -dropreplace mywebdrive.local/pkg/database || true && \
    go mod edit -dropreplace mywebdrive.local/pkg/metrics || true && \
    go mod edit -dropreplace mywebdrive/common || true )
}

build_module() {
  # $1 = dir
  echo "\n== Tidy & Build: $1 =="
  ( cd "$1" && go mod tidy && go build ./... )
}

build_service() {
  # $1 = service dir
  echo "\n== Service: $1 =="
  inject_replaces "$1"
  trap 'drop_replaces "$1"' RETURN
  ( cd "$1" && go mod tidy && go build ./... )
  drop_replaces "$1"  # also drop on success
}

# Build internal pkg modules first (should not need replaces)
for pkg in backend/pkg/config backend/pkg/database backend/pkg/metrics backend/common; do
  build_module "$pkg"
done

# Build services with temporary replaces to ensure no network path is required
services=( \
  backend/api-gateway \
  backend/auth-service \
  backend/user-service \
  backend/storage-service \
  backend/metadata-service \
  backend/sharing-service \
)

for svc in "${services[@]}"; do
  build_service "$svc"
done

echo "\nAll modules built successfully via proxy and local replaces."
