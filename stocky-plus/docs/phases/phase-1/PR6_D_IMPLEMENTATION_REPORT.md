# Phase 1 PR6-D — Complete webhook, import, and reconciliation implementation report

**Slice:** PR6-D complete §17.2 integration module  
**Branch:** `phase-1/pr6-d-order-webhook-import`  
**PR:** [#43](https://github.com/Vedang1998/Stocky/pull/43) OPEN / DRAFT / UNMERGED (do not reuse #39 / #40 / #41 / #42)  
**Authority:** D-054 **EFFECTIVE** (no D-055); ChatGPT owner thread [5673830675](https://github.com/Vedang1998/Stocky/pull/40#issuecomment-5673830675); work order `PR6_D_Complete_Integration_Work_Order.md` SHA-256 `3cf9d0d752b732836311cafd5072c45a63fa8ea74119b36d3ed06eaa7a0f2f49`  
**Status:** Repository module implemented on this branch with local execution evidence. Exact-head `pull_request` Classify + full Heavy + CI Gate IDs are recorded in PR #43 metadata after that run terminates; this report does **not** invent them and does **not** embed this documentation commit’s own SHA. Independent Claude review and a later ChatGPT merge decision remain required. Cursor does **not** certify its own independent approval.

**Production:** NOT AUTHORIZED  
**Inventory-write flags:** DEFAULT OFF  
**Shopify network I/O / live subscription registration / store calls:** NONE in this assignment  
**`read_all_orders` / `write_orders`:** NOT AUTHORIZED  
**PR 6 / Phase 1:** IN PROGRESS  
**R-176:** remains **OPEN / P0**

This report records the PR6-D orchestration module. It does **not** claim Phase 1 or PR 6 overall is complete. It does **not** enable flags, deploy, or merge.

---

## 1. Independently verified identities

| Field | Value |
|---|---|
| Current `origin/main` / squash **V** | `a3ff480f1477237f8055f10c43298480a05728a1` |
| **V** sole parent / squash **U** | `1ec7af31f1a6ffd1c0c1d9b4bcd28043c5516505` |
| `V^{tree}` / accepted-C tree | `ba55f5d5d138911aca83fd715e6f2c8a455e9917` |
| PR #40 accepted final head | `88251df1d22639c021aa083bfb953c50dd6bc8a1` |
| Reviewed C implementation subject | `b4a9aeb3453b42ea74e499e0cb7b152d5635911f` |
| B accepted integration subject | `7338aaa45294c28526330aa259779308bd6d851e` |
| Immutable C final review blob | `0daa0e5395c69b1fb86508f133f6ade3f8430f56` — `APPROVE PR6-C CANONICAL APPLICATOR FINAL INTEGRATION` |
| Exact-V **push** CI | run [`34921292975`](https://github.com/Vedang1998/Stocky/actions/runs/34921292975) event `push` head **V** **SUCCESS** |
| Classify | `104229798042` SUCCESS |
| Full Heavy | `104229820630` SUCCESS (not SKIPPED) |
| CI Gate | `104241657531` SUCCESS |
| Exact-U push CI (preserved) | [`34891789836`](https://github.com/Vedang1998/Stocky/actions/runs/34891789836): Classify `104136027179`; Heavy `104136080253`; Gate `104154438171` — all SUCCESS |
| Docs-only admission checkpoint | `f288b10b65001c5e5c2110599095d6ece9f24572` (parent **V**) |
| Admission comment | [5674410124](https://github.com/Vedang1998/Stocky/pull/40#issuecomment-5674410124) body starts `PR6_D_ADMISSION_READY` |
| Runtime implementation | `55a2ba299dc7d354ebaa4bfd464d4e0d1955fedf` |
| PostgreSQL integration suite | `93e7addb90b28613db2d87e1196d8fbe227cf94e` |
| Lock / money / revival / fence repairs | `9063f2dcf40bd23fd8d8018ad6794193f297a491` |
| This documentation/inventory/typecheck-repair commit | child of `9063f2d…`; SHA not embedded here |

PR #41 remains parked tooling and is **not** a D writer. Immutable B/C/planning review blobs were not edited.

---

## 2. Exclusive D ownership (this PR)

**Owned / edited**

- `app/lib/order-facts/sync/**` including production B→C mapper and database-free unit tests
- `app/jobs/workers/order-facts/sync-jobs.ts`
- `app/routes/webhooks.orders.edited.tsx`, `webhooks.orders.delete.tsx`, `webhooks.order_transactions.create.tsx`
- Additive wiring: `webhook-processor.ts`, `sanitize.server.ts`, `job-envelope.server.ts`, `execution-strategy.server.ts`, `intake.server.ts`, `queue.server.ts`, `bulk-finish.ts`, `health.server.ts`, `scripts/sync-control-plane/manifest.ts`
- `shopify.app.toml` — three topic/route declarations only; scopes string and `api_version = "2026-07"` unchanged
- `scripts/tenant-enforcement/tests/pr6-d-*.test.ts`
- `app/sync/__tests__/sync-d046-worker-finalize.test.ts` (D mock defaults to real D; RepeatableRead probe)
- This report, mechanical inventories, and live-control next-action text

**Not owned / not edited**

- Prisma schema and A migrations
- B `admin-read/**` internals
- C `apply/**` internals
- `.github/**`, package/global vitest configs, tenant-access allowlist
- Parked PR #41, F-F03 tooling, `/tmp` hygiene, D-055

C first-confirmation vs receipt: D retries once without a receipt when C throws `OrderApplyReceiptNotCertifiableError` containing `terminal_first_confirmation`. C internals were not patched.

---

## 3. What the module does

Authenticated webhook signals (six topics) durable-dispatch into `processOrderFactsWebhookJob`:

1. Probe `SyncApplicationReceipt` under RepeatableRead **before** Shopify I/O.
2. Allocate observation request generation, then B read (`readOrderFact` / `readRefundFact` / granted scopes via `currentAppInstallation.accessScopes.handle`).
3. Map through production `app/lib/order-facts/sync/mapper.ts` (not `pr6-c-b-compat-mapper.ts`).
4. Apply C `applyOrderFactsWithRetry` inside the caller’s tenant transaction. C inserts the receipt as its final write. Legacy `SalesDailyAggregate` runs in the **same** transaction only when `receiptStatus === "applied"` and the topic is a frozen v1 create/cancelled/refunds topic.
5. Incomplete pagination / retryable Admin transport → no receipt. Malformed money / currency mismatch / identity failures → blocked, non-retryable.

Import: Bulk A inner document must pass **both** B gates (`assertQuerySchemaValid` and `evaluateBulkOperationRules`) before `submitCatalogFactBulkOperation`. Fence generation is persisted before submit and **reused** on PENDING/RUNNING retry. JSONL nominates Order GIDs; bodies are not facts. Checkpoints only after committed accepted work.

Reconcile: durable `order-facts-sync` / `order-facts-reconcile`. Exhaustive in-window sweeps repair (including quarantine recovery that ignores the incremental watermark in the listing query but still counts `behindWatermarkExamined`). Samples emit `order_facts_sample_not_coverage` and never persist a completeness watermark. Health uses `catalogEvidence.reconcileUncertaintyCount` so HEALTHY is not reported over unresolved coverage.

>250-line sanitizer quarantine remains `job: null` with `payloadSchemaVersion: quarantine-projection-bounds-v1`. Intake coalesces `order-facts-reconcile` via `createDurableJob` without importing `queue.server` from intake.

---

## 4. Requirement-to-test matrix

Disposition keys: **D-exec** = executed at the D orchestration boundary in this assignment; **inherited-B/C** = merged lane evidence, not re-claimed as new D streaming/queue proof; **unexecuted** = not run here.

### 4.1 Plan §19

| ID | Class | D disposition | Evidence |
|---|---|---|---|
| T01 | + | D-exec | PG six-topic LIVE apply through B→D mapper→C |
| T02 | − | inherited-B | Mutation AST reject remains B-owned; D does not submit mutations |
| T03 | bypass | inherited-B + D-exec tenant | B client-header deny unit; D PG Shop A vs Shop B isolation |
| T04 | + | D-exec | Replay same application key; one fact row |
| T05–T08 | + | inherited-C apply + D-exec refund path | D PG `refunds/create` via `RefundFactById`; C owns ledger arithmetic |
| T09 / T44 | − | inherited-C | D does not apply incomplete parent snapshots (`incomplete` → no receipt) |
| T10 | + | inherited-C | Newer refetch is C Clock A |
| T11 / T12 | + | D-exec carry-forward | PG money/at-sale test retains `variantGidAtSale` / SKU; no relink |
| T13 | + | inherited-C | No create-required state machine in D |
| T14 | + | D-exec | Shop A facts absent from Shop B |
| T15 | + | D-exec | Sub-cent money strings preserved through mapper |
| T16–T18 | + | D-exec | Zero-price / test / gift-card / custom facts + diagnostics |
| T19 | + | D-exec | 300-line intake quarantine → coalesced sweep → 300 line facts |
| T20 | − | inherited-B | Named LIST `first` gate; D window listing uses `sortKey: UPDATED_AT` schema-valid |
| T21 | + | D-exec | JSONL nominate then B-refetch/C-apply; truncated JSONL fail-closed |
| T22 | − | D-exec | Partial bulk uses `markSyncRunPartialFailure`, not complete+watermark |
| T23 | + | D-exec | Injected commit loss rolls back; no success receipt |
| T24 | + | D-exec | Sample does not certify coverage; sweep heals missed in-window order |
| T25 | + | inherited-C | Overlap LIVE vs ABSENT is C; D preserves confirmed tombstone as `noop` |
| T26 | bypass | D-exec | Canonical D path source scan: no `parseFloat` / `Number(amount)` |
| T27 | + | D-exec | Presentment vs shop money both stored; no FX |
| T28 | − | inherited-C | Mixed-currency sum reject |
| T29 / T54 / T55 / T58 | + | inherited-C | Unit ledger; D does not invent a second writer |
| T30 | − | inherited-B + D-exec | B Number money reject; D maps `MALFORMED_MONEY` to blocked |
| T31 | drift | D-exec | Fence reuse on import retry; digest conflict on mismatched receipt |
| T32 | + | D-exec | New topics identity-only; no email/address/payment_details |
| T33 | − | D-exec | Safety scan + six-topic path uses B refetch, not REST quantity deltas |
| T34 | + | D-exec | Out-of-window null → `INACCESSIBLE_HISTORY_WINDOW`; quarantine listing does not heal it |
| T35 | + | inherited-C + D composition | C advisory locks; D omits lock-capacity default of 1 so refunds lock Order+Refund |
| T36 | + | D-exec | PENDING transaction webhook rejected; terminal `success/failure/error` refetch order |
| T37 | + | D-exec | `orders/edited` identity-only → order refetch |
| T38 | bypass | inherited-C | Raw shopId reassignment denied at apply |
| T39 | + | inherited-B | Extra page in reader; D 300-line uses real pagination |
| T40 | + | D-exec | Canonical D path does not call `processBomSale` |
| T41 | − | D-exec | Out-of-window null is inaccessible, not confirmed tombstone |
| T42 | + | D-exec | In-window completed null with continuity → confirmed-query absence |
| T43 | + | D-exec | LIVE then `orders/delete` → retained ABSENT + `WEBHOOK` + non-null `deletedAt` |
| T45 | + | D-exec | Equal `updatedAt` child repair through D webhook path |
| T46 | + | inherited-C | Null refund-line ordinal identity |
| T47 / T49 | + | inherited-C | Refunded units / unbalanced money diagnostics |
| T48 | − | D-exec | Invalid required money → blocked; no order fact |
| T50 | bypass | D-exec | Scope downgrade denies destructive absence + DataIssue |
| T51 | + | D-exec | Frozen v1 `orders/create` still applies after new-topic code |
| T52 / T53 | − | inherited-B + D-exec | D bulk unit: Bulk C inner document rejected; both B gates required |
| T56 / T57 | +/− | D-exec T57 | Incomplete pagination → `incomplete`, zero facts, zero receipt; T56 apply-side inherited-C |

### 4.2 D-owned orchestration / crash boundaries

| Case | Result | Evidence |
|---|---|---|
| Six topics coherent registration | toml + sanitizer + envelope + strategy + worker + routes in one PR | `safety.test.ts`, `shopify.app.toml` |
| Pre-D receipt not replayed; catch-up import | `already_applied`; digest unchanged; facts via import | PG pre-D receipt test |
| Unknown persisted schema | fail-closed | PG + `schema-dispatch.test.ts` |
| Delivery id as order id | fail-closed | PG identity test |
| Quarantine 300-line + watermark-behind | 300 line facts; `behindWatermarkExamined` counted | PG quarantine test |
| JSONL truncated / duplicate / mis-parented / open-parent bound | fail-closed | `jsonl.test.ts` + PG truncated import |
| Bulk userErrors / poll GID mismatch / fence reuse | fail-closed; mutation count 1 | PG bulk test |
| Processing disabled | import throws `shop_processing_disabled` | PG tenant test |
| Two-confirmation revival | first LIVE `terminal_first_confirmation` stays ABSENT; second LIVE | PG revival test |
| Currency mismatch | B `MONEY_CURRENCY_MISMATCH` → D blocked | PG currency test |
| D046 worker finalize after D wiring | 7/7 pass with CI env | `sync-d046-worker-finalize.test.ts` |
| Uncertain commit finalization | still PR4 `finalizeApplicationAfterRollback` | webhook-processor unchanged protocol |
| Production-scale 1,000,000-line D streaming/queues | **unexecuted** | C 1e6 apply envelope is not D evidence |

---

## 5. Execution ledger

Environment (disposable): PostgreSQL 16 `stocky_plus_ci`; Redis 7 after local install; `NODE_ENV=test`; CI-like role URLs when exercising worker identity; `STOCKY_DISPATCHER_PROCESS_COUNT=1` when exercising D-wired `processWebhookJob`; `SHOPIFY_APP_URL=https://example.com` placeholders only. No merchant data.

| Command | Exit | SHA when run | Notes |
|---|---|---|---|
| Exact-V push CI `34921292975` | SUCCESS | **V** `a3ff480f…` | Admission gate; Classify `104229798042`; Heavy `104229820630`; Gate `104241657531` |
| `npx vitest run app/lib/order-facts/sync/*.test.ts` | 0 | post-typecheck working tree | 7 files, **38** tests |
| `npx vitest run app/lib/order-facts` (default unit config) | 0 | post-runtime | 26 files, **221** tests (includes inherited A/B/C units) |
| `npm run test:migrations -- scripts/tenant-enforcement/tests/pr6-d-integration.test.ts` | 0 | repeated after scanner, typecheck, receipt-SQL helpers | **22** tests; last duration ~8.7s |
| `npm run tenant:access:inventory` then `:check` and `:audit` | 0 | after scanner, receipt-SQL, and live-control updates | findings **1760**, violations **0**, digest `b5f505a193aca8f2a78d628e3e67581659c5ebfe86d1f9fcff55a4081e8b5b76`, scannedFiles **483** |
| `npm run sync:inventory` / `:check` | 0 | after manifest D surfaces | surfaces=**58**, digest `191b83498733a237f4a6fa341e6be0620e718d7c7bd76e467684073500360539` |
| `npm run tenant:enforcement:inventory:check` | 0 | unchanged PR3 inventory | fresh |
| `npm run test:sync-inventory-audit` | 0 | after sync inventory | **5** tests |
| `npm run test:sync-exactly-once` (`sync-exactly-once.test.ts`) | 0 | after roles | **35** tests |
| `npx vitest run --config vitest.sync-integration.config.ts app/sync/__tests__/sync-d046-worker-finalize.test.ts` | 0 | after `DATABASE_RUNTIME_URL` + `STOCKY_DISPATCHER_PROCESS_COUNT=1` | **7** tests |
| `npm run test:sync-envelope-fail-closed` | 0 | after `SHOPIFY_APP_URL` | **6** tests |
| `npm run test:tenant-access -- app/tenant/__tests__/job-envelope.test.ts` | 0 | after D envelope registrations | **25** tests |
| `bash .github/scripts/classify-ci-change-set.test.sh` | 0 | — | 40/40 assertions |
| `npx eslint` on D-owned/wired files | 0 | after import cleanup | — |
| `npm run lint` | 0 | full app | — |
| `npx tsc --noEmit` | 0 | after typecheck repairs | — |
| `git diff --check` | 0 | — | — |
| `npm run graphql-codegen` | **not executed** | — | CI Heavy fetches shopify.dev schema; local Admin 2026-07 artifact already present for the PG schema gate |
| `npm test` (full default unit suite) | **not executed as one blob** | — | subset above executed; full CI Heavy remains authoritative |
| `npm run build` | **not executed locally** | — | CI Heavy |
| Production-scale 1e6 D JSONL/queue envelope | **unexecuted** | — | explicit |

### Failed attempts (not relabelled as passes)

| Attempt | Result | Correction |
|---|---|---|
| First PG refund apply | 2 identities vs lock cap default 1 | Omit D default of 1; C uses `identities.length` |
| Discount/currency expected UNCERTAIN | B returns `failure` codes | Map malformed money / currency mismatch to **blocked** |
| Bulk retry minted a new fence | `APPLICATION_DIGEST_CONFLICT` | Reuse PENDING/RUNNING `fenceGeneration` |
| Revival with receipt | C `conflict:terminal_first_confirmation` not certifiable | D retries once without receipt |
| `await` in non-async harness callback / extra `)` in bulk mock | transform/esbuild fail | syntax repairs |
| `SalesDailyAggregate` unique collision | non-unique legacy variant ids | unique variant per `admin_graphql_api_id` |
| Tenant inventory 9 violations | linebreak `$transaction` + prisma merchant delegates in D tests | same-line `$transaction`; SQL helpers; **no allowlist expansion** |
| D046 without `DATABASE_RUNTIME_URL` | `runtime_identity_rejected` (`stocky` vs `stocky_runtime`) | CI-like runtime URL (environment) |
| D046 without `STOCKY_DISPATCHER_PROCESS_COUNT` | capacity reader throw | CI already sets `1` (environment) |
| Envelope tests without `SHOPIFY_APP_URL` | shopifyApp empty appUrl | CI already sets `https://example.com` (environment) |
| `tsc` on D wiring | LegacyWebhookRunner / receipt `continue` / JSON / fixture nulls | type repairs; C/B internals unchanged |
| Exact-head CI `34931435422` | FAILURE on `93e7add…` (pre-repair) | superseded; not a pass |
| Exact-head CI `34932750380` | started on `9063f2d…` | superseded by this documentation/repair push; not used as final evidence |

---

## 6. Query / memory measurements (D-specific)

300-line quarantine recovery PG test logged:

```text
{"pr6dQuarantineRecovery":{"orderFactByIdQueries":8,"heapDeltaBytes":345216}}
```

Repeated executions: `orderFactByIdQueries` **8** (stable). Positive heap deltas observed **345216** and **356032** bytes (~0.33 MiB). A later same-process run reported a **negative** heap delta after GC (`-74622032`); heap delta is not a stable production-scale bound. Assertion used: queries in `[6, 40)` and heap delta `< 200 MiB` when positive.

This is **not** 1,000,000-line D streaming/queue evidence. C’s 1e6 apply-only envelope remains accepted for unchanged C only.

---

## 7. Source verification vs store execution

Accessed 2026-09-15 from Shopify Admin GraphQL 2026-07 `WebhookSubscriptionTopic`:

- `ORDERS_EDITED` → topic `orders/edited` (requires `read_orders` or marketplace/buyer-membership variants)
- `ORDERS_DELETE` → topic `orders/delete` (requires `read_orders`)
- `ORDER_TRANSACTIONS_CREATE` → topic `order_transactions/create`; **only** success / failure / error (not PENDING)

`shopify.app.toml` uses those REST-style topic strings with `api_version = "2026-07"`. Identity-only projections: edited uses `order_edit.order_id`; delete uses numeric `id` (official REST sample is `{ "id": <number> }`); transactions require `order_id` + terminal `status`.

**Actual store webhook delivery, live subscription registration, and Admin business mutations were not executed.**

Window listing `sortKey: UPDATED_AT` passed the local generated 2026-07 schema gate in the PG suite.

---

## 8. Residuals (unchanged owners)

| ID | Severity | Owner | Status |
|---|---|---|---|
| R-176 | P0 | D (apply half satisfied at **V**) | **OPEN** — D window/delete/revival/reconcile repository evidence exists on PR #43; not closed |
| NEW-CLAUDE-PR6B-C01 | P3 | B | Duplicate fragment names; both bulk gates remain mandatory |
| P3-FINAL-01 | P3 | tooling | F-F03; fail-closed CI; not imported from PR #41 |
| P3-FINAL-02 | P3 | tooling | `/tmp` hygiene; no broad delete |
| P3-FINAL-03 | P3 | C/D | at-sale provenance; D carries forward; never relink by SKU |
| C first-confirmation vs receipt | — | C (workaround in D) | D does not patch `apply/index.ts` |

---

## 9. Safety confirmation

- No production or merchant data.
- No live Shopify store calls or subscription registration.
- No inventory-write flag enablement.
- No D-055.
- No mark-ready and no merge.
- Tenant-access allowlist was **not** expanded.

Independent Claude PR6-D complete integration review remains mandatory.
