# PR 4 — Synchronization Control Plane Architecture

> **D-043 correction cycle:** Architecture extended by additive migration `20260804210000_sync_control_plane_correction` (`SyncApplicationReceipt`, `JobDispatch`, attempt leases, control-plane RLS, transition trigger, envelope v3, fair windowed claim). Status: CORRECTIONS IMPLEMENTED — PENDING INDEPENDENT VERIFICATION. See `PR4_SYNC_CONTROL_PLANE_CORRECTION_IMPLEMENTATION_REPORT.md`.

> **D-045 final correction:** Post-rollback SyncApplicationReceipt verification (Repeatable Read) is required before any `APPLICATION_ALREADY_APPLIED` path may finalize `SUCCEEDED`. v2 and v3 share `finalizeApplicationAfterRollback`. Confirmed stranded Redis recovery consumes the durable `attemptCount` budget (see Attempt-budget semantics), including dead-letter paths (NEW-CLAUDE-D045-04). BullMQ runnable allowlist for pinned 5.81.2 excludes `paused`. Queue classification is a pure `classifyQueueState` with no production test seam (NEW-CLAUDE-D045-01). Status: see PROJECT_STATUS / D-046.

> **D-051 readiness lock scope:** Additive migration `20260812230000_sync_control_plane_d051_readiness_lock_scope` replaces the D-050 global readiness advisory mutex with per-shop `pg_advisory_xact_lock(hashtextextended('stocky_dispatch_ready_shop_maintain:' || shop_id, 0))` in shopId ASC. **Correctness basis:** the audited runtime transaction-shape invariant — a supported runtime transaction does not take readiness advisory locks for different shops in separate statements in a dangerous order. **Defense-in-depth:** `stocky.ready_lock_max_shop` can fail closed for ordinary descending acquisition but is bypassable/clearable by `stocky_control_plane` and is **not** a security or correctness enforcement boundary (F-CLAUDE-D051-01). Status: `D-051 CORRECTION CLOSURE — APPROVED`; subsequent **D-052** accepts PR 4 repository implementation without changing this architectural truth. See `PR4_SYNC_CONTROL_PLANE_D051_CORRECTION_REVIEW_REPORT.md` (immutable blob `d17df590…`) and `PR4_SYNC_CONTROL_PLANE_CUMULATIVE_ACCEPTANCE_REVIEW_REPORT.md` (immutable blob `c9fca9b2…`).

> **D-052 acceptance status:** Phase 1 PR 4 repository implementation **ACCEPTED** at `eb757119a6b97b29c3c4e89f9cef7ecb8cd760f3`. Independent verdict `READY FOR CHATGPT PR 4 ACCEPTANCE` (cumulative review commit `ca799848…`, blob `c9fca9b2…`). Findings P0 0 / P1 0 / P2 0 / P3 4. PR #20 is **CLOSED and MERGED** (squash `f618103c64d0b17c25b7b48f49555f661e40e22d` at `2026-08-14T00:08:05Z`). PR #22 is **CLOSED and MERGED** (accepted closure head `b99039f9c34fb12e74d804a3df748cbfdb435313`; squash `99d48db22ad0d114f2ea43028fd35b4bc1806ac1` at `2026-08-14T04:01:29Z`). Phase 1 PR 4 is **FORMALLY CLOSED**. PR 5 is **NOT STARTED** and requires a separate ChatGPT product-owner brief/authorization. Production execution unauthorized. Inventory-write flags DEFAULT OFF. D-051 architectural truth is unchanged. See `PR4_SYNC_CONTROL_PLANE_CLOSURE_REPORT.md`.


**Phase:** 1  
**Work unit:** PR 4 — Synchronization control plane  
**Branch:** `phase-1/sync-control-plane` (merged as PR #20); `phase-1/pr4-closure` (merged as PR #22)
**Authorized starting main:** `e69bc53d91db75472b0d0998bf1b74ee6246adb1`
**PR #20 squash merge:** `f618103c64d0b17c25b7b48f49555f661e40e22d`
**PR #22 squash merge:** `99d48db22ad0d114f2ea43028fd35b4bc1806ac1`
**Decision:** D-042; final corrections D-045; D-051 correction closure approved; **D-052 PR 4 repository implementation ACCEPTED**; PR #20 CLOSED / MERGED; PR #22 CLOSED / MERGED; PR 4 FORMALLY CLOSED
**Shopify Admin API target:** `2026-07` (`ApiVersion.July26`)
**Production execution:** NOT AUTHORIZED
**Status:** D-052 PR 4 FORMALLY CLOSED

## Purpose

PR 4 establishes the durable synchronization control plane. The database is the
source of truth for webhook intake, logical jobs, attempts, dead letters,
replay lineage, sync runs/cursors, reconciliation scaffolding, and deterministic
sync-health state. Redis/BullMQ remains a delivery mechanism only.

PR 4 does **not** implement catalog, location, inventory, order, refund,
forecasting, purchasing, receiving, stocktake, transfer, cost, billing, AI, or
privacy-deletion domain workflows.

## Current paths (pre-PR4 characterization)

### Producers

| Producer | Module | Job name | Queue | Authority |
|---|---|---|---|---|
| Webhook routes (`orders/create`, `orders/cancelled`, `refunds/create`, `inventory_levels/update`) | `app/routes/webhooks.*` → `enqueueWebhook` | topic string | `stocky-webhooks` | Branded `TenantAuthority` → `tenant-job-envelope-v1` |
| After-auth hook | `app/shopify.server.ts` → `enqueueAfterAuthCatalogSync` | `catalog-sync` | `stocky-cron` | `after_auth_catalog_sync` |
| Dashboard sync action | `app/routes/app._index.tsx` → `enqueueCatalogSync` | `catalog-sync` | `stocky-cron` | `catalog_sync` |
| Weekly ABC tick | `scheduleAbcAnalysisCron` / worker | `abc-analysis` | `stocky-cron` | control-plane tick (no tenant envelope) |
| Per-shop ABC | `enqueueAbcAnalysisForShop` | `abc-analysis-shop` | `stocky-cron` | `abc_analysis` |

### Consumers / workers

| Worker | Queue | Processor |
|---|---|---|
| Webhook worker | `stocky-webhooks` | `processWebhookJob` |
| Cron worker | `stocky-cron` | `processCronJob` |

### Webhook topics (toml)

| Topic | Route | Durable intake in PR 4 |
|---|---|---|
| `app/uninstalled` | `webhooks.app.uninstalled` | Yes — disable + cancel |
| `app/scopes_update` | `webhooks.app.scopes_update` | Session-scope only (bootstrap) |
| `orders/create` | `webhooks.orders.create` | Yes |
| `orders/cancelled` | `webhooks.orders.cancelled` | Yes |
| `refunds/create` | `webhooks.refunds.create` | Yes |
| `inventory_levels/update` | `webhooks.inventory_levels.update` | Yes |
| `customers/data_request`, `customers/redact`, `shop/redact` | `webhooks.compliance` | Authenticate only — PR 7 |

### Current insufficiency (explicit)

- Direct BullMQ enqueue from webhook routes.
- BullMQ `jobId` dedupe only; completed/failed Redis retention is not durable idempotency.
- No durable attempt ledger, dead letter, or replay record.
- Envelope v1 is transport-only and expires after 24 hours.
- Uninstall deletes sessions only; does not durably disable processing.
- Crash between DB work and Redis ack can lose the unit of work.

## Proposed persistent records

Exact Prisma model names:

| Model | Classification | Purpose |
|---|---|---|
| `WebhookDelivery` | platform control-plane (tenant-owned) | Durable webhook inbox / idempotency |
| `DurableJob` | platform control-plane (tenant-owned) | Logical control-plane job |
| `JobAttempt` | platform control-plane (tenant-owned) | Append-only attempt history |
| `DeadLetter` | platform control-plane (tenant-owned) | Terminal disposition |
| `JobReplay` | platform control-plane (tenant-owned) | Auditable replay lineage |
| `SyncRun` | platform control-plane (tenant-owned) | PR5/PR6 scaffolding |
| `SyncCursor` | platform control-plane (tenant-owned) | Domain watermarks |
| `ReconciliationRun` | platform control-plane (tenant-owned) | PR8 scaffolding |
| `DataIssue` | platform control-plane (tenant-owned) | Discrepancy scaffolding |
| `SyncHealth` | platform control-plane (tenant-owned) | Deterministic health per domain |

`Shop` (bootstrap) gains lifecycle fields:

- `processingEnabled` (default true)
- `processingDisabledReason` (`UNINSTALLED` \| `MANUAL` \| `REDACTED`)
- `processingDisabledAt`
- `uninstalledAt`
- `reinstalledAt`

### Table classification rules

| Class | RLS | Runtime DML | Control-plane role | Notes |
|---|---|---|---|---|
| merchant_domain | ENABLE+FORCE (+ processing gate) | under tenant context | none | Existing 18 tables |
| bootstrap | no merchant RLS | Session/Shop narrow | SELECT lifecycle on Shop | Session + Shop |
| control_maintenance | no | none | none | Backfill quarantine |
| platform_control_plane | no merchant RLS | **none** for web runtime | limited DML on sync tables + Shop lifecycle SELECT/UPDATE | Tenant via non-null `shopId`, composite uniques, FKs; not a silent tenancy exemption |

Platform control-plane tables are **not** exempt from tenancy requirements: every row has non-null `shopId`, tenant-leading indexes, `shopId → Shop(id)` FK, and `(shopId, id)` uniqueness. They are exempt only from merchant-domain FORCE RLS because the dispatcher requires cross-shop `FOR UPDATE SKIP LOCKED` without `BYPASSRLS`.

## State machines

### DurableJob

```text
PENDING → DISPATCH_LEASED → ENQUEUED → RUNNING → SUCCEEDED
                              │            │
                              │            ├→ RETRY_WAIT → DISPATCH_LEASED (or ENQUEUED on redelivery)
                              │            └→ FAILED → DEAD_LETTERED
PENDING → CANCELLED
DISPATCH_LEASED → PENDING (lease expiry recovery)
RETRY_WAIT → CANCELLED
ENQUEUED → CANCELLED (uninstall; worker denies if already delivered)
```

Terminal: `SUCCEEDED`, `DEAD_LETTERED`, `CANCELLED`, `FAILED` (only as brief precursor to dead-letter creation in the same transaction).

Illegal transitions fail closed.

### WebhookDelivery

```text
RECEIVED → JOB_CREATED → COMPLETED
                └→ FAILED
(duplicate receipt increments duplicateCount; state unchanged)
```

### DeadLetter

```text
OPEN → REPLAYED | DISMISSED | SUPERSEDED
```

Exactly one active (`OPEN`) dead letter per terminal durable job.

### SyncHealth (deterministic; no invented SLA thresholds)

| State | Rule |
|---|---|
| `DISABLED` | Shop `processingEnabled = false` |
| `NEVER_STARTED` | No SyncRun and no DurableJob for domain |
| `RUNNING` | Active attempt or job in `RUNNING` / `DISPATCH_LEASED` / `ENQUEUED` |
| `DEGRADED` | Job in `RETRY_WAIT` or partial-failure SyncRun open |
| `FAILED` | Unresolved (`OPEN`) DeadLetter for domain, or SyncRun terminal failed with no successful successor |
| `HEALTHY` | Latest SyncRun succeeded (or latest job succeeded) and no unresolved blocker |

Priority when multiple apply: `DISABLED` > `FAILED` > `RUNNING` > `DEGRADED` > `HEALTHY` > `NEVER_STARTED`.

## Webhook intake order

1. `authenticate.webhook` (Shopify HMAC).
2. Resolve canonical Shop from verified domain (`createIfMissing: false` except uninstall/reinstall paths documented below).
3. Read/validate `X-Shopify-API-Version` (accept `2026-07`; reject unsupported with durable record of mismatch when Shop exists).
4. Topic sanitizer → versioned projection.
5. Deterministic payload digest (SHA-256 over canonical JSON of projection).
6. Single DB transaction:
   - upsert/find `WebhookDelivery` by `(shopId, shopifyWebhookId)`;
   - on duplicate: increment `duplicateCount`, bump `lastSeenAt`; do not create a second logical job;
   - on first: create `DurableJob` (`PENDING`) linked to delivery.
7. Return HTTP 200 after durable commit (Redis not required).
8. Dispatcher claims `PENDING` / expired leases and enqueues to BullMQ.

Durable intake target: p95 < 1s on a named disposable environment (not production).

## Dispatcher

- Bounded batch size (default 50).
- `SELECT … FOR UPDATE SKIP LOCKED` via control-plane role.
- Finite lease (`DISPATCH_LEASED` + `leaseOwner` + `leaseExpiresAt`).
- Deterministic BullMQ `jobId` = durable job id.
- Fresh `tenant-job-envelope-v2` signed at dispatch time.
- Idempotent enqueue; ack transitions to `ENQUEUED`.
- Recovery:
  - Redis down → leave `PENDING` / reclaim expired lease;
  - crash after claim → lease expiry returns to `PENDING`;
  - crash after enqueue before ack → re-enqueue is idempotent by BullMQ jobId; ack on observe;
  - concurrent dispatchers → SKIP LOCKED serialization.

No unbounded global scan: always `ORDER BY nextEligibleAt, createdAt LIMIT :batch`.

## Envelope — `tenant-job-envelope-v2`

Binds: `durableJobId`, `shopId`, `myshopifyDomain`, `source`, `correlationId`, `causationId?`, `payloadDigest`, `schemaVersion`, `issuedAt`, `signature`.

Rules:

- Authority created only from branded verified tenant authority / durable Shop row.
- Every dispatch/replay signs a fresh envelope (no reuse of expired v1/v2 signatures).
- Worker verifies signature, age (24h transport window from issuance), source/job match, Shop id/domain match, payload digest match against durable job, and `processingEnabled`.
- Queue payload alone is not durable authority.
- v1 remains parseable only for in-flight pre-cutover jobs during compatibility window when explicitly tested; new dispatches use v2 only.

Secret strength and source allowlist from PR 2 are preserved. New sources require allowlist update + inventory coverage.

## Uninstall sequence

1. Authenticate uninstall webhook.
2. Resolve canonical Shop from verified domain.
3. Persist uninstall `WebhookDelivery` idempotently.
4. Set `processingEnabled=false`, reason `UNINSTALLED`, timestamps.
5. Cancel all non-terminal jobs (`PENDING`, `DISPATCH_LEASED`, `ENQUEUED`, `RETRY_WAIT`) → `CANCELLED`.
6. Deny new job creation for disabled Shop.
7. Merchant-domain RLS predicate requires `stocky_shop_processing_enabled(shopId)`; after uninstall commit, subsequent merchant statements fail closed even if a worker already held tenant context (READ COMMITTED).
8. Delete sessions via bootstrap boundary.
9. Record completion on delivery/job.

Verified reinstall (afterAuth): may set `processingEnabled=true` only when reason was `UNINSTALLED` (not `REDACTED`); audited via Shop timestamps. Full `shop/redact` remains PR 7.

## Payload / privacy

Topic-specific sanitizers persist only approved projection keys. Strip customer names, email, phone, addresses, tokens, cookies, auth headers, unnecessary notes/objects. Money strings remain exact strings (no `Number`/`parseFloat` in newly persisted control-plane projections). Legacy processors may still use historical `parseFloat` paths; PR 6 owns exact order facts. No automatic durable-record deletion in PR 4 (PR 7 retention).

## Database roles

| Role | Env | Access |
|---|---|---|
| Migration owner | `DATABASE_MIGRATION_URL` | DDL/migrations/enforcement |
| Restricted runtime | `DATABASE_RUNTIME_URL` | Merchant DML under RLS; Session/Shop bootstrap; **no** control-plane table DML; **no** global dispatch |
| Control plane | `DATABASE_CONTROL_PLANE_URL` | DML on platform control-plane sync tables; SELECT/UPDATE on Shop lifecycle columns only; no merchant-domain DML; no migration privileges; NOINHERIT; no BYPASSRLS |

Web routes must not receive a general raw Prisma client for control-plane scans. Intake uses a narrow intake module bound to the control-plane connection (or migration URL only in disposable tests when control-plane URL unset is forbidden in production-like mode).

## API version migration

- Pin `shopify.app.toml` and `app/shopify.server.ts` to `2026-07` / `ApiVersion.July26`.
- Current `@shopify/shopify-app-react-router` already exposes `July26` — no package bump required solely for the enum.
- Record received `X-Shopify-API-Version` on every durable delivery.
- Unsupported/mismatched versions: fail closed for processing job creation after durable mismatch record (or reject before job when Shop missing).
- GraphQL codegen + webhook fixtures must pass against `2026-07`.
- No inventory mutation added or enabled.

## Failure and recovery

| Failure | Behavior |
|---|---|
| Redis down at intake | DB commit succeeds; job stays `PENDING` |
| Lease crash | Expiry reclaim |
| Enqueue without ack | Idempotent re-enqueue + ack |
| Retryable processor error | Attempt row + `RETRY_WAIT` + backoff |
| Non-retryable / max attempts | `DEAD_LETTERED` + exactly one `DeadLetter` |
| Replay | New `DurableJob` + `JobReplay`; original immutable |
| Uninstall race | RLS processing gate |
| Cross-shop access | Denied by application filters + absence of runtime grants on control-plane tables |

## Application receipt verification after rollback (D-045 / NEW-PR4-SC01)

When `applyWithApplicationReceipt` raises `APPLICATION_ALREADY_APPLIED`,
`APPLICATION_DIGEST_CONFLICT`, or `APPLICATION_OUTCOME_UNCERTAIN`, the merchant
application transaction has rolled back. The worker must **not** finalize
`SUCCEEDED` from the error code alone.

Shared path for `tenant-job-envelope-v2` and `tenant-job-envelope-v3`:

1. Open a **new** top-level TenantDb transaction at **Repeatable Read**.
2. Read `SyncApplicationReceipt` by exact `(shopId, applicationKey)`.
3. Require `receipt.payloadDigest === durable.payloadDigest` for success.
4. Outcomes:
   - matching receipt → `completeAttemptSuccess` with
     `applicationStatus = already_applied_verified_after_rollback`
   - missing / verification failure → dead-letter `application_outcome_uncertain`
   - digest mismatch → dead-letter `application_digest_conflict`

Conflict with no readable winner must emit `APPLICATION_OUTCOME_UNCERTAIN`, not
`APPLICATION_ALREADY_APPLIED`. v1 remains fail-closed and must not access
merchant handlers.

## Attempt-budget semantics for stranded recovery (D-045 / NEW-PR4-SC08 / NEW-CLAUDE-D045-04)

For PR 4:

```text
attemptCount represents consumed durable processing opportunities,
including a confirmed missing/terminal dispatch that requires redispatch
and the same opportunity when the job is dead-lettered instead of retried.
```

A confirmed stranded Redis recovery is not free and must not retry forever.

For retryable stranded recovery:

1. `nextAttemptCount = attemptCount + 1`
2. If `nextAttemptCount >= maxAttempts`: `ENQUEUED → FAILED → DEAD_LETTERED`
   with `terminalReason = max_attempts_exceeded` and
   `attemptCount = nextAttemptCount` persisted on the `ENQUEUED → FAILED` update
3. Otherwise: `ENQUEUED → RETRY_WAIT` with `attemptCount = nextAttemptCount`

`NO_AUTOMATIC_RETRY` stranded recovery also persists `attemptCount = nextAttemptCount`
on the same `ENQUEUED → FAILED` update before `FAILED → DEAD_LETTERED`.

Do **not** increment for runnable dispatch, queue unavailable, unknown state,
missing `activeDispatchSequence`, another reaper’s no-op, failed transaction,
or evidence-only observation. The increment and state transition must be atomic.

## Readiness maintain locks (D-051)

D-051 removed the D-050 global readiness advisory mutex. Readiness-changing
statement triggers take a **per-shop** transaction-scoped advisory lock:

```text
pg_advisory_xact_lock(
  hashtextextended('stocky_dispatch_ready_shop_maintain:' || shop_id, 0)
)
```

acquired in `shopId` ASC inside each statement-trigger loop. Trigger bodies
remain inline (no nested helper). Dispatcher claim does **not** take these
advisory locks (`FOR UPDATE SKIP LOCKED` on `DispatchReadyShop` only).

### Correctness basis — transaction-shape invariant

A supported runtime transaction must not take readiness advisory locks for
**different shops in separate statements** in a dangerous (descending) order.

Current independently audited writers are:

- single-shop readiness transactions; or
- single-statement multi-shop writers (expired-lease recovery, bulk
  `processingEnabled`, multi-row INSERT/UPDATE), iterated shopId ASC.

`claimBatchFair` / dispatcher claim may touch many shops but does not take the
readiness-maintain advisory lock.

This invariant is the deadlock-freedom **correctness boundary** independently
verified by the D-051 review (blob `d17df590…` at head `938e998…`).
`ORDER BY shopId ASC` inside one statement is not by itself a transaction-wide
deadlock proof.

### Defense-in-depth — `stocky.ready_lock_max_shop`

The transaction-local register `stocky.ready_lock_max_shop`
(`set_config(..., is_local=true)`) can fail closed (`P0001` /
`stocky_dispatch_ready_lock_order`) for ordinary descending multi-statement
acquisition. It is **bypassable and clearable** by the `stocky_control_plane`
role. It is therefore **not** a security boundary and **not** a correctness
enforcement boundary (F-CLAUDE-D051-01).

Do not describe this GUC as database enforcement. Do not revert to the removed
D-049 multi-shop-allowance GUC.

F-CLAUDE-D051-02 (P3, tracked on R-123): there is not yet a static guard
preventing a future multi-shop / multi-statement readiness writer. That guard
is out of scope for D-051 closure synchronization and is **not** implemented
under D-052 (F-CLAUDE-PR4ACC-03 accepted nonblocking future-maintenance residual).

## Explicit non-goals

PR 5/6 fact sync; PR 7 redaction; PR 8 reconciliation engine; inventory writes; billing; AI; merchant-facing replay UI; production deployment/migration/queue execution.

## Inventory and CI gates

Mechanical inventory: `PR4_SYNC_CONTROL_PLANE_INVENTORY.md` generated by `scripts/sync-control-plane/inventory.ts`.  
CI fails when a new producer, queue, worker, webhook route, or replay path lacks inventory coverage (`npm run sync:inventory:check`).
