# Dashboard Analytics Context

This document preserves the operational semantics of the administrator-facing Dashboard. Canonical product terms are defined in [`CONTEXT.md`](../../CONTEXT.md); this page explains how the Dashboard reports them.

## Read model and projection

The Admin Dashboard presents Business Analytics and System Health as separate data domains. It reports facts owned by Core and operational sources; it is not the authority for Identity, File, Quota, or Object state.

The Core Read Model is the query-oriented representation used for Business Analytics. The Analytics Worker idempotently projects supported domain events into that model. A Dashboard response may therefore be fresh, delayed, partially covered, or unknown without changing the underlying business facts.

## Measurement semantics

- A Successful Download is counted only after Storage finishes the complete object-byte response. Issuing or consuming a Download Ticket is not a Successful Download.
- Committed Storage Bytes are the bytes Core has charged to Quota after File Version finalization. They are not Physical Object Bytes, which may include historical versions and temporarily unreconciled objects.
- Analytics Coverage begins at the earliest instant a metric is known to be observed under the current collection contract. Coverage gaps make affected values incomplete or unknown rather than zero.
- Read-model freshness reports the latest processed analytics fact and its lag. Freshness and coverage answer different questions and must not be combined.

## Dashboard ranges

Dashboard ranges use calendar dates in `Asia/Shanghai` and end at response generation time:

- `today` starts at the current local midnight.
- `7d` includes today and the six preceding local calendar dates.
- `30d` includes today and the twenty-nine preceding local calendar dates.

Business Analytics includes start and end instants with its resolved range. System Health reports the same range kind and timezone while resolving the observation window against operational data sources.

## Availability

Business Analytics uses nullable values and coverage metadata when a metric cannot be known completely. System Health reports `available`, `partial`, or `unavailable` and retains per-field nulls when only some operational sources can answer. An unavailable operational source must never be represented as a healthy zero.
