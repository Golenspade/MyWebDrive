# Dashboard Analytics Context

This context defines the product language used by the administrator-facing analytics and system-health experience. The Dashboard reports facts owned elsewhere; it is never the source of truth for user, file, quota, or object state.

## Language

**Admin Dashboard**:
The authenticated administrator view that presents Business Analytics and System Health as independent data domains.
_Avoid_: Backend Dashboard, Overview API

**Core Read Model**:
The query-oriented representation of Core business facts used by the Admin Dashboard.
_Avoid_: Head Model, Dashboard database

**Analytics Worker**:
The background projector that idempotently converts domain events into the Core Read Model.
_Avoid_: Analyst Worker, statistics cron

**Business Analytics**:
Durable measurements of users, logical files, committed storage, uploads, and successful downloads.
_Avoid_: System metrics, telemetry

**System Health**:
Runtime measurements of service traffic, errors, latency, readiness, and pipeline lag.
_Avoid_: Business Analytics

**Successful Download**:
A complete object-byte response finished by Storage. Issuing or consuming a download ticket is not a Successful Download.
_Avoid_: Download request, ticket issuance

**Committed Storage Bytes**:
Bytes that Core has committed against user quota after successful file-version finalization.
_Avoid_: Storage total, physical usage

**Physical Object Bytes**:
Bytes physically retained by object storage, including historical versions and temporarily unreconciled objects.
_Avoid_: Committed Storage Bytes

**Coverage Start**:
The earliest instant from which a metric is known to be complete under the current collection contract.
_Avoid_: Launch date, first record

**Dashboard Range**:
A range that starts at local midnight in `Asia/Shanghai` and ends at the response generation instant; `7d` includes today plus the six preceding calendar dates, and `30d` includes today plus the preceding twenty-nine.
_Avoid_: Last N times 24 hours
