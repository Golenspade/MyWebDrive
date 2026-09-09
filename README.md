# MyWebDrive

MyWebDrive is a Core-first file storage and distribution platform. Core owns identity, files, upload intents, quota, sharing, publication, and dashboard facts. Storage owns object transfer and workers. The Web app is Next.js behind a same-origin Nginx entry.

This repository is in **local-first development**. The former split Auth/User/Metadata/Sharing/Gateway control plane is gone from the default workflow; recover it from git history if needed.

## Authority

- Control plane: `services/core-api`
- Storage API and worker: `services/storage`
- Private email adapter: `services/email-provider`
- Web: `frontend/cruip-landing`
- Schema: `services/core-api/prisma`
- Local compose: `infrastructure/alicloud/docker-compose.core.yml` + `infrastructure/docker-compose.core-dev.yml`

## Local development

Requires Node.js 20+, Corepack, Docker Engine, and Docker Compose 2.24.4+.

```bash
./manage-services.sh setup
./manage-services.sh start
```

Site: <http://127.0.0.1:8080>. Commands: [`docs/manage-services.md`](docs/manage-services.md).

```text
setup
start
stop
status
logs [service]
config
quality
smoke
reset --confirm
```

## Checks

```bash
pnpm run build:all
pnpm run typecheck
pnpm run lint:all
pnpm run test:all
pnpm run test:docs
pnpm run verify:docs
./manage-services.sh quality
```

`quality` does not need a running stack. `smoke` is optional and needs Docker.

## API and language

- Public HTTP: [`docs/openapi.yaml`](docs/openapi.yaml)
- Terms: [`CONTEXT.md`](CONTEXT.md)
- Dashboard: [`docs/context/dashboard-analytics.md`](docs/context/dashboard-analytics.md)

Public API covers email OTP, session refresh, files, upload intents, quota, shares, publications, dashboard, and grant-authorized Storage transfer. `/api/v1/internal/*`, `/metrics`, `/live`, `/ready`, and `/version` are private or operational.

## Git

`main` is the GitHub default branch. `develop` is the next-release integration branch. Daily work branches from `develop` and returns by PR. See [`docs/git-workflow.md`](docs/git-workflow.md).

## Security and contributing

Do not commit `.env`, credentials, tokens, database dumps, or generated artifacts. Read [`CONTRIBUTING.md`](CONTRIBUTING.md) and [`SECURITY.md`](SECURITY.md). Run `./manage-services.sh quality` before a PR.

MIT License: [`LICENSE`](LICENSE).
