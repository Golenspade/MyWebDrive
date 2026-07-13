# CLAUDE.md

This file provides repository-specific guidance to Claude Code. Read
`AGENTS.md` first; its code style, security, hygiene, and test rules apply here.

## Repository Authority (2026-07-13)

MyWebDrive is in a Core-first cutover:

- `services/core-api` is the authoritative control plane.
- `services/storage` owns the active storage API and worker.
- `services/email-provider` is a private outbound-email adapter.
- `frontend/cruip-landing` is the active Next.js frontend.
- `packages/common` and `packages/observability` are active shared packages.
- `infrastructure/alicloud/docker-compose.core.yml` is the only production
  Compose authority.

The old split Auth/User/Metadata/Sharing/Gateway runtime is **SOFT-RETIRED**.
It is excluded from default workspace gates and must not be started, migrated,
or deployed as a normal workflow. Historical source may remain for provenance;
its presence does not make it active.

## Supported Commands

Install exactly from the lockfile:

```bash
corepack pnpm install --frozen-lockfile
```

Run the complete fail-closed quality gate:

```bash
./manage-services.sh quality
```

Run the isolated Docker end-to-end smoke test:

```bash
./manage-services.sh smoke
```

List the compatibility shim surface:

```bash
./manage-services.sh help
```

The shim intentionally has no lifecycle command. Any old or unknown command
must warn `SOFT-RETIRED`, exit `64`, and never start the split-service stack.
Core-first local startup will be documented only after a dedicated contract is
implemented.

Useful narrow gates:

```bash
pnpm run build:all
pnpm run typecheck
pnpm run lint:all
pnpm run test:all
bash scripts/test-repo-authority-contract.sh
bash scripts/test-core-release-contract.sh
bash scripts/test-core-cutover-contract.sh
```

Legacy tests are explicit and non-authoritative: `pnpm run test:legacy`.

## Active Design Boundaries

- Core owns identity, profile, metadata, sharing, quota, admin, and analytics
  control-plane state in the Core Prisma schema.
- Storage owns object transfer and background storage work; Core callbacks and
  storage grants use dedicated secrets.
- Email delivery stays private to the Compose network and authenticates with an
  internal provider token. Production cloud access uses the approved ECS role,
  not persistent AccessKey environment variables.
- The frontend uses same-origin `/api/v1/...` requests. Do not reintroduce a
  browser-facing Gateway base URL or a Next.js API rewrite.
- Nginx routes storage traffic to Storage, other public API traffic to Core,
  and blocks `/api/v1/internal` from public access.

## Prisma and Generated Artifacts

`services/core-api/prisma` is the authoritative control-plane schema and
migration history. Production migrations run through the release script before
Core starts. Do not add split-schema migration loops to active tooling.

Prisma clients, native engines, `dist`, `.next`, `.tsbuildinfo`, PID files, and
frontend npm lockfiles are generated outputs and must remain untracked. Run:

```bash
bash scripts/test-generated-artifacts-contract.sh
bash scripts/verify-no-generated-artifacts.sh
```

The verifier must fail closed if it cannot inspect the Git index.

## Production Release

Production uses immutable images tagged `sha-<40 lowercase hex>` and recorded by
digest. The only supported release entrypoints are:

- `infrastructure/alicloud/deploy.sh`
- `infrastructure/alicloud/rollback.sh`

See `infrastructure/alicloud/ALIYUN_DEPLOY_GUIDE.md` and
`docs/runbooks/core-cutover-and-rollback.md`. Never bypass their migration,
health, version, lock, or manifest checks; never destroy persistent volumes as
part of deployment recovery.

## Implementation Rules

- Use Node.js 20+, pnpm 9.7.0, strict TypeScript, ESM, two-space indentation,
  single quotes, and omitted semicolons.
- Keep changes focused and preserve active Core/Storage/Email/Web boundaries.
- Prefer `unknown` plus narrowing over `any`.
- Validate request data early and route unexpected errors through structured
  logging and the unified error middleware.
- Use `@mywebdrive/observability`; do not add service `console.log` calls.
- Never commit secrets, credentials, generated clients, native binaries, or
  build output.
- Add or update a failing contract/test before changing authority, release,
  migration, or lifecycle behavior.
