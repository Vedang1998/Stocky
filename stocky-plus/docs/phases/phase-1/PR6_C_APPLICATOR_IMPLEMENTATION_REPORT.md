# Phase 1 PR6-C — Order / Refund Canonical Applicator Implementation Report

**Slice:** PR6-C complete-module canonical order/refund applicator
**Branch:** `phase-1/pr6-c-order-fact-applicator`
**PR:** #40 OPEN / DRAFT / UNMERGED
**Authority:** D-054 **EFFECTIVE** (no D-055); ChatGPT B/C addendum [5639320213](https://github.com/Vedang1998/Stocky/pull/37#issuecomment-5639320213); admission [5640728436](https://github.com/Vedang1998/Stocky/pull/37#issuecomment-5640728436); consolidated correction decision [5642820719](https://github.com/Vedang1998/Stocky/pull/40#issuecomment-5642820719); routing/continuation [5647803315](https://github.com/Vedang1998/Stocky/pull/40#issuecomment-5647803315) (`user=Vedang1998`, `created_at=2026-09-12T18:21:41Z`, id `5647803315`) — this is the outstanding C evidence-completion assignment, not a repeat of the already executed F-01–F-08 package.
**Status:** Independent Claude review of `04a3e276c9d607e440051603e54e7c96dc9ad19f` issued `CORRECTIONS REQUIRED` (P0 0 / P1 6 / P2 2 / P3 4). F-01–F-08 remain implemented. Independent correction/evidence review of `4a5fc80417f90c80f6e310428a6ce0d0036f9d93` (blob `8c384b698bc45a7a9ac0a1dffa2ab8fdbcc65704`) issued `CORRECTIONS REQUIRED` (P0 0 / P1 0 / P2 1 / P3 4). F-CR-01…05 plus tooling **T** merge landed at `e8c0e54a02d4686699fcb7d75c60ac57654d2067`. Combined-tree isolation and fetch-before-archive landed at `042e83563c8a8d367ae11df3fda6c0e10c6badd0`. Exact-head `pull_request` [34886822386](https://github.com/Vedang1998/Stocky/actions/runs/34886822386) on that SHA is historical **FAILURE** (Classify SUCCESS; Heavy/Gate FAIL on T-owned F-F03). That run was **not** cancelled. PR #39 is CLOSED/MERGED. Squash **U** / current main is `1ec7af31f1a6ffd1c0c1d9b4bcd28043c5516505`. History-preserving merge into C is `c76a5d3704e3e4285f4e1152b0ada005a5e946a6` (parents `042e835…` + `1ec7af31…`). Exact-U push [34891789836](https://github.com/Vedang1998/Stocky/actions/runs/34891789836) is **not** marked green here. New exact-integrated-C Classify + Heavy + Gate are **not** marked green here. Independent C acceptance remains **pending**. Merge of PR #40 is **not** authorized.

**Production:** NOT AUTHORIZED
**Inventory-write flags:** DEFAULT OFF
**Shopify network I/O in this lane:** NONE
**PR6-D runtime:** NOT AUTHORIZED

This report records the PR6-C applicator implementation. It does **not** claim Phase 1 or PR 6 overall is complete. It does **not** start PR6-B reader work, PR6-D webhooks/import, production, or flag enablement. This report does **not** embed its own commit SHA.

---

## 1. Independently verified identities

| Field | Value |
|---|---|
| PR #37 | CLOSED / MERGED at `2026-09-11T20:07:27Z` |
| Accepted subject head | `f7a39c3664a8a45b7a7cd3055079b4ebc888bb02` |
| Squash **M** / `origin/main` | `bdbb5bba91ac8af82e49a99e36cce5db8b401c68` |
| **M** sole parent | `09feffd3f36eb4698f2ed8a152efe414cd9b77bd` |
| `M^{tree}` | `9e5a700b0f4a3b0d9b7f0638bd431e0daea029dc` (equals accepted subject tree) |
| Correction review at **M** | `PR6_A_FOUNDATION_CORRECTION_INDEPENDENT_REVIEW.md` blob `da388c5d2ffa8bc0e04312de9c14a831b5ba4010` — `APPROVE PR6-A FOUNDATION CORRECTION` |
| Original A review blob | `198e55548a2ca09942843798a9ebd3e03a30d0fa` |
| Planning review blobs at **M** (never edit) | `d72340c01dd9c662d0e8bb4aa8d43482940470d9`, `fca2b260d03e3105782ed216f7773c53e6aef2a7`, `4f5ea10f6d36175d3540cb977a8f3543f36c15c2` |
| Exact-M **push** CI | run [34642536795](https://github.com/Vedang1998/Stocky/actions/runs/34642536795) `event=push` `head=bdbb5bba…` **SUCCESS** |
| B admission comment | [5640728436](https://github.com/Vedang1998/Stocky/pull/37#issuecomment-5640728436) body starts `PR6_BC_ADMISSION_READY`, user `cursor[bot]`, created `2026-09-11T21:15:39Z` |
| Control commit (docs-only, parent = **M**) | `4a5478dd0daa658ffd2d50cce4a33571cb0ab6f6` on `phase-1/pr6-b-order-admin-read` |
| Authorized C starting implementation head | `04a3e276c9d607e440051603e54e7c96dc9ad19f` |
| Final C independent review | `f8e60805dcee6f80f3e40760afad7aea40cfb4b8` (sole parent `04a3e276…`; blob `a90ae442a80ee593bb43bee3b15c2228f32d6e15`; only added file `PR6_C_APPLICATOR_INDEPENDENT_REVIEW.md`). **Never edited.** Superseded identity `ff0ce52e…` is not used. |
| Review integration | `git merge --ff-only` was impossible because C had already advanced past `04a3e276…`. Review was merged as `1f61e33bcf9fedaee56efa3e0082f8f593ccd887` (parents `9f3840a…` + `f8e60805…`). Tree blob remains `a90ae442…`. |
| Runtime/test correction head | `0474fecc15d728ce69ad858a0bae3de637c573e8` |
| Unchanged returned packet (does **not** complete evidence) | `b0b7f5825601e7f66e2547739cb0ff304697b83e` |
| Evidence-harness runtime/test head (before this documentation commit) | `14fb29f7ef54cdf3851637892704c69e3fd5dfc2` |
| Starting C head for this correction/integration packet | `4a5fc80417f90c80f6e310428a6ce0d0036f9d93` |
| Immutable C correction review | `e24ac2d50950373213c2a2ece9ee784b335c2c7e` — sole parent `4a5fc80…`; sole added path `PR6_C_APPLICATOR_CORRECTION_INDEPENDENT_REVIEW.md`; blob `8c384b698bc45a7a9ac0a1dffa2ab8fdbcc65704`. Fast-forwarded; never edited. |
| Required tooling **T** | `f5ec7abb01d14d5803e186b3e883fa15defad38f` (PR #42 squash). Sole parent **M**. History-preserving merge `3d25fdd520071e154cfaa85d651acf14983140aa` (parents `e24ac2d…` + `f5ec7ab…`). PR #41 remains parked. |
| B typed-read pin (read-only) | `610ed0503a3aa2998aca7228f4fca9617bed23a3` — still used for C-only pinned-scratch tests. Accepted B runtime is on C via **U**, not by rewriting this pin. Superseded overlay identity `d9717f68…` is not used. |
| Accepted B subject head | `7338aaa45294c28526330aa259779308bd6d851e` — PR #39 CLOSED / MERGED at `2026-09-14T20:15:14Z` (comment [5670216046](https://github.com/Vedang1998/Stocky/pull/39#issuecomment-5670216046)). |
| Squash **U** / current `origin/main` | `1ec7af31f1a6ffd1c0c1d9b4bcd28043c5516505`. Sole parent **T** `f5ec7abb01d14d5803e186b3e883fa15defad38f`. `U^{tree}` `84dbb800d45e7c7037ab87ee4dfc8a77de19ae56` equals `7338aaa^{tree}`. |
| B review (read-only) | `59f469a1951a4a4d86c6273f9ff10cc6635cf0e3`, blob `b4533610b5af305816aef5434b884c3065b06f94`. Not edited by C. |
| C-INTEGRATION-01 starting head | `e8c0e54a02d4686699fcb7d75c60ac57654d2067` |
| C-INTEGRATION-01 isolation head (failed overlay-archive CI) | `124d4f557b54218657e73e057235a89612ab3160` — run [34879406832](https://github.com/Vedang1998/Stocky/actions/runs/34879406832) Classify `104094645199` SUCCESS, Heavy `104094697451` **FAILURE**, Gate `104115647881` **FAILURE** |
| C-INTEGRATION-01 fetch-before-archive implementation | `3358ee982445b1b04aac15e7d47a131ab5af5522` (parent `124d4f5…`). |
| Pre-U C head (failed F-F03 exact-head CI) | `042e83563c8a8d367ae11df3fda6c0e10c6badd0` — run [34886822386](https://github.com/Vedang1998/Stocky/actions/runs/34886822386) terminal **FAILURE**. Not cancelled. Overlay safety 15/15 and reader 18/18 passed. Heavy failed T-owned F-F03. |
| U merge into C | `c76a5d3704e3e4285f4e1152b0ada005a5e946a6` (parents `042e835…` + `1ec7af31…`). This documentation commit is a child of that SHA and does not embed its own unknown future SHA. |

C started from **M**, not from B runtime. Accepted B is now present on C via the authorized history-preserving merge of squash **U**. C does not edit B’s shared-control files or B `admin-read/**` contents.

## 2. Exclusive C ownership

**Owned**

- `stocky-plus/app/lib/order-facts/apply/**` including module-local unit tests
- `stocky-plus/scripts/tenant-enforcement/tests/pr6-c-canonical-applicator.test.ts`
- `stocky-plus/scripts/tenant-enforcement/tests/pr6-c-evidence-gates.test.ts`
- `stocky-plus/scripts/tenant-enforcement/tests/pr6-c-b-compat-probe.test.ts` (test-local mapper; no B overlay committed)
- `stocky-plus/scripts/tenant-enforcement/tests/pr6-c-b-compat-mapper.ts`
- `stocky-plus/scripts/tenant-enforcement/tests/pr6-c-b-pin-overlay.ts` (C-only: owned tmp worktree of the B pin; combined tree: tracked B files in place; never deletes tracked admin-read)
- `stocky-plus/scripts/tenant-enforcement/tests/pr6-c-b-pin-overlay.safety.test.ts`
- `stocky-plus/scripts/tenant-enforcement/tests/pr6-c-b-reader-overlay.test.ts`
- `stocky-plus/scripts/tenant-enforcement/tests/pr6-c-pg-harness.ts`
- `stocky-plus/scripts/tenant-enforcement/tests/pr6-c-process-loss.test.ts`
- `stocky-plus/scripts/tenant-enforcement/tests/pr6-c-process-loss-child.ts`
- `stocky-plus/scripts/tenant-enforcement/tests/pr6-c-scale-envelope.test.ts`
- `stocky-plus/docs/phases/phase-1/PR6_C_APPLICATOR_IMPLEMENTATION_REPORT.md` (this report)
- Immutable first-pass review blob `a90ae442…` (not edited)
- Immutable correction review blob `8c384b69…` (not edited)
- Mechanical scanner exception: `stocky-plus/docs/phases/phase-1/PR2_TENANT_ACCESS_INVENTORY.md` (combined-tree regen after U: `scannedFiles` **448**; findings 1741; violations 0; digest `8e9b1ed9…` unchanged; no unused allowlist entries)

**Not owned / not edited**

- Prisma schema and migrations
- A types/constants/locks (`app/lib/order-facts/types.ts`, `constants.ts`, `lock-key.ts`, `advisory-lock.ts`)
- B `admin-read/**` and generated `app/types/**`
- Shared control docs (`PROJECT_STATUS.md`, `DECISIONS.md`, `RISK_REGISTER.md`, `PR6_BC_EXECUTION_BRIEF.md`, `PR6_A_CLOSURE_REPORT.md`, phase README, `ACCELERATED_SAFE_DELIVERY.md`)
- Webhook/worker/import, Shopify config, packages, CI workflows, global test configs
- Allowlist files (no unused exception added)
- `PR6_C_APPLICATOR_INDEPENDENT_REVIEW.md` after merge

## 3. What the applicator does

`applyOrderFacts(db, input)` applies already-authoritative Order/Refund observations inside an open tenant transaction. The caller owns COMMIT/ROLLBACK. There is no Shopify network I/O. Receipt-bound batches that do not reach a terminal accepted operation throw `OrderApplyReceiptNotCertifiableError`; the caller must ROLLBACK.

`applyOrderFactsWithRetry(begin, input)` retries `order_apply_unique_conflict` / `order_advisory_lock_timeout` / `order_apply_receipt_lock_timeout` only by rolling back and starting a **fresh** PostgreSQL transaction. No in-process unique retry. No `ON CONFLICT DO UPDATE`. No savepoint recovery.

Supported identities locked: Order GID and nested Refund GIDs only — never every line. Refund jobs lock Order **and** Refund even when no local Order row exists. Keys are ordered ascending `(key1, key2)` via the frozen A primitive `acquireOrderIdentityAdvisoryLock` / `stocky-pr6-canonical-lock-v1`. Capacity uses the frozen catalog evaluator.

When a receipt is bound, C acquires a **module-local** application-key advisory lock (`stocky-pr6-c-receipt-v1`, SHA-256 int32 pair via A’s `orderLockPreimage` without mutating A) **before** receipt lookup and identity locks. Lock order: tenant + `processingEnabled` → receipt key → short-circuit → capacity → identity locks → `processingEnabled` re-check → DML → certify or throw → receipt insert.

Kill switch: runtime cannot `SELECT "Shop"`. Apply calls granted helper `stocky_shop_processing_enabled(text)`.

Receipt: `SyncApplicationReceipt` insert is the **final** write (`ATOMIC_APPLICATION_RECEIPT`); `ON CONFLICT DO NOTHING`. Duplicate same digest short-circuits. Digest mismatch fails closed. Success certifies a terminal accepted operation via an explicit reason allowlist. Generic `noop` and zero-writes are not success. Bounded outcome evidence is stored on existing `resultMetadata`.

## 4. Primary gates

| Gate | Implementation |
|---|---|
| R-164 | Ordinary apply APIs export no physical-delete operation. Writers are INSERT/UPDATE only. Source scan forbids `deleteMany` / `DELETE FROM` canonical order fact tables. |
| R-174 | Independent Order Clock A and independent Refund Clock A (`updatedAt`). Stale parent discards that parent’s children (T44). Equal `updatedAt` re-applies for child repair (T45). Nested Refund is **not** discarded solely because the Order snapshot is stale. `happenedAt` is event time, not Clock A. |
| R-176 (C apply half) | Rolling 60-day window: aged-out `order(id:)` null → `INACCESSIBLE_HISTORY_WINDOW`; `deletedAt` stays NULL; historical facts retained. Confirmed absence requires completed null + in-window + scope continuity. Unverified delete uses `ABSENT_SIGNALLED_DELETE_UNVERIFIED` + `deletionSource=WEBHOOK`. Established tombstones are preserved when later access is unverifiable. Terminal revival requires two independent non-overlapping LIVE confirmations. First-insert ABSENT writes no row. Full-sync omission nominates in-window LIVE rows as `CANDIDATE` only — never a single-epoch tombstone. Out-of-window LIVE rows are excluded from nomination (T34). Severity remains **P0 OPEN**. |
| R-167 | Window is not treated as complete lookback. `read_all_orders` makes the predicate unconditional; C consumes trusted scope evidence and does not invent grant. |
| R-168 | PO-10 / signed unit ledger in `units.ts`. Refund lines are not unit events. Derived refunded/removed magnitudes only. Never `abs()`. Never BOM explosion. |
| Money | Exact DECIMAL(20,6) text. `Number` / `parseFloat` rejected. Required-bag parse of the whole snapshot **before** merchant DML (T48). Shop vs presentment stored separately; no FX. Unbalanced refund identity persists Shopify fields + `REFUND_MONEY_UNBALANCED`. |
| Tenant | `stocky.current_shop_id` must match batch `shopId`. Client-supplied shop header is denied. All writers bind `shopId`. Text arrays use catalog JSONB construction, not `${scopes}::text[]`. |
| Fencing | Direct apply requires a durable `OrderFactObservationInFlight` token. Lease validity uses PostgreSQL `clock_timestamp()`. Incomplete nested walks complete the observation with `SNAPSHOT_PAGINATION_INCOMPLETE` and write no canonical facts. Unique races retry full apply on a fresh transaction. |

## 5. Requirement-to-test matrix (C-owned)

Default-discovered `app/lib/order-facts/apply/*.test.ts` are database-free. PostgreSQL suites live only in `scripts/tenant-enforcement/tests/pr6-c-*.test.ts`. The 1,000,000-line envelope is in `pr6-c-scale-envelope.test.ts` and runs only when `PR6_C_SCALE_1E6=1`.

| ID | Kind | C coverage |
|---|---|---|
| T01 | + | PG first LIVE order+line exact decimals |
| T03 | bypass | PG client shop header denied |
| T04 | + | PG duplicate receipt short-circuit |
| T05 | + | PG duplicate refund GID idempotent |
| T06 | + | PG two RETURN sales accumulate; refund lines not double-counted |
| T07 | + | PG edit agreement then refund both persist; one sale ledger |
| T08 | + | PG cancel then refund both persist |
| T09 / T44 | − | PG stale `updatedAt` writes no children; unit Clock A |
| T10 | + | PG newer refetch applies |
| T11 | + | PG `variantGidAtSale` retained when later identity is null |
| T12 | + | PG historical variant GID not replaced by later SKU-matched GID |
| T13 | + | PG cancelled snapshot then later refetch; no create state machine |
| T14 | + | PG two tenants same Shopify order GID |
| T15 | + | PG + unit sub-cent `1.234567` |
| T16 | + | PG zero-price qty 2 kept |
| T17 | + | PG `test=true` stored; JOIN without extra `shopId` in ON |
| T18 | + | PG gift-card line stored |
| T23 | + | PG retry helper fresh transaction after unique conflict |
| T25 | + | PG overlapping LIVE vs ABSENT conflict; no LWW tombstone |
| T26 | bypass | Unit source scan + money `Number` reject |
| T27 | + | PG presentment EUR / shop USD; no FX |
| T28 | − | Unit mixed shop-currency sum reject |
| T29 / T54 | + | Unit + PG contradictory identity detected; clean exchange does not false-fire sign |
| T31 | drift | PG earlier ACTIVE fence blocks later direct first insert |
| T34 | + | PG aged-out LIVE excluded from full-sync absence nomination |
| T35 | + | PG advisory lock held in the applying transaction before commit |
| T36 | + | PG PENDING refund transaction stored from snapshot |
| T38 | bypass | PG raw SQL `shopId` reassignment denied |
| T40 | bypass | Unit source scan forbids `processBomSale` |
| T41 | − | Unit + PG aged-out null → `INACCESSIBLE_HISTORY_WINDOW`; `deletedAt` NULL; `DEGRADED` |
| T42 | + | Unit + PG in-window null tombstone `ABSENT_CONFIRMED_QUERY` |
| T43 | + | Unit + PG unverified delete `WEBHOOK` + `deletedAt`; line retained |
| T45 | + | Unit + PG equal `updatedAt` repairs drifted children |
| T46 | + | PG null refund-line id ordinal identity idempotent |
| T47 | + | Unit + PG RETURN −1 stored; derived refunded magnitude 1; diagnostic null |
| T48 | − | Unit + PG invalid required bag / invalid line bag; no partial order row |
| T49 | + | Unit + PG unbalanced refund persists + `REFUND_MONEY_UNBALANCED` |
| T50 | bypass | Unit + PG scope downgrade voids absence; missing persisted continuity denies absence |
| T55 | + | Unit + PG documented RETURN quantity −2 |
| T56 | + | PG two complete refund snapshots both persist (apply side) |
| T57 | − | PG incomplete nested walk → `SNAPSHOT_PAGINATION_INCOMPLETE`; no facts |
| T58 | + | Unit + PG mixed ORDER+RETURN on one agreement does not set `UNIT_SALE_SIGN_INCONSISTENT` |
| Revival | + | PG two-step revival; first confirmation does not overwrite `#ORIG` |
| Refund w/o Order | + | PG complete refund stands without local Order row |
| Independent refund clock | + | PG stale order + newer nested refund still applies |
| Kill switch | − | PG `processingEnabled=false` fails closed via helper; Gate C re-checks after lock grant |
| R-164 surface | − | PG + unit no physical-delete operation |
| First-insert ABSENT | − | Unit + PG writes no row |

**Not C:** T02, T19, T20, T30 reader, T39, T52, T53 (B). T21, T22, T24, T32, T33, T37, T43 webhook/import orchestration, T51 (D). T56/T57 **reader pagination** remains B.

## 5.1 F-01…F-12 disposition matrix

| ID | Sev | Owner | Disposition | Evidence |
|---|---|---|---|---|
| F-01 | P1 | C | Closed. Refund existence/diagnostics/candidate writers target `ShopifyOrderRefundFact` with `RETURNING` affected-row checks. Direct Refund uses Refund existence + Clock A; nested Refund uses Refund identity blockers/existence/interval/revival with the enclosing complete interval. Unconditional `liveChildWrite` is not an existence verdict. Nested LIVE against a Refund tombstone records first confirmation and does not restore attributes. | PG Refund tombstone / first-insert ABSENT / unverified / inaccessible / first LIVE after tombstone / nested tombstone |
| F-02 | P1 | C | Closed. Accepted newer LIVE presence interval is persisted for **Order and Refund** roots. LIVE `[1,2] → [9,10] → delayed ABSENT [5,6]` stays LIVE with evidence no older than `[9,10]`. | Unit + PG Order F-02; PG Refund F-02 |
| F-03 | P1 | C | Closed. Independently newer Refund under a stale unblocked Order Clock A still applies. Valid Order + blocked Refund writes the order and not the refund subtree. Order-level blocker writes neither. | PG independent refund clock; F-03 nested Order blocker; F-03 valid Order + blocked Refund |
| F-04 | P1 | C | Closed. Receipt success requires every observation to be terminal-accepted (`applied` / `already_applied` / allowlisted no-op reason). Nonterminal outcomes throw `OrderApplyReceiptNotCertifiableError` so the owning transaction rolls back. Same key/digest: malformed money → no receipt/facts; corrected fresh observation → one receipt and one order row. Mixed, incomplete, blocked, lease-invalid, conflict, digest conflict, empty new, empty already-receipted covered. | Unit `receipt-certification.test.ts`; PG F-04 family |
| F-05 | P1 | C | Closed. Durable in-flight scopes are the comparison set. `lastValidLiveScopeFloor` ignores caller `lastConfirmedAccessScopes`. Missing persisted continuity denies absence. Inaccessible writes keep persisted LIVE `accessScopeSnapshot`. | Unit T50 / missing baseline / forged lastConfirmed; PG F-05 floor; PG F-05 inaccessible keep |
| F-06 | P1 | C | Closed. Complete direct parent snapshot marks omitted parent-versioned children ABSENT (`ABSENT_CONFIRMED_QUERY`, retained, no DELETE) for lines, agreements, sales, refund lines, adjustments, transactions. Nested Order.refund omission stays LIVE. Full-sync remains CANDIDATE. Present `currentQuantity=0` is not omitted. 2-to-1 and 1-to-0 covered. | PG F-06 family |
| F-07 | P2 | C | Closed. Durable observation `accessScopeSnapshot` compared as a set; fabricated `read_all_orders` throws `order_apply_access_scope_mismatch`. | PG F-07 mismatch + matching sets |
| F-08 | P2 | C | Closed. Empty new batch returns `receiptStatus: "none"` and inserts 0 receipts. Empty already-receipted batch may return `already_applied`. | PG F-08; PG F-04 empty already-receipted |
| F-09 | P3 | B owns extraction; C preserves | Pin `610ed050` emits `restocked`, `restockLocationId`, and complete-connection `refundLineOrdinal`. C persists them. The mapper does not invent ordinals from array index when B supplies the field. | PG B-compat: `restocked=true`, `restockLocationGid=gid://shopify/Location/7`, `refundLineOrdinal=2` (not `0`) |
| F-10 | P3 | C documents / mapper blocks | Missing local Order **row** remains supported. Missing authoritative parent Order **GID** (`orderId=null` without an enclosing Order) is blocked: no `String(null)` cast, no FK, no nullable schema change, no success receipt. Embedded walks may use the enclosing Order GID; a contradictory returned parent GID is blocked. | Mapper contract + PG orphan refund 0 rows; enclosing vs contradictory cases |
| F-11 | P3 | C preserves; D residual | First B read copies the current catalog GID onto both at-sale and current fields (source cannot independently verify checkout-time link). Later B reads with a different current/SKU do **not** overwrite stored `variantGidAtSale`. Line `shopifyLegacyResourceId` stays `null`. | PG B-compat at-sale preserve; T11 / T12 |
| F-12 | P3 | C rejects; B may leave strings | Malformed required decimal on a `status: "complete"` B payload is mapped through and rejected by C before success/receipt. Canonical line total is `discountedTotalSetWithCodeDiscounts` (`9.00`); `withoutCodeDiscounts` (`9.50`) is not a second authority and is not a fallback. | PG B-compat money two-txn + with-code persist; unit money reject |

## 5.2 Order / Refund existence parity

| Case | Order | Refund |
|---|---|---|
| Direct first LIVE | insert `ShopifyOrderFact` | insert `ShopifyOrderRefundFact` (no Order row required) |
| Direct null in-window + scope continuity | `ABSENT_CONFIRMED_QUERY` | same on refund row |
| Aged-out null | `INACCESSIBLE_HISTORY_WINDOW`, `deletedAt` NULL | same on refund row |
| Unverified delete | `ABSENT_SIGNALLED_DELETE_UNVERIFIED` + `WEBHOOK` | same on refund row |
| Confirmed absence | tombstone + children retained | tombstone + refund children retained |
| First revival confirmation | diagnostic only; attributes not restored | nested LIVE against tombstone: diagnostic only |
| Second independent non-overlapping LIVE | restores LIVE | same |
| Overlapping LIVE vs ABSENT | `overlap_conflict`, no LWW | same decision function |
| Stale LIVE vs newer presence | interval not rewound | Refund F-02 `[1,2]→[9,10]→ABSENT[5,6]` stays LIVE |
| Active blocker | no canonical write | Refund identity blocker skips refund subtree even under a valid Order |
| Expired blocker | abandon + re-check | same helper path |
| Wrong token / identity | fence fail-closed | same |
| Newer nested Refund + stale Order Clock A | Order children skipped; Refund Clock A may apply | covered |
| Valid Order + blocked Refund | Order written; refund subtree not | covered |
| Nested Refund vs own tombstone | n/a | first confirmation does not restore |
| Parentless complete Refund | n/a | stored with known parent GID, no FK |

## 5.3 Receipt terminal-outcome table

Receipt-bound success requires `batchCertifiesReceiptSuccess`: every observation is `applied`, `already_applied`, or `noop` with an allowlisted reason. Otherwise apply **throws** `order_apply_receipt_not_certifiable` and the caller rolls back.

| Outcome / reason | Certifies receipt? |
|---|---|
| `applied` / `already_applied` | yes |
| `noop` + `already_live` / `already_absent` / `overlap_agree` / `presence_keep_live` / `absent_not_later` / `preserve_established_tombstone` / `already_unverified_delete` / `first_insert_absent_preserve_no_row` / `clock_a_stale` / `terminal_first_confirmation` | yes |
| `noop` + generic `noop` / missing reason / zero-writes alone | no |
| `rejected` / `incomplete` / `blocked` / `conflict` / `lease_invalid` | no |
| empty new batch | `receiptStatus: none`, no insert |
| empty already-receipted same digest | `already_applied` |
| different digest | `order_apply_receipt_digest_conflict`, rollback |

Failed-then-valid same-key proof: malformed `netPaymentSet` with key `f04-delivery` → throw + 0 receipts + 0 order rows; corrected fresh token, **same** key/digest → 1 receipt + 1 `ShopifyOrderFact`.

## 5.4 Scope floor and child omission

- Comparison set is the fenced `OrderFactObservationInFlight.accessScopeSnapshot`.
- Reordered equivalent arrays match. Fabricated elevation mismatches.
- Last-valid-LIVE floor is persisted fact `accessScopeSnapshot`. Caller `lastConfirmedAccessScopes` is ignored as authority.
- Missing persisted continuity is `SCOPE_DOWNGRADE`, not permission for absence.
- Inaccessible/rejected writes do not replace that floor.
- Direct complete parent: omitted previously-LIVE children become `ABSENT` + `ABSENT_CONFIRMED_QUERY` + `CONFIRMED_QUERY` using the parent interval. Rows retained. No physical DELETE.
- Full-sync omission nominates `CANDIDATE` only. Null gens do not invent a confirmation interval.
- Refund itself is independently clocked and is not tombstoned because it is missing from an Order list.
- A line still present with `currentQuantity=0` stays LIVE.

## 6. Local validation (executed)

Recorded after commands execute. This documentation snapshot does **not** invent results and does **not** embed its own commit SHA.

Evidence-harness runtime/test implementation head for the **historical** commands in this §6 table: `14fb29f7ef54cdf3851637892704c69e3fd5dfc2`. Those results are preserved and are **not** relabelled as this correction/integration packet. On that head, C materialized pin `610ed050…` at test time into production `app/lib/order-facts/admin-read/**` and removed it afterwards. **This packet does not do that:** pinned readers use an owned tmp worktree (§6.3 / §6.6). After overlay tests, `git ls-files` still has no `admin-read` paths.

Prior F-01–F-08 / gates / mapper-only probe commands remain recorded against `0474fec…` / `b0b7f58…` and are not relabelled as this evidence-completion packet.

| Command | Exit | Result |
|---|---|---|
| `npx prisma validate` | 0 | schema valid |
| `npx tsc --noEmit` | 0 | no errors |
| `npm run typecheck` | 0 | `react-router typegen && tsc --noEmit` |
| focused eslint of new `pr6-c-b-*` / `pr6-c-process-loss*` / `pr6-c-scale-envelope.test.ts` / `pr6-c-pg-harness.ts` | 0 | no errors |
| `npm run lint` | 0 | no errors |
| `npx vitest run app/lib/order-facts` | 0 | **64** passed / 9 files (nonzero) |
| `npm test` | 0 | **437** passed / 48 files (nonzero) |
| `npm run test:migrations -- scripts/tenant-enforcement/tests/pr6-c-b-reader-overlay.test.ts scripts/tenant-enforcement/tests/pr6-c-process-loss.test.ts scripts/tenant-enforcement/tests/pr6-c-scale-envelope.test.ts` | 0 | **20** passed / **1** skipped / 3 files on `14fb29f…` (nonzero; collected 21). Skip is the 1e6 envelope. Overlay **12**, process-loss **7**, scale policy **1**. Do not relabel as the later 18-test overlay file. |
| `npm run test:migrations -- scripts/tenant-enforcement/tests/pr6-c-b-reader-overlay.test.ts` (additional actual-reader cases) | 0 | **18** passed / 1 file (nonzero; collected 18). Overlay removed afterwards. |
| `npm run test:migrations -- scripts/tenant-enforcement/tests/pr6-c-canonical-applicator.test.ts scripts/tenant-enforcement/tests/pr6-c-evidence-gates.test.ts scripts/tenant-enforcement/tests/pr6-c-b-compat-probe.test.ts` | 0 | **108** passed / 3 files (nonzero; collected 108 = 82 + 9 + 17) |
| `PR6_C_SCALE_1E6=1 npm run test:migrations -- scripts/tenant-enforcement/tests/pr6-c-scale-envelope.test.ts` | 0 | **2** passed / 1 file (nonzero; collected 2). **Actual** 1,000,000 line facts. Duration 912.06s. See §6.2. |
| `npm run test:migrations` (full corpus, CI-like disposable env, `PR6_C_SCALE_1E6` unset) | 0 | **595** passed / **1** skipped / 66 files on `14fb29f…` (nonzero; collected 596). The skip is the 1e6 envelope. Duration 666.70s. Overlay **12** and process-loss **7** passed inside that corpus; do not relabel as the later 18-test overlay file. |
| `npm run build` | 0 | client + SSR production build |
| `npm run tenant:access:inventory` | 0 | `tenant_access_inventory_written` findings 1741 violations 0 |
| `npm run tenant:access:inventory:check` | 0 | `tenant_access_inventory_fresh` (`scannedFiles` 403) |
| `git diff --check` | 0 | clean |
| `.github/scripts/classify-ci-change-set.sh --from-git bdbb5bba… 14fb29f…` | 0 | `docs_only=false` `full_ci=true` `classification_reason=non_docs_or_unknown_path` `changed_path_count=34` |
| exact-head `pull_request` on `e5af049459992f3c6a5c32b799dca00d1279020e` | Gate 1 | run [34714619941](https://github.com/Vedang1998/Stocky/actions/runs/34714619941) `event=pull_request`. Classify job `103609574612` **SUCCESS**. Heavy job `103609595251` **CANCELLED** (`startedAt=2026-09-12T22:19:23Z`, `completedAt=2026-09-12T23:29:45Z`, ~70m22s, `timeout-minutes: 70`). CI Gate job `103638944625` **FAIL**: `classify_result=success` `validate_result=cancelled` `full_ci=true` `docs_only=false` — `CI Gate FAIL: full CI required but validate result is cancelled`. Do **not** label this run Heavy SUCCESS or exact-head green. |

Previous exact-head SUCCESS values on `04a3e276…` / `9f3840a…` / `65bf143…` / `b0b7f58…` / `26dd788…` / `14fb29f…` are superseded and are **not** substituted as exact-head evidence for this packet. Run `34714619941` is the exact-head result for `e5af049…` and is **cancelled/failed**, not success. This documentation commit will have its own exact-head run after push; do not later-push solely to embed that future run ID.

Mechanical inventory exception on that historical head: `PR2_TENANT_ACCESS_INVENTORY.md` (`scannedFiles` 396 → 403). This packet regenerated it from the combined C+T tree (`scannedFiles` 404; findings 1741; violations 0). Digest unchanged. No unused allowlist entries. No A/schema/grant edits. Independent review artifacts not edited. No committed `admin-read/**` files.

## 6.1 Evidence gates A–E

All C-owned PostgreSQL harnesses are in `scripts/tenant-enforcement/tests/pr6-c-evidence-gates.test.ts`. Command: `npm run test:migrations -- scripts/tenant-enforcement/tests/pr6-c-evidence-gates.test.ts`. Environment: disposable PG16, runtime role, `vitest.migrations.config.ts`, serialized file execution.

| Gate | Achieved schedule | Result | Remaining limitation |
|---|---|---|---|
| A interrupt before commit | apply then `ROLLBACK` | 0 facts, 0 receipts | none for this schedule |
| A after commit / before ack | commit then retry empty batch | facts+receipt present; retry `already_applied`; still 1 receipt | none for this schedule |
| A adversarial receipt DELETE | labelled separately; retry upserts same GID | still 1 order row, new receipt | not a D dead-letter worker (D not authorized) |
| B reverse identity order | two sessions, reverse GID input, real apply path | both commit, no hang, no fabricated `40P01` | correct ordering need not produce deadlock |
| C real lock timeout | holder `pg_advisory_xact_lock`; waiter apply | `order_advisory_lock_timeout` ~5s; rollback; fresh txn retry applies | uses frozen A identity lock + existing helper |
| C kill switch while waiting | flip `processingEnabled` while waiter blocked | `OrderApplyProcessingDisabledError` after lock grant; 0 facts; restored after test | none for this schedule |
| D same key/digest disjoint GIDs | **`serialized_before_missing_receipt_lookup`** | winner commits; loser `already_applied`; loser GID 0 rows | both sessions cannot pass missing-receipt lookup; do **not** claim that unachieved schedule |
| D different digest | sequential then conflicting digest | `order_apply_receipt_digest_conflict`; no disjoint facts | none for this schedule |
| E C-specific scale | 400-child parent + 2-to-1 replacement; 40 parents × 25 lines; setup vs apply times and RSS/query counts recorded in-test | 9/9 gate file passed; ~2s apply batch; `executedLines` 1400 | **not** the 1e6-line envelope. See §6.2 for the actual 1,000,000-line run. Do not label this smoke as that envelope. |

## 6.2 Actual 1,000,000-line C-specific envelope (executed locally)

This is **not** extrapolation from Gate E’s 1,400 lines.

| Field | Observed |
|---|---|
| Command | `PR6_C_SCALE_1E6=1 npm run test:migrations -- scripts/tenant-enforcement/tests/pr6-c-scale-envelope.test.ts` |
| Exit | 0 |
| Collected / passed | **Historical 1e6 execution (pre-delta harness on `14fb29f…`):** 2 / 2 (one policy test + envelope; nonzero). **Do not relabel as a new run.** **Current default discovery of this file:** 7 collected, 6 passed, 1 skipped (policy tests + skipped envelope). |
| Duration | 912.06s (envelope it 906839ms) |
| `lineFacts` | **1000000** |
| Mix | 2 parents × 500 lines, then 500→1 replacement; 19960 parents × 50 lines in batches of 20; 20 refund-bearing parents × 50 lines in batches of 10 |
| `batches` | 1000 |
| `setupMs` | 829 |
| `applyMs` | 904601 |
| `replacementMs` | 113 |
| `queryCount` | 3484058 |
| RSS | 144216064 → 151367680 bytes |
| Throughput | 1105.46 line facts / s against applyMs |
| PostgreSQL | `max_connections=100`, `max_locks_per_transaction=64`, `max_prepared_transactions=0`, isolation `read committed` |
| Host (this execution) | 4 CPUs; MemTotal 16398384 kB; `PostgreSQL 16.15 (Ubuntu 16.15-0ubuntu0.24.04.1)` |
| Assertions | `ShopifyOrderLineFact` count **exactly** 1,000,000; high-child parent `LIVE=1` / `ABSENT=499`; not equal to 1400 |

PHASE_BRIEF list p95 < 500ms and webhook enqueue p95 < 1s are **not** this apply SLA. The envelope is skipped unless `PR6_C_SCALE_1E6=1` **and** `GITHUB_ACTIONS` is not `true`. Default CI never executes it. Schema reset for the envelope lives **inside** the `it.skipIf` body so a skip cannot run `resetSchemaAndApplyEnforcement` (F-CR-02: proven by source parse plus a dead-port run, 6 passed / 1 skipped in 4ms). The 912.06s / `lineFacts=1000000` / `applyMs=904601` row set belongs to the **pre-delta harness** (before `5e8fbd2` moved reset into `it.skipIf` and `4a5fc80` converted nested helpers to arrows). That workload was **not** re-executed to change a label (F-CR-03). Merged tooling **T** sets Heavy validate `timeout-minutes: 120`; C reads that value from `.github/workflows/ci.yml` and does not keep a self-confirming `HEAVY_TIMEOUT_MINUTES = 70` constant. Historical exact-head Heavy on `e5af049…` (run `34714619941`) was **CANCELLED** at the then-70-minute cap after ~53 minutes of **pre-migration execution** (distinct from ~162 minutes **queued** before `startedAt`). Skipped 1e6 (2ms) and process-loss (~8.2s) in that cancelled log did **not** explain the cancellation (F-CR-01). Default `npm run test:migrations` records **1 skipped** (the envelope) and must not be labelled as a 1e6 pass.

## 6.3 Actual pinned B reader overlay (executed, overlay removed)

Copied B types and fabricated read results in `pr6-c-b-compat-probe.test.ts` remain the mapper contract suite (**17** passed). They are **not** this gate.

`pr6-c-b-reader-overlay.test.ts` uses `prepareBAdminReadForCTests()`. On this C-only tree that materializes pin `610ed0503a3aa2998aca7228f4fca9617bed23a3` into an **owned disposable git worktree** under `os.tmpdir()` (marker `.pr6-c-owned-scratch`, prefix `pr6-c-owned-b-pin-`). Dynamic imports load B’s `readOrderFact` / `readRefundFact` / `createOrderStoreAdmin` / `createMockAdmin` / fixtures from that worktree, map through the test-local mapper, and apply on disposable PostgreSQL. Cleanup uses `git worktree remove --force` and refuses repository, production, symlink, and unowned paths. When tracked B `admin-read` is already present, the same helper executes those tracked files in place and **does not** overlay or delete them. Copied-type mapper fixtures in `pr6-c-b-compat-probe.test.ts` are **not** this gate. The overlay is never committed.

Command (focused, after additional actual-reader cases): `npm run test:migrations -- …/pr6-c-b-reader-overlay.test.ts` → **18** passed / 1 file. Earlier focused run on `14fb29f…` was **12** passed before those cases were added. Overlay directory absent after both runs.

Pinned B production/test-transport blobs at `610ed050` (`git rev-parse 610ed050:<path>`), asserted in-test:

| Path | Blob |
|---|---|
| `stocky-plus/app/lib/order-facts/admin-read/orders.ts` | `b5ce0d53cf29c8b370065330f1a3e84c55c7096d` |
| `stocky-plus/app/lib/order-facts/admin-read/refunds.ts` | `5324d33205f490a1a4c76d6b1011e0bef2e429f7` |
| `stocky-plus/app/lib/order-facts/admin-read/index.ts` | `85fc132817166b48771376ec3ae1b1b23758cc2c` |
| `stocky-plus/app/lib/order-facts/admin-read/__tests__/fixtures.ts` | `5981aef29f2d423a5907b8970d5684bf6878738b` |
| `stocky-plus/app/lib/order-facts/admin-read/__tests__/order-store-admin.ts` | `34a778f251ecaa3f6acc29498afd549791bef28a` |
| `stocky-plus/app/lib/order-facts/admin-read/__tests__/mock-admin.ts` | `34671adf9fdab380ac1bfb9d115cd90c8e82d6d5` |

| Case | Result |
|---|---|
| Real B `OrderFactById` transport | `admin.calls` nonempty and query text includes `OrderFactById`; `processedAt` `2026-08-01T00:00:00Z`; with-code total `9.00` persisted, not `9.50`; pin blobs match the table above |
| Stable multi-page Order | `pageSize=1`, two lines, `complete`, more than one `OrderFactById` call, 2 LIVE line facts |
| Independently clocked Refund | real `RefundFactById`; refund `updatedAt` `2026-08-20T00:00:00Z`; C stores the refund without a local Order row |
| Genuine empty vs missing/malformed refunds | `refunds=[]` completes and persists; `omitRefunds` / object-shaped refunds are B `MALFORMED_ENVELOPE`; 0 facts for those GIDs |
| Version drift on continuation | mutated `updatedAt` on call ≥2; B not `complete`; mapper not `mapped`; 0 order facts |
| Restock / ordinal | B complete-connection ordinals `[0,1,2]`; C persists `restocked=true`, `restockLocationGid=gid://shopify/Location/7`. Refund `order.id` matches the header GID so B does not `IDENTITY_MISMATCH`. |
| Null refund-line IDs across pages | three lines (two `id=null`) at `pageSize=1`; B ordinals `[0,1,2]` with no per-page reset; C persists the same |
| Neutral `null_observed` | B does not assign `INACCESSIBLE_HISTORY_WINDOW`; mapper emits `ABSENT_CONFIRMED_QUERY` + `queryCompleted` / `queryReturnedNull` |
| In-window then null | C tombstone `ABSENT` / `ABSENT_CONFIRMED_QUERY` / `deletedAt` set |
| Aged-out then null | C `LIVE` + `INACCESSIBLE_HISTORY_WINDOW` + `deletedAt` NULL + `ORDER_HISTORY_WINDOW_TRUNCATED` |
| Incomplete walk | B `SNAPSHOT_PAGINATION_INCOMPLETE`; C writes 0 order facts |
| `orderId=null` refund | B `RefundFactById` complete with `orderId` null; mapper `blocked` / `unknown_parent_order_gid`; 0 refund rows |
| Enclosing vs contradictory parent | nested refund uses Order GID; contradictory B `IDENTITY_MISMATCH`; 0 clash rows |
| Malformed money (F-12) | B at this pin may `complete` with `"not-a-decimal"`; C rejects; 0 facts / 0 receipts |
| At-sale GID preserve | later current variant `ProductVariant/99` does not overwrite stored `variantGidAtSale` |
| Same key/digest retry | malformed then valid B read; one receipt |
| Mixed-exchange 6/3/3/0 vs stale ordered-5 | real B walk; clean `unitDiagnosticState` null; stale `LINE_UNIT_IDENTITY_INCONSISTENT` |
| Cleanup | overlay directory absent |

## 6.4 Real session/process-loss and uncertain outcome (executed)

Distinct from Gate A SQL `ROLLBACK` / `COMMIT` controls and from adversarial receipt DELETE. No D worker. File: `pr6-c-process-loss.test.ts` plus child `pr6-c-process-loss-child.ts`. Child parks after `applied` and after `committed` are **both** 30s (not 120s). `sleep(75)` is the uncertain-commit yield, not a missed-kill park. `waitExit` is 2s then `pg_terminate_backend` (`reapAbandonedBackend`). F-CR-04 source tests live in a separate describe and do not require PostgreSQL.

| Case | Mechanism | Result |
|---|---|---|
| Control label | string inequality | `ROLLBACK` is not `pg_terminate_backend` / `SIGKILL` |
| Session loss before COMMIT | `pg_terminate_backend` of the applying backend after DML, no ROLLBACK | 0 order facts, 0 receipts |
| Abrupt client disconnect | `client.end()` after apply, no COMMIT/ROLLBACK | 0 facts, 0 receipts |
| Process SIGKILL before COMMIT | tsx process-group SIGKILL, then `pg_terminate_backend` of the abandoned backend (Node death does **not** drop the session/receipt advisory lock by itself), then retry | 0 facts after kill; retry `applied`; then 1 fact + 1 receipt |
| Process SIGKILL after COMMIT | SIGKILL after child `committed` | 1 fact + 1 receipt; retry `already_applied`; still 1 |
| Uncertain COMMIT | `pg_terminate_backend` during child COMMIT race, then retry | retry `applied` or `already_applied`; **exactly** 1 fact + 1 receipt |
| Uncertain socket destroy | destroy the pg stream during `COMMIT`, then retry | retry `applied` or `already_applied`; **exactly** 1 fact + 1 receipt |
| Child park bound | source assertion | **both** long parks are 30s; changing either one to 60s fails the guard; `sleep(75)` remains the commit-race yield (F-CR-04) |

## 6.5 CI matrix (do not collapse these rows)

F-CR-05: historical failed CI, historical successful CI, current-head CI, implemented corrections, and independent re-review pending are distinct. Never mark pending CI green. The later successful C run on `4a5fc80…` does **not** repair F-F03 and does **not** prove the skipped 1e6 / process-loss changes caused or fixed the 70-minute cancellation.

| Class | Run | Head | Result |
|---|---|---|---|
| Historical failed C `pull_request` | [34714619941](https://github.com/Vedang1998/Stocky/actions/runs/34714619941) | `e5af049459992f3c6a5c32b799dca00d1279020e` | Classify `103609574612` SUCCESS. Heavy `103609595251` **CANCELLED** at `timeout-minutes: 70` (~70m22s executing after ~162 min queued). Gate `103638944625` FAIL (`validate_result=cancelled`). F-F03 also failed inside Heavy before cancel. |
| Historical successful C `pull_request` | [34726234237](https://github.com/Vedang1998/Stocky/actions/runs/34726234237) | `4a5fc80417f90c80f6e310428a6ce0d0036f9d93` | Classify + Heavy + Gate SUCCESS. Does **not** dispose F-F03 (intermittent; tenant-indexes blob identical to M). Does **not** re-attribute the cancelled run. |
| Exact-T post-merge `push` | [34799274517](https://github.com/Vedang1998/Stocky/actions/runs/34799274517) | `f5ec7abb01d14d5803e186b3e883fa15defad38f` | Classify `103838454264` SUCCESS. Heavy `103838476115` SUCCESS. Gate `103848213649` SUCCESS. Aggregate **SUCCESS**. |
| Historical C `pull_request` on F-CR/T packet | [34801383240](https://github.com/Vedang1998/Stocky/actions/runs/34801383240) | `e8c0e54a02d4686699fcb7d75c60ac57654d2067` | Classify `103844656536` SUCCESS. Heavy `103844674320` SUCCESS. Gate `103853429475` SUCCESS (`classify_result=success` `validate_result=success` `full_ci=true` `docs_only=false`). Evidence for `e8c0e54…` only. **Not** this C-INTEGRATION-01 head. |
| Historical failed C-INTEGRATION-01 overlay-archive `pull_request` | [34879406832](https://github.com/Vedang1998/Stocky/actions/runs/34879406832) | `124d4f557b54218657e73e057235a89612ab3160` | Classify `104094645199` SUCCESS. Heavy `104094697451` **FAILURE**. Gate `104115647881` **FAILURE**. `git archive 7338aaa…` on shallow C. **Not** green. **Not** this head. |
| Historical failed pre-U C `pull_request` | [34886822386](https://github.com/Vedang1998/Stocky/actions/runs/34886822386) | `042e83563c8a8d367ae11df3fda6c0e10c6badd0` | Terminal **FAILURE**. **Not cancelled.** Classify `104119402578` SUCCESS. Heavy `104119441376` **FAILURE**. Gate `104138617440` **FAILURE** (`classify_result=success` `validate_result=failure` `full_ci=true` `docs_only=false`). Migrations **1 failed / 631 passed / 1 skipped (633)**. C overlay safety **15/15** and reader **18/18** passed. Failed test: T-owned F-F03 `indexes.migration.test.ts:1210` `expect(buildSettled).toBe(false)` got `true`. **Not** combined-tree evidence. **Not** this head. |
| Exact-U post-merge `push` | [34891789836](https://github.com/Vedang1998/Stocky/actions/runs/34891789836) | `1ec7af31f1a6ffd1c0c1d9b4bcd28043c5516505` | **Pending — not green.** Classify `104136027179` SUCCESS at the time this sentence was written; Heavy was still in progress. Do not treat as SUCCESS here. |
| Current-head exact-integrated-C `pull_request` | new run after the U-merge documentation commit that contains this sentence | live PR head | **Pending — not green.** Earlier C-only CI is not combined-tree evidence. |

### 6.5.1 Historical failed run `34714619941` (`e5af049…`) — preserved measurement

| Check | Job | Result |
|---|---|---|
| Classify change set | `103609574612` | SUCCESS |
| Lint, typecheck, test, build, Prisma, GraphQL | `103609595251` | **CANCELLED** at job `timeout-minutes: 70` (queued ~162 min on `ubuntu-latest`, then `startedAt=2026-09-12T22:19:23Z` / `completedAt=2026-09-12T23:29:45Z`) |
| CI Gate | `103638944625` | **FAIL** — `validate_result=cancelled` |

C-owned files that had already finished in that step: canonical 82, overlay 18, probe 17, evidence 9, process-loss 7, scale 2 tests / 1 skipped.

F-F03 (`DML overlaps active build-scan and validation-scan phases`) failed in that job. It remained real. C did not edit `scripts/tenant-indexes/`. The accepted tooling mitigation is **PR #42 / T** (`timeout-minutes: 120` plus F-F03 harness repair in `indexes.migration.test.ts`), **not** parked PR #41.

**F-CR-01.** Skipped envelope (2 ms) and process-loss (~8.2 s) in that cancelled log did **not** explain the 70-minute cancellation. Commit `5e8fbd2` and the prior report framing of “Heavy-budget leaks” are **defensive hardening**, not a demonstrated fix for that cancel. The outcome-changing swing was **pre-migration execution-time variance** (~53m vs ~40m on `b0b7f58…`), which is separate from **runner-queue delay** (~162 min queued before `startedAt`). Queued time is not executing time.

## 6.6 This correction/integration packet — local evidence

`app/lib/order-facts/apply/**` is unchanged versus starting C head `4a5fc80…`. Merged tooling files remain byte-identical to T. No B runtime or D adapter is committed. `git ls-files` has no `stocky-plus/app/lib/order-facts/admin-read` paths after overlay tests.

| Command | Exit | Result |
|---|---|---|
| `DATABASE_URL`/`TENANT_MAINTENANCE_DATABASE_URL`/`DATABASE_MIGRATION_URL` pointed at `127.0.0.1:59999`; `npm run test:migrations -- …/pr6-c-scale-envelope.test.ts` | 0 | **6** passed / **1** skipped / 1 file (collected 7). 4ms. Proves skipped envelope does not attempt database setup (F-CR-02). |
| `npm run test:migrations -- …/pr6-c-scale-envelope.test.ts` (live PG env, envelope still skipped) | 0 | **6** passed / **1** skipped (7). |
| `npm run test:migrations -- …/pr6-c-process-loss.test.ts` | 0 | **11** passed (4 source park-bound tests including both-park negatives + 7 PG cases). |
| `npm run test:migrations -- …/pr6-c-b-pin-overlay.safety.test.ts` | 0 | **9** passed. C-only scratch; tracked-B in-place blobs/`git ls-files -s` preserved; unowned path kept; symlink not followed; cleanup refuses foreign and repository paths; repeated invoke. |
| `npm run test:migrations -- …/pr6-c-b-reader-overlay.test.ts` | 0 | **18** passed. Real B reader → mapper → C apply on disposable PostgreSQL from owned worktree of pin `610ed050…`. Tracked admin-read blobs before/after equal `{}`. Production `admin-read` absent. |
| `npm run test:migrations -- …/pr6-c-canonical-applicator.test.ts …/pr6-c-evidence-gates.test.ts …/pr6-c-b-compat-probe.test.ts` | 0 | **108** passed (82 + 9 + 17). Mapper-only probe is **not** the overlay gate. |
| focused eslint of touched `pr6-c-*` overlay/scale/process-loss files | 0 | no errors |
| `npx vitest run app/lib/order-facts` | 0 | **64** passed / 9 files |
| `npm run typecheck` | 0 | `react-router typegen && tsc --noEmit` |
| `npm run build` | 0 | client + SSR production build |
| `npx prisma validate` | 0 | schema valid |
| `npm run tenant:access:inventory:check` | 0 | `tenant_access_inventory_fresh` (`scannedFiles` 404) |
| `npm run tenant:access:audit` | 0 | `tenant_access_audit_ok` findings 1741 violations 0 |
| `git diff --check` | 0 | clean |

Million-line envelope remains opt-in (`PR6_C_SCALE_1E6=1`, never on GitHub Actions) and was **not** re-run.

### 6.6.1 F-CR dispositions

| ID | Sev | Disposition |
|---|---|---|
| F-CR-01 | P2 | **Corrected in this report.** Attribution rewritten. Historical measurements preserved. |
| F-CR-02 | P3 | **Corrected in tests.** Live workflow timeout parse; skipIf-only reset; dead-port skip; negatives for beforeAll / describe.skipIf. |
| F-CR-03 | P3 | **Corrected in this report.** 2/2 and 912.06s attributed to pre-delta harness; current discovery 7/6/1 recorded separately. |
| F-CR-04 | P3 | **Corrected in tests.** Both 30s parks asserted; either-one 60s mutation fails; interruption schedules preserved. |
| F-CR-05 | P3 | **Corrected in this report and PR body.** CI classes distinguished; current-head not marked green. |
| C-INTEGRATION-01 | P2 | **Corrected in tests, then fetch-closed for CI.** Isolated C-only fixture; isolated tracked-B fixture; genuine partial-setup failure; both-mode safety then **15 / 15**; both-mode actual-reader **18 / 18**. Tracked-B archive now `ensureGitCommit(7338aaa…)` before `git archive`. Pin `610ed050…` is not a substitute. |

Independent re-review of this packet remains **pending**.

## 6.7 C-INTEGRATION-01 — combined-tree isolation (this packet)

**Finding.** Several safety tests used the live `REPO_ROOT` and asserted zero tracked B `admin-read` paths, empty blob/stage maps, and an absent production directory. Those assertions fail once accepted B is tracked. The isolated tracked-reader preservation test did not correct those checkout-dependent tests. The test named cleanup-after-setup-failure did not induce a failure inside setup.

**Reproduction (executed, before correction).** Disposable worktree of `e8c0e54…` plus `git checkout 7338aaa… -- stocky-plus/app/lib/order-facts/admin-read` (**44** tracked paths). Command: `npm run test:migrations -- …/pr6-c-b-pin-overlay.safety.test.ts`. Exit 1. **5 failed / 4 passed (9)**. Failures: C-only pinned-reader (`expected 44 to be +0`); repeated materialize (`tracked admin-read paths exist but directory is missing`); cleanup-after-setup-failure (same missing-directory error); live C-only prepare (`HEAD:` blob missing for staged paths); `C tree currently has no tracked admin-read` (`expected [44 paths] to equal []`). Log: `/opt/cursor/artifacts/pr6-c-c-integration-01-repro.log`.

**Correction.** C-only scenarios use a disposable git fixture with no tracked B. Tracked-B scenarios use a separate committed fixture archived from `7338aaa…` with a non-empty inventory. The live-checkout test is mode-agnostic and never asserts emptiness. `afterScratchCreated` induces a real failure after the owned worktree exists; cleanup removes only that scratch, leaves no orphan worktree, and preserves production, tracked, and pre-existing unowned files. Working-tree evidence is index stage, index blobs, on-disk `git hash-object` hashes, `status --porcelain`, `diff`, and `diff --cached` — not HEAD blob IDs alone. An empty map is valid only as the isolated C-only absence assertion.

PR #39 remained unmerged. No squash **U**. Combined execution used `/tmp/pr6-c-combined-repro` only. B runtime was not committed on C.

| Mode | Source SHA | Suite | Collected / executed | Mode selected | Result |
|---|---|---|---|---|---|
| C-only subject | `e8c0e54…` working tree + this correction | safety | **11 / 11** | pinned-scratch on isolated fixture; live checkout empty | exit 0 |
| Combined disposable | local `9ce389b` (C + committed 44 B admin-read files from `7338aaa…`; not on C) | safety | **11 / 11** | live checkout **integrated**; C-only tests still used isolated empty fixture | exit 0 |
| C-only subject | same | actual-reader PG | **18 / 18** | **pinned-scratch** (`Preparing worktree (detached HEAD 610ed05)`) | exit 0 |
| Combined disposable | same local combined HEAD | actual-reader PG | **18 / 18** | **integrated** (no pin worktree line; production dir used) | exit 0 |

Combined on-disk preservation after integrated reader: **44** tracked paths; disk hashes equal index blobs; `status`/`diff`/`cachedDiff` empty. `orders.ts` blob `b5ce0d53…` matches `7338aaa` and the pin. Applicator workload unchanged; 1e6 envelope was **not** re-run.

C regressions after the correction (C-only tree): process-loss **11**, scale **6 passed / 1 skipped**, canonical **82**, gates **9**, probe **17**, `app/lib/order-facts` **64 / 9 files**, eslint 0, typecheck 0, inventory fresh (`scannedFiles` 404), audit ok. `apply/**` unchanged versus `e8c0e54…` and versus `4a5fc80…`. Review blobs `a90ae442…` / `8c384b69…` and T files unchanged.

### 6.7.1 Exact-head CI hole — missing `7338aaa` in the shallow C checkout

**Finding.** Isolation tests archived accepted B `7338aaa…` from the live C object store with no fetch. Local agent object stores already had PR #39. GitHub Actions shallow clones of C did not. Pin fetch of `610ed050…` already worked in that job (reader overlay 18/18) and is **not** a substitute: the admin-read trees currently match (`8ae3d688…`) but the commit objects are distinct.

**Reproduction (executed).** Exact-head run [34879406832](https://github.com/Vedang1998/Stocky/actions/runs/34879406832) on `124d4f5…`: `fatal: not a tree object: 7338aaa45294c28526330aa259779308bd6d851e` in `isolatedTrackedBEnv`. Local analog: `git init` + `fetch --depth=1 origin HEAD` from C, then `git archive 7338aaa…` → exit 128, same fatal. Fetching only the pin still fails archive of `7338aaa…`. After `git fetch --no-tags --depth=1 origin 7338aaa…`, `cat-file` is `commit` and archive lists **51** tar entries. Log: `/opt/cursor/artifacts/pr6-c-tracked-b-missing-object-repro.log`.

**Correction.** `ensurePinnedBCommit` is now `ensureGitCommit(sha, cwd)` with the same origin fetch attempts. `archiveAcceptedBAdminRead()` calls it for `7338aaa…` before `git archive` and rejects an empty payload. Tests: absent-object archive fails closed; pin fetch is not a substitute; ensure then archive is non-empty and resolves exactly `7338aaa…`; unknown SHA throws without materializing accepted B.

| Mode | Source | Suite | Collected / executed | Result |
|---|---|---|---|---|
| C-only `/workspace` at `3358ee9…` | live C (no tracked admin-read) | safety | **15 / 15** | exit 0. Live checkout pinned-scratch. New shallow-clone cases included. |
| Combined `/tmp/pr6-c-combined-fetch` | worktree of `3358ee9…` + `git checkout 7338aaa… -- …/admin-read` (**44** paths; not on C) | safety | **15 / 15** | exit 0. Live checkout **integrated**. |
| C-only same | pin `610ed050…` | actual-reader PG | **18 / 18** | **pinned-scratch** (`Preparing worktree (detached HEAD 610ed05)`) |
| Combined same | tracked 44 paths | actual-reader PG | **18 / 18** | **integrated** (no pin worktree line) |
| focused eslint of the two overlay files | `3358ee9…` | eslint | 0 errors | exit 0 |

`apply/**` still unchanged versus `e8c0e54…` / `4a5fc80…`. T files remain `ci.yml` `8d1fa98a…` and `indexes.migration.test.ts` `8bfc6d8b…`. Review blobs unchanged. The sentences in this subsection about PR #39 remaining unmerged describe the pre-U isolation packet only. See §6.8.

## 6.8 Authorized U merge into C (this packet)

**Authority.** ChatGPT PR #39 comment [5670216046](https://github.com/Vedang1998/Stocky/pull/39#issuecomment-5670216046). PR #39 CLOSED/MERGED. Continue the existing C integration assignment; do not restart completed corrections.

**U verification (executed).** `origin/main` `1ec7af31f1a6ffd1c0c1d9b4bcd28043c5516505`. Sole parent `f5ec7abb01d14d5803e186b3e883fa15defad38f` (**T**). `U^{tree}` `84dbb800d45e7c7037ab87ee4dfc8a77de19ae56` equals `7338aaa^{tree}`. Merge-base(C, U) = **T**. Overlapping path vs C: only `PR2_TENANT_ACCESS_INVENTORY.md` (mechanical `scannedFiles` 404 vs 416). No unexpected executable conflict in `apply/**`, schema, CI, or B `admin-read/**`.

**Pre-U run preserved.** [34886822386](https://github.com/Vedang1998/Stocky/actions/runs/34886822386) on `042e835…` reached terminal **FAILURE** and was **not** cancelled. C overlay passed; T-owned F-F03 failed.

**Merge.** History-preserving `git merge origin/main`. Merge commit `c76a5d3704e3e4285f4e1152b0ada005a5e946a6` parents `042e83563c8a8d367ae11df3fda6c0e10c6badd0` + `1ec7af31f1a6ffd1c0c1d9b4bcd28043c5516505`. Inventory regenerated from the combined tree: `scannedFiles` **448**, findings 1741, violations 0, digest `8e9b1ed9…` unchanged, `tenant_access_inventory_fresh`, `tenant_access_audit_ok`.

**Preservation (executed).**

| Artifact | Pre-merge | Post-merge `c76a5d3…` |
|---|---|---|
| `apply/` tree | `cfdbb98f…` at `042e835…` | `cfdbb98f…` identical |
| `admin-read/` tree | absent on C | `8ae3d688…` identical to **U** / `7338aaa` (**44** paths). `orders.ts` `b5ce0d53…` |
| First C review blob | `a90ae442…` | `a90ae442…` |
| C correction review blob | `8c384b69…` | `8c384b69…` |
| T `ci.yml` | `8d1fa98a…` | `8d1fa98a…` |
| T `indexes.migration.test.ts` | `8bfc6d8b…` | `8bfc6d8b…` |

C vs **U** remaining paths: **36** (C applicator, C tests, C reviews/report, combined inventory). No schema/CI/apply edits in the merge delta.

**Combined-tree tests on `c76a5d3…` (executed).** Live checkout has tracked B; actual-reader used **integrated** mode (no pin worktree line).

| Command | Exit | Result |
|---|---|---|
| `npm run test:migrations -- …/pr6-c-b-pin-overlay.safety.test.ts` | 0 | **15 / 15**. Isolated C-only still pins. Isolated tracked-B fixture non-empty. Live checkout **integrated**. Shallow-checkout absent-object / pin-not-substitute / ensure-then-archive covered. Partial-setup cleanup covered. |
| `npm run test:migrations -- …/pr6-c-b-reader-overlay.test.ts` | 0 | **18 / 18** integrated. After the suite: **44** tracked admin-read paths; working tree clean; `orders.ts` still `b5ce0d53…`. |
| `npm run typecheck` | 0 | `react-router typegen && tsc --noEmit` |
| `npm run tenant:access:inventory:check` | 0 | `tenant_access_inventory_fresh` |
| `npm run tenant:access:audit` | 0 | `tenant_access_audit_ok` scannedFiles 448 findings 1741 violations 0 |
| `git diff --check` | 0 | clean |

Logs: `/opt/cursor/artifacts/pr6-c-u-merge-safety.log`, `/opt/cursor/artifacts/pr6-c-u-merge-reader.log`. 1e6 envelope was **not** re-run. No B redesign. No D runtime.

Exact-U push [34891789836](https://github.com/Vedang1998/Stocky/actions/runs/34891789836) and the new exact-integrated-C `pull_request` are **not** marked green in this file. Independent C approval remains **pending**.

## 7. Risk status after this slice

| Risk | Status after C |
|---|---|
| R-176 | **OPEN / P0**. A representability remains satisfied at **M**. C implements window predicates, inaccessible vs tombstone, unverified delete, tombstone preservation, two-confirmation revival, and in-window-only nomination. C does **not** close webhook/import/reconcile obligations (D). Do not close R-176. |
| R-164 | **OPEN / P3** unchanged. C ordinary apply has no physical-delete operation. Do not change DELETE privilege or RLS. |
| R-167 | **OPEN**. C applies the 60-day window and `read_all_orders` unconditional predicate. Grant remains a Partner/ops question. |
| R-168 | **OPEN**. C implements PO-10 in `units.ts`. Pending independent verification. |
| R-174 | **OPEN**. Independent Order/Refund Clock A implemented. Pending independent verification. |
| R-169 / R-171 / R-172 | Unchanged. C does not invent `"default"` location, does not FK lines to current variant facts, persists both money-bag sides. |

No D-055. Monday 7 September 2026 target remains missed and is not re-dated.

## 8. Explicit non-authorization

- PR6-D runtime remains **NOT AUTHORIZED**.
- Production, merchant production data, deployment, Shopify writes, inventory writes, scope additions, and flag enablement remain **NOT AUTHORIZED**.
- No live store call.
- C does not DML `DataIssue`, `SalesDailyAggregate`, or explode BOM sales.
- C does not edit B control docs or A frozen contracts.
- B→C compatibility probe **executed** against pin `610ed0503a3aa2998aca7228f4fca9617bed23a3` via a test-local mapper in `pr6-c-b-compat-probe.test.ts` (**17** passed). That mapper suite is **not** a substitute for the pinned-B overlay in §6.3.
- Accepted B `admin-read/**` is present on C **only** via the authorized merge of squash **U**. C did not rewrite B files. The C-only pin `610ed050…` remains a test-time scratch for isolated fixtures. No D runtime.
- The 1e6 envelope is **not** part of default CI `test:migrations`. Local execution in §6.2 is the C-owned evidence. Do not treat the Gate E 1,400-line smoke or the corpus skip as that envelope.

### 8.1 B→C probe cases (pin `610ed050`)

| Case | Result |
|---|---|
| Preserve source values and raw timestamps | `processedAtShopify` kept `2026-08-01T00:00:00Z`; shop USD / presentment EUR stored separately |
| `orderId = null` must not be cast to C's required string | mapper `blocked` / `unknown_parent_order_gid`; 0 refund rows |
| Embedded enclosing Order GID vs contradictory parent | enclosing maps; contradictory `blocked` |
| restock / `refundLineOrdinal` / with-code discount | persisted `restocked`, `restockLocationGid`, ordinal `2`; line total `9.00` not `9.50` |
| Neutral `null_observed` vs incomplete/failure | mapper never assigns `INACCESSIBLE_HISTORY_WINDOW`; incomplete uses structured `reason`, not English `detail` |
| Aged-out `null_observed` | C writes `INACCESSIBLE_HISTORY_WINDOW`, `deletedAt` NULL |
| In-window `null_observed` | C tombstones `ABSENT_CONFIRMED_QUERY` |
| Incomplete walk | C `incomplete` / `SNAPSHOT_PAGINATION_INCOMPLETE`; 0 facts |
| Malformed decimal + retry | throw `OrderApplyReceiptNotCertifiableError`; 0 receipts; corrected same key/digest → 1 receipt |
| Mixed-exchange 6/3/3/0 vs stale ordered-5 | `unitDiagnosticState` null vs `LINE_UNIT_IDENTITY_INCONSISTENT` (`reason: "REFUND"` / `RefundAgreement`) |
| Later current/SKU does not relink at-sale | stored `variantGidAtSale` remains original GID |

## 9. Packet for ChatGPT

This is the **PR6-C authorized U integration** packet on existing PR #40. Isolation/fetch corrections are already on `042e835…`. Merge commit `c76a5d3…` parents `042e835…` + **U** `1ec7af31…`. It is **not** a resubmission of `b0b7f58` and **not** an applicator rewrite.

**Run `34886822386` on `042e835…` is terminal FAILURE and was not cancelled.** Overlay passed; T-owned F-F03 failed. That C-only run is **not** combined-tree evidence.

**Exact-U push `34891789836` and the new exact-integrated-C `pull_request` Classify + Heavy + Gate are pending and are not marked green in this file.** Independent Claude re-review of the integrated head remains required. This is **not** `READY FOR CHATGPT PR6-C COMPLETE-MODULE REVIEW`, **not** merge authorization of PR #40, and **not** D-055. R-176 remains **OPEN / P0**. R-164 unchanged.
