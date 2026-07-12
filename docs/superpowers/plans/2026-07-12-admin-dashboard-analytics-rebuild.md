# Admin Dashboard Analytics Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken legacy overview aggregation with a Core Read Model, an idempotent Analytics Worker, durable successful-download facts, private Prometheus telemetry, and a failure-isolated administrator frontend.

**Architecture:** Core PostgreSQL remains the only business authority. A separate Analytics Worker projects deterministic Core Outbox events into daily read tables, Storage records two-phase download facts through a Redis Stream and signed Core callbacks, and Core queries a private Prometheus service for runtime health. The frontend queries Business Analytics and System Health independently.

**Tech Stack:** Node.js 20+, TypeScript strict mode, Express 4, Prisma 5, PostgreSQL 16, Redis 7 Streams, prom-client 15, Prometheus, Vitest 4, Supertest, Next.js 15, React 19, Docker Compose v2.

## Global Constraints

- Use canonical terms from `CONTEXT.md`: Core Read Model, Analytics Worker, Business Analytics, System Health, Successful Download, and Committed Storage Bytes.
- Never restore `services/api-gateway-node` or any retired Auth/User/Metadata/Sharing service to production.
- Public application paths remain under `/api/v1/*`; public `/metrics` and `/api/v1/internal/*` remain 404 through Nginx.
- Business calendar dates use `Asia/Shanghai`; `7d` is today plus six preceding dates and `30d` is today plus twenty-nine.
- All integer measurements in Dashboard JSON are decimal strings; missing coverage is `null`, never zero.
- Core events contain opaque IDs and numeric facts only. Never persist or label email, IP, grant, token, cookie, Authorization, object credential, or raw query string values.
- Existing Core identity, quota, upload, file, sharing, publication, and grant invariants remain unchanged except for transactional event hooks.
- Every behavior change follows RED -> GREEN -> REFACTOR and is covered by a focused Vitest or shell contract test.
- Agent branches may commit inside isolated worktrees. The primary worktree imports them with `git cherry-pick -n`; it creates no implementation commit until all local Docker E2E gates pass.

## Parallel Execution Map

| Worktree branch | Owner | Exclusive primary paths | Integration-only paths left to root |
| --- | --- | --- | --- |
| `codex/dashboard-core-read-model` | Core agent | `services/core-api/src/analytics/**`, Core analytics migration/schema additions, generic Outbox helpers | `services/core-api/src/app.ts`, `services/core-api/src/index.ts`, production Compose |
| `codex/dashboard-download-facts` | Download agent | Core grant/sharing download files, `services/storage/src/download-events/**`, Storage download tests | shared Core schema, Core app composition, production Compose |
| `codex/dashboard-prometheus` | Observability agent | `packages/observability/**`, `services/core-api/src/system-health/**`, Prometheus config, metrics tests | shared Core/Storage entrypoints, final Compose allowlist |
| Primary worktree | Root | frontend Dashboard, app/entrypoint wiring, shared schema conflict resolution, Compose, smoke E2E, CI/release contract | final verification, commit, push, deployment |

---

### Task 1: Core Read Model and Analytics Worker

**Files:**
- Modify: `services/core-api/prisma/schema.prisma`
- Create: `services/core-api/prisma/migrations/202607120001_dashboard_analytics/migration.sql`
- Modify: `services/core-api/src/outbox/service.ts`
- Create: `services/core-api/src/analytics/types.ts`
- Create: `services/core-api/src/analytics/range.ts`
- Create: `services/core-api/src/analytics/projector.ts`
- Create: `services/core-api/src/analytics/worker.ts`
- Create: `services/core-api/src/analytics/service.ts`
- Create: `services/core-api/src/analytics/router.ts`
- Create: `services/core-api/src/analytics/__tests__/range.test.ts`
- Create: `services/core-api/src/analytics/__tests__/projector.test.ts`
- Create: `services/core-api/src/analytics/__tests__/worker.test.ts`
- Create: `services/core-api/src/analytics/__tests__/router.test.ts`
- Modify: `services/core-api/src/identity/otp.ts`
- Modify: `services/core-api/src/identity/session.ts`

**Interfaces:**
- Produces: `createAnalyticsRouter({ prisma, sessionSecret, now }): express.Router`.
- Produces: `runAnalyticsWorker({ prisma, signal, now, sleep, batchSize }): Promise<void>`.
- Produces: `parseDashboardRange(kind, now): { kind; timezone; start; end; dates }`.
- Produces: `enqueueDomainEvent(tx, { dedupeKey, topic, aggregateId, occurredAt, payload }): Promise<void>`.
- Produces: `GET /api/v1/admin/dashboard/business?range=today|7d|30d` contract from the design specification.
- Consumes later: `download.completed:<downloadAttemptId>` Outbox events created by Task 2.

- [ ] **Step 1: Write the failing range tests**

Cover `today`, `7d`, `30d`, invalid range, the `2026-07-12T12:00:00.000Z` Shanghai boundary, and month crossing. Assert `7d.start === 2026-07-05T16:00:00.000Z` and `end === now`.

Run: `pnpm -C services/core-api test -- src/analytics/__tests__/range.test.ts`

Expected: FAIL because `src/analytics/range.ts` does not exist.

- [ ] **Step 2: Implement exact range parsing**

Define:

```ts
export type DashboardRangeKind = 'today' | '7d' | '30d'
export type DashboardRange = {
  kind: DashboardRangeKind
  timezone: 'Asia/Shanghai'
  start: Date
  end: Date
  dates: string[]
}
export function parseDashboardRange(value: unknown, now: Date): DashboardRange
```

Reject unsupported values with `InvalidDashboardRangeError`. Compute Shanghai dates without relying on the host timezone.

Run: `pnpm -C services/core-api test -- src/analytics/__tests__/range.test.ts`

Expected: PASS.

- [ ] **Step 3: Write the failing Prisma projection tests**

Seed two `file.version.created` events with the same `dedupeKey`, one `user.created`, and one `user.activity.recorded`. Assert one `AnalyticsEventReceipt` per source key, one upload increment, one created-user increment, and one active-user row.

Run: `pnpm -C services/core-api test -- src/analytics/__tests__/projector.test.ts`

Expected: FAIL because projection models and projector do not exist.

- [ ] **Step 4: Add read-model schema and migration**

Add exact models:

```prisma
model AnalyticsDaily {
  date           DateTime @id @db.Date
  uploadsCount   BigInt   @default(0)
  uploadsBytes   BigInt   @default(0)
  downloadsCount BigInt   @default(0)
  downloadsBytes BigInt   @default(0)
  createdUsers   BigInt   @default(0)
  updatedAt      DateTime @updatedAt
}

model AnalyticsDailyActiveUser {
  date        DateTime @db.Date
  userId      String
  firstSeenAt DateTime
  @@id([date, userId])
}

model AnalyticsEventReceipt {
  sourceKey     String   @id
  outboxEventId String?
  topic         String
  occurredAt    DateTime
  processedAt   DateTime @default(now())
  @@index([outboxEventId])
}

model AnalyticsCoverage {
  metric       String   @id
  startedAt    DateTime
  complete     Boolean  @default(true)
  gapStartedAt DateTime?
  updatedAt    DateTime @updatedAt
}
```

Add check constraints preventing negative daily counters. Add indexes on `FileVersion.createdAt`, `UploadIntent.completedAt`, and `RefreshSession.lastUsedAt` for reconciliation queries.

Run: `pnpm -C services/core-api prisma:generate && pnpm -C services/core-api exec prisma validate --schema prisma/schema.prisma`

Expected: PASS.

- [ ] **Step 5: Implement idempotent projection**

`projectOutboxEvent(tx, event)` first inserts `AnalyticsEventReceipt` using `event.dedupeKey` as `sourceKey`. A duplicate receipt returns without updating aggregates. Worker claims are filtered to exactly `user.created`, `user.activity.recorded`, `file.version.created`, and `download.completed`; events for unknown topics are not claimed or marked processed.

Run: `pnpm -C services/core-api test -- src/analytics/__tests__/projector.test.ts`

Expected: PASS with duplicate projection unchanged.

- [ ] **Step 6: Write and implement worker claim/retry tests**

Test bounded batches, `FOR UPDATE SKIP LOCKED`, successful `processedAt`, sanitized error codes, capped retry delays, abort signal shutdown, and continued processing after a poison event.

Run: `pnpm -C services/core-api test -- src/analytics/__tests__/worker.test.ts`

Expected: FAIL before implementation, then PASS after `worker.ts` is implemented.

- [ ] **Step 7: Generalize transactional Outbox creation**

Keep `enqueueFileVersionCreated()` as a typed wrapper. Add `enqueueDomainEvent()` and use it from the identity user-creation/session-rotation transactions. Dedupe activity as `user.activity:<userId>:<YYYY-MM-DD>`.

Run: `pnpm -C services/core-api test -- src/identity src/files src/analytics`

Expected: PASS with no duplicate daily activity event.

- [ ] **Step 8: Write and implement the Business Analytics router**

Test missing token 401, non-admin 403, invalid range 400, admin 200, decimal strings, `null` for uncovered data, totals from authoritative tables, daily series from projections, and lag/freshness fields.

Run: `pnpm -C services/core-api test -- src/analytics/__tests__/router.test.ts`

Expected: FAIL before router implementation, then PASS.

- [ ] **Step 9: Verify and commit the agent branch**

Run:

```bash
pnpm -C services/core-api test -- src/analytics src/identity src/files
pnpm -C services/core-api build
git diff --check
```

Expected: all commands exit 0.

Commit: `feat(core): add dashboard analytics read model`

---

### Task 2: Durable Successful-download Facts

**Files:**
- Modify: `services/core-api/prisma/schema.prisma`
- Modify: `services/core-api/src/grants/storage-grant.ts`
- Modify: `services/core-api/src/grants/__tests__/storage-grant.test.ts`
- Modify: `services/core-api/src/sharing/service.ts`
- Modify: `services/core-api/src/sharing/router.ts`
- Modify: `services/core-api/src/sharing/__tests__/download-ticket.test.ts`
- Create: `services/core-api/src/analytics/download-attempt.ts`
- Create: `services/core-api/src/analytics/__tests__/download-attempt.test.ts`
- Create: `services/storage/src/download-events/types.ts`
- Create: `services/storage/src/download-events/queue.ts`
- Create: `services/storage/src/download-events/callback.ts`
- Create: `services/storage/src/download-events/__tests__/queue.test.ts`
- Modify: `services/storage/src/grants/verifier.ts`
- Modify: `services/storage/src/api.ts`
- Modify: `services/storage/src/worker.ts`
- Modify: `services/storage/src/runtime.ts`
- Create: `services/storage/src/__tests__/download-completion.test.ts`

**Interfaces:**
- Produces grant claims: `{ downloadAttemptId, fileVersionId, expectedBytes }` for every download purpose.
- Produces Redis Stream records: `{ kind: 'started' | 'completed', attemptId, bytes, occurredAt }`.
- Produces private callbacks: `POST /api/v1/internal/download-attempts/:id/started|completed` with the existing timestamped HMAC body contract.
- Produces Core `download.completed:<attemptId>` Outbox events consumed by Task 1.

- [ ] **Step 1: Write failing Core download-attempt tests**

Test `issued -> started -> completed`, `started -> unknown`, duplicate start/completion, wrong version/byte conflict, and completion creating exactly one Outbox event.

Run: `pnpm -C services/core-api test -- src/analytics/__tests__/download-attempt.test.ts`

Expected: FAIL because the model and service do not exist.

- [ ] **Step 2: Add the exact download-attempt model**

```prisma
model DownloadAttempt {
  id            String   @id @default(uuid())
  fileVersionId String
  purpose       String
  expectedBytes BigInt
  status        String   @default("issued")
  issuedAt      DateTime @default(now())
  startedAt     DateTime?
  completedAt   DateTime?
  unknownAt     DateTime?
  @@index([status, issuedAt])
  @@index([fileVersionId])
}
```

The integration migration combines this model with Task 1's migration under one final ordered migration. Agent branches may use a local migration for tests; root resolves the final numbering before E2E.

- [ ] **Step 3: Extend grants and ticket issuance**

Create `DownloadAttempt` before returning a ticket. Add signed download claims and verify them strictly in Core and Storage. Do not add user email, share token, or grant persistence.

Run:

```bash
pnpm -C services/core-api test -- src/grants src/sharing
pnpm -C services/storage test -- src/__tests__/grant-verifier.test.ts
```

Expected: PASS after implementation.

- [ ] **Step 4: Write failing two-phase Redis queue tests**

Test `download.started` append before the first byte, `download.completed` append after matching bytes, reclaim of pending entries, idempotent ack, and unknown-attempt timeout input.

Run: `pnpm -C services/storage test -- src/download-events/__tests__/queue.test.ts`

Expected: FAIL before queue implementation, then PASS.

- [ ] **Step 5: Implement the Storage streaming boundary**

Update the object download route to:

1. verify grant and expected size;
2. consume the one-time grant;
3. append `started` before sending headers/body;
4. count bytes and observe abort;
5. append `completed` only after source completion with exact bytes;
6. never append completion on abort or mismatch.

Run: `pnpm -C services/storage test -- src/__tests__/download-completion.test.ts`

Expected: PASS for full stream, abort, mismatch, Redis failure, and replay cases.

- [ ] **Step 6: Implement Storage Worker callback delivery**

Extend the existing worker loop with fair polling between upload-finalization and download-event streams. Reclaim pending download facts, sign callback bodies with `CORE_CALLBACK_SECRET`, ack only after Core returns 2xx/idempotent success, and retain transient failures.

Run: `pnpm -C services/storage test -- src/__tests__/worker-callback.test.ts src/__tests__/worker-loop.test.ts`

Expected: PASS.

- [ ] **Step 7: Verify and commit the agent branch**

Run:

```bash
pnpm -C services/core-api test -- src/grants src/sharing src/analytics/__tests__/download-attempt.test.ts
pnpm -C services/storage test
pnpm -C services/core-api build
pnpm -C services/storage build
git diff --check
```

Expected: all commands exit 0.

Commit: `feat(storage): record durable download completion facts`

---

### Task 3: Private Prometheus and System Health

**Files:**
- Modify: `packages/observability/src/index.ts`
- Modify: `packages/observability/package.json`
- Create: `services/core-api/src/system-health/prometheus.ts`
- Create: `services/core-api/src/system-health/service.ts`
- Create: `services/core-api/src/system-health/router.ts`
- Create: `services/core-api/src/system-health/__tests__/prometheus.test.ts`
- Create: `services/core-api/src/system-health/__tests__/router.test.ts`
- Create: `infrastructure/alicloud/prometheus/Dockerfile`
- Create: `infrastructure/alicloud/prometheus/prometheus.yml`
- Modify: `infrastructure/alicloud/docker-compose.core.yml`
- Modify: `infrastructure/alicloud/env.example`
- Modify: `scripts/verify-core-release-contract.sh`

**Interfaces:**
- Produces: `createAppTelemetry({ service }): { logger, httpMiddleware, metricsHandler, register }`.
- Produces: `createSystemHealthRouter({ prisma, sessionSecret, prometheus, now }): express.Router`.
- Produces: `GET /api/v1/admin/dashboard/system?range=today|7d|30d`.
- Produces: private Prometheus origin `http://prometheus:9090` through `PROMETHEUS_URL`.

- [ ] **Step 1: Write failing bounded-label telemetry tests**

Assert normalized Express route templates, status/method/service labels, no query string/object key/share token labels, request counter increment, and duration histogram observation.

Run: `pnpm -C packages/observability test`

Expected: FAIL until a package test script and tests are added, then PASS.

- [ ] **Step 2: Implement reusable telemetry**

Retain current logger redaction. Ensure metric labels use the matched route template or a fixed `unmatched` label, never `req.path`. Add explicit domain counters/histograms through focused constructors rather than an unbounded label API.

Run: `pnpm -C packages/observability test && pnpm -C packages/observability build`

Expected: PASS.

- [ ] **Step 3: Write failing PromQL adapter tests**

Assert callers choose only predefined range templates. Cover request increase, 5xx increase, error rate, p95/p99 histogram quantiles, timeout, malformed payload, partial query failure, and no raw caller PromQL.

Run: `pnpm -C services/core-api test -- src/system-health/__tests__/prometheus.test.ts`

Expected: FAIL before implementation, then PASS.

- [ ] **Step 4: Implement System Health router**

Use Core admin middleware. Merge predefined Prometheus results with direct Core Outbox pending/oldest-age queries. Return `availability: available | partial | unavailable`, decimal-string integer counters, numeric rates/latencies, and 503 only if no health result can be established.

Run: `pnpm -C services/core-api test -- src/system-health`

Expected: PASS for admin, non-admin, partial, timeout, and unavailable cases.

- [ ] **Step 5: Add private Prometheus production service**

Build `mywebdrive-prometheus` from a versioned `prom/prometheus` base pinned by digest, with `prometheus.yml` copied into the image. The production service has no config bind mount, no published port, persistent `prometheus-data`, 15-second scrape, 30-day retention, healthcheck, read-only root filesystem with the required writable data volume, dropped capabilities, and `no-new-privileges`.

Scrape exactly `core-api:8080`, `storage-api:7084`, and `storage-worker:7085`. Public Nginx keeps `/metrics` 404.

Run: `bash scripts/verify-core-release-contract.sh`

Expected: PASS after allowlist and security contract updates.

- [ ] **Step 6: Verify and commit the agent branch**

Run:

```bash
pnpm -C packages/observability test
pnpm -C packages/observability build
pnpm -C services/core-api test -- src/system-health
pnpm -C services/core-api build
bash scripts/verify-core-release-contract.sh
git diff --check
```

Expected: all commands exit 0.

Commit: `feat(observability): add private dashboard system health`

---

### Task 4: Shared Runtime Integration

**Files:**
- Modify: `services/core-api/src/app.ts`
- Modify: `services/core-api/src/index.ts`
- Modify: `services/core-api/src/config.ts`
- Modify: `services/core-api/package.json`
- Modify: `services/storage/src/index.ts`
- Modify: `services/storage/package.json`
- Modify: `infrastructure/alicloud/docker-compose.core.yml`
- Modify: `infrastructure/alicloud/deploy.sh`
- Modify: `infrastructure/alicloud/rollback.sh`
- Modify: `scripts/verify-core-release-contract.sh`
- Modify: `.github/workflows/ci.yml`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- `node dist/index.js api` serves Core HTTP.
- `node dist/index.js analytics-worker` runs only the Analytics Worker and its private health server.
- Core private `/metrics` and Storage private `/metrics` are scrapeable inside Compose.
- Production service allowlist includes `analytics-worker` and `prometheus`, with no retired services.

- [ ] **Step 1: Import agent branches without committing**

Resolve and import each reviewed agent commit:

```bash
for branch in \
  codex/dashboard-core-read-model \
  codex/dashboard-download-facts \
  codex/dashboard-prometheus; do
  agent_commit=$(git rev-parse "$branch")
  git cherry-pick -n "$agent_commit"
done
```

Resolve shared Prisma schema, package, app, entrypoint, and Compose changes against the approved design. Do not create a commit.

- [ ] **Step 2: Write failing runtime composition tests**

Extend Core health tests to assert analytics-worker liveness/readiness and private metrics. Extend Storage runtime tests to assert metrics and download-event queue dependencies.

Run:

```bash
pnpm -C services/core-api test -- src/__tests__/health.test.ts
pnpm -C services/storage test -- src/__tests__/runtime-startup.test.ts
```

Expected: FAIL before shared wiring, then PASS.

- [ ] **Step 3: Wire Core and Storage entrypoints**

Core `index.ts` validates `api|analytics-worker`; API receives analytics and system-health routers plus telemetry, while worker receives Prisma and no public business router. Storage API and worker register their own telemetry without exposing public routes through Nginx.

Run:

```bash
pnpm -C services/core-api build
pnpm -C services/storage build
```

Expected: PASS.

- [ ] **Step 4: Finalize Compose and release contract**

Ensure Core migration runs once, Analytics Worker waits for it, Prometheus waits for scrape targets, web does not depend on Prometheus, and Nginx depends only on public-path services. Update exact service allowlists, image checks, healthchecks, deploy start order, rollback manifest handling, and CI smoke targets.

Run:

```bash
bash scripts/verify-core-release-contract.sh
bash scripts/test-core-cutover-contract.sh
```

Expected: both print their success markers and exit 0.

---

### Task 5: Admin Dashboard Frontend Rewrite

**Files:**
- Delete: `frontend/cruip-landing/lib/api/overview.ts`
- Create: `frontend/cruip-landing/lib/api/dashboard.ts`
- Create: `frontend/cruip-landing/lib/api/__tests__/dashboard-contract.test.ts`
- Rewrite: `frontend/cruip-landing/app/admin/overview/page.tsx`
- Modify: `frontend/cruip-landing/app/admin/components/metric-card.tsx`
- Modify: `frontend/cruip-landing/package.json`

**Interfaces:**
- Consumes: `/admin/dashboard/business` and `/admin/dashboard/system` relative to `/api/v1`.
- Produces: independent Business Analytics and System Health resource states.

- [ ] **Step 1: Write failing frontend contract tests**

Assert exact response types, decimal-string integer fields, `today|7d|30d`, two independent API calls, absence of `/admin/overview` API calls and `last7d`, dynamic range chart titles, and explicit `null`/coverage handling.

Run: `pnpm -C frontend/cruip-landing test -- lib/api/__tests__/dashboard-contract.test.ts`

Expected: FAIL before the new client exists.

- [ ] **Step 2: Implement the typed client**

Define `DashboardRangeKind`, `BusinessDashboardResponse`, `SystemDashboardResponse`, and:

```ts
export const dashboardApi = {
  business: (range: DashboardRangeKind) =>
    apiClient.get<BusinessDashboardResponse>(`/admin/dashboard/business?range=${range}`),
  system: (range: DashboardRangeKind) =>
    apiClient.get<SystemDashboardResponse>(`/admin/dashboard/system?range=${range}`),
}
```

Run the focused contract test and expect PASS.

- [ ] **Step 3: Rewrite page state and rendering**

Use two independent reducers or state objects. Load through `Promise.allSettled`, preserve stale successful data, retry only failed resources on normal refresh, and expose full refresh separately. Render Business Analytics even when System Health is partial/unavailable. Parse decimal strings only for formatting; never coerce missing values to zero.

Run: `pnpm -C frontend/cruip-landing test`

Expected: PASS.

- [ ] **Step 4: Verify frontend build**

Run:

```bash
pnpm -C frontend/cruip-landing lint
pnpm -C frontend/cruip-landing build
git diff --check
```

Expected: all commands exit 0.

Do not commit yet.

---

### Task 6: Local Docker E2E and Final Commit

**Files:**
- Modify: `scripts/smoke-core-e2e.sh`
- Modify: `scripts/verify-core-release-contract.sh`
- Modify: `.github/workflows/ci.yml`
- Modify: `docs/runbooks/core-cutover-and-rollback.md`

- [ ] **Step 1: Extend the Docker smoke assertions**

The smoke environment must start PostgreSQL, Redis, MinIO, Core API, Analytics Worker, Storage API, Storage Worker, private Prometheus, web, email provider, and Nginx. After the existing upload/download flow, assert:

- admin Business Analytics returns 200 and the upload/download each increment exactly once;
- replayed grants/callbacks do not increment again;
- Business Analytics byte/count fields are strings;
- System Health returns 200 with Prometheus available;
- public `/metrics` and `/api/v1/internal/*` return 404;
- stopping Prometheus leaves Business Analytics 200 and the page available;
- restarting Analytics Worker drains pending Outbox events without double count.

- [ ] **Step 2: Run focused quality gates**

```bash
pnpm -C packages/observability test
pnpm -C services/core-api test
pnpm -C services/storage test
pnpm -C frontend/cruip-landing test
pnpm run typecheck
pnpm run lint:all
pnpm run build:all
bash scripts/verify-core-release-contract.sh
bash scripts/test-core-cutover-contract.sh
```

Expected: every command exits 0.

- [ ] **Step 3: Run the required local Docker E2E**

```bash
bash scripts/smoke-core-e2e.sh
```

Expected: final success marker, no retained smoke containers/volumes, and exit 0.

- [ ] **Step 4: Review the integrated diff**

```bash
git status --short
git diff --check
git diff --stat
git diff --name-status
```

Verify no secret, generated cache, temporary worktree path, Docker volume, `.env`, or unrelated file is present.

- [ ] **Step 5: Create the local implementation commit only after E2E**

```bash
git add services packages frontend infrastructure scripts .github docs pnpm-lock.yaml package.json Makefile
git commit -m "feat(admin): rebuild dashboard analytics pipeline"
```

Expected: commit succeeds and `git status --short` is empty.

---

### Task 7: Remote Push, CI, and Production Deployment

**Files:**
- No source changes unless CI or deployment verification exposes a defect.
- Production state: `/var/lib/mywebdrive/releases/current.env` and immutable release manifest through existing deploy tooling.

- [ ] **Step 1: Push main**

```bash
git push origin main
```

Expected: remote `main` advances to the local implementation commit.

- [ ] **Step 2: Wait for required GitHub Actions**

Resolve and watch the exact main-branch run:

```bash
GH=/opt/homebrew/bin/gh
run_id=$($GH run list --workflow "Core release CI" --branch main --limit 1 --json databaseId --jq '.[0].databaseId')
$GH run watch "$run_id" --exit-status
```

Confirm tests, typecheck, lint, builds, release contract, Docker image smoke, and all immutable image publications pass.

- [ ] **Step 3: Resolve immutable image digests**

Set `release_tag="sha-$(git rev-parse HEAD)"`. Confirm Core, Email Provider, Storage, Web, Nginx, and Prometheus images are available under that exact tag and resolve to one digest each. Never deploy mutable `latest`.

- [ ] **Step 4: Deploy with the existing locked manifest workflow**

Against `8.134.175.90`, first locate the installed immutable deployment directory with a read-only SSH inspection, copy only the reviewed Compose/deploy artifacts if the installed contract is older, and then run `infrastructure/alicloud/deploy.sh "$release_tag"` from that directory. Preserve `/var/lib/mywebdrive/releases/current.env`, its history manifest, and existing database/object snapshots before deployment. Do not run source checkout, `git reset`, volume deletion, or old-service migrations on the host.

- [ ] **Step 5: Run production acceptance**

Verify public health, internal/public route isolation, both authenticated Dashboard endpoints with the real administrator, one controlled upload/download, Prometheus partial-failure isolation, version metadata, container health, read-model lag, and SQL reconciliation. Redact account identity, tokens, grants, object keys, OTP, cookies, and secrets from captured evidence.

- [ ] **Step 6: Record deployment evidence**

Append the selected commit, image digests, CI run ID, migration result, production smoke outcomes, and rollback manifest location to the existing Core migration plan/runbook evidence section. Commit and push only if this documentation update contains no secret or mutable host state.
