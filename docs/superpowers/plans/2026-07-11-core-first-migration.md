# MyWebDrive Core-first Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the split Auth/User/Metadata/Sharing/Gateway control plane with one transactionally consistent Core API, using passwordless email OTP sessions and a separate grant-protected Storage Data Plane.

**Architecture:** Build the complete Core API in isolation while the existing services remain frozen. Core owns identity, sessions, quota, uploads, metadata, sharing, publications, grants and outbox state in one PostgreSQL schema; Storage owns object bytes and validates only Core-issued grants. Production traffic switches only after the entire Core + Storage contract passes empty-environment and failure-injection tests.

**Tech Stack:** Node.js 20+, TypeScript strict mode, Express 4, Prisma 5, PostgreSQL 16, Redis 7, jsonwebtoken, ioredis, Vitest 4, Supertest, Next.js 15, Docker Compose v2, GitHub Actions.

## Global Constraints

- Architecture completeness takes priority over temporary availability. Do not add new Metadata → User, Sharing → Storage or Gateway proxy bridges to the old control plane.
- Keep public API paths under `/api/v1/*`; Nginx is the only public reverse proxy and the final topology has no Node API Gateway.
- Core is the sole business authority and the sole issuer of Storage grants. Storage never queries users, quota, files, shares or publications.
- Use one `CORE_DATABASE_URL`, one Prisma schema and one ordered migration history for all Core modules.
- Do not store passwords, plaintext OTP codes, plaintext refresh tokens, grants, Authorization headers, cookies, full query strings or raw filesystem paths in logs or PostgreSQL.
- OTP is six numeric digits, expires after 600 seconds, permits five failed attempts, has a 60-second resend cooldown, and is limited to five sends per normalized email per hour and twenty sends per source IP per hour.
- Access JWTs expire after 900 seconds and must validate `alg=HS256`, `typ=access`, `iss=mywebdrive-core` and `aud=mywebdrive-web`.
- Refresh credentials are 256-bit opaque random tokens stored only as SHA-256 digests. The `mwd_refresh` Cookie is HttpOnly, SameSite=Lax, Path `/api/v1/auth`, Secure in production, idle-expires after 30 days and absolutely expires after 90 days.
- Startup requires an explicit nonnegative decimal `DEFAULT_USER_QUOTA_BYTES`; production additionally requires non-default `CORE_SESSION_SECRET`, `OTP_PEPPER`, `STORAGE_GRANT_SECRET` and `CORE_CALLBACK_SECRET`, each at least 32 UTF-8 bytes, plus absolute HTTPS `EMAIL_PROVIDER_URL` and nonempty `EMAIL_PROVIDER_TOKEN`. There is no baked-in product quota: deployment configuration owns that policy until a billing component replaces it.
- Storage grants use independent `STORAGE_GRANT_SECRET`, `aud=storage-api`, `typ=storage-grant`, purpose `upload` or `download`, a stable opaque object key, a UUID `jti`, and a maximum TTL of 300 seconds; downloads default to 60 seconds and are one-time.
- All quota reservation, file finalization, share download consumption and OTP consumption invariants are enforced by PostgreSQL transactions and constraints, not read-then-write application sequences.
- Redis unavailability fails closed for OTP request rate limiting and one-time grant consumption. PostgreSQL, Redis or the configured object backend failing makes readiness return 503.
- Every behavior change follows RED → GREEN → REFACTOR. Do not commit unrelated or generated cache files.

---

## Target File Structure

| Path | Responsibility |
| --- | --- |
| `services/core-api/prisma/schema.prisma` | Single Core database schema and generator. |
| `services/core-api/prisma/migrations/*/migration.sql` | Only ordered Core production migration history. |
| `services/core-api/src/app.ts` | Express composition and dependency injection; no domain logic. |
| `services/core-api/src/config.ts` | Fail-closed environment parsing with exact TTL and secret guards. |
| `services/core-api/src/auth/access-token.ts` | Access JWT issue/verify contract. |
| `services/core-api/src/identity/*` | Email normalization, OTP lifecycle, user creation and refresh-session rotation. |
| `services/core-api/src/quota/*` | Account balance, reservations, commits, releases and ledger audit. |
| `services/core-api/src/uploads/*` | Upload intent state machine and idempotent completion. |
| `services/core-api/src/files/*` | File/folder metadata and immutable versions. |
| `services/core-api/src/sharing/*` | Shares, publications, atomic download consumption and ticket issuance. |
| `services/core-api/src/grants/*` | Core-side upload/download grant issuer. |
| `services/core-api/src/outbox/*` | Transactional event creation and worker consumption. |
| `services/storage/src/object-storage/*` | Local/MinIO/OSS adapters behind one byte-oriented interface. |
| `services/storage/src/worker.ts` | Merge/hash/finalize callback and reconciliation worker entrypoint. |
| `frontend/cruip-landing/lib/stores/auth-store.ts` | In-memory access token and cookie-backed session bootstrap. |
| `infrastructure/alicloud/docker-compose.core.yml` | Final immutable Core + Storage + Worker + Web topology. |

## Public Identity Contract

```ts
POST /api/v1/auth/email/request
body: { email: string }
202: { challengeId: string; expiresInSeconds: 600; resendAfterSeconds: 60 }
400: { error: 'Invalid email' }
429: { error: 'Too many requests' }
503: { error: 'Email delivery unavailable' }

POST /api/v1/auth/email/verify
body: { challengeId: string; email: string; code: string }
200: { accessToken: string; expiresInSeconds: 900; user: { id: string; email: string; role: 'user' | 'admin' } }
401: { error: 'Invalid or expired verification code' }
429: { error: 'Verification attempts exhausted' }
Set-Cookie: mwd_refresh=<opaque>; HttpOnly; SameSite=Lax; Path=/api/v1/auth; Max-Age=2592000; Secure in production

POST /api/v1/auth/refresh
body: none
200: { accessToken: string; expiresInSeconds: 900 }
401: { error: 'Invalid refresh session' }
Set-Cookie: rotated mwd_refresh cookie

POST /api/v1/auth/logout -> 204 and clears/revokes current refresh session
GET /api/v1/auth/me -> current user for a valid access token
```

The email provider adapter uses this exact upstream contract:

```ts
export type SendOtpInput = { to: string; code: string; ttlSeconds: 600; purpose: 'login' }
export interface EmailSender { sendOtp(input: SendOtpInput): Promise<void> }

POST ${EMAIL_PROVIDER_URL}/v1/messages/otp
Authorization: Bearer ${EMAIL_PROVIDER_TOKEN}
Content-Type: application/json
body: SendOtpInput
success: any 2xx response
```

The upstream component owns deliverability and provider policy. Core owns normalization, challenge security, rate limiting, one-time consumption and session issuance.

---

## Task 0: Record the Core-first decision and supersede the bridge plan

**Files:**
- Modify: `docs/superpowers/specs/2026-07-10-core-api-storage-architecture-design.md`
- Modify: `docs/superpowers/plans/2026-07-10-runtime-security-and-release-hardening.md`
- Create: `docs/superpowers/plans/2026-07-11-core-first-migration.md`

- [x] **Step 1: Replace invitation/password target-state language with email OTP and rotating sessions**

- [x] **Step 2: Record that old services remain frozen and no temporary grant/quota bridge will be built**

- [x] **Step 3: Self-review the spec and plan**

Run:

```bash
rg -n '\b(TB[D]|TO[D]O)\b|implement la[t]er' \
  docs/superpowers/specs/2026-07-10-core-api-storage-architecture-design.md \
  docs/superpowers/plans/2026-07-11-core-first-migration.md
git diff --check
```

Expected: no placeholder or obsolete target-state requirement; `git diff --check` exits 0.

- [x] **Step 4: Commit the approved documents**

```bash
git add docs/superpowers/specs/2026-07-10-core-api-storage-architecture-design.md \
  docs/superpowers/plans/2026-07-10-runtime-security-and-release-hardening.md \
  docs/superpowers/plans/2026-07-11-core-first-migration.md
git commit -m "docs(architecture): choose core-first passwordless identity"
```

## Task 1: Create the Core service and single database authority

**Files:**
- Create: `services/core-api/package.json`
- Create: `services/core-api/tsconfig.json`
- Create: `services/core-api/src/config.ts`
- Create: `services/core-api/src/app.ts`
- Create: `services/core-api/src/index.ts`
- Create: `services/core-api/src/__tests__/health.test.ts`
- Create: `services/core-api/prisma/schema.prisma`
- Create: `services/core-api/prisma/migrations/202607110001_core_init/migration.sql`
- Modify: `tsconfig.json`
- Modify: `pnpm-lock.yaml`

**Produces:**

```ts
export type CoreDependencies = {
  prisma: PrismaClient
  redis: Redis
  emailSender: EmailSender
  now: () => Date
  randomBytes: (size: number) => Buffer
}
export function createCoreApp(deps: CoreDependencies): express.Express
```

- [ ] **Step 1: Write failing health and configuration tests**

```ts
test('ready returns 503 when PostgreSQL is unavailable', async () => {
  const app = createCoreApp(fakes({ databaseReady: false }))
  expect((await request(app).get('/ready')).status).toBe(503)
})

test('production rejects missing OTP and session secrets', () => {
  expect(() => loadCoreConfig({ NODE_ENV: 'production' })).toThrow('CORE_SESSION_SECRET must be set')
})
```

Run: `pnpm -C services/core-api test -- health.test.ts`

Expected: FAIL because the package and app do not exist.

- [ ] **Step 2: Add the package and app composition**

`package.json` must expose `dev`, `build`, `start`, `test`, `prisma:generate`, `prisma:validate` and `migrate:deploy`. `app.ts` exposes `/live`, `/ready`, `/version` and mounts module routers; it uses `express.json({ verify })` to retain the exact callback bytes on internal completion requests without logging them. `index.ts` is the only file that listens on `CORE_PORT`.

```ts
app.get('/live', (_req, res) => res.json({ status: 'live', service: 'core-api' }))
app.get('/ready', async (_req, res) => {
  try {
    await deps.prisma.$queryRawUnsafe('SELECT 1')
    await deps.redis.ping()
    return res.json({ status: 'ready', service: 'core-api' })
  } catch {
    return res.status(503).json({ status: 'not_ready', service: 'core-api' })
  }
})
```

- [ ] **Step 3: Add the complete Core Prisma schema**

The initial migration creates these exact models and constraints:

```prisma
model User {
  id           String   @id @default(uuid())
  email        String   @unique
  displayName  String?
  role         String   @default("user")
  status       String   @default("active")
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  sessions     RefreshSession[]
  files        File[]
  uploadIntents UploadIntent[]
  quotaAccount QuotaAccount?
  quotaReservations QuotaReservation[]
  quotaLedger  QuotaLedgerEntry[]
  shares       Share[]
}

model EmailOtpChallenge {
  id             String    @id @default(uuid())
  email          String
  codeDigest     String
  failedAttempts Int       @default(0)
  expiresAt      DateTime
  consumedAt     DateTime?
  deliveryStatus String    @default("pending")
  requestedIpHash String
  createdAt      DateTime  @default(now())
  @@index([email, createdAt])
  @@index([expiresAt])
}

model RefreshSession {
  id                String    @id @default(uuid())
  familyId          String
  userId            String
  tokenHash         String    @unique
  idleExpiresAt     DateTime
  absoluteExpiresAt DateTime
  rotatedAt         DateTime?
  revokedAt         DateTime?
  replacedById      String?
  createdAt         DateTime  @default(now())
  lastUsedAt        DateTime  @default(now())
  user              User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([familyId])
  @@index([userId, revokedAt])
}

model QuotaAccount {
  userId         String   @id
  limitBytes     BigInt
  reservedBytes  BigInt   @default(0)
  committedBytes BigInt   @default(0)
  updatedAt      DateTime @updatedAt
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model UploadIntent {
  id             String   @id @default(uuid())
  userId         String
  idempotencyKey String
  objectKey      String   @unique
  fileName       String
  sizeBytes      BigInt
  mimeType       String
  parentId       String?
  status         String   @default("created")
  expiresAt      DateTime
  completedAt    DateTime?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  user           User     @relation(fields: [userId], references: [id])
  reservation    QuotaReservation?
  fileVersion    FileVersion?
  @@unique([userId, idempotencyKey])
  @@index([userId, status])
}

model QuotaReservation {
  id             String   @id @default(uuid())
  userId         String
  uploadIntentId String   @unique
  bytes          BigInt
  status         String   @default("reserved")
  expiresAt      DateTime
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  uploadIntent   UploadIntent @relation(fields: [uploadIntentId], references: [id], onDelete: Cascade)
}

model QuotaLedgerEntry {
  id          String   @id @default(uuid())
  userId      String
  businessRef String   @unique
  kind        String
  deltaBytes  BigInt
  createdAt   DateTime @default(now())
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId, createdAt])
}

model File {
  id        String    @id @default(uuid())
  ownerId   String
  parentId  String?
  name      String
  type      String
  deletedAt DateTime?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  owner     User      @relation(fields: [ownerId], references: [id])
  parent    File?     @relation("FileTree", fields: [parentId], references: [id])
  children  File[]    @relation("FileTree")
  versions  FileVersion[]
  shares    Share[]
  publication Publication?
  @@index([ownerId, parentId, deletedAt])
}

model FileVersion {
  id             String   @id @default(uuid())
  fileId         String
  uploadIntentId String   @unique
  version        Int
  objectKey      String   @unique
  sizeBytes      BigInt
  mimeType       String
  sha256         String
  createdAt      DateTime @default(now())
  file           File     @relation(fields: [fileId], references: [id])
  uploadIntent   UploadIntent @relation(fields: [uploadIntentId], references: [id])
  @@unique([fileId, version])
}

model Share {
  id            String   @id @default(uuid())
  token         String   @unique
  fileId        String
  ownerId       String
  passwordHash  String?
  expiresAt     DateTime?
  maxDownloads  Int?
  downloadCount Int      @default(0)
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  file          File     @relation(fields: [fileId], references: [id], onDelete: Cascade)
  owner         User     @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  @@index([ownerId, isActive])
}

model Publication {
  id        String   @id @default(uuid())
  fileId    String   @unique
  slug      String   @unique
  status    String   @default("draft")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  file      File     @relation(fields: [fileId], references: [id], onDelete: Cascade)
}

model OutboxEvent {
  id            String    @id @default(uuid())
  topic         String
  aggregateId   String
  payload       Json
  attempts      Int       @default(0)
  availableAt   DateTime  @default(now())
  processedAt   DateTime?
  lastErrorCode String?
  createdAt     DateTime  @default(now())
  @@index([processedAt, availableAt])
}
```

The SQL migration adds these database checks after creating the Prisma tables:

```sql
ALTER TABLE "User" ADD CONSTRAINT "User_role_check" CHECK ("role" IN ('user', 'admin'));
ALTER TABLE "User" ADD CONSTRAINT "User_status_check" CHECK ("status" IN ('active', 'disabled'));
ALTER TABLE "EmailOtpChallenge" ADD CONSTRAINT "Otp_attempts_check" CHECK ("failedAttempts" BETWEEN 0 AND 5);
ALTER TABLE "QuotaAccount" ADD CONSTRAINT "Quota_nonnegative_check" CHECK ("limitBytes" >= 0 AND "reservedBytes" >= 0 AND "committedBytes" >= 0);
ALTER TABLE "QuotaAccount" ADD CONSTRAINT "Quota_limit_check" CHECK ("reservedBytes" + "committedBytes" <= "limitBytes");
ALTER TABLE "UploadIntent" ADD CONSTRAINT "UploadIntent_status_check" CHECK ("status" IN ('created', 'uploading', 'finalizing', 'completed', 'aborted', 'expired'));
ALTER TABLE "UploadIntent" ADD CONSTRAINT "UploadIntent_size_check" CHECK ("sizeBytes" >= 0);
ALTER TABLE "QuotaReservation" ADD CONSTRAINT "Reservation_status_check" CHECK ("status" IN ('reserved', 'committed', 'released', 'expired'));
ALTER TABLE "File" ADD CONSTRAINT "File_type_check" CHECK ("type" IN ('file', 'folder'));
ALTER TABLE "FileVersion" ADD CONSTRAINT "FileVersion_size_check" CHECK ("sizeBytes" >= 0);
ALTER TABLE "Share" ADD CONSTRAINT "Share_downloads_check" CHECK ("downloadCount" >= 0 AND ("maxDownloads" IS NULL OR "maxDownloads" >= 0));
ALTER TABLE "Publication" ADD CONSTRAINT "Publication_status_check" CHECK ("status" IN ('draft', 'published', 'disabled'));
```

- [ ] **Step 4: Verify empty-database migration, tests and build**

Run:

```bash
pnpm -C services/core-api prisma:validate
pnpm -C services/core-api test
pnpm -C services/core-api build
```

With a fresh PostgreSQL database, run `pnpm -C services/core-api migrate:deploy` twice. Expected: first run applies `202607110001_core_init`; second run reports no pending migrations.

- [ ] **Step 5: Commit**

```bash
git add services/core-api tsconfig.json pnpm-lock.yaml
git commit -m "feat(core): establish single control-plane database"
```

## Task 2: Implement passwordless email OTP and rotating sessions

**Files:**
- Create: `services/core-api/src/identity/email.ts`
- Create: `services/core-api/src/identity/otp.ts`
- Create: `services/core-api/src/identity/session.ts`
- Create: `services/core-api/src/identity/router.ts`
- Create: `services/core-api/src/identity/email-sender.ts`
- Create: `services/core-api/src/auth/access-token.ts`
- Create: `services/core-api/src/identity/__tests__/otp.test.ts`
- Create: `services/core-api/src/identity/__tests__/session.test.ts`
- Create: `services/core-api/src/identity/__tests__/router.test.ts`
- Modify: `services/core-api/src/app.ts`

**Interfaces:**

```ts
export function normalizeEmail(value: unknown): string
export function createOtpDigest(pepper: string, challengeId: string, email: string, code: string): Buffer
export function issueAccessToken(user: { id: string; role: string }, secret: string): string
export function verifyAccessToken(token: string, secret: string): { userId: string; role: string }
```

- [ ] **Step 1: Write failing OTP security tests**

Tests cover normalization, non-six-digit rejection, ten-minute expiry, the fifth failed attempt locking the challenge, constant-time digest comparison, one-time consumption and two concurrent verifications producing exactly one session.

```ts
expect(normalizeEmail('  User@Example.COM ')).toBe('user@example.com')
expect(await verifyTwiceConcurrently(challenge)).toEqual([200, 401])
expect(await attemptWrongCodeFiveTimes(challenge)).toHaveProperty('finalStatus', 429)
```

Run: `pnpm -C services/core-api test -- src/identity/__tests__/otp.test.ts`

Expected: FAIL because identity modules do not exist.

- [ ] **Step 2: Implement request-code with fail-closed Redis limits**

Use Redis keys `otp:email:<sha256(email)>:<UTC-hour>` and `otp:ip:<sha256(ip)>:<UTC-hour>` with atomic `INCR` plus first-write `EXPIRE 3700`. Reject counts over 5 and 20 respectively. Generate the code with rejection sampling from `randomBytes`, create the challenge, call `EmailSender.sendOtp`, mark delivery `sent`, and return 503 while marking `failed` if delivery fails. Never log `email`, `code` or provider request bodies.

- [ ] **Step 3: Implement atomic verify and first-login creation**

Inside one serializable Prisma transaction: select the challenge, reject consumed/expired/exhausted/mismatched challenges, conditionally increment failures or conditionally set `consumedAt`, then upsert the user by normalized email. `CORE_ADMIN_EMAILS` is a comma-separated normalized allowlist used only to assign `role=admin` on first creation.

- [ ] **Step 4: Implement opaque refresh-session rotation**

The cookie token format is `<sessionId>.<base64url(32 random bytes)>`; only `sha256(fullToken)` is stored. Refreshing creates a new row in the same family, marks the old row `rotatedAt` and `replacedById`, and uses `min(now + 30 days, absoluteExpiresAt)` for the new idle expiry. Presenting an already rotated token revokes every row in its family before returning 401.

- [ ] **Step 5: Verify routes and commit**

Run:

```bash
pnpm -C services/core-api test -- src/identity
pnpm -C services/core-api build
```

Expected: all identity tests pass; no test output contains the example email, OTP or refresh token.

```bash
git add services/core-api/src
git commit -m "feat(identity): add passwordless email sessions"
```

## Task 3: Replace frontend password and invitation authentication

**Files:**
- Modify: `frontend/cruip-landing/app/(auth)/signin/page.tsx`
- Modify: `frontend/cruip-landing/app/(auth)/signup/page.tsx`
- Delete: `frontend/cruip-landing/app/(auth)/reset-password/reset-password-form.tsx`
- Modify: `frontend/cruip-landing/app/(auth)/reset-password/page.tsx`
- Modify: `frontend/cruip-landing/lib/stores/auth-store.ts`
- Modify: `frontend/cruip-landing/lib/api/client.ts`
- Modify: `frontend/cruip-landing/app/admin/components/admin-menubar.tsx`
- Modify: `frontend/cruip-landing/lib/api/admin.ts` to remove invitation exports while preserving unrelated admin APIs
- Delete: `frontend/cruip-landing/app/admin/invitations/page.tsx`
- Create: `frontend/cruip-landing/tests/passwordless_auth_test.py`

- [ ] **Step 1: Write failing source-contract tests**

```python
assert "localStorage" not in AUTH_STORE
assert "refreshToken" not in AUTH_STORE
assert "invitationCode" not in SIGNUP_PAGE
assert "type='password'" not in SIGNIN_PAGE
assert "/auth/email/request" in AUTH_STORE
assert "credentials: 'include'" in API_CLIENT
```

Run: `python3 -m unittest frontend/cruip-landing/tests/passwordless_auth_test.py -v`

Expected: FAIL on the current password, invitation and persisted-token implementation.

- [ ] **Step 2: Implement the two-step OTP screen**

Step `email` posts the normalized email and stores only `challengeId` plus the 60-second resend countdown in component memory. Step `code` accepts exactly six digits, posts verification, then routes admins to `/admin/overview` and users to `/account`. Refresh or navigation returns to the email step; no OTP is persisted.

- [ ] **Step 3: Make access tokens memory-only**

The Zustand store must not use `persist`. `bootstrap()` calls `/auth/refresh` with `credentials: 'include'`, stores the returned access token in memory and then calls `/auth/me`. The API client retries one 401 after a single shared refresh promise; logout calls `/auth/logout`, clears memory and navigates to `/signin`.

- [ ] **Step 4: Remove obsolete invitation/password surfaces**

`/signup` and `/reset-password` redirect to `/signin`. Remove the invitation navigation and admin page/API imports. Replace EventSource query-token usage with a fetch-based stream carrying `Authorization: Bearer <accessToken>`.

- [ ] **Step 5: Verify and commit**

Run:

```bash
python3 -m unittest frontend/cruip-landing/tests/passwordless_auth_test.py -v
pnpm -C frontend/cruip-landing build
```

```bash
git add frontend/cruip-landing
git commit -m "feat(frontend): adopt passwordless cookie sessions"
```

## Task 4: Implement quota reservations and upload intents

**Files:**
- Create: `services/core-api/src/auth/middleware.ts`
- Create: `services/core-api/src/auth/__tests__/middleware.test.ts`
- Create: `services/core-api/src/grants/storage-grant.ts`
- Create: `services/core-api/src/grants/__tests__/storage-grant.test.ts`
- Create: `services/core-api/src/quota/service.ts`
- Create: `services/core-api/src/uploads/service.ts`
- Create: `services/core-api/src/uploads/router.ts`
- Create: `services/core-api/src/uploads/__tests__/reservation.test.ts`
- Modify: `services/core-api/src/config.ts`
- Modify: `services/core-api/src/identity/otp.ts`
- Modify: `services/core-api/src/identity/__tests__/router.test.ts`
- Modify: `services/core-api/src/app.ts`

**Interfaces:**

```ts
POST /api/v1/upload-intents
headers: Authorization, Idempotency-Key
body: { fileName: string; sizeBytes: string; mimeType: string; parentId?: string }
201/200: { id: string; objectKey: string; uploadGrant: string; expiresAt: string }

POST /api/v1/upload-intents/:id/cancel -> releases an active reservation exactly once
GET /api/v1/quota -> { limitBytes: string; reservedBytes: string; committedBytes: string; availableBytes: string }

PATCH /api/v1/admin/users/:userId/quota
body: { limitBytes: string }
200: { limitBytes: string; reservedBytes: string; committedBytes: string; availableBytes: string }
409: requested limit is below reserved + committed
```

All quota/upload routes use the shared access-token middleware. It verifies the exact access-JWT contract, reloads the user from Core, rejects disabled users, and checks the current database role for admin routes rather than trusting a possibly stale role claim. A newly verified email creates or backfills exactly one `QuotaAccount` in the same identity transaction using `DEFAULT_USER_QUOTA_BYTES`; an existing account is never reset on login.

- [ ] **Step 1: Write failing concurrent reservation tests**

Create a quota of 100 bytes and concurrently request two 80-byte intents. Assert exactly one succeeds, one returns 413, the account reserves 80 bytes, and retrying the winning `Idempotency-Key` with the same body returns the same intent without another reservation; the same key with a different body returns 409. Cover missing/invalid bearer, disabled user, non-admin quota update, quota reduction below occupied bytes, and first-login quota creation/backfill without later reset. Add grant-contract tests for `alg=HS256`, `typ=storage-grant`, `aud=storage-api`, `purpose=upload`, exact opaque UUID `objectKey`, immutable `uploadIntentId`, decimal `maxBytes`, UUID `jti`, independent `STORAGE_GRANT_SECRET`, and expiry no later than 300 seconds.

- [ ] **Step 2: Implement one-transaction reservation**

Validate `Idempotency-Key` as 1-128 characters from `[A-Za-z0-9._:-]`; validate `fileName` as 1-255 trimmed characters with no slash, backslash, NUL or control byte; parse `sizeBytes` as a positive decimal `BigInt`; and require a nonempty MIME type of at most 255 characters. When `parentId` exists, verify it is an undeleted folder owned by the same user. Use a serializable Prisma transaction and a conditional `UPDATE` equivalent to `committed + reserved + requested <= limit`. Create `UploadIntent`, `QuotaReservation` and reservation audit row `reservation-create:<reservationId>` in the same transaction. Use a UUID object key and issue the shared grant module's upload grant only after commit. The grant issuer accepts an enumerated purpose and never accepts a user-supplied path.

- [ ] **Step 3: Implement idempotent cancel/expiry release**

Conditional transition `reserved -> released` decrements `QuotaAccount.reservedBytes` once and creates one ledger row with business ref `reservation-release:<reservationId>`. Cancel is owner-scoped and idempotently returns 204 for an already released/expired reservation. Before quota read or new reservation, lazily release that user's expired reservations in bounded serializable batches; multiple Core replicas may race, but conditional status updates and unique business refs allow each reservation to affect the balance once.

- [ ] **Step 4: Verify and commit**

Run: `pnpm -C services/core-api test -- src/auth src/identity src/uploads src/quota src/grants && pnpm -C services/core-api build`

```bash
git add services/core-api/src/auth services/core-api/src/config.ts services/core-api/src/identity services/core-api/src/grants services/core-api/src/quota services/core-api/src/uploads services/core-api/src/app.ts
git commit -m "feat(core): reserve quota with upload intents"
```

## Task 5: Finalize files, quota and outbox atomically

**Files:**
- Create: `services/core-api/src/files/service.ts`
- Create: `services/core-api/src/files/router.ts`
- Create: `services/core-api/src/outbox/service.ts`
- Create: `services/core-api/src/files/__tests__/finalize.test.ts`
- Modify: `services/core-api/src/app.ts`

**Interfaces:**

```ts
POST /api/v1/internal/upload-intents/:id/complete
headers: X-Core-Timestamp, X-Core-Signature
body: { objectKey: string; sizeBytes: string; sha256: string }
200: { fileId: string; versionId: string; idempotent: boolean }
```

- [ ] **Step 1: Write failing ten-retry completion test**

Submit the same signed completion ten times. Assert every authenticated retry returns the same file/version identity, with one FileVersion, one committed QuotaLedgerEntry, one processed UploadIntent and one `file.version.created` OutboxEvent.

- [ ] **Step 2: Implement callback identity**

Verify `hex(HMAC_SHA256(CORE_CALLBACK_SECRET, timestamp + '.' + rawBody))` with constant-time comparison, allow at most 300 seconds clock skew, and reject missing, stale or invalid callback identity before parsing business fields. An authenticated replay inside the clock window is handled by the business idempotency key (`uploadIntentId` plus immutable `objectKey`), not by an in-memory replay cache, so worker retries remain valid across Core restarts.

- [ ] **Step 3: Implement the completion transaction**

In one serializable transaction, verify the callback `objectKey` and exact uploaded size against the intent, then conditionally transition an active intent (`created`, `uploading` or `finalizing`) to `completed`. Create or update the logical File, create its immutable version with unique `uploadIntentId`, move bytes from reserved to committed, create ledger ref `upload-commit:<intentId>` and insert the outbox event. A repeated completion with the same immutable result returns the existing IDs and performs no writes; a replay with different size, digest or object key is rejected as a conflict. A concurrent cancel can win only by first changing the reservation/intent to a terminal released state, in which case finalization fails without committing quota.

- [ ] **Step 4: Verify and commit**

Run: `pnpm -C services/core-api test -- src/files src/outbox && pnpm -C services/core-api build`

```bash
git add services/core-api/src/files services/core-api/src/outbox services/core-api/src/app.ts
git commit -m "feat(core): finalize uploads transactionally"
```

## Task 6: Issue private, share and publication download grants

**Files:**
- Modify: `services/core-api/src/grants/storage-grant.ts`
- Create: `services/core-api/src/sharing/service.ts`
- Create: `services/core-api/src/sharing/router.ts`
- Create: `services/core-api/src/sharing/__tests__/download-ticket.test.ts`
- Modify: `services/core-api/src/app.ts`

**Interfaces:**

```ts
POST /api/v1/files/:fileId/download-ticket
POST /api/v1/shares/:token/download-ticket
POST /api/v1/publications/:slug/download-ticket
200: { objectKey: string; downloadGrant: string; expiresInSeconds: 60; fileName: string; mimeType: string }
```

- [ ] **Step 1: Write failing authorization and concurrency tests**

Cover non-owner rejection, wrong share password, expired/disabled share, draft publication, wrong grant purpose, and two concurrent requests for the final allowed share download producing exactly one 200.

- [ ] **Step 2: Implement grant issuance**

Core signs HS256 grants with independent `STORAGE_GRANT_SECRET`, `aud=storage-api`, `typ=storage-grant`, purpose, objectKey, UUID jti and 60-second expiry. Never include user-supplied path fragments or return grant in a URL.

- [ ] **Step 3: Implement atomic share consumption**

Within one transaction select the current FileVersion and conditionally update the share with `isActive=true`, non-expired and `(maxDownloads IS NULL OR downloadCount < maxDownloads)`. Only a successful update may receive a grant.

- [ ] **Step 4: Verify and commit**

Run: `pnpm -C services/core-api test -- src/sharing src/grants && pnpm -C services/core-api build`

```bash
git add services/core-api/src/grants services/core-api/src/sharing services/core-api/src/app.ts
git commit -m "feat(core): centralize download authorization"
```

## Task 7: Complete the Storage Data Plane and Worker boundary

**Files:**
- Create: `services/storage/src/object-storage/types.ts`
- Create: `services/storage/src/object-storage/local.ts`
- Create: `services/storage/src/object-storage/minio.ts`
- Create: `services/storage/src/object-storage/oss.ts`
- Create: `services/storage/src/grants/verifier.ts`
- Create: `services/storage/src/finalization-queue.ts`
- Create: `services/storage/src/worker.ts`
- Create: `services/storage/src/__tests__/object-storage.test.ts`
- Create: `services/storage/src/__tests__/grant-verifier.test.ts`
- Create: `services/storage/src/__tests__/worker-callback.test.ts`
- Modify: `services/storage/src/index.ts`
- Modify: `services/storage/package.json`

**Interface:**

```ts
export interface ObjectStorage {
  writePart(objectKey: string, partNumber: number, body: Readable): Promise<void>
  completeObject(objectKey: string, parts: number): Promise<{ sizeBytes: bigint; sha256: string }>
  openRead(objectKey: string): Promise<Readable>
  stat(objectKey: string): Promise<{ sizeBytes: bigint } | null>
  deleteObject(objectKey: string): Promise<void>
}
```

The byte API and queue boundary are exact:

```ts
PUT  /api/v1/storage/uploads/:objectKey/parts/:partNumber
POST /api/v1/storage/uploads/:objectKey/complete
GET  /api/v1/storage/objects/:objectKey

Authorization: Bearer <storage-grant>

Redis Stream: storage:finalize
job: { uploadIntentId: string; objectKey: string; parts: number }
consumer group: storage-workers
```

Upload grants may authorize the idempotent part writes and one completion enqueue for the same upload intent during their at-most-300-second lifetime. Download grants are consumed once with an atomic Redis `SET grant:used:<jti> 1 NX EX <remaining-ttl>` before opening bytes; Redis errors fail closed. Neither type permits an `objectKey`, upload intent or purpose different from the signed claims.

- [ ] **Step 1: Write failing adapter containment tests**

Run every encoded traversal and absolute-path case against the Local adapter. Assert no filesystem method receives a path outside `STORAGE_PATH/files` or `STORAGE_PATH/parts`. Cover invalid signature, wrong algorithm/type/audience/purpose/object key, expiry, download replay, and Redis failure; no invalid grant may call an object-storage method.

- [ ] **Step 2: Extract Storage API and Worker commands**

`node dist/index.js api` serves grant-protected byte routes and durably enqueues completion into the Redis Stream only after all declared parts exist. `node dist/index.js worker` uses a Redis consumer group, claims/reclaims pending jobs, composes the final object, calculates SHA-256 and sends the signed idempotent Core callback. It acknowledges a job only after Core accepts the callback or returns the same already-completed identity. Neither command imports Core Prisma or business tables.

- [ ] **Step 3: Implement retry and orphan rules**

Worker retries callback 5 times with capped exponential delays 1, 2, 4, 8 and 16 seconds. After transient exhaustion it leaves the stream entry pending for later reclaim, retains completed objects for reconciliation, and never deletes the only final object because a callback failed. Permanent Core conflicts move the job to `storage:finalize:dead-letter` with only opaque IDs and error codes. API readiness requires Redis and the configured object adapter; Worker readiness requires Redis consumer-group access and the object adapter.

- [ ] **Step 4: Verify and commit**

Run: `pnpm -C services/storage test && pnpm -C services/storage build`

```bash
git add services/storage
git commit -m "feat(storage): separate object API and worker"
```

## Task 8: Create the immutable Core production and CI contract

**Files:**
- Create: `services/core-api/Dockerfile`
- Create: `services/storage/Dockerfile`
- Create: `infrastructure/alicloud/docker-compose.core.yml`
- Create: `scripts/verify-core-release-contract.sh`
- Modify: `package.json`
- Modify: `Makefile`
- Modify: `.github/workflows/ci.yml`
- Modify: `infrastructure/alicloud/deploy.sh`
- Modify: `infrastructure/alicloud/rollback.sh`

- [ ] **Step 1: Write the failing release contract test**

The script must reject source mounts, mutable `latest`, missing healthchecks, missing migration job, `|| true`, `git reset`, rsync, volume deletion and any production service other than postgres, redis, object storage, core-api, storage-api, storage-worker, web and nginx.

- [ ] **Step 2: Implement exact workspace quality commands**

Root scripts use quoted selectors and fail when no target matches:

```json
{
  "build:all": "pnpm --filter './packages/*' --filter './services/*' --filter './apps/*' --filter './frontend/*' run build",
  "test:all": "pnpm --if-present --filter './services/*' --filter './apps/*' --filter './frontend/*' run test",
  "lint:all": "pnpm --if-present --filter './services/*' --filter './apps/*' --filter './frontend/*' run lint"
}
```

- [ ] **Step 3: Implement immutable compose and migration job**

Every application image is `${REGISTRY}/mywebdrive-<name>:${IMAGE_TAG}` with required nonempty `IMAGE_TAG`. The one-shot `core-migrate` runs `prisma migrate deploy` before Core starts. Application containers are read-only except named data/tmp volumes and include `/ready` healthchecks. No source tree is mounted.

- [ ] **Step 4: Implement deploy and rollback by image tag**

Both scripts require an explicit immutable tag, validate configuration, pull images, run migration, start services, wait for readiness/version and record the deployed tag/digests. Neither script runs Git commands, rsync, `down -v` or deletes data.

- [ ] **Step 5: Verify and commit**

Run:

```bash
pnpm run build:all
pnpm run typecheck
pnpm run lint:all
pnpm run test:all
bash scripts/verify-core-release-contract.sh infrastructure/alicloud/docker-compose.core.yml
docker compose -f infrastructure/alicloud/docker-compose.core.yml config -q
```

```bash
git add package.json Makefile .github/workflows/ci.yml services/core-api/Dockerfile services/storage/Dockerfile infrastructure/alicloud scripts/verify-core-release-contract.sh
git commit -m "fix(release): ship immutable core topology"
```

## Task 9: Cut over and retire the split control plane

**Files:**
- Modify: Nginx production configuration selected by `infrastructure/alicloud/docker-compose.core.yml`
- Modify: `frontend/cruip-landing/next.config.js`
- Modify: `docs/env.example`
- Move to archive or delete from production composition: `services/auth`, `services/user`, `services/metadata`, `services/sharing`, `services/api-gateway-node`
- Create: `scripts/smoke-core-e2e.sh`
- Create: `docs/runbooks/core-cutover-and-rollback.md`

- [ ] **Step 1: Write the empty-environment end-to-end gate**

The script provisions empty PostgreSQL/Redis/object volumes and verifies: email request with fake upstream, OTP first-user creation, refresh rotation, quota reservation, upload completion, private ticket, single-consumption share ticket, grant replay rejection, logout revocation, `/ready`, `/version`, and no old service in the active compose.

- [ ] **Step 2: Run the gate before cutover**

Expected: FAIL because Nginx/frontend still target Gateway and old services remain active.

- [ ] **Step 3: Switch the only public route**

Nginx sends `/api/v1/storage/objects/*` and upload byte routes to Storage; every other `/api/v1/*` route goes to Core. Frontend uses same-origin relative paths. Remove Gateway, Auth, User, Metadata and Sharing from production compose and deployment scripts.

- [ ] **Step 4: Verify rollback without old-service writes**

Rollback restores the previous complete Core image set and never re-enables old service writes against the Core database. Restore rehearsal uses the pre-cutover snapshot in an isolated environment before production traffic switches.

- [ ] **Step 5: Run complete verification and commit**

Run:

```bash
make quality-check
bash scripts/smoke-core-e2e.sh
bash scripts/assert-no-sensitive-artifacts.sh
git diff --check
```

```bash
git add infrastructure frontend docs scripts services package.json Makefile pnpm-lock.yaml
git commit -m "feat(core): cut over the unified control plane"
```

---

## Completion Evidence

The Core-first migration is complete only when all of the following are captured from fresh commands:

- Empty PostgreSQL applies the single Core migration history twice without error.
- All Core, Storage and frontend tests pass with zero skipped security cases.
- Two concurrent OTP verifies consume one challenge; refresh reuse revokes its family.
- Two concurrent 80-byte reservations against a 100-byte account commit only one reservation.
- Ten repeated completion callbacks produce one version, one ledger commit and one outbox event.
- Two final-share download requests produce one ticket; the Storage grant succeeds once and replay fails.
- PostgreSQL, Redis and object-backend outages each make readiness return 503.
- Production compose contains no source mounts, mutable tags, split control-plane services or independent migration histories.
- Public API logs contain no email, OTP, access token, refresh token, grant, Cookie or Authorization value.
