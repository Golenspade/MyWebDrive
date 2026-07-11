#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.core.yml"
STATE_DIR=${DEPLOY_STATE_DIR:-/var/lib/mywebdrive/releases}
TARGET_TAG=${1:-}

trap 'printf "rollback failed at line %s\n" "$LINENO" >&2' ERR

[[ "$TARGET_TAG" =~ ^sha-[0-9a-f]{40}$ ]] || {
  printf 'rollback tag must be content-addressed as sha-<40 lowercase hex>\n' >&2
  exit 64
}
[[ "$STATE_DIR" == /* ]] || { printf 'DEPLOY_STATE_DIR must be an absolute path\n' >&2; exit 64; }
[[ -f "$COMPOSE_FILE" ]] || { printf 'compose file is missing: %s\n' "$COMPOSE_FILE" >&2; exit 66; }
[[ -d "$STATE_DIR/history" ]] || { printf 'release history is unavailable\n' >&2; exit 66; }

shopt -s nullglob
matches=("$STATE_DIR/history/"*-"$TARGET_TAG"-*.manifest)
shopt -u nullglob
(( ${#matches[@]} > 0 )) || { printf 'no release manifest found for %s\n' "$TARGET_TAG" >&2; exit 66; }
manifest=${matches[0]}
for candidate in "${matches[@]}"; do
  [[ "$candidate" -nt "$manifest" ]] && manifest=$candidate
done

manifest_tag=''
manifest_tag_count=0
while IFS= read -r line || [[ -n "$line" ]]; do
  [[ "$line" == *=* ]] || { printf 'invalid release manifest line\n' >&2; exit 65; }
  key=${line%%=*}
  value=${line#*=}
  if [[ "$key" == IMAGE_TAG ]]; then
    manifest_tag=$value
    manifest_tag_count=$((manifest_tag_count + 1))
  fi
done < "$manifest"
[[ $manifest_tag_count -eq 1 && "$manifest_tag" =~ ^sha-[0-9a-f]{40}$ && "$manifest_tag" == "$TARGET_TAG" ]] || {
  printf 'release manifest IMAGE_TAG does not match rollback target\n' >&2
  exit 65
}

printf 'rolling back to immutable release %s from %s\n' "$TARGET_TAG" "$manifest"
exec "$SCRIPT_DIR/deploy.sh" --manifest "$manifest" "$TARGET_TAG"
