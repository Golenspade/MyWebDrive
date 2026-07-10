# Runtime Security and Release Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the currently exploitable unauthenticated download and quota paths, make critical state changes fail closed, and make CI/deployment report real failures.

**Architecture:** This is the first executable slice of the approved Core API + Storage Data Plane design. It does not introduce a second, half-finished control plane; it hardens existing seams so Storage accepts a purpose-bound grant rather than a raw file ID, metadata cannot silently bypass quota enforcement, and release automation uses one fail-closed contract.

**Tech Stack:** Node.js 20+, TypeScript, Express 4, Prisma 5, jsonwebtoken, ioredis, Vitest 4, Docker Compose, GitHub Actions.

**Scope:** Phase 0 and Phase 1 of the approved architecture design: production stopgaps and a trustworthy release substrate. The separately versioned Core API strangler migration begins only after these security and release gates pass.

## Global Constraints

- Keep public API paths under `/api/v1/*`; the bare public download endpoint is deliberately removed rather than preserved.
- Never expose a raw filesystem path, storage object key, authorization header, cookie, grant, or refresh token in logs.
- `JWT_SECRET` is only for user sessions; `STORAGE_GRANT_SECRET` is mandatory and independent for Storage grants.
- A failed quota dependency, invalid grant, Redis failure during one-time grant consumption, migration error, lint error, test error, or missing workspace target blocks the operation.
- Object bytes remain outside PostgreSQL; local storage validates resolved paths remain under `STORAGE_PATH/files`.
- Use tests first for every behavior change and do not commit unrelated worktree files.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `services/storage/src/access-grant.ts` | Sign and verify short-lived purpose/audience-bound storage grants. |
| `services/storage/src/local-object-path.ts` | Validate an opaque object ID and resolve a contained local object path. |
| `services/storage/src/__tests__/access-grant.test.ts` | Regression tests for invalid audience, purpose, expiry and replay-safe grant parsing. |
| `services/storage/src/__tests__/local-object-path.test.ts` | Regression tests for encoded traversal and allowed opaque IDs. |
| `scripts/assert-no-sensitive-artifacts.sh` | Blocks tracked databases and environment files from returning to source control. |
| `services/storage/src/index.ts` | Require download grant, remove direct URL endpoints, expose live/ready/version. |
| `services/storage/package.json` | Add the Storage test script and test dependencies. |
| `services/user/src/index.ts` | Remove public storage delta adjustment; expose an internal-only signed adjustment endpoint only during migration. |
| `services/metadata/src/index.ts` | Treat missing or failed quota verification/adjustment as a write failure. |
| `services/sharing/src/index.ts` | Atomically consume limited shares before streaming and request a Storage download grant. |
| `services/auth/src/index.ts` | Consume invitation capacity atomically in the registration transaction. |
| `package.json`, `Makefile`, `.github/workflows/ci.yml` | Use exact workspace selectors and fail-closed build/test/lint/migration commands. |
| `infrastructure/alicloud/docker-compose.images.yml` | Establish the single image-based production compose contract with readiness health checks and no source mounts. |
| `infrastructure/alicloud/deploy.sh`, `infrastructure/alicloud/rollback.sh` | Deploy immutable image tags and roll back image tags without resetting a server Git worktree. |

## Task 0: Remove tracked runtime data and prevent recurrence

**Files:**
- Create: `scripts/assert-no-sensitive-artifacts.sh`
- Modify: `.gitignore`
- Delete: `services/auth/prisma/auth.db`
- Delete: `services/auth/prisma/services/auth/prisma/auth.db`
- Delete: `services/data/dev.db`
- Delete: `services/data/mywebdrive.db`
- Delete: `services/metadata/prisma/metadata.db`
- Delete: `services/metadata/prisma/services/metadata/prisma/metadata.db`
- Delete: `services/sharing/prisma/services/sharing/prisma/sharing.db`
- Delete: `services/storage/prisma/storage.db`
- Delete: `services/storage/prisma/services/storage/prisma/storage.db`
- Delete: `services/user/prisma/services/user/prisma/user.db`

- [ ] **Step 1: Run the sensitive-artifact assertion before writing it**

Run: `git ls-files | rg '(^|/)([^/]+\\.(db|sqlite|sqlite3)|\\.env)$'`

Expected: policy failure because the command prints the ten tracked SQLite files.

- [ ] **Step 2: Write the policy assertion**

```bash
#!/usr/bin/env bash
set -euo pipefail

forbidden="$(git ls-files | rg '(^|/)([^/]+\\.(db|sqlite|sqlite3)|\\.env)$' || true)"
if [[ -n "$forbidden" ]]; then
  printf '%s\\n' 'Tracked runtime data or environment files are forbidden:' >&2
  printf '%s\\n' "$forbidden" >&2
  exit 1
fi
```

- [ ] **Step 3: Remove tracked data and add exact ignore rules**

Use `git rm --` for each listed database. Add `services/data/` and `services/*/prisma/services/` to `.gitignore` in addition to the existing `services/*/prisma/*.db` rule.

- [ ] **Step 4: Verify the policy and commit**

Run: `bash scripts/assert-no-sensitive-artifacts.sh && git check-ignore -v services/data/dev.db services/storage/prisma/storage.db`

Expected: the assertion exits 0 and both sample paths are ignored.

Commit:

```bash
git add .gitignore scripts/assert-no-sensitive-artifacts.sh
git rm --cached services/auth/prisma/auth.db services/auth/prisma/services/auth/prisma/auth.db services/data/dev.db services/data/mywebdrive.db services/metadata/prisma/metadata.db services/metadata/prisma/services/metadata/prisma/metadata.db services/sharing/prisma/services/sharing/prisma/sharing.db services/storage/prisma/storage.db services/storage/prisma/services/storage/prisma/storage.db services/user/prisma/services/user/prisma/user.db
git commit -m "fix(security): remove tracked runtime databases"
```

## Task 1: Storage grant and local-path primitives

**Files:**
- Create: `services/storage/src/access-grant.ts`
- Create: `services/storage/src/local-object-path.ts`
- Create: `services/storage/src/__tests__/access-grant.test.ts`
- Create: `services/storage/src/__tests__/local-object-path.test.ts`
- Modify: `services/storage/package.json`

**Interfaces:**

```ts
export type StorageGrant = {
  jti: string
  objectKey: string
  purpose: 'download' | 'upload'
  audience: 'storage-api'
  expiresAt: Date
}

export function verifyStorageGrant(token: string, secret: string, purpose: StorageGrant['purpose']): StorageGrant
export function resolveLocalObjectPath(storageRoot: string, objectKey: string): string
```

- [ ] **Step 1: Write the failing access-grant tests**

```ts
test('rejects a user access token because its audience is not storage-api', () => {
  const token = jwt.sign({ user_id: 'u1', type: 'access' }, secret, { expiresIn: 60 })
  expect(() => verifyStorageGrant(token, secret, 'download')).toThrow('Invalid storage grant')
})

test('rejects a valid upload grant on a download request', () => {
  const token = signStorageGrant({ objectKey: validObjectKey, purpose: 'upload' }, secret)
  expect(() => verifyStorageGrant(token, secret, 'download')).toThrow('Invalid storage grant')
})
```

- [ ] **Step 2: Run the tests and observe the missing-module failure**

Run: `pnpm -C services/storage test -- access-grant.test.ts`

Expected: FAIL because `../access-grant.js` does not exist.

- [ ] **Step 3: Write the failing local-path tests**

```ts
test.each(['../.env', '..%2F..%2F.env', '/etc/passwd', 'nested/file'])(
  'rejects non-opaque object key %s',
  (objectKey) => expect(() => resolveLocalObjectPath('/tmp/storage', objectKey)).toThrow('Invalid object key'),
)
```

- [ ] **Step 4: Implement the two minimal primitives**

```ts
const OBJECT_KEY_PATTERN = /^[a-f0-9]{64}$/

export function resolveLocalObjectPath(storageRoot: string, objectKey: string): string {
  if (!OBJECT_KEY_PATTERN.test(objectKey)) throw new Error('Invalid object key')
  const root = path.resolve(storageRoot, 'files')
  const candidate = path.resolve(root, objectKey)
  if (!candidate.startsWith(`${root}${path.sep}`)) throw new Error('Invalid object key')
  return candidate
}
```

`verifyStorageGrant` must call `jwt.verify` with `algorithms: ['HS256']` and `audience: 'storage-api'`, require `typ: 'storage-grant'`, a UUID `jti`, a 64-hex `objectKey`, and the requested purpose.

- [ ] **Step 5: Run the focused tests and commit**

Run: `pnpm -C services/storage test -- access-grant.test.ts local-object-path.test.ts`

Expected: PASS with all grant and traversal cases green.

Commit:

```bash
git add services/storage/package.json services/storage/src/access-grant.ts services/storage/src/local-object-path.ts services/storage/src/__tests__
git commit -m "feat(storage): validate purpose-bound download grants"
```

## Task 2: Replace bare download and direct URLs

**Files:**
- Modify: `services/storage/src/index.ts:1-960`
- Test: `services/storage/src/__tests__/access-grant.test.ts`

**Interfaces:**

```ts
GET /api/v1/storage/objects/:objectKey/download
Authorization: Bearer <storage-grant>

GET /api/v1/storage/files/:fileId/download -> 410 { error: 'Legacy download endpoint disabled' }
GET /api/v1/storage/files/:fileId/direct-url -> 410 { error: 'Legacy direct URL endpoint disabled' }
```

- [ ] **Step 1: Add failing route-level tests for no grant, malformed key and legacy endpoints**

```ts
expect(await request(app).get(`/api/v1/storage/objects/${validObjectKey}/download`)).toHaveProperty('status', 401)
expect(await request(app).get('/api/v1/storage/objects/..%2F..%2F.env/download').set('Authorization', `Bearer ${grant}`)).toHaveProperty('status', 400)
expect(await request(app).get('/api/v1/storage/files/x/download')).toHaveProperty('status', 410)
```

- [ ] **Step 2: Run the route tests and observe the old public behavior**

Run: `pnpm -C services/storage test -- download-route.test.ts`

Expected: FAIL because the old endpoint returns a non-410 response and the new endpoint is absent.

- [ ] **Step 3: Implement the guarded route**

The route must verify the grant before opening any object, require `grant.objectKey === req.params.objectKey`, atomically consume `grant.jti` in Redis with `SET key 1 EX 60 NX`, and return `503` if Redis is unavailable. It must call `resolveLocalObjectPath` for local storage and use `files/${objectKey}` for MinIO. Both legacy public routes and `download-direct` return 410 without issuing redirects or presigned URLs.

- [ ] **Step 4: Add live, ready and version behavior**

`/live` returns process liveness only. `/ready` pings Prisma, Redis and MinIO when enabled (or checks the contained local storage root). `/version` returns `GIT_SHA`, `BUILD_ID` and startup timestamp. A readiness dependency error returns 503.

- [ ] **Step 5: Run tests, build Storage and commit**

Run: `pnpm -C services/storage test && pnpm -C services/storage build`

Expected: both commands exit 0.

Commit:

```bash
git add services/storage
git commit -m "fix(storage): close public file download paths"
```

## Task 3: Stop quota bypasses and share races

**Files:**
- Modify: `services/user/src/index.ts:140-170`
- Modify: `services/metadata/src/index.ts:14-31, 601-803`
- Modify: `services/sharing/src/index.ts:123-170`
- Create: `services/metadata/src/__tests__/quota-failure.test.ts`
- Create: `services/sharing/src/__tests__/share-limit.test.ts`

**Interfaces:**

```ts
POST /api/v1/users/me/storage/adjust -> 410 { error: 'Storage adjustment endpoint disabled' }
POST /api/v1/files/:fileId/versions -> 503 when quota verification or adjustment cannot be confirmed
GET /api/v1/shares/:shareToken/download -> at most one 200 response when maxDownloads is exhausted concurrently
```

- [ ] **Step 1: Write failing tests for the old bypass and concurrent share limit**

```ts
expect(await request(userApp).post('/api/v1/users/me/storage/adjust').set(auth).send({ delta: -1_000_000 })).toHaveProperty('status', 410)
expect(await request(metadataApp).post('/api/v1/files/f1/versions').set(auth).send(payload)).toHaveProperty('status', 503)
expect((await Promise.all([download(), download()])).filter((r) => r.status === 200)).toHaveLength(1)
```

- [ ] **Step 2: Observe failing tests**

Run: `pnpm -C services/metadata test -- quota-failure.test.ts && pnpm -C services/sharing test -- share-limit.test.ts`

Expected: FAIL because quota calls are swallowed and `downloadCount` uses read-then-write.

- [ ] **Step 3: Implement fail-closed behavior**

Delete the best-effort adjustment helper from metadata. Before creating or deleting a version, treat any non-2xx user service response, network error, malformed quota payload or missing `USER_SERVICE_URL` as a `503 Quota service unavailable`; do not write file/version metadata first. Replace the public user adjustment route with 410. Replace share consumption with `updateMany` constrained by `id`, `isActive`, expiration and `downloadCount < maxDownloads`; proceed only when its count is one.

- [ ] **Step 4: Run focused tests and affected builds**

Run: `pnpm -C services/metadata test && pnpm -C services/sharing test && pnpm -C services/user build && pnpm -C services/metadata build && pnpm -C services/sharing build`

Expected: every command exits 0.

- [ ] **Step 5: Commit**

```bash
git add services/user services/metadata services/sharing
git commit -m "fix(core): fail closed for quota and share limits"
```

## Task 4: Make CI and production compose fail closed

**Files:**
- Modify: `package.json`
- Modify: `Makefile`
- Modify: `.github/workflows/ci.yml`
- Modify: `infrastructure/alicloud/docker-compose.images.yml`
- Modify: `infrastructure/alicloud/deploy.sh`
- Modify: `infrastructure/alicloud/rollback.sh`
- Create: `scripts/verify-release-contract.sh`

**Interfaces:**

```bash
pnpm run build:all
pnpm run test:all
pnpm run lint:all
bash scripts/verify-release-contract.sh infrastructure/alicloud/docker-compose.images.yml
```

- [ ] **Step 1: Write the release-contract shell test before the script**

```bash
test -n "$(docker compose -f "$1" config)"
! grep -q 'volumes:.*../../:/workspace' "$1"
! grep -q '|| true' "$1"
grep -q 'healthcheck:' "$1"
```

- [ ] **Step 2: Run it against current production compose**

Run: `bash scripts/verify-release-contract.sh infrastructure/alicloud/docker-compose.images.yml`

Expected: FAIL because the compose contains source mounts or lacks application health checks.

- [ ] **Step 3: Implement exact quality scripts and compose contract**

Use quoted pnpm selectors such as `pnpm --filter './services/*' --filter './packages/*' run build`; do not use glob-expanded filters or `|| true`. CI must run install with frozen lockfile, Prisma generate, Prisma validate, `migrate deploy` against PostgreSQL, build, typecheck, lint, tests, Docker builds and compose config. The image compose must use only image references parameterized by `${IMAGE_TAG}`, named data volumes, a migration one-shot service, dependency readiness, non-default secret guards and healthchecks for every application process.

- [ ] **Step 4: Replace code-sync deploy and Git-reset rollback**

`deploy.sh` accepts a required immutable image tag, runs `docker compose ... pull`, starts the migration job and waits for `/ready` plus `/version`. `rollback.sh` accepts a prior image tag and re-runs the compose workflow without `git reset`, `rsync --delete`, `down -v` or data-volume deletion.

- [ ] **Step 5: Verify contract and commit**

Run: `pnpm run build:all && pnpm run typecheck && pnpm run lint:all && pnpm run test:all && bash scripts/verify-release-contract.sh infrastructure/alicloud/docker-compose.images.yml`

Expected: all commands exit 0; `docker compose -f infrastructure/alicloud/docker-compose.images.yml config` exits 0 after required test environment variables are supplied.

Commit:

```bash
git add package.json Makefile .github/workflows/ci.yml infrastructure/alicloud scripts/verify-release-contract.sh
git commit -m "fix(release): enforce immutable fail-closed deployments"
```
