# MyWebDrive

MyWebDrive is a file-storage and distribution product whose language separates logical content, physical transfer authority, public distribution, business facts, and runtime health.

## Language

**Core**:
The product authority for identity, files, quota, sharing, publication, and analytics facts.
_Avoid_: Gateway, split control plane

**Identity**:
A person recognized by a verified email address and assigned a product role.
_Avoid_: Account record, credential

**Session**:
A revocable, renewable relationship that lets an Identity obtain short-lived access.
_Avoid_: Login token, permanent token

**File**:
A logical, user-owned item whose content may evolve through File Versions.
_Avoid_: Object, blob

**Folder**:
A logical File container used to organize other Files without owning object bytes.
_Avoid_: Directory object, bucket

**File Version**:
An immutable committed content revision of a File.
_Avoid_: Upload, current blob

**Object**:
The physical bytes retained for a File Version.
_Avoid_: File, File Version

**Upload Intent**:
A time-bounded reservation to create a File or add a File Version of a declared size and media type.
_Avoid_: Upload session, chunk session

**Storage Grant**:
A short-lived authority scoped to one Object and one transfer purpose.
_Avoid_: Access token, download URL

**Download Ticket**:
A short-lived package that identifies downloadable content and carries its Storage Grant.
_Avoid_: Share link, direct URL

**Download Attempt**:
A tracked opportunity to transfer one File Version for a specific distribution purpose.
_Avoid_: Download, ticket issuance

**Successful Download**:
A Download Attempt whose complete expected Object bytes reached the recipient.
_Avoid_: Ticket issuance, download request

**Share**:
A revocable capability that lets a token holder request a Download Ticket for one File, optionally subject to expiry, password, or count limits.
_Avoid_: Publication, public file

**Publication**:
A named catalogue entry that makes one File discoverable and eligible for public Download Tickets while published.
_Avoid_: Share, release artifact

**Quota**:
The per-Identity byte budget divided into reserved, committed, and available capacity.
_Avoid_: Disk size, physical storage

**Committed Storage Bytes**:
Bytes charged to Quota for committed File Versions.
_Avoid_: Physical Object Bytes, total disk usage

**Physical Object Bytes**:
Bytes retained as Objects, including historical or temporarily unreconciled content.
_Avoid_: Committed Storage Bytes, Quota usage

**Business Analytics**:
Durable product measurements derived from Identity, File, Upload Intent, Quota, and Successful Download facts.
_Avoid_: System Health, telemetry

**Analytics Coverage**:
The known time boundary and completeness state for a Business Analytics measurement.
_Avoid_: Launch date, data freshness

**System Health**:
Current evidence about service availability, traffic, latency, errors, and processing lag.
_Avoid_: Business Analytics, product totals
