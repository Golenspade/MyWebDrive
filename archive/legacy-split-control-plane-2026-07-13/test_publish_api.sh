#!/usr/bin/env bash
set -e

GATEWAY_PORT=${GATEWAY_PORT:-9080}
BASE_URL="http://localhost:${GATEWAY_PORT}"

echo "=== Testing Publish API ==="
echo "Gateway: $BASE_URL"
echo ""

# Step 1: Login as admin
echo "1. Login as admin..."
LOGIN_RESP=$(curl -s -X POST "$BASE_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}')

# Prefer jq for robust parsing
if command -v jq >/dev/null 2>&1; then
  ACCESS_TOKEN=$(echo "$LOGIN_RESP" | jq -r .accessToken)
else
  ACCESS_TOKEN=$(echo "$LOGIN_RESP" | grep -o '"accessToken":"[^\"]*' | cut -d'"' -f4)
fi

if [ -z "$ACCESS_TOKEN" ] || [ "$ACCESS_TOKEN" = "null" ]; then
  echo "❌ Login failed"
  echo "$LOGIN_RESP"
  exit 1
fi

echo "✅ Login successful"
echo ""

# Step 2: Create an upload session (JSON flow)
echo "2. Creating upload session..."
UPLOAD_RESP=$(curl -s -X POST "$BASE_URL/api/v1/storage/uploads" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fileName":"test-app.zip","fileSize":1024}')

if command -v jq >/dev/null 2>&1; then
  UPLOAD_ID=$(echo "$UPLOAD_RESP" | jq -r .id)
else
  UPLOAD_ID=$(echo "$UPLOAD_RESP" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
fi

if [ -z "$UPLOAD_ID" ] || [ "$UPLOAD_ID" = "null" ]; then
  echo "❌ Failed to create upload session"
  echo "$UPLOAD_RESP"
  exit 1
fi

echo "✅ Upload ID: $UPLOAD_ID"
echo ""

# Step 3: Upload minimal chunk (index 0, 1KB)
echo "3. Uploading one chunk..."
TMP_FILE=$(mktemp)
# 1KB dummy content
dd if=/dev/zero of="$TMP_FILE" bs=1024 count=1 >/dev/null 2>&1 || echo -n "0" > "$TMP_FILE"
CHUNK_RESP=$(curl -s -X PATCH "$BASE_URL/api/v1/storage/uploads/$UPLOAD_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "X-Chunk-Index: 0" \
  -H "Content-Type: application/octet-stream" \
  --data-binary @"$TMP_FILE")
rm -f "$TMP_FILE"

echo "$CHUNK_RESP"
echo ""

# Step 4: Finalize upload
echo "4. Finalizing upload..."
FINALIZE_RESP=$(curl -s -X POST "$BASE_URL/api/v1/storage/uploads/$UPLOAD_ID/finalize" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}')

echo "$FINALIZE_RESP"
echo ""

# Step 4: Get file tags (should be empty initially)
echo "4. Getting file tags..."
TAGS_RESP=$(curl -s -X GET "$BASE_URL/api/v1/files/$UPLOAD_ID/tags" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "$TAGS_RESP"
echo ""

# Step 5: Publish to catalog
# Step 5a: Negative case - invalid slug (expect 400)
echo "5a. Publishing with invalid slug (expect 400)..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$BASE_URL/api/v1/files/$UPLOAD_ID/catalog" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "!!!",
    "version": "1.0.0",
    "channel": "stable",
    "public": true
  }')
if [ "$STATUS" != "400" ]; then
  echo "❌ Expected 400 for invalid slug, got $STATUS"; exit 1
fi

echo "✅ Invalid slug rejected"

# Step 5b: Negative case - invalid url (expect 400)
echo "5b. Publishing with invalid url (expect 400)..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$BASE_URL/api/v1/files/$UPLOAD_ID/catalog" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "test-app",
    "version": "1.0.0",
    "channel": "stable",
    "public": true,
    "url": "javascript:alert(1)"
  }')
if [ "$STATUS" != "400" ]; then
  echo "❌ Expected 400 for invalid url, got $STATUS"; exit 1
fi

echo "✅ Invalid url rejected"

echo "5. Publishing to catalog..."
PUBLISH_RESP=$(curl -s -X PUT "$BASE_URL/api/v1/files/$UPLOAD_ID/catalog" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "test-app",
    "name": "Test Application",
    "description": "A test application for catalog",
    "category": "tools",
    "license": "MIT",
    "repo": "https://github.com/test/app",
    "version": "1.0.0",
    "channel": "stable",
    "os": "any",
    "arch": "any",
    "public": true
  }')

echo "$PUBLISH_RESP"
echo ""

# Step 6: Get file tags again (should have catalog tags)
echo "6. Getting file tags after publish..."
TAGS_RESP2=$(curl -s -X GET "$BASE_URL/api/v1/files/$UPLOAD_ID/tags" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "$TAGS_RESP2"
echo ""

# Step 7: Get catalog entry
echo "7. Getting catalog entry..."
CATALOG_RESP=$(curl -s -X GET "$BASE_URL/api/v1/catalog/test-app")

echo "$CATALOG_RESP"
echo ""

# Step 8: Check audit log
echo "8. Checking audit log..."
AUDIT_RESP=$(curl -s -X GET "$BASE_URL/api/v1/admin/audit" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "$AUDIT_RESP" | grep -o '"action":"publish"' || echo "No publish audit found"
echo ""

echo "=== Test Complete ==="

