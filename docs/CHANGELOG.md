# Changelog

All notable changes to this repository will be documented in this file.

## 2025-10-15

### Added
- Admin Overview wired to backend aggregation and charted 7-day uploads trend (`frontend/cruip-landing/app/admin/overview/page.tsx`).
  - Added downloads trend & today metrics (downloads_count, requests/errors cards).
- Notifications page connected to backend health feed (`/api/v1/admin/health`) replacing mock data (`frontend/cruip-landing/app/admin/notifications/page.tsx`).
  - Later switched to gateway notifications API (`/api/v1/admin/notifications*`) with mark-read support.
  - Added optional live updates via SSE: `GET /api/v1/admin/notifications/stream` (token via query for EventSource).
  - Registration requires invitation code by default (`REGISTRATION_REQUIRE_INVITE=true`); signup UI makes code mandatory and supports `?code=` prefill.
- Frontend API clients for admin overview and health (`frontend/cruip-landing/lib/api/{overview,admin-health}.ts`).
- Storage service download statistics endpoints:
  - `GET /api/v1/storage/downloads/statistics` (totals)
  - `GET /api/v1/storage/downloads/statistics/daily?days=N` (daily series)
  - Persist download events for statistics (SQLite `DownloadEvent` model; recorded on each file download).
- Gateway admin overview now aggregates:
  - Upload totals/series; Download totals/series (via storage endpoints)
  - Requests/errors counts (via Prometheus metrics across services)
- New in-memory Admin notifications/audit APIs in gateway (MVP):
  - `GET/POST /api/v1/admin/notifications`, `POST /api/v1/admin/notifications/mark-read`
  - `GET/POST /api/v1/admin/audit`
  - Health transitions (healthy<->error) auto-generate notifications
  - Persistence (SQLite via Prisma) added with graceful in-memory fallback; SSE stream `GET /api/v1/admin/notifications/stream` for live updates.
- Smoke tests covering admin overview, health, invitations, and users list (`services/api-gateway-node/src/__tests__/admin.smoke.ts`).
  - Additional memory-APIs tests are included but skipped by default; enable when running the updated gateway build.

### Changed
- Admin navigation defaults to `/admin/overview`; root redirects to overview.
- User menu now reflects authenticated user and supports logout.

### Notes
- `visits_uv` remains 0 (placeholder) pending a unique visitor source. Requests/errors counts are parsed from `http_requests_total` metrics.
- For storage downloads, object size detection on MinIO uses `statObject`; local filesystem uses `fs.stat`.
