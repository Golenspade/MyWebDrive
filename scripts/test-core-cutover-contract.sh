#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
NGINX_DIR="$ROOT_DIR/infrastructure/alicloud/nginx"
HOST_NGINX="$ROOT_DIR/infrastructure/alicloud/nginx-mywebdrive.conf"
COMPOSE="$ROOT_DIR/infrastructure/alicloud/docker-compose.core.yml"

fail() { printf 'cutover contract violation: %s\n' "$*" >&2; exit 1; }
require() { grep -Eq -- "$1" "$2" || fail "$3"; }
reject() { if grep -Eiq -- "$1" "$2"; then fail "$3"; fi; }

require 'trap .*on_error.*ERR' "$ROOT_DIR/scripts/smoke-core-e2e.sh" 'Core smoke must report silent command failures'

for file in "$NGINX_DIR/Dockerfile" "$NGINX_DIR/nginx.conf" "$HOST_NGINX" "$ROOT_DIR/frontend/cruip-landing/Dockerfile" "$ROOT_DIR/frontend/cruip-landing/next.config.js" "$ROOT_DIR/docs/runbooks/core-cutover-and-rollback.md" "$ROOT_DIR/scripts/smoke-core-e2e.sh"; do
  [[ -f "$file" ]] || fail "missing $file"
done

require 'listen[[:space:]]+8080' "$NGINX_DIR/nginx.conf" 'nginx must listen on 8080'
require 'location[[:space:]]*=[[:space:]]*/healthz' "$NGINX_DIR/nginx.conf" 'nginx health route missing'
require 'location.*\^~[[:space:]]+/api/v1/internal/' "$NGINX_DIR/nginx.conf" 'internal API must be blocked'
require 'location[[:space:]]*=[[:space:]]*/api/v1/internal[[:space:]]*\{' "$NGINX_DIR/nginx.conf" 'exact internal API root must be blocked'
require 'return[[:space:]]+404' "$NGINX_DIR/nginx.conf" 'internal API must return 404'
require 'proxy_pass[[:space:]]+http://storage-api:7084' "$NGINX_DIR/nginx.conf" 'storage route target is invalid'
require 'proxy_pass[[:space:]]+http://core-api:8080' "$NGINX_DIR/nginx.conf" 'Core route target is invalid'
require 'proxy_pass[[:space:]]+http://web:4323' "$NGINX_DIR/nginx.conf" 'web route target is invalid'
require 'log_format[[:space:]]+safe[[:space:]]+.*\$remote_addr[[:space:]]+\$request_method[[:space:]]+\$status[[:space:]]+\$body_bytes_sent[[:space:]]+\$request_time' "$NGINX_DIR/nginx.conf" 'nginx access log must omit URLs, query strings and credentials'
require 'access_log /dev/stdout safe;' "$NGINX_DIR/nginx.conf" 'nginx must use the safe access log format'
share_location=$(awk '
  /location[[:space:]]+\^~[[:space:]]+\/api\/v1\/shares\// { capture = 1 }
  capture { print }
  capture && /^[[:space:]]*}/ { exit }
' "$NGINX_DIR/nginx.conf")
grep -Eq 'proxy_pass[[:space:]]+http://core-api:8080' <<<"$share_location" || fail 'share route must target Core explicitly'
grep -Eq 'error_log[[:space:]]+/dev/null[[:space:]]+crit' <<<"$share_location" || fail 'share route must suppress token-bearing upstream errors'
for setting in 'proxy_request_buffering[[:space:]]+off' 'proxy_buffering[[:space:]]+off' 'proxy_read_timeout[[:space:]]+3600s' 'proxy_set_header[[:space:]]+Authorization[[:space:]]+\$http_authorization'; do
  require "$setting" "$NGINX_DIR/nginx.conf" "storage streaming setting missing: $setting"
done
reject 'gateway|api-gateway' "$NGINX_DIR/nginx.conf" 'nginx must not route to the old Gateway'
require 'server[[:space:]]+127\.0\.0\.1:18080' "$HOST_NGINX" 'host Nginx must route only to the private Core-first listener'
require 'log_format[[:space:]]+mywebdrive_safe[[:space:]]+.*\$remote_addr[[:space:]]+\$request_method[[:space:]]+\$status[[:space:]]+\$body_bytes_sent[[:space:]]+\$request_time' "$HOST_NGINX" 'host Nginx access log must omit URLs, query strings and credentials'
require 'access_log[[:space:]]+/var/log/nginx/mywebdrive-access\.log[[:space:]]+mywebdrive_safe' "$HOST_NGINX" 'host Nginx must use its path-free access log'
host_share_location=$(awk '
  /location[[:space:]]+\^~[[:space:]]+\/api\/v1\/shares\// { capture = 1 }
  capture { print }
  capture && /^[[:space:]]*}/ { exit }
' "$HOST_NGINX")
grep -Eq 'error_log[[:space:]]+/dev/null[[:space:]]+crit' <<<"$host_share_location" || fail 'host share route must suppress token-bearing upstream errors'
reject '127\.0\.0\.1:(3100|9090)|mywebdrive_(frontend|gateway)|api-gateway' "$HOST_NGINX" 'host Nginx must not retain a legacy route'
reject 'rewrites|API_BASE_URL|localhost:9080|gateway' "$ROOT_DIR/frontend/cruip-landing/next.config.js" 'web build must not contain an API rewrite'
require 'outputFileTracingRoot' "$ROOT_DIR/frontend/cruip-landing/next.config.js" 'monorepo tracing root is required'
require '^USER[[:space:]]+node$' "$ROOT_DIR/frontend/cruip-landing/Dockerfile" 'web image must run as node'
require '^USER[[:space:]]+nginx$' "$NGINX_DIR/Dockerfile" 'nginx image must run as nginx'

for service in auth user metadata sharing api-gateway-node gateway; do
  reject "^[[:space:]]{2}${service}:" "$COMPOSE" "old service remains active: $service"
done
reject 'services/(auth|user|metadata|sharing|api-gateway-node)/prisma/migrations' "$ROOT_DIR/scripts/smoke-core-e2e.sh" 'smoke must not run legacy migrations'

printf 'core cutover contract: ok\n'
