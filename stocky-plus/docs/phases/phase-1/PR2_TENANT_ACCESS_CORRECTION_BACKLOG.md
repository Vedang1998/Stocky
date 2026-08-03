# Phase 1 PR 2 — Tenant Access Correction Backlog

**Source review:** `PR2_TENANT_ACCESS_REVIEW_REPORT.md` (Claude Code)  
**Reviewed implementation head:** `6f9ca22c069a46003b6944ff56c888ff91e95cdc`  
**Independent verdict:** `NOT READY — CORRECTIONS REQUIRED`  
**Pull request:** #13 (`phase-1/tenant-access`)  
**Authorized base:** `main@04289d61f605414597ac85f47830a3c9d2f9e33d`

This backlog translates every independent finding into a tracked correction. Status values below are planning dispositions at backlog creation; implementation progress is recorded in `PR2_TENANT_ACCESS_CORRECTION_IMPLEMENTATION_REPORT.md`.

| Finding | Severity | Correction ID | Correction status | Disposition |
| --- | ---: | --- | --- | --- |
| F-PR2-01 | P1 | C-01 | Mandatory | Nullable ownership compatibility for direct + child models |
| F-PR2-02 | P1 | C-02 | Mandatory | Recursive relation isolation on include/select/_count |
| F-PR2-03 | P1 | C-03 | Mandatory | Cryptographically authenticated job envelopes |
| F-PR2-04 | P2 | C-04 | Mandatory | Architecture scanner completeness + exact allowlists |
| F-PR2-05 | P2 | C-05 | Mandatory | Nested write and connect ownership validation |
| F-PR2-06 | P2 | C-06 | Mandatory | Complete client-hint conflict detection |
| F-PR2-07 | P3 | C-07 | Evaluate; do not add unapproved schema | Narrow webhook `createIfMissing`; document residual |
| F-PR2-08 | P3 | C-08 | Documentation correction required | Separate PR 2 transport integrity from PR 4 persistence |
| F-PR2-09 | P3 | C-09 | Documentation correction required | Document Node/npm version requirements |

## Correction detail

### C-01 / F-PR2-01 — Nullable ownership compatibility (P1, Mandatory)

- Replace conjunctive direct-model scope with approved disjunction.
- Child access requires verified same-tenant parent lineage for null-`shopId` rows.
- Fail closed on foreign non-null `shopId`, conflicting ownership signals, missing/ambiguous lineage.
- Do not silently repair ownership on read/update/delete.
- Creates continue to assign canonical ownership; updates must not mutate `shopId` or legacy `shop`.

### C-02 / F-PR2-02 — Recursive relation isolation (P1, Mandatory)

- Explicit relation metadata for every merchant-owned relation in use.
- Recursively scope `include`, nested `include`, `select`, nested `select`, `_count`, nested `where`.
- Fail closed on unknown merchant relation shapes.
- Remove documentation that labels unscoped nested includes as an acceptable PR 3 residual.

### C-03 / F-PR2-03 — Authenticated job envelopes (P1, Mandatory)

- HMAC-SHA256 signature over deterministic unsigned fields.
- Dedicated `TENANT_JOB_ENVELOPE_SECRET` (≥ 32 bytes); fail closed if absent/weak.
- Closed `TenantJobSource` allowlist; source/job-type compatibility.
- Parse `issuedAt`; reject invalid, future (>5m skew), and aged (>24h) envelopes.
- Producers accept branded `TenantAuthority` only; no arbitrary pre-built envelope enqueue API.
- Verification before canonical Shop lookup and before any merchant query.

### C-04 / F-PR2-04 — Architecture scanner completeness (P2, Mandatory)

- Detect dynamic imports, re-export chains, aliases, computed/aliased delegates, destructuring, raw SQL aliases, unauthorized `issueTenantAuthority`, raw shop-only queue payloads, arbitrary envelope producers, wildcard/directory allowlists, stale inventory.
- Exact-file allowlist entries with owner and expiration/removal condition.
- Committed negative fixtures for all required bypass cases.
- Deterministic inventory generation (no wall-clock-only freshness).

### C-05 / F-PR2-05 — Nested write / connect validation (P2, Mandatory)

- Validate `connect`, `connectOrCreate.where`, `set`, `disconnect`, nested update/delete/upsert targets through tenant-scoped resolution.
- Reject mixed-tenant ID arrays, foreign/missing rows, unknown relation ops.
- Fail closed before mutation.

### C-06 / F-PR2-06 — Client-hint conflict detection (P2, Mandatory)

- Inspect duplicate query values, headers, top-level/nested JSON, arrays, form fields, nested form keys, multipart, route params.
- `requireAdminTenant({ request, params })`.
- Bounded recursive inspection with fail-closed limits.

### C-07 / F-PR2-07 — Webhook Shop creation (P3)

- Prefer Shop creation only on verified post-auth install path.
- Narrow `createIfMissing` by topic or document explicit race residual.
- Do not add Shop provenance schema without separate ChatGPT approval.

### C-08 / F-PR2-08 — R-039 wording (P3)

- Distinguish PR 2 transport authentication/integrity from PR 4 persistence/replay/idempotency.
- Do not call version/shape/Shop matching "integrity validation."

### C-09 / F-PR2-09 — Tool versions (P3)

- Document prominently: Node compatible with package engines; npm exactly `11.5.2`.
- Do not broaden dependency upgrades or regenerate lockfile unnecessarily.

## Out of scope for this correction cycle

- Marking PR #13 ready or merging
- Deployment / production DB / production backfill
- RLS, DB roles, non-null `shopId`, composite tenant FKs, tenant-key triggers
- PR 3 / PR 4 persistence schema
- Inventory writes / enabling inventory-write flags
- API-version changes / unrelated features
