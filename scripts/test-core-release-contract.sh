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

for operation in 'git reset --hard HEAD~1' 'rsync source destination' 'docker compose down -v' 'docker volume rm data' 'false || true'; do
  fixture="$FIXTURES/deploy-$(printf '%s' "$operation" | tr -cd 'a-z').sh"
  cp "$ROOT_DIR/infrastructure/alicloud/deploy.sh" "$fixture"
  printf '\n%s\n' "$operation" >> "$fixture"
  expect_script_failure "$operation" "$fixture" RELEASE_CONTRACT_DEPLOY_SCRIPT
done

sed '/compose run --rm --no-deps core-migrate/d' "$ROOT_DIR/infrastructure/alicloud/deploy.sh" > "$FIXTURES/missing-deploy-migrate.sh"
expect_script_failure missing-deploy-migration "$FIXTURES/missing-deploy-migrate.sh" RELEASE_CONTRACT_DEPLOY_SCRIPT

printf 'core release contract fixtures: ok\n'
