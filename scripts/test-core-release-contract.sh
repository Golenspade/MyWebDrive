#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
CONTRACT="$ROOT_DIR/scripts/verify-core-release-contract.sh"
SOURCE_COMPOSE="$ROOT_DIR/infrastructure/alicloud/docker-compose.core.yml"
FIXTURES=$(mktemp -d)
trap 'rm -rf "$FIXTURES"' EXIT

expect_failure() {
  local label=$1 fixture=$2
  if bash "$CONTRACT" "$fixture" >/dev/null 2>&1; then
    printf 'negative fixture unexpectedly passed: %s\n' "$label" >&2
    exit 1
  fi
  printf 'negative fixture rejected: %s\n' "$label"
}

expect_script_failure() {
  local label=$1 fixture=$2 variable=$3
  if env "$variable=$fixture" bash "$CONTRACT" "$SOURCE_COMPOSE" >/dev/null 2>&1; then
    printf 'negative script fixture unexpectedly passed: %s\n' "$label" >&2
    exit 1
  fi
  printf 'negative fixture rejected: %s\n' "$label"
}

bash "$CONTRACT" "$SOURCE_COMPOSE"

awk '{ print; if (!done && /image: .*mywebdrive-core-api/) { print "    volumes:"; print "      - ../../:/workspace"; done=1 } }' "$SOURCE_COMPOSE" > "$FIXTURES/source-mount.yml"
expect_failure source-mount "$FIXTURES/source-mount.yml"

awk '{ if (!done && /mywebdrive-core-api:.*IMAGE_TAG/) { sub(/mywebdrive-core-api:.*/, "mywebdrive-core-api:latest"); done=1 } print }' "$SOURCE_COMPOSE" > "$FIXTURES/latest.yml"
expect_failure latest-tag "$FIXTURES/latest.yml"

sed 's/:${IMAGE_TAG:?IMAGE_TAG is required}/:/' "$SOURCE_COMPOSE" > "$FIXTURES/empty-tag.yml"
expect_failure empty-tag "$FIXTURES/empty-tag.yml"

awk '{ if (!done && $0 == "    healthcheck:") { print "    healthcheck_missing:"; done=1 } else print }' "$SOURCE_COMPOSE" > "$FIXTURES/missing-healthcheck.yml"
expect_failure missing-healthcheck "$FIXTURES/missing-healthcheck.yml"

sed 's/^  core-migrate:/  legacy-migrate:/' "$SOURCE_COMPOSE" > "$FIXTURES/missing-migrate.yml"
expect_failure missing-core-migrate "$FIXTURES/missing-migrate.yml"

awk '{ if ($0 == "volumes:") { print "  auth:"; print "    image: forbidden.invalid/auth:v1" } print }' "$SOURCE_COMPOSE" > "$FIXTURES/legacy-service.yml"
expect_failure legacy-service "$FIXTURES/legacy-service.yml"

sed 's/mc mb --ignore-existing/mc ls/' "$SOURCE_COMPOSE" > "$FIXTURES/missing-bucket-init.yml"
expect_failure missing-bucket-init "$FIXTURES/missing-bucket-init.yml"

awk '{ if (!done && /^    image: postgres:/) { sub(/@sha256:[0-9a-f]+/, ""); done=1 } print }' "$SOURCE_COMPOSE" > "$FIXTURES/unpinned-infra.yml"
expect_failure unpinned-infrastructure-image "$FIXTURES/unpinned-infra.yml"

awk '{ print; if (!done && /image: .*mywebdrive-core-api/) { print "    volumes:"; print "      - ${SOURCE_DIR}:/workspace:ro"; done=1 } }' "$SOURCE_COMPOSE" > "$FIXTURES/variable-source-mount.yml"
expect_failure variable-source-mount "$FIXTURES/variable-source-mount.yml"

awk '
  $0 == "  core-api:" { core=1 }
  core && $0 == "    healthcheck:" { print "    healthcheck:"; print "      disable: true"; skip=1; next }
  skip && /^    [A-Za-z0-9_-]+:/ { skip=0 }
  !skip { print }
' "$SOURCE_COMPOSE" > "$FIXTURES/disabled-healthcheck.yml"
expect_failure disabled-healthcheck "$FIXTURES/disabled-healthcheck.yml"

awk '{ if ($0 ~ /node_modules.*prisma migrate deploy/) print "    command: [\"true\"] # prisma migrate deploy"; else print }' "$SOURCE_COMPOSE" > "$FIXTURES/fake-migrate.yml"
expect_failure fake-migrate-command "$FIXTURES/fake-migrate.yml"

for operation in 'git reset --hard HEAD~1' 'rsync source destination' 'docker compose down -v' 'docker volume rm data' 'docker system prune --volumes' 'false || true'; do
  fixture="$FIXTURES/deploy-$(printf '%s' "$operation" | tr -cd 'a-z').sh"
  cp "$ROOT_DIR/infrastructure/alicloud/deploy.sh" "$fixture"
  printf '\n%s\n' "$operation" >> "$fixture"
  expect_script_failure "$operation" "$fixture" RELEASE_CONTRACT_DEPLOY_SCRIPT
done

sed '/compose run --rm --no-deps core-migrate/d' "$ROOT_DIR/infrastructure/alicloud/deploy.sh" > "$FIXTURES/missing-deploy-migrate.sh"
expect_script_failure missing-deploy-migration "$FIXTURES/missing-deploy-migrate.sh" RELEASE_CONTRACT_DEPLOY_SCRIPT

mkdir -p "$FIXTURES/fake-bin"
cat > "$FIXTURES/fake-bin/docker" <<'EOF'
#!/usr/bin/env bash
printf 'CORE=%s STORAGE=%s WEB=%s NGINX=%s :: %s\n' "${CORE_API_IMAGE-}" "${STORAGE_IMAGE-}" "${WEB_IMAGE-}" "${NGINX_IMAGE-}" "$*" >> "$DOCKER_CALL_LOG"
if [[ "$1" == image && "$2" == inspect ]]; then
  tag_ref=${!#}
  repository=${tag_ref%:"${IMAGE_TAG}"}
  case "$repository" in
    */mywebdrive-core-api) digest=$(printf 'a%.0s' {1..64}) ;;
    */mywebdrive-storage) digest=$(printf 'b%.0s' {1..64}) ;;
    */mywebdrive-web) digest=$(printf 'c%.0s' {1..64}) ;;
    */mywebdrive-nginx) digest=$(printf 'd%.0s' {1..64}) ;;
    *) exit 1 ;;
  esac
  printf '["%s@sha256:%s"]\n' "$repository" "$digest"
fi
if [[ "$1" == inspect && "$*" == *"{{.Image}}"* ]]; then printf 'sha256:%s\n' "$(printf 'e%.0s' {1..64})"; fi
if [[ "$1" == inspect && "$*" == *'.State.Health'* ]]; then printf 'healthy\n'; fi
if [[ "$1" == compose && "$*" == *' ps -q '* ]]; then printf 'fixture-container\n'; fi
if [[ "$1" == compose && "$*" == *' config --format json'* ]]; then
  core=${CORE_API_IMAGE:-registry.example/mywebdrive-core-api:${IMAGE_TAG}}
  storage=${STORAGE_IMAGE:-registry.example/mywebdrive-storage:${IMAGE_TAG}}
  web=${WEB_IMAGE:-registry.example/mywebdrive-web:${IMAGE_TAG}}
  nginx=${NGINX_IMAGE:-registry.example/mywebdrive-nginx:${IMAGE_TAG}}
  printf '{"services":{"core-api":{"image":"%s"},"storage-api":{"image":"%s"},"web":{"image":"%s"},"nginx":{"image":"%s"}}}\n' "$core" "$storage" "$web" "$nginx"
fi
exit 0
EOF
chmod +x "$FIXTURES/fake-bin/docker"
touch "$FIXTURES/env"

for mutable_tag in production main master latest; do
  : > "$FIXTURES/docker.log"
  set +e
  PATH="$FIXTURES/fake-bin:$PATH" DOCKER_CALL_LOG="$FIXTURES/docker.log" MYWEBDRIVE_ENV_FILE="$FIXTURES/env" DEPLOY_STATE_DIR="$FIXTURES/state" "$ROOT_DIR/infrastructure/alicloud/deploy.sh" "$mutable_tag" > "$FIXTURES/mutable.out" 2>&1
  code=$?
  set -e
  [[ $code -eq 64 ]] || { printf 'mutable release tag was not rejected with EX_USAGE: %s\n' "$mutable_tag" >&2; exit 1; }
  [[ ! -s "$FIXTURES/docker.log" ]] || { printf 'mutable tag invoked Docker: %s\n' "$mutable_tag" >&2; exit 1; }
done

printf 'not a directory\n' > "$FIXTURES/state-file"
: > "$FIXTURES/docker.log"
set +e
PATH="$FIXTURES/fake-bin:$PATH" DOCKER_CALL_LOG="$FIXTURES/docker.log" MYWEBDRIVE_ENV_FILE="$FIXTURES/env" DEPLOY_STATE_DIR="$FIXTURES/state-file/child" "$ROOT_DIR/infrastructure/alicloud/deploy.sh" "sha-0123456789abcdef0123456789abcdef01234567" > "$FIXTURES/state.out" 2>&1
code=$?
set -e
[[ $code -ne 0 && ! -s "$FIXTURES/docker.log" ]] || { printf 'state preflight did not fail before Docker mutation\n' >&2; exit 1; }

: > "$FIXTURES/docker.log"
set +e
PATH="$FIXTURES/fake-bin:$PATH" DOCKER_CALL_LOG="$FIXTURES/docker.log" MYWEBDRIVE_ENV_FILE="$FIXTURES/env" DEPLOY_STATE_DIR="$FIXTURES/missing-history" "$ROOT_DIR/infrastructure/alicloud/rollback.sh" "sha-0123456789abcdef0123456789abcdef01234567" > "$FIXTURES/history.out" 2>&1
code=$?
set -e
[[ $code -ne 0 && ! -s "$FIXTURES/docker.log" ]] || { printf 'missing rollback history did not fail before Docker mutation\n' >&2; exit 1; }

release_tag=sha-0123456789abcdef0123456789abcdef01234567
state_dir="$FIXTURES/digest-state"
: > "$FIXTURES/docker.log"
PATH="$FIXTURES/fake-bin:$PATH" DOCKER_CALL_LOG="$FIXTURES/docker.log" MYWEBDRIVE_ENV_FILE="$FIXTURES/env" DEPLOY_STATE_DIR="$state_dir" "$ROOT_DIR/infrastructure/alicloud/deploy.sh" "$release_tag" >/dev/null
core_digest="registry.example/mywebdrive-core-api@sha256:$(printf 'a%.0s' {1..64})"
storage_digest="registry.example/mywebdrive-storage@sha256:$(printf 'b%.0s' {1..64})"
web_digest="registry.example/mywebdrive-web@sha256:$(printf 'c%.0s' {1..64})"
nginx_digest="registry.example/mywebdrive-nginx@sha256:$(printf 'd%.0s' {1..64})"
grep -F "CORE=$core_digest STORAGE=$storage_digest WEB=$web_digest NGINX=$nginx_digest :: compose" "$FIXTURES/docker.log" >/dev/null || { printf 'deployment did not switch Compose to RepoDigests\n' >&2; exit 1; }
manifest=$(find "$state_dir/history" -type f -name "*-$release_tag-*.manifest" -print -quit)
grep -Fx "CORE_API_IMAGE=$core_digest" "$manifest" >/dev/null
grep -Fx "STORAGE_IMAGE=$storage_digest" "$manifest" >/dev/null
grep -Fx "WEB_IMAGE=$web_digest" "$manifest" >/dev/null
grep -Fx "NGINX_IMAGE=$nginx_digest" "$manifest" >/dev/null

: > "$FIXTURES/docker.log"
PATH="$FIXTURES/fake-bin:$PATH" DOCKER_CALL_LOG="$FIXTURES/docker.log" MYWEBDRIVE_ENV_FILE="$FIXTURES/env" DEPLOY_STATE_DIR="$state_dir" "$ROOT_DIR/infrastructure/alicloud/rollback.sh" "$release_tag" >/dev/null
grep -F "CORE=$core_digest STORAGE=$storage_digest WEB=$web_digest NGINX=$nginx_digest :: compose" "$FIXTURES/docker.log" >/dev/null || { printf 'rollback did not deploy the recorded digest manifest\n' >&2; exit 1; }
if grep -F 'image inspect' "$FIXTURES/docker.log" >/dev/null; then printf 'rollback resolved a mutable tag instead of using its manifest\n' >&2; exit 1; fi

malicious="$FIXTURES/malicious.manifest"
printf '%s\n' "IMAGE_TAG=$release_tag" 'CORE_API_IMAGE=$(touch /tmp/contract-pwned)' "STORAGE_IMAGE=$storage_digest" "WEB_IMAGE=$web_digest" "NGINX_IMAGE=$nginx_digest" > "$malicious"
rm -f /tmp/contract-pwned
: > "$FIXTURES/docker.log"
set +e
PATH="$FIXTURES/fake-bin:$PATH" DOCKER_CALL_LOG="$FIXTURES/docker.log" MYWEBDRIVE_ENV_FILE="$FIXTURES/env" DEPLOY_STATE_DIR="$state_dir" "$ROOT_DIR/infrastructure/alicloud/deploy.sh" --manifest "$malicious" >/dev/null 2>&1
code=$?
set -e
[[ $code -ne 0 && ! -e /tmp/contract-pwned && ! -s "$FIXTURES/docker.log" ]] || { printf 'manifest parser executed or accepted untrusted content\n' >&2; exit 1; }

printf 'core release contract fixtures: ok\n'
