#!/usr/bin/env bash
# End-to-end flow: invitation -> register -> small/large upload (quota fail) -> admin increase quota -> reupload -> download
# Prereqs:
# - Backend running on 9080 (./manage-services.sh start-backend or restart)
# - Seeded admin account: email=admin@local password=admin123456
# - Tools: curl, node, dd (or fallbacks)
# Usage: bash scripts/test_invite_quota_flow.sh

set -euo pipefail

GATEWAY_URL=${GATEWAY_URL:-"http://127.0.0.1:9080"}
PAGE_SIZE=${PAGE_SIZE:-50}
SMALL_QUOTA=${SMALL_QUOTA:-$((1*1024*1024))}   # 1 MiB
BIG_QUOTA=${BIG_QUOTA:-$((6*1024*1024))}       # 6 MiB
SMALL_SIZE=${SMALL_SIZE:-$((512*1024))}        # 512 KiB
LARGE_SIZE=${LARGE_SIZE:-$((2*1024*1024))}     # 2 MiB
WORKDIR=$(mktemp -d)
trap 'rm -rf "$WORKDIR"' EXIT

log(){ echo "[E2E] $*"; }
http(){
  local method=$1 url=$2; shift 2
  local code
  code=$(curl -sS -w "%{http_code}" -o "$WORKDIR/resp.json" -X "$method" "$url" "$@")
  # normalize to digits only
  code=$(echo "$code" | tr -dc '0-9')
  echo "$code"
}
body(){ cat "$WORKDIR/resp.json"; }
json(){ node -e "const fs=require('fs'); const o=JSON.parse(fs.readFileSync('$WORKDIR/resp.json','utf8')); console.log($1)"; }

log "1) Admin login"
code=$(http POST "$GATEWAY_URL/api/v1/auth/login" -H 'Content-Type: application/json' -d '{"email":"admin@local","password":"admin123456"}')
[ "$code" = "200" ] || { log "Admin login failed ($code)"; exit 1; }
ADMIN_TOKEN=$(json "o.accessToken")

log "2) Create invitation"
code=$(http POST "$GATEWAY_URL/api/v1/auth/invitations" -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d '{"usageLimit": 2, "notes":"e2e"}')
[[ "$code" =~ ^20[0-9]$ ]] || { log "Create invitation failed ($code)"; exit 1; }
INVITE_CODE=$(json "o.code")
log "   invite=$INVITE_CODE"

log "3) Register user with invitation"
EMAIL="e2e+$(date +%s)@local"
PASS="P@ssw0rd123"
code=$(http POST "$GATEWAY_URL/api/v1/auth/register" -H 'Content-Type: application/json' -d "{\"name\":\"E2E User\",\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"invitationCode\":\"$INVITE_CODE\"}")
[[ "$code" =~ ^20[0-9]$ ]] || { log "Register failed ($code)"; exit 1; }
USER_ID=$(json "o.id")

log "4) Login as user"
code=$(http POST "$GATEWAY_URL/api/v1/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}")
[ "$code" = "200" ] || { log "User login failed ($code)"; exit 1; }
USER_TOKEN=$(json "o.accessToken")

log "5) Set small quota for user (1 MiB)"
code=$(http PATCH "$GATEWAY_URL/api/v1/users/$USER_ID/quota" -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d "{\"storageQuota\": $SMALL_QUOTA}")
[ "$code" = "200" ] || { log "Set small quota failed ($code)"; exit 1; }

# Prepare files
SMALL_FILE="$WORKDIR/small.bin"; LARGE_FILE="$WORKDIR/large.bin"
dd if=/dev/urandom of="$SMALL_FILE" bs=$SMALL_SIZE count=1 status=none
dd if=/dev/urandom of="$LARGE_FILE" bs=$LARGE_SIZE count=1 status=none

upload_and_finalize(){
  local token=$1 name=$2 size=$3 path=$4
  code=$(http POST "$GATEWAY_URL/api/v1/storage/uploads" -H "Authorization: Bearer $token" -H 'Content-Type: application/json' -d "{\"fileName\":\"$name\",\"fileSize\":$size,\"mimeType\":\"application/octet-stream\"}")
  if [[ ! "$code" =~ ^20[0-9]$ ]]; then log "Create upload session failed ($name) code=$code"; echo "$code"; return 0; fi
  SID=$(json "o.id")
  curl -sS -H "Authorization: Bearer $token" -H 'X-Chunk-Index: 0' -H 'Content-Type: application/octet-stream' --data-binary @"$path" -X PATCH "$GATEWAY_URL/api/v1/storage/uploads/$SID" > /dev/null
  code=$(http POST "$GATEWAY_URL/api/v1/storage/uploads/$SID/finalize" -H "Authorization: Bearer $token" -H 'Content-Type: application/json' -d '{}')
  echo "$code"
}

log "6) Upload small file (expect 200)"
code=$(upload_and_finalize "$USER_TOKEN" small.bin $SMALL_SIZE "$SMALL_FILE")
[ "$code" = "200" ] || { log "Small upload finalize failed ($code)"; exit 1; }

log "7) Upload large file (expect 502 due to quota)"
code=$(upload_and_finalize "$USER_TOKEN" large.bin $LARGE_SIZE "$LARGE_FILE")
[ "$code" = "502" ] || { log "Large upload should fail with 502, got $code"; exit 1; }

log "8) Increase quota to 6 MiB and retry large (expect 200)"
code=$(http PATCH "$GATEWAY_URL/api/v1/users/$USER_ID/quota" -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d "{\"storageQuota\": $BIG_QUOTA}")
[ "$code" = "200" ] || { log "Increase quota failed ($code)"; exit 1; }
code=$(upload_and_finalize "$USER_TOKEN" large2.bin $LARGE_SIZE "$LARGE_FILE")
[ "$code" = "200" ] || { log "Large2 upload finalize failed ($code)"; exit 1; }
FILE_ID=$(json "o.fileId")

log "9) Download uploaded file (expect 200)"
DL_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$GATEWAY_URL/api/v1/storage/files/$FILE_ID/download")
[ "$DL_CODE" = "200" ] || { log "Download failed ($DL_CODE)"; exit 1; }

log "10) Fetch last notifications"
code=$(http GET "$GATEWAY_URL/api/v1/admin/notifications?pageSize=$PAGE_SIZE" -H "Authorization: Bearer $ADMIN_TOKEN")
[ "$code" = "200" ] || { log "List notifications failed ($code)"; exit 1; }
log "Done. Key activities should appear in notifications: 创建邀请码 / 新用户注册 / 文件上传完成 / 文件上传失败 / 配额修改 / 下载请求"

