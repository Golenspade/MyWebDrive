# CLAUDE.md

Read `AGENTS.md` first. Its repository authority, style, security, testing, and Git rules apply to every change.

## Current architecture

MyWebDrive is Core-first. `services/core-api` owns control-plane state and the authoritative Prisma history; `services/storage` owns object transfer and storage workers; `services/email-provider` is private; `frontend/cruip-landing` is the active Web app. Production authority is `infrastructure/alicloud/docker-compose.core.yml` with `infrastructure/alicloud/deploy.sh` and `infrastructure/alicloud/rollback.sh`.

The former split control plane is **SOFT-RETIRED** under `archive/legacy-split-control-plane-2026-07-13`. It is excluded from default build, test, migration, local development, and deployment paths.

## Supported local interface

```bash
./manage-services.sh setup
./manage-services.sh start
./manage-services.sh stop
./manage-services.sh status
./manage-services.sh logs [service]
./manage-services.sh config
./manage-services.sh smoke
./manage-services.sh quality
./manage-services.sh reset --confirm
./manage-services.sh legacy:<command>
```

The local site is `http://127.0.0.1:8080`; the Compose project is `mywebdrive-core-dev`. See `docs/manage-services.md` for exact behavior. Unrecognized former commands warn `SOFT-RETIRED`, exit 64, and never start an archived topology.

The `legacy:<command>` escape hatch is observation-only from 2026-07-13 through 2026-07-26. Do not use it for implementation, migrations, deployments, or production writes; remove it on or after 2026-07-27 unless a new explicit expiry is approved.

## Narrow verification

```bash
pnpm run build:all
pnpm run typecheck
pnpm run lint:all
pnpm run test:all
pnpm run test:docs
pnpm run verify:docs
bash scripts/test-repo-authority-contract.sh
bash scripts/test-core-dev-contract.sh
bash scripts/test-core-release-contract.sh
bash scripts/test-core-cutover-contract.sh
```

`./manage-services.sh quality` runs the full fail-closed gate without requiring a running stack. `./manage-services.sh smoke` delegates to `scripts/smoke-core-e2e.sh` and requires Docker.

## Active boundaries

- Browser traffic is same-origin. Nginx sends Storage transfer paths to Storage, other public API paths to Core, and blocks private callback paths.
- Public API authority is `docs/openapi.yaml`; operational endpoints and private callbacks are excluded.
- Core and Storage exchange dedicated Storage Grants and signed callbacks. Storage does not own control-plane state.
- Core migrations run before Core starts in the production release contract. Never add a split-schema migration loop.
- Prisma clients, native engines, `dist`, `.next`, `.tsbuildinfo`, PID files, and frontend npm lockfiles are generated outputs and remain untracked.

## Production release

Use only immutable `sha-<40 lowercase hex>` images through:

- `infrastructure/alicloud/deploy.sh`
- `infrastructure/alicloud/rollback.sh`

Follow `infrastructure/alicloud/ALIYUN_DEPLOY_GUIDE.md` and `docs/runbooks/core-cutover-and-rollback.md`. Never bypass their migration, lock, health, version, digest, or manifest checks, and never destroy persistent volumes as a recovery shortcut.

## Implementation rules

Use Node.js 20+, pnpm 9.7.0, strict TypeScript, ESM, two-space indentation, single quotes, and omitted semicolons. Keep changes focused, use `unknown` plus narrowing instead of broad `any`, route unexpected errors through structured logging, and never commit secrets or generated output. Add a failing contract or test before changing authority, release, migration, lifecycle, or documentation-verifier behavior.
