# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MyWebDrive is a microservices-based cloud storage platform built with Node.js + TypeScript using a pnpm monorepo architecture. The backend has been fully migrated from Go to Node.js, with Next.js 15 serving the frontend.

**Key Characteristics:**
- Chinese primary language project (documentation and user-facing content)
- Microservices architecture with clear System of Record (SoR) boundaries
- PostgreSQL for each service's database with Prisma ORM
- JWT-based authentication with access/refresh tokens
- TUS protocol for resumable uploads
- Async upload finalization for large files (202 status code + polling)

## Architecture

### Service Ports
- **API Gateway**: 9080 (routes to all backend services)
- **Auth Service**: 7081 (authentication, identity)
- **User Service**: 7082 (user profiles, quotas)
- **Metadata Service**: 7083 (files/folders metadata)
- **Storage Service**: 7084 (file uploads/downloads)
- **Sharing Service**: 7085 (file sharing links)
- **Frontend**: 4323 (Next.js dev server at `frontend/cruip-landing`, configurable via `FRONTEND_PORT`)

### System of Record (SoR) Boundaries

**Critical**: Each service owns its domain data. Do not duplicate fields across services.

- **Auth**: Identity (id, email, passwordHash, role, name)
- **User**: Profile & quotas (id, name, storageQuota, storageUsed)
- **Metadata**: Files & folders (fileId, name, path, versions)
- **Storage**: Physical storage (uploads, chunks, S3/MinIO paths)
- **Sharing**: Share links (shareToken, password, expiresAt)

**Important**: User service does NOT store email/password/role — these live in Auth, and role is carried in JWT.

**Note**: `name` currently exists in both Auth and User (historical duplication). Treat User as the SoR for profile fields unless explicitly stated otherwise; plan to de-duplicate in a future migration.

### Prisma Client Pattern

**CRITICAL**: Each service generates its own Prisma Client to avoid type conflicts in the monorepo.

Schema configuration:
```prisma
generator client {
  provider = "prisma-client-js"
  output   = "./client"
}
```

Import pattern (NodeNext ESM):
```typescript
// Auth, Metadata, Storage services
import { PrismaClient } from '../prisma/client/index.js'

// User, Sharing services (also use explicit path)
import { PrismaClient } from '../prisma/client/index.js'
```

**Never** import from `@prisma/client` directly in service code.

## Common Development Commands

### Setup & Build
```bash
# Initial setup
pnpm -w install
pnpm -w build

# Use management script for all services
./manage-services.sh help
```

### Starting Services

```bash
# Start all backend services (gateway + 5 microservices)
./manage-services.sh start-backend

# Start frontend + backend
./manage-services.sh start

# Start frontend in production mode (builds first)
./manage-services.sh start-frontend-prod

# Check status
./manage-services.sh status
```

### Individual Service Development

Each service can be started independently:
```bash
# Example: Auth service
cd services/auth
JWT_SECRET=dev-secret AUTH_PORT=7081 pnpm dev

# Example: Storage service (with full env)
cd services/storage
JWT_SECRET=dev-secret \
STORAGE_PORT=7084 \
STORAGE_PATH=./storage \
METADATA_SERVICE_URL=http://localhost:7083 \
STORAGE_DATABASE_URL=postgres://user:pass@localhost:5432/storage \
REDIS_URL=redis://localhost:6379/0 \
pnpm dev
```

### Prisma Workflows

```bash
# Generate client for a service
pnpm --filter ./services/auth prisma:generate

# Push schema changes (dev only)
pnpm --filter ./services/auth db:push

# Seed auth database (creates admin + invite codes)
pnpm --filter ./services/auth db:seed
```

### Frontend Development

```bash
# Frontend-only development
cd frontend/cruip-landing && pnpm dev

# Frontend build (for production preview)
cd frontend/cruip-landing && pnpm build

# Frontend type checking
cd frontend/cruip-landing && pnpm typecheck

# Frontend linting
cd frontend/cruip-landing && pnpm lint
```

### Development Helper Scripts

For improved developer experience, use these helper scripts:

```bash
# Backend with health checks and Redis detection
bash scripts/start-backend-dev.sh

# Frontend with auto-configured API_BASE_URL and EMFILE mitigation
bash scripts/start-frontend-dev.sh

# Frontend with custom port
PORT=3200 bash scripts/start-frontend-dev.sh
```

These scripts handle:
- Automatic environment variable setup
- Service health verification
- File descriptor limit warnings (EMFILE on macOS)
- Log path reporting

### Testing

```bash
# End-to-end regression tests (point to Node gateway on 9080)
GATEWAY_PORT=9080 bash ./test_guest_download.sh
GATEWAY_PORT=9080 bash ./test_invitation_flow.sh
GATEWAY_PORT=9080 bash ./test_invitation_system.sh

# Frontend tests
cd frontend/cruip-landing && pnpm test
```

### Build & Quality

```bash
# Build all packages/services
make build

# Quality check (build + test + lint)
make quality-check

# Docker compose (Node version)
make docker-build
make docker-up
```

## Key Environment Variables

Common across services:
```bash
JWT_SECRET=your-secret-key
REDIS_URL=redis://localhost:6379/0

# Download limits (storage service)
DOWNLOAD_CONCURRENCY_LIMIT=3
DOWNLOAD_Mbps=300

# Owner verification cookies
OWNER_COOKIE_SECRET=please-change-me
OWNER_COOKIE_TTL_SEC=86400
```

Service-specific:
```bash
# Auth
AUTH_PORT=7081
ACCESS_TOKEN_TTL=900
REFRESH_TOKEN_TTL=604800
REGISTRATION_REQUIRE_INVITE=false

# Storage (MinIO/S3)
USE_MINIO=false
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=...
MINIO_SECRET_KEY=...
MINIO_BUCKET=mywebdrive

# Dev-only: Skip metadata callbacks (for quick demos without metadata service)
STORAGE_SKIP_METADATA=false  # Set to true for local testing

# Frontend
FRONTEND_PORT=3100
FRONTEND_HOST=127.0.0.1
API_BASE_URL=http://localhost:9080

# Databases (PostgreSQL)
AUTH_DATABASE_URL=postgres://user:pass@localhost:5432/auth
USER_DATABASE_URL=postgres://user:pass@localhost:5432/user
METADATA_DATABASE_URL=postgres://user:pass@localhost:5432/metadata
STORAGE_DATABASE_URL=postgres://user:pass@localhost:5432/storage
SHARING_DATABASE_URL=postgres://user:pass@localhost:5432/sharing
GATEWAY_DATABASE_URL=postgres://user:pass@localhost:5432/gateway
```

Generate template: `./manage-services.sh env:write .env.example`

## Code Patterns & Standards

### Service Structure
```
services/<name>/
├── src/
│   ├── index.ts          # Entry point
│   ├── routes/           # Express routes
│   ├── middleware/       # Auth, logging, etc.
│   └── types/            # Type declarations
├── prisma/
│   ├── schema.prisma
│   └── client/           # Generated Prisma Client
├── package.json
└── tsconfig.json
```

### Observability

All services use unified logging and metrics from `@mywebdrive/observability`:

- **Logging**: Pino JSON logs with `service`, `instance`, `env`, `req.id`
- **Metrics**: Prometheus `/metrics` endpoint with:
  - `http_requests_total{method,route,status,service,instance}`
  - `http_request_duration_ms` (histogram)
- **Health**: `/health` endpoint on all services
- **Request ID**: `x-request-id` header auto-injected and propagated

Verify metrics: `curl http://localhost:7081/metrics | head`

### Frontend Architecture

The frontend uses a modern React + Next.js 15 stack with Zustand for state management.
There are two Next.js apps:
- `frontend/cruip-landing`: main marketing/docs/admin frontend, originally derived from the Cruip Simple Light template but heavily customized, with all third-party promotions removed and only attribution kept in README.
- `apps/web`: an experimental site that now shares the same Next 15 / React 19 stack and is intended for future templateization work (do not reintroduce external branding or promotions here).

Key patterns:

- **API Client**: `lib/api/client.ts` handles automatic token refresh (single-flight), 204 responses, and unified error handling
- **Auth Store**: `lib/stores/auth-store.ts` manages authentication state with localStorage persistence
- **Dependency Injection**: API client receives auth callbacks to avoid circular dependencies
- **Protected Routes**: `components/auth/protected-route.tsx` with hydration-aware checks

See `docs/FRONTEND_BACKEND_CONNECTION_DESIGN.md` for comprehensive frontend implementation guide.

### Admin Dashboard

The frontend includes a comprehensive admin dashboard at `/admin`:

- **/admin/users**: User management (list, search, pagination, role changes, quota management)
- **/admin/notifications**: System notifications with filtering and export
- **/admin/invitations**: Invite code management (when `REGISTRATION_REQUIRE_INVITE=true`)

**Authentication**: Admin pages require Bearer token stored in localStorage (use "Set Token" dialog in UI)

**Key APIs**:
- `GET /api/v1/auth/admin/users` - Paginated user list with search
- `PATCH /api/v1/auth/admin/users/:id/role` - Change user role
- `GET /api/v1/users/:id/storage` - View user quota/usage
- `PATCH /api/v1/users/:id/quota` - Set storage quota
- `GET /api/v1/admin/overview` - Dashboard aggregated stats

### Error Handling

Services should return consistent error formats:
```typescript
{
  "error": "error_code",
  "message": "Human readable message"
}
```

### TypeScript Configuration

Services use `NodeNext` module resolution with ESM:
```json
{
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "composite": true,
    "tsBuildInfoFile": ".tsbuildinfo"
  }
}
```

**Important**: When using `tsBuildInfoFile`, must set `"composite": true`.

## Admin API Routes

All admin routes require authentication + admin role (`requireAuth` + `requireAdmin` middleware).

### User Management (Auth Service)
- `GET /api/v1/auth/admin/users?query=&page=1&pageSize=10` - List users with search/pagination
- `GET /api/v1/auth/admin/users/:id` - User details (id, name, email, role, createdAt)
- `PATCH /api/v1/auth/admin/users/:id/role` - Change role (user/admin)
- `GET /api/v1/auth/admin/users/statistics?range=7d|30d` - User statistics (totalUsers, newUsers)

### Quota Management (User Service)
- `GET /api/v1/users/:id/storage` - View quota and usage for specific user
- `PATCH /api/v1/users/:id/quota` - Set storage quota (admin only)

### Storage Statistics (Storage Service)
- `GET /api/v1/storage/statistics` - Total upload bytes and count
- `GET /api/v1/storage/statistics/daily?days=30` - Daily uploads (completed, grouped by updatedAt)
- `GET /api/v1/storage/downloads/active` - Active downloads (concurrency and IP list from Redis)

### File Statistics (Metadata Service)
- `GET /api/v1/files/statistics` - Total files count and size (latest version aggregated)

### Aggregated Overview (Gateway)
- `GET /api/v1/admin/overview` - Dashboard stats aggregating:
  - `totals`: total_users, total_files, total_storage_bytes
  - `today`: uploads_bytes, downloads_count, requests_count, errors_count, latency_ms_p95, latency_ms_p99
  - `last7d`: uploads_bytes, downloads_bytes (from storage/statistics/daily)

  Gateway also persists admin notifications and audit logs in its own PostgreSQL database.

**Note**: Gateway forwards `Authorization` header to downstream services and provides fallback to 0 on failure.

## Special Features

### Async Upload Finalization

For large file uploads, the system implements async finalization to avoid timeout issues:

**Flow**:
1. Client uploads file chunks via `PATCH /api/v1/storage/uploads/{id}` (with `X-Chunk-Index` header)
2. After all chunks uploaded, client calls `POST /api/v1/storage/uploads/{id}/finalize`
3. Storage service returns `202 Accepted` if file is large (starts background merge job)
4. Client polls `GET /api/v1/storage/uploads/{id}` every 2 seconds to check status
5. When status becomes `completed`, upload is done

**Key Implementation Details**:
- Storage service uses `setImmediate` for background processing (non-blocking)
- In-memory Set `FINALIZE_IN_PROGRESS` tracks active jobs (prevents duplicate merges)
- Gateway intercepts finalize requests to push admin notifications
- Frontend polls up to 300 times (10 minutes max)
- Idempotent: calling finalize on completed session returns current info

**Configuration**:
```bash
GATEWAY_PROXY_TIMEOUT_MS=600000        # 10 minutes
UPLOAD_FINALIZE_TIMEOUT_MS=600000      # 10 minutes
STORAGE_SKIP_METADATA=false            # Dev-only: skip metadata callback
```

**Status Values**:
- `uploading` - chunks being uploaded
- `processing` - finalize job running (202 returned)
- `completed` - merge done, file ready
- `failed` - merge failed

### Catalog API (Download Directory)

Development setup for asset downloads:
1. Place files in `assetsReal/` at repo root
2. Import via manifest: `pnpm -C services/metadata catalog:import` (reads `assetsReal/catalog-import.json`)
3. Or auto-scan: `pnpm -C services/metadata catalog:scan`
4. Gateway maps `/assets` → `assetsReal/` for direct downloads
5. API: `GET http://localhost:9080/api/v1/catalog`
6. Graylist: Only returns items with `catalog:public=true` tag

For production, replace `catalog:url` with CDN/OSS URLs.

### CORS Configuration

Default (dev): Gateway allows `*` origin for convenience.

Production: Set `CORS_ALLOWED_ORIGINS=http://your-domain.com,https://your-domain.com` (comma-separated).

Frontend reads `API_BASE_URL` from env (configurable in `.env.local`).

### Invitation System

When `REGISTRATION_REQUIRE_INVITE=true`:
1. Admin account required to create invite codes
2. Seed admin: `pnpm --filter services/auth prisma:seed`
3. Create invites: `POST /api/v1/auth/invitations` (admin only)

## Deployment

### Quick Deploy to Aliyun

```bash
# 1. Setup SSH (one-time)
./scripts/ssh-setup.sh

# 2. Deploy
./scripts/quick-deploy.sh <server-ip>

# 3. Configure environment on server
ssh root@<server-ip>
cd /opt/MyWebDrive/infrastructure/alicloud
vim .env  # Set JWT_SECRET, etc.
docker-compose -f docker-compose.node.yml restart
```

### Build Before Deploy

**Critical**: Services must be built before deployment. Production containers run from `dist/` only.

```bash
# One-time builder (in Node 20 container)
./scripts/build-all-node.sh

# Or use make
make build
```

This generates:
- `packages/*/dist`
- `services/*/dist`
- Prisma clients at `services/*/prisma/client`

### Docker Compose

```bash
# Local
make docker-build
make docker-up

# Aliyun (on server)
cd infrastructure/alicloud
./deploy.sh production latest
```

## Shared Packages

The monorepo includes shared packages in `packages/`:

- **@mywebdrive/common**: Shared utilities and types used across services
- **@mywebdrive/observability**: Unified logging (Pino) and metrics (Prometheus) for all services

Import these in services via workspace protocol: `"@mywebdrive/common": "workspace:*"`

## Common Pitfalls

1. **Prisma Client Types Conflict**: Always use per-service output (`./client`) and import from local path with `.js` extension.

2. **Missing Prisma Generate**: Before building a service, run `prisma generate` or use `pnpm build` which includes it.

3. **Database**: Each service connects to PostgreSQL via `<SERVICE>_DATABASE_URL` (e.g., `AUTH_DATABASE_URL=postgres://...`). Do not assume SQLite file paths.

4. **JWT Secret**: Must be identical across all services for token verification.

5. **NodeNext Imports**: Relative imports need explicit `.js` extension: `from '../prisma/client/index.js'`

6. **tsBuildInfoFile**: Requires `"composite": true` in tsconfig.

7. **Service Dependencies**: Storage depends on Metadata; Sharing depends on Storage and Metadata. Start in order: auth → user → metadata → storage → sharing → gateway.

8. **Redis for Storage**: Storage service requires Redis for download rate limiting. Set `REDIS_URL` or it defaults to `redis://localhost:6379/0`.

9. **Next.js Static Export vs Rewrites**: In development, `output: 'export'` is commented out in `frontend/cruip-landing/next.config.js` because static export mode conflicts with `rewrites` and `middleware`. Keep commented for dev (uses CORS); enable only for static production builds.

## File Locations

- Service management: `./manage-services.sh`
- Environment template: `docs/env.example`
- Deployment logs: `/var/log/mywebdrive/deploy.log` (server)
- Service logs (dev): `logs/*.log`
- OpenAPI spec: `docs/openapi.yaml` (being rewritten for Node SoR)
- Migration docs: `docs/_archive/MIGRATION_TO_NODE.md`
- Changelog: `CHANGELOG.md`

## Makefile Targets

```bash
make help           # Show all commands
make build          # pnpm recursive build
make test           # pnpm recursive test
make docker-build   # Build Node compose images
make docker-up      # Start Node compose
make docker-down    # Stop Node compose
make format         # Format frontend/Node code
make lint           # Lint frontend/Node code
make quality-check  # Build + test + lint
make alicloud-deploy # Deploy to Aliyun
```

## Working with This Codebase

1. **Always check service SoR boundaries** before adding fields to schemas.
2. **Use the management script** for starting/stopping services rather than manual commands.
3. **Generate Prisma client after schema changes** before running TypeScript build.
4. **Test with regression scripts** after making changes to APIs.
5. **Update CHANGELOG.md** for notable changes.
6. **Logs directory** is gitignored - check `logs/*.log` for debugging during development.
7. **Do not track large files** - `assetsReal/` is gitignored for download assets.

## Quick Troubleshooting

**Services won't start:**
- Check if ports are already in use: `lsof -i :9080` (or other service port)
- Verify JWT_SECRET is set: `echo $JWT_SECRET`
- Check service logs: `tail -f logs/<service>.log`

**Prisma errors:**
- Regenerate client: `pnpm --filter ./services/<name> prisma:generate`
- Push schema: `pnpm --filter ./services/<name> db:push`
- Check database connection: Verify `<SERVICE>_DATABASE_URL` is set correctly

**Frontend can't reach backend:**
- Verify gateway is running on 9080: `curl http://localhost:9080/health`
- Check API_BASE_URL in frontend: should be `http://localhost:9080`
- Review CORS settings in gateway (default allows `*` in dev)

**Build failures:**
- Clean and rebuild: `pnpm clean && pnpm -w build`
- Ensure Node.js 20+ is installed: `node --version`
- Check for missing dependencies: `pnpm -w install`

**Frontend EMFILE errors (macOS):**
- **Symptom**: `Watchpack Error (watcher): Error: EMFILE: too many open files, watch`
- **Cause**: System file descriptor limit too low for Next.js/webpack file watching
- **Quick fix**: `ulimit -n 10000` then restart frontend in same terminal
- **Or use polling**: `WATCHPACK_POLLING=true WATCHPACK_POLL_INTERVAL=1000 pnpm dev`
- **Permanent fix (macOS)**: `sudo launchctl limit maxfiles 65536 200000`, then restart terminal
- **Helper script**: `bash scripts/start-frontend-dev.sh` applies limits automatically
- **Verify limit**: `ulimit -n` should show ≥ 10000

## Additional Resources

- Developer Guide: `docs/DEVELOPER_GUIDE_SoR_and_Prisma.md`
- Frontend-Backend Connection: `docs/FRONTEND_BACKEND_CONNECTION_DESIGN.md` ⭐ **NEW**
- Quick Start: `QUICK_START.md`
- Deploy Guide: `DEPLOY_GUIDE.md`
- CORS Details: `docs/CORS.md`
- Catalog Plan: `docs/catalog-plan-A.md`
- Service Management: `docs/manage-services.md`
