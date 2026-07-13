# Legacy split-control-plane entrypoints

These compose files, Kubernetes manifests, development helpers, deployment scripts, and legacy smoke scripts were retired from the active repository surface on 2026-07-13.

They are preserved for one observation cycle only. They are not part of the default build, typecheck, lint, test, development, CI, or production deployment paths. The active production authority remains:

- `infrastructure/alicloud/docker-compose.core.yml`
- `infrastructure/alicloud/deploy.sh`
- `infrastructure/alicloud/rollback.sh`
- `scripts/smoke-core-e2e.sh`

Use `pnpm run test:legacy` for the explicit, soft-retired legacy test interface.
