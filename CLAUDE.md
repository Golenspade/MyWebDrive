# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MyWebDrive is a microservices-based cloud storage platform built with Node.js + TypeScript using a pnpm monorepo architecture. The backend has been fully migrated from Go to Node.js, with Next.js 15 serving the frontend.

**Key Characteristics:**
- Chinese primary language project (documentation and user-facing content)
- Microservices architecture with clear System of Record (SoR) boundaries
- SQLite for each service's database with Prisma ORM
- JWT-based authentication with access/refresh tokens
- TUS protocol for resumable uploads

## Architecture

### Service Ports
- **API Gateway**: 9080 (routes to all backend services)
- **Auth Service**: 7081 (authentication, identity)
- **User Service**: 7082 (user profiles, quotas)
- **Metadata Service**: 7083 (files/folders metadata)
- **Storage Service**: 7084 (file uploads/downloads)
- **Sharing Service**: 7085 (file sharing links)
- **Frontend**: 3100 (Next.js dev server at `frontend/cruip-landing`)

### System of Record (SoR) Boundaries

**Critical**: Each service owns its domain data. Do not duplicate fields across services.

- **Auth**: Identity (id, email, passwordHash, role)
- **User**: Profile & quotas (id, name, storageQuota, storageUsed)
- **Metadata**: Files & folders (fileId, name, path, versions)
- **Storage**: Physical storage (uploads, chunks, S3/MinIO paths)
- **Sharing**: Share links (shareToken, password, expiresAt)

**Important**: User service does NOT store email/password/role - these live in Auth. Role is carried in JWT.

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
STORAGE_DATABASE_URL=file:./storage.db \
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

# Frontend
FRONTEND_PORT=3100
FRONTEND_HOST=127.0.0.1
API_BASE_URL=http://localhost:9080
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

## Special Features

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

## Common Pitfalls

1. **Prisma Client Types Conflict**: Always use per-service output (`./client`) and import from local path with `.js` extension.

2. **Missing Prisma Generate**: Before building a service, run `prisma generate` or use `pnpm build` which includes it.

3. **Database Path**: Each service uses its own SQLite file via `<SERVICE>_DATABASE_URL` env var (e.g., `METADATA_DATABASE_URL=file:./metadata.db`).

4. **JWT Secret**: Must be identical across all services for token verification.

5. **NodeNext Imports**: Relative imports need explicit `.js` extension: `from '../prisma/client/index.js'`

6. **tsBuildInfoFile**: Requires `"composite": true` in tsconfig.

7. **Service Dependencies**: Storage depends on Metadata; Sharing depends on Storage and Metadata. Start in order: auth → user → metadata → storage → sharing → gateway.

8. **Redis for Storage**: Storage service requires Redis for download rate limiting. Set `REDIS_URL` or it defaults to `redis://localhost:6379/0`.

## File Locations

- Service management: `./manage-services.sh`
- Environment template: `docs/env.example`
- Deployment logs: `/var/log/mywebdrive/deploy.log` (server)
- Service logs (dev): `logs/*.log`
- OpenAPI spec: `docs/openapi.yaml` (being rewritten for Node SoR)
- Migration docs: `MIGRATION_TO_NODE.md`
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

## Additional Resources

- Developer Guide: `docs/DEVELOPER_GUIDE_SoR_and_Prisma.md`
- Frontend-Backend Connection: `docs/FRONTEND_BACKEND_CONNECTION_DESIGN.md` ⭐ **NEW**
- Quick Start: `QUICK_START.md`
- Deploy Guide: `DEPLOY_GUIDE.md`
- CORS Details: `docs/CORS.md`
- Catalog Plan: `docs/catalog-plan-A.md`
- Service Management: `docs/manage-services.md`
