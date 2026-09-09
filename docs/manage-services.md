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
