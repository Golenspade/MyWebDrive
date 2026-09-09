# Local development

`manage-services.sh` is the local interface for the Core-first stack. It composes `infrastructure/alicloud/docker-compose.core.yml` with `infrastructure/docker-compose.core-dev.yml` under the project name `mywebdrive-core-dev`.

## Prerequisites

- Node.js 20+
- Corepack with the repository `pnpm@9.7.0`
- Docker Engine and Docker Compose 2.24.4+ (the overlay uses `!override`)

`setup` writes `.state/core-dev.env` with owner-only permissions. Do not commit that file.

## First start

```bash
./manage-services.sh setup
./manage-services.sh start
```

- Site: <http://127.0.0.1:8080>
- Development email viewer: <http://127.0.0.1:8025>
- Compose project: `mywebdrive-core-dev`

The stack is PostgreSQL, Redis, MinIO, Core migrate, Core API, analytics worker, private email adapter, Storage API, Storage worker, Prometheus, Web, and Nginx.

## Commands

| Command | Behavior |
|---|---|
| `./manage-services.sh help` | Print the supported interface. |
| `./manage-services.sh setup` | Create local state and `pnpm install --frozen-lockfile`. |
| `./manage-services.sh start` | Build and start the stack, wait for health. |
| `./manage-services.sh stop` | Stop containers; keep volumes and secrets. |
| `./manage-services.sh status` | Compose status. |
| `./manage-services.sh logs [service]` | Last 200 log lines. |
| `./manage-services.sh config` | Validate the merged Compose model. |
| `./manage-services.sh quality` | Fail-closed quality gate; no running stack required. |
| `./manage-services.sh smoke` | Optional isolated Compose E2E (`scripts/smoke-core-e2e.sh`). |
| `./manage-services.sh reset --confirm` | Delete local containers and volumes; keep `.state/core-dev.env`. |

Unknown former lifecycle names exit 64 and do not start an archived stack. `reset` requires the exact `--confirm` token.

## Daily loop

```bash
./manage-services.sh start
./manage-services.sh status
./manage-services.sh logs core-api
./manage-services.sh stop
```

## Checks without Docker

```bash
pnpm run build:all
pnpm run typecheck
pnpm run lint:all
pnpm run test:all
pnpm run test:docs
pnpm run verify:docs
./manage-services.sh quality
```

Public API: `docs/openapi.yaml`. Nginx exposes `/healthz` and blocks `/api/v1/internal/*`. Operational `/live`, `/ready`, `/version`, and `/metrics` are not public OpenAPI.

## Browser snapshots

Committed snapshots under `e2e/snapshots/` are Linux-authoritative. Production remains Linux. A normal `pnpm run test:e2e` compares against them and must never rewrite them. `SMOKE_UPDATE_SNAPSHOTS` accepts only `0` or `1`; absent or exactly `0` compares snapshots, and only exactly `1` requests an update.

Do not generate authoritative snapshots on macOS or through the host browser path, except the temporary override below. The default path still starts `SMOKE_BROWSER_CONTAINER_IMAGE` and verifies its actual Linux platform, the repository-locked Playwright `1.61.1` package, and the ability of that package to launch Chromium from the container. A project name ending in `-linux` is not provenance.

```bash
SMOKE_REUSE_IMAGES=1 \
SMOKE_BROWSER_GATE=1 \
SMOKE_BROWSER_CONTAINER_IMAGE=mcr.microsoft.com/playwright:v1.61.1-noble \
SMOKE_UPDATE_SNAPSHOTS=1 \
bash scripts/smoke-core-e2e.sh
```

There is no Linux development machine in this workspace yet. For local **code tests on macOS**, set `SMOKE_ALLOW_HOST_SNAPSHOTS` to exactly `1`. That skips Linux container provenance and lets host Playwright compare (and, with `SMOKE_UPDATE_SNAPSHOTS=1`, write) snapshots. Do not commit those host files as the production authority.

```bash
SMOKE_BROWSER_GATE=1 \
SMOKE_UPDATE_SNAPSHOTS=1 \
SMOKE_ALLOW_HOST_SNAPSHOTS=1 \
pnpm run test:e2e
```

This override is temporary. When a Linux development machine exists, unset `SMOKE_ALLOW_HOST_SNAPSHOTS` (or set it to `0`) and restore Linux-container-only snapshot updates. Do not leave the macOS exception in place once that machine is available.
