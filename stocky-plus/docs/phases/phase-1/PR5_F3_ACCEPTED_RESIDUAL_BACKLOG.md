# Phase 1 PR5-F3 — Accepted Residual Backlog

**Status:** `ACCEPTED NONBLOCKING P3 RESIDUALS — CARRIED FORWARD AFTER PR5 REPOSITORY-IMPLEMENTATION ACCEPTANCE — NOT PRODUCTION-ROLLOUT CLOSED`

**Authority:** ChatGPT technical acceptance under **D-054 EFFECTIVE** (post-authorization closeout; **not** D-055)
**ChatGPT disposition:** **ACCEPT PHASE 1 PR5 REPOSITORY IMPLEMENTATION**
**Source review:** `PR5_F3_EXACT_HEAD_INDEPENDENT_REVIEW.md`
**Source review commit:** `b06e1ae2287f0d8fbf1ba6be87b8ee496a05f1ee`
**Source review blob:** `8d6d47a204d7976339c0023b6b28249f20a337a7` (never edit)
**Reviewed exact implementation head:** `502b869eb540ea9071224bd4b5da52c6b55498f0`
**Independent verdict:** `APPROVE PR5-F3 EXACT-HEAD IMPLEMENTATION` — P0 0 / P1 0 / P2 0 / P3 9
**PR #35 squash merge:** `36365e2535a2394fa53b0642db4dbf90a438316f`
**PR #35 merge timestamp:** `2026-09-06T01:33:34Z`
**Post-merge main CI:** run `34004211341` SUCCESS
**Closure report:** `PR5_CLOSURE_REPORT.md`

These nine findings remain **P3**. Severity is not lowered. None reopens the accepted PR5-F3 exact-head implementation. None is fixed in this documentation closeout. None authorizes runtime, schema, migration, privilege, flag, or PR #34 edits.

Claude recorded that every P3 is a residual, a latent precision gap, or a test-portability issue, and that none produces incorrect merchant-visible inventory, cost, tenancy, or health behaviour at the accepted head. That is why they did not block PR5 **repository-implementation** technical acceptance. It is **not** a reason to treat the production-readiness subset as irrelevant.

## Mandatory pre-production classifications

The following remain **P3** and are additionally classified as **production-readiness requirements**. They must be explicitly reconsidered before production enablement even though PR5 repository implementation is accepted:

| ID | Production-readiness requirement |
|---|---|
| **P3-CLAUDE-F3XH-06** | Kill-switch / refetch chunk hardening must be explicitly reconsidered before production enablement. Webhook refetch currently checks `processingEnabled` once rather than per canonical chunk. |
| **P3-CLAUDE-F3XH-08** | Non-concurrent index rollout must be resolved through an approved safe migration approach or explicit controlled maintenance-window evidence before applying the F3 migration to populated production tables. |

Do **not** silently treat these as ordinary later polish because the repository implementation is accepted.

The other seven P3s remain tracked **engineering hardening** unless another approved gate requires them earlier.

## Findings

### P3-CLAUDE-F3XH-01 — `bulkOperationRunQuery` scanner-exception collision across roots

| Field | Value |
|---|---|
| Severity | **P3** (unchanged) |
| Source | `PR5_F3_EXACT_HEAD_INDEPENDENT_REVIEW.md` blob `8d6d47a204d7976339c0023b6b28249f20a337a7` |
| Summary | Root-relative `bulkOperationRunQuery` scanner exception can collide across scan roots. `CANONICAL_SUBMIT_MUTATION_EXCEPTIONS` matches `modulePath === "ingest/bulk-operation-submitter.ts"`; a worker-tree module at that relative path inherited the library submitter exception. |
| Why it did not block PR5 technical acceptance | Latent precision gap. Blast radius is bounded: the exception still admits only a single-operation, single-root-field `bulkOperationRunQuery`; an inventory mutation at that path is still rejected. No merchant-visible inventory write at the accepted head. Independent verdict remained `APPROVE PR5-F3 EXACT-HEAD IMPLEMENTATION`. |
| Owner / future disposition | Engineering hardening. Preserve when closing **R-163** for the repository scanner obligation; do not erase this residual. |
| Gate | Ordinary hardening unless another approved gate requires it earlier. Related: **R-163** closed for the required two-root scanner obligation only. |

### P3-CLAUDE-F3XH-02 — Whole-application scanner skips directories named `types`

| Field | Value |
|---|---|
| Severity | **P3** (unchanged) |
| Source | `PR5_F3_EXACT_HEAD_INDEPENDENT_REVIEW.md` blob `8d6d47a204d7976339c0023b6b28249f20a337a7` |
| Summary | `scripts/pr5-f3-safety-scan.ts` skips any directory named `types`, so a future `app/**/types/**` module can escape the whole-application semantic scan. |
| Why it did not block PR5 technical acceptance | No directory named `types` existed under `app` at the accepted head; no file was currently unscanned. Independent verdict remained approve. |
| Owner / future disposition | Engineering hardening. Preserve when closing **R-163**; do not erase this residual. |
| Gate | Ordinary hardening unless another approved gate requires it earlier. Related: **R-163** closed for the required two-root scanner obligation only. |

### P3-CLAUDE-F3XH-03 — Projection retry budget calculated but effectively discarded

| Field | Value |
|---|---|
| Severity | **P3** (unchanged) |
| Source | `PR5_F3_EXACT_HEAD_INDEPENDENT_REVIEW.md` blob `8d6d47a204d7976339c0023b6b28249f20a337a7` |
| Summary | Both branches of the compatibility-projection retry guard return the same value, so the computed retry budget is discarded. `MAX_COMPATIBILITY_PROJECTION_ATTEMPTS` is declared and unused. |
| Why it did not block PR5 technical acceptance | Premature exhaustion cannot occur because nothing exhausts; pending DEGRADED rows are re-selected on the next pass. The named `NEW-CLAUDE-F2CCM-01` invariant holds by accident rather than enforcement. No incorrect merchant-visible health at this head. |
| Owner / future disposition | Engineering hardening of the named retry-budget invariant. |
| Gate | Ordinary hardening unless another approved gate requires it earlier. |

### P3-CLAUDE-F3XH-04 — Lock-capacity test expectation depends on `max_connections`

| Field | Value |
|---|---|
| Severity | **P3** (unchanged) |
| Source | `PR5_F3_EXACT_HEAD_INDEPENDENT_REVIEW.md` blob `8d6d47a204d7976339c0023b6b28249f20a337a7` |
| Summary | Race AW expectation `reduced === true` is settings-dependent: it fails at `max_connections=200` and passes at CI's `max_connections=100`. |
| Why it did not block PR5 technical acceptance | Deterministic under CI's pinned `postgres:16-alpine`. Independently reproduced as a test-portability issue, not a runtime capacity bypass. **R-161** remains separately OPEN for production-scale evidence. |
| Owner / future disposition | Test hardening: derive the expected cap from observed settings. |
| Gate | Ordinary hardening unless another approved gate requires it earlier. Does not close or reopen **R-161**. |

### P3-CLAUDE-F3XH-05 — Unsubscribed legacy inventory webhook route remains

| Field | Value |
|---|---|
| Severity | **P3** (unchanged) |
| Source | `PR5_F3_EXACT_HEAD_INDEPENDENT_REVIEW.md` blob `8d6d47a204d7976339c0023b6b28249f20a337a7` |
| Summary | `shopify.app.toml` re-points `inventory_levels/update` to `/webhooks/catalog-facts`, but `app/routes/webhooks.inventory_levels.update.tsx` remains and still enqueues the topic. |
| Why it did not block PR5 technical acceptance | Not a competing authority. It enqueues the same topic now routed to authoritative refetch, and it is unreachable from Shopify without a subscription. **R-165** closure is the live null→zero writer removal, not this leftover route. |
| Owner / future disposition | Engineering hardening: delete the route or document it as an intentional transition fallback. |
| Gate | Ordinary hardening unless another approved gate requires it earlier. |

### P3-CLAUDE-F3XH-06 — Webhook refetch checks `processingEnabled` once rather than per canonical chunk

| Field | Value |
|---|---|
| Severity | **P3** (unchanged) |
| Source | `PR5_F3_EXACT_HEAD_INDEPENDENT_REVIEW.md` blob `8d6d47a204d7976339c0023b6b28249f20a337a7` |
| Summary | JSONL apply asserts `processingEnabled` before every sub-batch; webhook refetch checks once at entry and then applies all chunks of an in-flight Product. |
| Why it did not block PR5 technical acceptance | Merchant impact is low and bounded by one product's variant set. The post-commit projector re-checks and throws. No P0/P1/P2 at the accepted head. |
| Owner / future disposition | Kill-switch / refetch chunk hardening before production enablement. |
| Gate | **Production-readiness requirement.** Must be explicitly reconsidered before production enablement. Do not treat as irrelevant because PR5 repository implementation is accepted. |

### P3-CLAUDE-F3XH-07 — Capacity fallback exhausts before reaching batch size 1 from default 500

| Field | Value |
|---|---|
| Severity | **P3** (unchanged) |
| Source | `PR5_F3_EXACT_HEAD_INDEPENDENT_REVIEW.md` blob `8d6d47a204d7976339c0023b6b28249f20a337a7` |
| Summary | `capacityFailures > 6` aborts while halving from 500 reaches 7, so a slice cannot degrade to 1. The run fails closed with `canonical_lock_capacity_retry_exhausted` rather than proceeding unsafely. |
| Why it did not block PR5 technical acceptance | Fail-closed resilience ceiling under sustained 53200 pressure, not unsafe apply. **R-161** remains OPEN separately for production-scale capacity evidence. |
| Owner / future disposition | Engineering hardening of the fallback bound. |
| Gate | Ordinary hardening unless another approved gate requires it earlier. Does not close or reopen **R-161**. |

### P3-CLAUDE-F3XH-08 — Five fact-table indexes use non-concurrent `CREATE INDEX`

| Field | Value |
|---|---|
| Severity | **P3** (unchanged) |
| Source | `PR5_F3_EXACT_HEAD_INDEPENDENT_REVIEW.md` blob `8d6d47a204d7976339c0023b6b28249f20a337a7` |
| Summary | Five `CREATE INDEX IF NOT EXISTS` statements (not `CONCURRENTLY`) under `statement_timeout = '60s'` in `20260905173500_pr5_f3_remaining_integration`. |
| Why it did not block PR5 technical acceptance | Tables are empty in repository/CI evidence and no production execution is authorized. On a populated production table each build takes a `SHARE` lock that blocks writes; a 60s timeout fails the migration closed. |
| Owner / future disposition | Approved safe migration approach or explicit controlled maintenance-window evidence before applying the F3 migration to populated production tables. This closeout does **not** edit the migration. |
| Gate | **Production-readiness requirement.** Must be resolved before applying the F3 migration to populated production tables. Do not treat as irrelevant because PR5 repository implementation is accepted. |

### P3-CLAUDE-F3XH-09 — One control-plane `SyncRun` read omits explicit `shopId`

| Field | Value |
|---|---|
| Severity | **P3** (unchanged) |
| Source | `PR5_F3_EXACT_HEAD_INDEPENDENT_REVIEW.md` blob `8d6d47a204d7976339c0023b6b28249f20a337a7` |
| Summary | `catalog-sync.ts` reloads `prisma.syncRun.findUnique({ where: { id: run.id } })` without pairing `shopId`. Other checkpoint reads pair `id` with `shopId`. |
| Why it did not block PR5 technical acceptance | Not exploitable at this head: `run.id` is a CUID already obtained from a shop-scoped query, so no cross-tenant row can be reached. Consistency gap against the lane's tenant-predicate convention only. |
| Owner / future disposition | Engineering hardening: fail closed on a shop-scoped read. |
| Gate | Ordinary hardening unless another approved gate requires it earlier. |

## Explicit non-authorization

- None of these residuals authorizes application, test, schema, migration, privilege, CI, package, Shopify configuration, or feature-flag edits in this closeout.
- None reopens PR5-F3 exact-head acceptance or PR5 repository-implementation technical acceptance.
- None authorizes production activation, production backfill, deployment, or inventory writes.
- Inventory-write flags remain **DEFAULT OFF**.
- `FEATURE_PR5_ABSENCE_TOMBSTONE` remains **DEFAULT OFF**.
- Production inventory writes remain **UNAPPROVED**.
- Phase 1 remains **IN PROGRESS**.
- PR6 runtime remains **NOT AUTHORIZED**.
- PR #34 remains untouched at `f5d429b7b3577c87e67c5ef3445e88560e565a5c`.
