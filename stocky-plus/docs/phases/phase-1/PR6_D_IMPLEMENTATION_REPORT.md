# Phase 1 PR6-D — Complete webhook, import, and reconciliation implementation report

**Slice:** PR6-D complete §17.2 integration module
**Branch:** `phase-1/pr6-d-order-webhook-import`
**PR:** [#43](https://github.com/Vedang1998/Stocky/pull/43) OPEN / DRAFT / UNMERGED (do not reuse #39 / #40 / #41 / #42)
**Authority:** D-054 **EFFECTIVE** (no D-055); ChatGPT owner thread [5673830675](https://github.com/Vedang1998/Stocky/pull/40#issuecomment-5673830675); original work order `PR6_D_Complete_Integration_Work_Order.md` SHA-256 `3cf9d0d752b732836311cafd5072c45a63fa8ea74119b36d3ed06eaa7a0f2f49`; consolidated correction [5686500951](https://github.com/Vedang1998/Stocky/pull/43#issuecomment-5686500951); C3 source-contract [5692110528](https://github.com/Vedang1998/Stocky/pull/43#issuecomment-5692110528); SC recovery [5705430913](https://github.com/Vedang1998/Stocky/pull/43#issuecomment-5705430913); SC-R control corrections [5713115882](https://github.com/Vedang1998/Stocky/pull/43#issuecomment-5713115882)
**Status:** PR43 SC-R-01…SC-R-04 control correction is on this branch (plan **C3.7** / brief §8 / D-054 subitem — **not D-055**). Immutable reviews `5354111` (blob `48ac291a…`), `a72b403` (blob `ba82a3c981cda4bec52ea453c2618319288fa66c`), source-contract `7710758` (blob `1eb18cae44cdf7a6660256e2632ebc8019d6da0d`), and SC-recovery `ec61089` (blob `e8525c2fd2778c8baf118d0008a9213b7af4eca8`) are **not** edited. SC subject **H** `4768033b6b9c09804a6d417f0bb10ab3e8fdab9b`. Required main **V** `a3ff480f1477237f8055f10c43298480a05728a1`. Historical SUCCESS `35168858541` is **H only**; `35088765421` is `09029c0` only; `35044093460` is `7e0329f` only; `35060561603` is `eaf0b73` only; `35065980776` is `74ef385` only. Exact-head SC-R `pull_request` Classify + full Heavy + CI Gate IDs are **pending at this report write** and must not be invented. This report does **not** embed this documentation commit’s own SHA. Cursor does **not** certify independent approval. The next independent review must be a **separate actual Claude Code** session.

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
| Required starting implementation / live PR head before correction | `25226e46905b082fe3af09bb1d9f5c68a8e39785` |
| Immutable D complete-integration review | `53541112832f8da3dcfa65adea8e9a4447b0f18b` (sole parent `25226e46…`; blob `48ac291a781b2347cb6017af862f2de9677826a5`; never edit) |
| Defective-subject exact-head CI | run [`34934317232`](https://github.com/Vedang1998/Stocky/actions/runs/34934317232) on `25226e46…` only |

PR #41 remains parked tooling and is **not** a D writer. Immutable B/C/planning/A review blobs were not edited. Preserved blobs: C final `0daa0e5395c69b1fb86508f133f6ade3f8430f56`; C original `a90ae442a80ee593bb43bee3b15c2228f32d6e15`; C correction `8c384b698bc45a7a9ac0a1dffa2ab8fdbcc65704`; B correction `e902a1ce07e30174cd56cea13114be7325195c98`; B original `b4533610b5af305816aef5434b884c3065b06f94`; tooling `5a47f6f8133806848ad71a545e07c030a2137e37`; A `198e55548a2ca09942843798a9ebd3e03a30d0fa`; A correction `da388c5d2ffa8bc0e04312de9c14a831b5ba4010`; planning `4f5ea10f6d36175d3540cb977a8f3543f36c15c2`.

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

C first-confirmation vs receipt: D does not patch C internals. The first LIVE confirmation throws `OrderApplyReceiptNotCertifiableError` containing `terminal_first_confirmation`, persists the observation without a success receipt, returns `first_confirmation_pending`, and the worker uses `completeAttemptRetry` on the same durable job.

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
| Production-scale 1,000,000-line D streaming/queues | **executed** (opt-in `PR6_D_SCALE_1E6=1`, skipped on GitHub Actions) | `pr6-d-scale-envelope.test.ts`; see §13 |

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
| Exact-head CI `34931435422` | FAILURE on `93e7add…` | Classify SUCCESS; Heavy FAIL `tenant:access:inventory:check_failed_exit_1`; Gate FAIL; superseded |
| Exact-head CI `34932750380` | FAILURE on `9063f2d…` | Classify SUCCESS; Heavy FAIL `tenant:access:inventory:check_failed_exit_1` (stale inventory vs D files); Gate FAIL; superseded |
| Exact-head CI `34934129024` | FAILURE on `17d1324…` | Classify FAIL `git diff --check` trailing whitespace in this report; Heavy SKIPPED; Gate FAIL; not a pass |

---

## 6. Query / memory measurements (D-specific)

300-line quarantine recovery PG test logged:

```text
{"pr6dQuarantineRecovery":{"orderFactByIdQueries":8,"heapDeltaBytes":345216}}
```

Repeated executions: `orderFactByIdQueries` **8** (stable). Positive heap deltas observed **345216** and **356032** bytes (~0.33 MiB). A later same-process run reported a **negative** heap delta after GC (`-74622032`); heap delta is not a stable production-scale bound. Assertion used: queries in `[6, 40)` and heap delta `< 200 MiB` when positive.

This is **not** 1,000,000-line D streaming/queue evidence. C’s 1e6 apply-only envelope remains accepted for unchanged C only.

**D-R-12 attributed retraction:** the dated 2026-09-15 quarantine PG measurement `heapDeltaBytes: 53336` (subject `25226e46`, Cursor local run) is preserved as a historical sample only. It is **not** a peak bound and **not** a universal performance claim. Claude independently measured `heapDeltaBytes: 10999720` on the same instrumented test under different conditions (review `5354111`, D-R-12). Sampled peaks elsewhere in this report are observed high-water values at a stated interval, not mathematical bounds.

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

---

## 10. PR43 consolidated correction contract (checkpoint)

**Authority:** PR #43 comment [5686500951](https://github.com/Vedang1998/Stocky/pull/43#issuecomment-5686500951); Claude review `53541112832f8da3dcfa65adea8e9a4447b0f18b` blob `48ac291a781b2347cb6017af862f2de9677826a5`; D-054 remains **EFFECTIVE**; no D-055. This section is a work checkpoint inside the existing D implementation report, not a new planning PR.

### 10.1 Production call chain

1. Intake sanitizer → durable `webhook:{topic}` job (v3 envelope / supported v2 recovery) → `processWebhookJob`.
2. `claimAttempt` → `applyOrderFactsWebhookIfOwned` → `processOrderFactsWebhookJob`.
3. Probe `SyncApplicationReceipt` under RepeatableRead **before** Shopify I/O.
4. Allocate observation gens → B `readOrderFact` / `readRefundFact` (Shopify transport mocked in tests).
5. Production mapper → `applyCanonicalAndLegacy` inside the **caller’s existing TenantDb `$transaction`**.
6. C `applyOrderFactsWithRetry(asApplyDb(tx))` (`$queryRaw` view only). Frozen v1 legacy `handleOrderCreate` / `handleOrderCancelled` / `handleRefundCreate` receive the **same transaction-scoped TenantDb**, never the query-only view.
7. Success receipt insert is C’s final write in that transaction. Canonical facts, required legacy aggregates, and the receipt commit together or roll back together.

Import: `order-facts-sync` → `runOrderFactsImportStep` → Bulk A submit/poll (one poll per durable CONTINUE) → stream JSONL → assemble complete parent snapshots → apply Bulk A bodies when sufficient, else counted B follow-up → C apply → checkpoint physical ordinals → completeness counts before watermark.

### 10.2 Transaction owner

The authenticated TenantDb transaction opened by `applyCanonicalAndLegacy` / nominated apply is the sole writer for one certifiable application. D does not open a second client, does not widen grants, and does not cast a `$queryRaw`-only object into TenantDb. Import harness hosts without merchant delegates cannot type-check as `LegacyWebhookRunner`.

### 10.3 Success versus continuation states

| State | Worker | Receipt | Legacy | Durable job |
|---|---|---|---|---|
| `applied` | `completeAttemptSuccess` | success inserted | frozen topics only, same txn | `SUCCEEDED` |
| `already_applied` | success (pre-I/O probe) | existing matching digest | not replayed | `SUCCEEDED` |
| apply-time `already_applied` after probe proceed | throw `application_already_applied` | verify after rollback | rolled back with the loser | `already_applied_verified_after_rollback` or dead-letter |
| `first_confirmation_pending` | `completeAttemptRetry` same job | none | deferred | `RETRY_WAIT`; fresh B read; new gens |
| `incomplete` | retry | none | none | `RETRY_WAIT` |
| `blocked` / `noop` | fail or success-noop | none | none | terminal / no effects |

A first LIVE confirmation may persist C’s diagnostic without a success receipt. It is **not** a finished application and must not set `SUCCEEDED`.

### 10.4 Bounded assembly / close evidence

JSONL close/release does **not** use next-root arrival, empty page, newline, unit-quantity sum, or `groupObjects:false` order. Named evidence:

- **Mid-stream close:** root object persisted **and** attached LineItem children count equals the root’s selected finite `currentSubtotalLineItemsQuantity`.
- **Stream-end completeness:** leftover empty (no partial line), no orphans, **no leftover open parents**, **and** authoritative `objectCount` **and** `rootObjectCount` tokens both equal observed counts (unsigned decimal, no Number coercion). A leftover parent without `currentSubtotalLineItemsQuantity`, or whose LineItem count does not equal that field, is `TRUNCATED`. Export-count equality and a terminating newline are not parent-complete evidence.
- Live roots, orphan maps, live bytes, and live duplicate IDs are bounded. Released child IDs are dropped. Released root GIDs are retained only in a bounded recent-window ring (`max(2×open-parent bound, 32)`), not a whole-stream set. Duplicates inside the live set or that ring fail closed as `DUPLICATE`; a duplicate after the ring has forgotten the GID is handled by C already-applied receipts rather than unbounded ID retention.

### 10.5 Count checks, ordinals, poll, recovery

- Completeness requires structural validity **and** both count equalities. Missing/malformed/untrusted tokens never become zero. Proven zero-count empty export is distinct from an empty download of a nonempty export.
- Checkpoint `jsonlCommittedLineOrdinal` is a physical JSONL object-line ordinal. Advance only the contiguous committed prefix. Restart re-reads the prefix (no HTTP Range) and skips already-committed application via receipts.
- Poll budget is cumulative `SyncRun.examinedCount` plus wall clock from `bulkSubmitIntentAt ?? startedAt` (120 attempts / 600s), one poll per CONTINUE, fence reused, no in-txn sleep.
- Failure: `markSyncRunPartialFailure` + DataIssue; no coverage watermark; no HEALTHY over unresolved coverage.

### 10.6 Bulk A mapping limitation (`confirmed`)

Frozen Bulk A does not select `Order.confirmed` (NOT NULL on `ShopifyOrderFact`). D does not change B documents. Baseline unedited / zero-refund snapshots apply Bulk A `discountedTotalSet` (not with-code) with empty `agreements` and `agreementsComplete: true`. `confirmed` is recorded as D-owned import provenance `true` because this document’s `orders` connection excludes DraftOrder — **not** as a Shopify-selected field. `closedAt`, `displayFulfillmentStatus`, and `subtotalLineItemsQuantity` are null when unselected. Qualifying `edited=true` or nonzero `totalRefundedSet` still take counted B `readOrderFact` follow-ups.

---

## 11. Claude twelve-finding dispositions (correction)

Severities and reproduction are Claude’s (review `5354111` / blob `48ac291a…`). Cursor dispositions below are implementation claims, not independent acceptance.

Evidence class keys: **direct-helper** = `processOrderFactsWebhookJob` / JSONL function; **real-worker** = `processWebhookJob` + v3/v2 durable envelope; **queue/recovery** = attempt/retry/lease; **source-contract** = Bulk A mapping / count tokens / close evidence; **scale** = opt-in 1e6 envelope.

| ID | Claude severity | Concrete fix | Pre-fix failure (Claude) | Post-fix tests (Cursor-executed) |
|---|---|---|---|---|
| D-R-01 | P1 | Thread transaction-scoped TenantDb into `runLegacy`; `asApplyDb` is C-only; `isOrderFactsMerchantHost` rejects `$queryRaw`-only views | Frozen v1 topics fail in production worker | **real-worker** `pr6-d-worker.test.ts` create/cancelled/refunds via `processWebhookJob` |
| D-R-02 | P1 | Release closed assemblies; bound is live parents/orphans/bytes, not total roots | 33 sequential closed roots `OPEN_PARENT_BOUND` | **source-contract** `jsonl.test.ts` 32/33/40/100/1000; **direct-helper** 40 PG Bulk A applies |
| D-R-03 | P1 | Compare unsigned `objectCount` and `rootObjectCount` before COMPLETE/watermark/HEALTHY | Empty/truncated JSONL certified coverage | **source-contract** empty-nonzero, newline truncation, both count mismatches; **direct-helper** import count miss + proven zero export |
| D-R-04 | P1 | `first_confirmation_pending` + `completeAttemptRetry` on the same durable job; no `SUCCEEDED` | First LIVE confirmation reported applied; no second confirmation | **real-worker** / **queue/recovery** revival, interrupt, exhaust, overlap |
| D-R-05 | P1 | Legacy runs only when `receiptStatus === "applied"` in the same txn; deferred until certifiable | No-receipt retry skipped legacy yet reported success | **direct-helper** legacy deferred until second confirmation; **real-worker** refund reaches real handler |
| D-R-06 | P2 | Checkpoint is physical JSONL ordinal; contiguous prefix only; resume skips committed work | Ordinal wrong units; never read | **direct-helper** truncated→resume; gap does not advance checkpoint |
| D-R-07 | P2 | Restore D046 injection at `applyOrderFactsWithRetry` + RepeatableRead probe | Weakened already_applied_verified_after_rollback | **real-worker** `sync-d046-worker-finalize.test.ts` 7/7 |
| D-R-08 | P2 | Streaming `TextDecoder({fatal:true})`; fail closed on malformed/truncated UTF-8 | Split multi-byte silently corrupted | **source-contract** byte-boundary round-trip of `Café — 東京`; malformed and truncated UTF-8 `MALFORMED` |
| D-R-09 | P2 | Cumulative `SyncRun.examinedCount` + wall clock; one poll per CONTINUE | Local constant reset; dead budget | **direct-helper** first CONTINUE increments examinedCount to 1; 120 exhausts |
| D-R-10 | P2 | Map complete Bulk A parent+lines; follow-up only edited/refund-bearing | Every order refetched | **direct-helper** 40 baseline `OrderFactById` = 0; edited+refunded = 2 follow-ups |
| D-R-11 | P3 | Live ID set + bounded released-root ring; children dropped on release | Whole-stream `seenIds` | **source-contract** 1000 sequential roots; duplicate-across-window; byte bound on one huge parent |
| D-R-12 | P3 | Retract 53336 as peak bound; scale envelope measurements | Unreproducible heap claim | Historical 53336 preserved as dated sample; Claude 10999720 attributed to Claude; **scale** §13 |

**Attributed correction of earlier complete-module claims:** Cursor previously treated green local suites, worker-helper tests, and the 53336 heap delta as complete-module / worker / memory proof. Claude’s review showed those claims unsupported for production `processWebhookJob` legacy wiring, first-confirmation continuation, bounded import, completeness, checkpoints, UTF-8, poll budget, Bulk A body use, and scale. Those earlier claims are retracted. Independent acceptance remains Claude’s / ChatGPT’s.

---

## 12. Correction execution ledger (additive)

Historical rows in §5 remain bound to their original heads. New correction-local executions:

| Command | Exit | Notes |
|---|---|---|
| `npx tsc --noEmit` | 0 | after D-owned type repairs and leftover-parent fail-closed |
| `npx vitest run app/lib/order-facts` | 0 | **28** files, **245** tests (includes inherited A/B/C units) |
| `npx vitest run app/lib/order-facts/sync/jsonl.test.ts mapper-bulk.test.ts merchant-host.test.ts` | 0 | **29** tests |
| `npx vitest run --config vitest.migrations.config.ts scripts/tenant-enforcement/tests/pr6-d-correction.test.ts` | 0 | **8** tests |
| `npx vitest run --config vitest.migrations.config.ts scripts/tenant-enforcement/tests/pr6-d-worker.test.ts` | 0 | **12** tests; real `processWebhookJob`; overlap rerun 2/2 |
| `npx vitest run --config vitest.migrations.config.ts scripts/tenant-enforcement/tests/pr6-d-integration.test.ts` | 0 | **24** tests (was 22 at `25226e46`) |
| `npm run test:sync-exactly-once` | 0 | **35** exactly-once + **7** D046 |
| `npm run test:sync-envelope-fail-closed` | 0 | **6** tests |
| `npm run test:tenant-access -- app/tenant/__tests__/job-envelope.test.ts` | 0 | **25** tests |
| `npm run test:sync-dispatch-recovery` | 0 | **29** tests |
| inherited C `pr6-c-canonical-applicator` + `pr6-c-evidence-gates` | 0 | **82** + **9** |
| `npx vitest run --config vitest.migrations.config.ts scripts/tenant-enforcement/tests/pr6-d-scale-envelope.test.ts` | 0 | **3** passed / **1** skipped without `PR6_D_SCALE_1E6=1` |
| `PR6_D_SCALE_1E6=1` million-line envelope | 0 | **1** passed / **3** skipped; duration **1859.38s**; see §13 |
| `npm run tenant:access:inventory` / `:check` / `:audit` | 0 | findings **1761**, violations **0**, scannedFiles **489**, digest `607886370181cfe7521c736783e5859b4e4e79fa1e4311fcf800fd0c57fee8a5` |
| `npm run sync:inventory` / `:check` | 0 | surfaces=**58**, digest `191b83498733a237f4a6fa341e6be0620e718d7c7bd76e467684073500360539` |
| `npm run tenant:enforcement:inventory:check` | 0 | fresh |
| `npm run test:sync-inventory-audit` | 0 | **5** tests |
| `npx eslint` focused D files + `npm run lint` | 0 | — |
| `npm run typecheck` | 0 | `react-router typegen && tsc --noEmit` |
| `npm run build` | 0 | client + SSR |
| `bash .github/scripts/classify-ci-change-set.test.sh` | 0 | 40/40 assertions |
| `git diff --check` | 0 | — |
| `npm run graphql-codegen` | **not executed** | CI Heavy fetches shopify.dev; local Admin 2026-07 schema gate already executed in `bulk-query-schema.test.ts` |

Failed attempts during this correction (not relabelled as passes):

| Attempt | Result | Correction |
|---|---|---|
| First `PR6_D_SCALE_1E6=1` run | assertion `orderFactsA === resultA.applied` (126439 vs 126186) after crash-prefix skip | assert fact count vs planned roots; applied may be less than examined |
| Overlap confirmation `processWebhookJob` | PG `40001` serialize on RepeatableRead | D retries serialization at the TenantDb transaction; test looks up jobs via `WebhookDelivery.shopifyWebhookId` and allows settled throws |
| Integration JSONL fixtures without `currentSubtotalLineItemsQuantity` | `PARTIAL_FAILURE` after leftover-parent fail-closed | fixtures use the same quantity close evidence as production Bulk A |

Exact-head corrected Classify / Heavy / Gate IDs: **not yet** — require the coherent correction push. Historical SUCCESS `34934317232` is the defective subject only.

---

## 13. D-specific 1,000,000-line scale/recovery (executed)

Command (local disposable PostgreSQL/Redis; `GITHUB_ACTIONS` unset; not CI):

```text
PR6_D_SCALE_1E6=1 npx vitest run --config vitest.migrations.config.ts \
  scripts/tenant-enforcement/tests/pr6-d-scale-envelope.test.ts -t "streams 1,000,000 JSONL"
```

Exit **0**. Test file duration **1859.38s**. Concurrent full-import wall `elapsedMs` **1847487**. Effective worker concurrency: one Vitest worker; two shops (`pr6-d-scale-a` resume + `pr6-d-scale-b`) plus an overlapping `orders/edited` webhook on shop A. Database: disposable PostgreSQL 16. Code subject: uncommitted correction working tree on parent `5354111` (review FF). This is **not** C’s apply-only 1e6 envelope.

First failed attempt (same envelope, assertion `orderFactsA === applied`) is recorded in §12 and is **not** a pass.

Observed JSON (`pr6dScaleEnvelope`):

```json
{
  "objectTarget": 1000000,
  "plannedRoots": 126439,
  "plannedObjects": 1000000,
  "childBuckets": { "zero": 0, "small": 91956, "eight": 22989, "forty": 11494 },
  "qualifyingFollowUps": 45,
  "warmup": {
    "objectTarget": 1000,
    "roots": 130,
    "elapsedMs": 1692,
    "peakRssBytes": 155758592,
    "peakHeapBytes": 43542648,
    "rssSamples": 33,
    "heapSamples": 33
  },
  "crashPrefixObjects": 2000,
  "crashPrefixRoots": 254,
  "crashSkippedRoots": 253,
  "crashCheckpointOrdinal": 2000,
  "webhookOverlapStatus": "applied",
  "applied": 126186,
  "examined": 126439,
  "followUpReads": 45,
  "bulkDirectApplies": 126141,
  "shopBFacts": 1,
  "graphqlCalls": 140,
  "jsonlFetches": 2,
  "elapsedMs": 1847487,
  "sampleMs": 250,
  "peakRssBytes": 431763456,
  "peakHeapBytes": 285156584,
  "rssSamples": 7389,
  "heapSamples": 7389
}
```

Distribution: 126439 parents across 1,000,000 objects. Child mix is 91956 small / 22989 eight-child / 11494 forty-child parents (0 zero-child). Qualifying edited/refund follow-ups **45** (not every order). Baseline Bulk A direct applies **126141**. `OrderFactById` is not used for unedited zero-refund roots. GraphQL call count **140** includes shop/scope/bulk poll plus the 45 follow-ups — not 126439 full-order refetches. JSONL downloads **2** (truncated crash prefix + full resume). Crash checkpoint physical ordinal **2000**; resume skipped **253** already-committed roots so `applied` **126186** `<` `examined` **126439**. Shop B remained **1** fact (no cross-shop leak). Webhook overlap status `applied`.

Memory method: `process.memoryUsage()` sampled every **250ms** (`unref` interval) on the Node vitest worker during the concurrent full import. **Peak RSS 431763456 bytes (~412 MiB)** and **peak heap 285156584 bytes (~272 MiB)** are observed high-water values at that interval, not mathematical bounds. Warmup (1000 objects) sampled every 50ms: peak RSS 155758592, peak heap 43542648. RSS during the live run was observed near 410 MiB at 9–21 minutes while the checkpoint advanced from ~332k to ~680k of 1e6, i.e. not growing with total roots. Limitations: sampling can miss short spikes between 250ms ticks; RSS includes V8/runtime; this is one process on one disposable database; no throughput projection.

D-R-12: dated 2026-09-15 quarantine PG `heapDeltaBytes: 53336` (subject `25226e46`) remains a historical sample only and is **retracted** as a peak bound. Claude independently measured `heapDeltaBytes: 10999720` under different conditions (review `5354111`). Those two endpoint heap deltas are not this scale run.

Remaining limits: HTTP Range is not used (prefix re-read + receipt skip); Bulk B stays disabled and Bulk C stays rejected; `confirmed` is D import provenance as in §10.6; default CI never executes this envelope; GitHub `validate` timeout-minutes remains **120**.

§13 records the **pre-C3** million-object envelope (quantity-as-closure, invented `confirmed`, edited/refund-bearing follow-up). It is **not** C3 scale evidence. C3 scale is canonical **order-line facts** and is recorded in §14 after that envelope is executed.

---

## 14. C3 source-contract correction (same D-054 — not D-055)

**Authority:** PR #43 comment [5692110528](https://github.com/Vedang1998/Stocky/pull/43#issuecomment-5692110528). Plan C3 / brief §6 / D-054 subitem. Subject re-review: `a72b403fe3c0ed57fa69d262d7dfbec3d7646292` blob `ba82a3c981cda4bec52ea453c2618319288fa66c`. Prior corrected head `7e0329f` exact-head CI `35044093460` SUCCESS is preserved and is **not** C3 evidence.

This section **supersedes §10.4 mid-stream quantity close, §10.6 invented `confirmed` / empty-complete agreements, and §11 D-R-02 / D-R-03 / D-R-10 / D-R-11 Cursor dispositions** for D import. Frozen B documents and C internals are unchanged. RESOLVED D-R-01/04/05/06/07/08/09/12 remain.

### 14.1 Replacement import path

1. Fingerprint `sha256(D Bulk A query + groupObjects:false + shopId)`. Old fingerprints fail closed (`old_bulk_a_checkpoint_not_transferable`); ordinals are not skipped against a changed epoch.
2. Default submit/poll inner QUERY is `ORDER_FACTS_D_BULK_A_ORDERS_LINES` (`sync/bulk-a-query.ts`, version `order-facts-d-bulk-a-v2`). Both B gates still run. Frozen B `ORDER_FACTS_BULK_A_ORDERS_LINES` is not the D payload.
3. `streamOrderFactsJsonl` **spools, indexes, and validates** on D-owned scratch (`{tmpdir}/stocky-pr6-d/{shop}/{run}`) **before** `onCompleteAssembly`. Parent closure is indexed `__parentId` membership after EOF. Orphans are `MIS_PARENTED`. `currentSubtotalLineItemsQuantity` is not a child-record count. ID uniqueness and grouped parent membership use **bounded external sort and streaming adjacent comparison** — the export is never loaded as a whole JavaScript string, root array, or ID Set.
4. Assemblies emit in **physical min-ordinal** order from `emit.tsv`. Blank/whitespace-only physical lines are framing only and do not occupy a checkpoint ordinal. Live-byte and scratch-byte bounds fail before apply. Pending checkpoint holes live in a **scratch ack bitset** (`ack.bits`), not an in-memory Set.
5. Scratch `manifest.json` binds shop, run, BulkOperation GID, query fingerprint, API version `2026-07`, fence, counts, and SHA-256 content digests. Digest mismatch or epoch mismatch fails closed; ordinals are not skipped against an unverified source. Ownership marker `.stocky-pr6-d-owned` is required before cleanup.
6. Every imported order queries `OrderFactsImportLedger` (agreements/sales + refund LIST identities). Pin identity / `updatedAt` / `currencyCode` against the Bulk A root. Drift abandons the mixed candidate and falls back to `applyNominatedOrderGid` (counted `fallback`). Mapper `agreementsComplete` stays false until that ledger is attached. Refund clocks are independent of parent `updatedAt`.
7. Selected `confirmed` and `discountedTotalSet(withCodeDiscounts: true)` are required. Omitted selected keys fail closed (N-09). Zero-money refunds still take `RefundFactById`.

### 14.2 Finding mapping

| ID | C3.5 disposition | Red/green tests |
|---|---|---|
| D-R-01,04,05,06,07,08,09,12 | **RESOLVED** (preserved) | worker/receipt/revival/scope/D046/tenant matrices unchanged |
| D-R-02 | Staging + indexed EOF membership; 33 orphans = `MIS_PARENTED`; `onCompleteAssembly` never before validation | `jsonl.test.ts` 33/40/100/1000; PG 40 ledger applies |
| D-R-03 | Unsigned count tokens; staging fails before apply so truncated spool cannot certify | empty-nonzero, newline truncation, crash prefix checkpoint 0 |
| D-R-10 | Actual selected `confirmed`; with-code line money; ledger for **every** imported order | mapper-bulk; PG every-order ledger; SalesAgreement first-import |
| D-R-11 | Whole-stream unique IDs via external sort; no 64-root ring; no whole-file ID Set | duplicate after 70 / 3000 / 70000; child reuse same/different parent |
| N-01 | Record count independent of units | one LineItem quantity 10 → **1** PG line fact; qty≠child-count JSONL |
| N-02 | Complete parent only after validated membership + ledger | three retained lines with one current unit; no apply before EOF |
| N-03 | Zero-current retained lines and zero-money refunds preserved | retained `currentQuantity=0` rows; zero-money `RefundFactById` |
| N-04 | True zero-line only when source contains none | proven empty export vs truncated/missing collection |
| N-05 | No contiguous-parent assumption | children-before-parent; 33 open orphans; UTF-8 every byte boundary |
| N-06 / N-07 | Exact global identity; sort-run split | duplicate after 70 and 3000; 70000-root sort-run duplicate |
| N-08 / N-09 | `confirmed` actual; omitted ≠ selected-null | mapper-bulk omitted `confirmed`/`closedAt`; selected-null `closedAt` |
| N-08 refund clock | Refund LIST even when parent `updatedAt` unchanged | PG refund txn `77-b` with independent clock |
| Scratch / N resource | Digest, ENOSPC, process-loss, ownership hashes | `source-stage.test.ts`; `/dev/full`; SIGKILL leftover rebuild |

### 14.3 Historical C3 execution ledger (`eaf0b73` / `74ef385`)

Local commands on implementation head `eaf0b7307f62ccd9f41687a08dc7d3a3e01cf696` (parent `619f4c8`). This subsection is **preserved dated evidence** for that SHA. It is **not** C3.5 / `1e04ddc` evidence and is **not** relabeled. Historical SUCCESS `35044093460` is `7e0329f` only. Failed typecheck run `35059069898` is `4e1ad0d` only.

| Command | Exit | Notes |
|---|---|---|
| `npx vitest run app/lib/order-facts` | 0 | **30** files, **258** tests |
| `npx vitest run` C3 unit files (`jsonl`/`source-stage`/`mapper-bulk`/`bulk`/`supplemental-ledger`/`merchant-host`) | 0 | **45** tests |
| `npx vitest run --config vitest.migrations.config.ts scripts/tenant-enforcement/tests/pr6-d-correction.test.ts` | 0 | **11** tests |
| `pr6-d-integration.test.ts` | 0 | **24** tests |
| `pr6-d-worker.test.ts` | 0 | **12** tests |
| `pr6-d-scale-envelope.test.ts` without `PR6_D_SCALE_1E6` | 0 | **3** passed / **1** skipped |
| `npm run test:sync-exactly-once` | 0 | **35** exactly-once + **7** D046 |
| `npm run test:sync-envelope-fail-closed` | 0 | **6** |
| `npm run test:sync-dispatch-recovery` | 0 | **29** |
| `npm run test:tenant-access -- app/tenant/__tests__/job-envelope.test.ts` | 0 | **25** |
| `npm run test:sync-inventory-audit` | 0 | **5** |
| `npx tsc --noEmit` / `npm run typecheck` | 0 | — |
| `npx eslint` focused D C3 files | 0 | — |
| `bash .github/scripts/classify-ci-change-set.test.sh` | 0 | 40/40 assertions |
| `git diff --check` | 0 | — |
| First `PR6_D_SCALE_1E6=1` envelope on `619f4c8` | **1** | `lineFactsA` **999801** vs **1000000** after webhook overlap replaced a 200-line parent. **Not a pass.** |
| Second `PR6_D_SCALE_1E6=1` envelope on `eaf0b73` | 0 | **4** passed; duration **885.08s**; see JSON below |

Exact-head C3 Classify / Heavy / Gate on `eaf0b7307f62ccd9f41687a08dc7d3a3e01cf696`: run [`35060561603`](https://github.com/Vedang1998/Stocky/actions/runs/35060561603) **SUCCESS**. Classify `104679868899` SUCCESS. Full Heavy `104679892208` SUCCESS (not skipped). CI Gate `104693426142` SUCCESS. Historical SUCCESS `35044093460` is `7e0329f` only. Failed typecheck run `35059069898` is `4e1ad0d` only.

Observed JSON (`pr6dScaleEnvelope`) from the passing second envelope:

```json
{
  "lineFactTarget": 1000000,
  "plannedRoots": 5192,
  "plannedObjects": 1005192,
  "plannedLineFacts": 1000000,
  "childBuckets": { "zero": 101, "small": 4350, "eight": 520, "forty": 221 },
  "warmup": {
    "lineTarget": 1000,
    "roots": 5,
    "elapsedMs": 1083,
    "peakRssBytes": 155971584,
    "peakHeapBytes": 43911560,
    "rssSamples": 21,
    "heapSamples": 21
  },
  "crashPrefixLines": 2000,
  "crashPrefixRoots": 11,
  "crashCheckpointOrdinal": null,
  "webhookOverlapStatus": "applied",
  "applied": 5192,
  "examined": 5192,
  "followUpReads": 1,
  "bulkDirectApplies": 5191,
  "ledgerCounts": {
    "initial": 5192,
    "recheck": 0,
    "agreement": 0,
    "sale": 0,
    "refund": 0,
    "fallback": 1,
    "throttle": 0
  },
  "shopBFacts": 1,
  "lineFactsA": 1000000,
  "graphqlCalls": 5200,
  "jsonlFetches": 2,
  "elapsedMs": 876344,
  "sampleMs": 250,
  "peakRssBytes": 912486400,
  "peakHeapBytes": 672250776,
  "rssSamples": 3499,
  "heapSamples": 3499
}
```

C3 scale notes on `eaf0b73`: 5,192 parents produced **1,000,000** canonical order-line facts. That JSON remains a **historical** envelope for SHA `eaf0b73` only (whole-file ID loads still present on that SHA). It is **not** C3.5 scale evidence.

### 14.4 C3.5 remaining-proof execution (`1e04ddc`)

Runtime/test head `1e04ddcac612a7748b5567debee324ef1e6b6167` (parent `74ef385`). Commands below executed on that SHA in this assignment. Exact-head Classify / Heavy / Gate IDs for the **later documentation-final head** are not invented here.

| Command | Exit | Notes |
|---|---|---|
| `npx tsc --noEmit` | 0 | — |
| `npx eslint` focused D C3.5 files | 0 | — |
| `npx vitest run app/lib/order-facts` | 0 | **30** files, **271** tests |
| `npx vitest run app/lib/order-facts/sync` | 0 | **11** files, **88** tests |
| `npx vitest run --config vitest.migrations.config.ts scripts/tenant-enforcement/tests/pr6-d-correction.test.ts` | 0 | **15** tests |
| `pr6-d-integration.test.ts` | 0 | **24** tests |
| `pr6-d-worker.test.ts` | 0 | **12** tests |
| `pr6-d-scale-envelope.test.ts` without `PR6_D_SCALE_1E6` | 0 | **3** passed / **1** skipped |
| `npm run test:sync-exactly-once` | 0 | **35** exactly-once + **7** D046 |
| `npm run test:sync-envelope-fail-closed` | 0 | **6** |
| `npm run test:sync-dispatch-recovery` | 0 | **29** |
| `npm run test:tenant-access -- app/tenant/__tests__/job-envelope.test.ts` | 0 | **25** |
| `npm run test:sync-inventory-audit` | 0 | **5** |
| `npx vitest run app/lib/order-facts/admin-read/bulk-query-schema.test.ts` | 0 | **20** |
| `bash .github/scripts/classify-ci-change-set.test.sh` | 0 | 40/40 assertions |
| `git diff --check` | 0 | — |
| `PR6_D_SCALE_1E6=1` envelope on `1e04ddc` | 0 | **4** passed; duration **929.47s**; see JSON below |

First `PR6_D_SCALE_1E6=1` envelope on `619f4c8` (`lineFactsA` **999801**) remains a **failed** historical attempt and is **not** a pass. Second envelope on `eaf0b73` remains historical for that SHA. The JSON below is the **C3.5** envelope on `1e04ddc` after streaming indexes / digests / bitset.

Observed JSON (`pr6dScaleEnvelope`) from the passing C3.5 envelope:

```json
{
  "lineFactTarget": 1000000,
  "plannedRoots": 5192,
  "plannedObjects": 1005192,
  "plannedLineFacts": 1000000,
  "childBuckets": { "zero": 101, "small": 4350, "eight": 520, "forty": 221 },
  "warmup": {
    "lineTarget": 1000,
    "roots": 5,
    "elapsedMs": 1094,
    "peakRssBytes": 159461376,
    "peakHeapBytes": 47000680,
    "rssSamples": 21,
    "heapSamples": 21
  },
  "crashPrefixLines": 2000,
  "crashPrefixRoots": 11,
  "crashCheckpointOrdinal": null,
  "webhookOverlapStatus": "applied",
  "applied": 5192,
  "examined": 5192,
  "followUpReads": 1,
  "bulkDirectApplies": 5191,
  "ledgerCounts": {
    "initial": 5192,
    "recheck": 0,
    "agreement": 0,
    "sale": 0,
    "refund": 0,
    "fallback": 1,
    "throttle": 0
  },
  "shopBFacts": 1,
  "lineFactsA": 1000000,
  "graphqlCalls": 5200,
  "jsonlFetches": 2,
  "elapsedMs": 920964,
  "sampleMs": 250,
  "peakRssBytes": 393846784,
  "peakHeapBytes": 228991304,
  "rssSamples": 3683,
  "heapSamples": 3683
}
```

C3.5 scale notes: independently planned **5,192** roots / **1,005,192** JSONL objects / **1,000,000** canonical order-line facts (`qty` ≠ child-record count). Every imported order received a ledger (`initial: 5192`). One overlapping `orders/edited` on zero-child root `d-scale-51` drifted to full-B (`followUpReads: 1`, `fallback: 1`). Truncated crash prefix did not persist a committed ordinal (`crashCheckpointOrdinal` null). Shop B remained **1** fact. Admin GraphQL calls **5200**; JSONL fetches **2** (crash + success). Wall `elapsedMs` **920964**; bash `elapsed_real=929.902` `user=147.826` `sys=46.387`. Peak RSS/heap are sampled high-water values on a 250ms interval, **not** mathematical bounds and **not** encoded-byte proofs of JavaScript heap. Scratch files are disposed after emit; this run did **not** sample peak scratch directory bytes (limitation). Default CI still skips this envelope (`PR6_D_SCALE_1E6=1` and not GitHub Actions). GitHub `validate` timeout-minutes remains **120**. `npm run graphql-codegen` was **not executed** locally; CI Heavy fetches shopify.dev; local Admin 2026-07 schema gate executed in `bulk-query-schema.test.ts`.

---

## 15. SC-01…SC-04 recovery correction (same D-054 — not D-055)

**Authority:** PR #43 comment [5705430913](https://github.com/Vedang1998/Stocky/pull/43#issuecomment-5705430913). Plan **C3.6** / brief §7 / D-054 subitem. This is implementation/correction evidence only. It is **not** technical acceptance, independent approval, lane closure, mark-ready, merge, or D-055.

### 15.1 Identities and immutable review preservation

| Field | Value |
|---|---|
| Required starting implementation | `09029c09ea7468e6ff676a11fdf020dde5deb694` |
| Runtime/test SC implementation | `4fd98cef76ad043de2f9c586906053d5c6a42937` |
| Required `origin/main` / squash **V** | `a3ff480f1477237f8055f10c43298480a05728a1` |
| Branch / PR | `phase-1/pr6-d-order-webhook-import` / [#43](https://github.com/Vedang1998/Stocky/pull/43) OPEN / DRAFT / UNMERGED |
| Source-contract review commit | `7710758b181b5a49f1affa260a56b331adafdf7e` |
| Review sole parent | `09029c09ea7468e6ff676a11fdf020dde5deb694` |
| Review path / blob | `stocky-plus/docs/phases/phase-1/PR6_D_SOURCE_CONTRACT_INDEPENDENT_REVIEW.md` / `1eb18cae44cdf7a6660256e2632ebc8019d6da0d` |
| Integration | `git merge --ff-only 7710758…` onto the D branch. One-file delta. Artifact not re-authored. |
| Complete-integration review | `53541112832f8da3dcfa65adea8e9a4447b0f18b` blob `48ac291a781b2347cb6017af862f2de9677826a5` preserved |
| Correction re-review | `a72b403fe3c0ed57fa69d262d7dfbec3d7646292` blob `ba82a3c981cda4bec52ea453c2618319288fa66c` preserved |
| Review provenance qualification | GitHub records `7710758` author/committer as Cursor Agent and the PR comment as cursor[bot]. That metadata does **not** establish which reasoning agent performed the work and is **not** ChatGPT-verified independence. The artifact is preserved exactly, including its claimed role. Final independent acceptance must come from a **separate actual Claude Code** review. |
| Historical exact-head CI on `09029c0` | run [`35088765421`](https://github.com/Vedang1998/Stocky/actions/runs/35088765421) only — old-subject evidence, not this SC package |

### 15.2 Policy (conservative replay; no new schema)

Shop/run identity is metadata. Each physical attempt uses `mkdtemp` under `{tmpdir}/stocky-pr6-d/att-{shop}-{run}-*`. Cleanup requires an authentic in-process `WeakSet` handle plus matching on-disk token and containment. Markerless `source.jsonl` / `*.sorted` / empty dirs stay. Leftovers count toward byte and attempt limits.

A newly staged download opens the ack bitset at contiguous `0`. Completion is reconstructed from C `loadReceipt` / `probeReceiptBeforeShopifyIo` with `order-facts-d-import-src-v1:{jobType}:{durableJobId}:{gid}` plus a representation-only parent/child content digest. Fence is **not** in the application key. Mutated already-receipted content fails `import_receipt_content_conflict_fresh_run_required`. Identity-only legacy receipts fail `import_legacy_receipt_fresh_run_required` and are not upgraded. No new database table.

`maxRequests` is one aggregate D transport budget, including nested Refund pages, retries, and the final Order recheck. Every complete candidate, including one-page, performs that recheck and compares Refund LIST GID membership independently of parent `updatedAt`. This is multi-request consistency checking, not server snapshot isolation.

### 15.3 Before/after SC-01…SC-04 (Cursor, this assignment)

Before-fix probe on FF’d tree `7710758` (runtime still `1e04ddc` behavior), disposable fixtures, JSON `/opt/cursor/artifacts/sc_repro_before.json`:

| ID | Before (fail) | After (this package) |
|---|---|---|
| SC-01 live same-shop/run | `sc01_liveStillThere: false`; second stager used the same path and deleted `LIVE-WORKER-BYTES` | Two real processes; first retains `LIVE-WORKER-BYTES`; unique `att-*` dirs |
| SC-01 markerless | `source.jsonl` / `*.sorted` / empty dirs deleted | Untouched; marker data alone cannot grant takeover |
| SC-02 reorder | `skipThroughOrdinal: 2`; would `SUCCEEDED` with B missing | Walk from 0; resume completes **both** A and B; `verifiedReplayApplies: 1` |
| SC-03 `maxRequests: 1` + refund | `complete` with 2 GraphQL calls (`OrderFactsImportLedger` + `RefundFactById`) | Incomplete; exact boundary initial+refund+recheck succeeds |
| SC-04 one-page | `complete`, `recheck: 0` | Final Order check always runs; refund membership drift without timestamp bump fails |

### 15.4 Original-ID crosswalk (not renamed)

| ID | SC package disposition | Notes |
|---|---|---|
| D-R-01,04,05,06,07,08,09,12 | **RESOLVED** (preserved) | Worker/receipt/revival/scope/D046/tenant matrices unchanged |
| D-R-02,03,10,11 | C3.5 dispositions preserved | Staging/EOF/unsigned counts/selected fields/global IDs |
| N-01…N-07, N-09 | preserved | qty ≠ child-count; empty vs truncated; duplicates |
| N-04 / N-05 / N-06 | original meanings preserved | Not relabeled to unrelated passing scenarios |
| N-08 refund clock | preserved | Independent Refund clock; LIST even when parent `updatedAt` unchanged |
| N-08 scale/resource | **Cursor-executed** on this assignment; **not independently closed** | New 1e6 with positive checkpoint, SQL, scratch peak. No severity downgrade by Cursor |
| SC-01…SC-04 | Cursor-repaired; pending ChatGPT + separate Claude review | Finding IDs kept |
| Counter-evidence | preserved | Later import did not destroy an already-populated agreement ledger |

### 15.5 Cursor local commands (SC tree; parent `7710758`)

Environment: Node `v22.14.0`, npm `11.5.2`, linux, 4 CPUs, 16 GiB RAM, disposable PostgreSQL accepting, Redis `PONG`. Commands below are Cursor’s, this working tree.

| Command | Exit | Notes |
|---|---|---|
| `npx vitest run app/lib/order-facts` | 0 | **31** files, **296** tests |
| `npx vitest run app/lib/order-facts/apply` + `bulk-query-schema.test.ts` | 0 | **7** files, **65** tests (C apply **45** + schema **20**) |
| `npx vitest run --config vitest.migrations.config.ts scripts/tenant-enforcement/tests/pr6-d-sc-recovery.test.ts` | 0 | **13** tests (reorder, worker wrapper, mutation, legacy, commit-before-checkpoint, scratch loss, overlap, stale ordinal, multi-page, independent transport) |
| `pr6-d-correction.test.ts` + `pr6-d-integration.test.ts` + `pr6-d-worker.test.ts` | 0 | **51** tests (**15**+**24**+**12**) |
| `pr6-d-scale-envelope.test.ts` without `PR6_D_SCALE_1E6` | 0 | **3** passed / **1** skipped; skip does not reset schema |
| `npm run test:sync-exactly-once` | 0 | **42** tests (**35** exactly-once + **7** D046) |
| `npm run test:sync-envelope-fail-closed` | 0 | **6** |
| `npm run test:sync-dispatch-recovery` | 0 | **29** |
| `npm run test:tenant-access -- app/tenant/__tests__/job-envelope.test.ts` | 0 | **25** |
| `npm run test:sync-inventory-audit` | 0 | **5** |
| `npx tsc --noEmit` / `npm run lint` / `npm run build` | 0 | — |
| `bash .github/scripts/classify-ci-change-set.test.sh` | 0 | 40/40 assertions |
| `git diff --check` | 0 | — |
| `npm run tenant:access:inventory` / `:check` / `:audit` | 0 | findings **1761**, violations **0**, scannedFiles **503**, digest `82f3d083e2749973449cf9429b5c47d078c3218cd982efd5414191d68ec54eea` |
| `npm run sync:inventory:check` | 0 | surfaces=**58**, digest `191b83498733…` |
| `npm run tenant:enforcement:inventory:check` | 0 | fresh |
| First `PR6_D_SCALE_1E6=1` start | **not executed** | `/usr/bin/time` missing; restarted with bash `time` |
| First executed 1e6 on this tree | **1** | `PARTIAL_FAILURE` / `import_incomplete` at special 101-sale parent: D harness routed `OrderAgreementSalesPage` (`orderId`) to the wrong store via `variables.id`. **Not a pass.** |
| Second executed 1e6 | **1** | Import **SUCCEEDED** with 1,000,000 line facts, but assertion `bulkDirectApplies + followUpReads === 5192` received **5191** because crash-prefix parent 1 was a content-bound receipt replay. **Not a pass.** JSON was after the assertion and was not captured. |
| Third executed 1e6 | **0** | **4** passed on runtime head `4fd98cef76ad043de2f9c586906053d5c6a42937` working tree; duration **908.04s**; bash `elapsed_real=1073.200` `user=159.834` `sys=47.397`; see JSON below |

`npm run graphql-codegen` was **not executed** locally. CI Heavy fetches shopify.dev. Local Admin 2026-07 schema gate: `bulk-query-schema.test.ts` **20** tests.

Combined correction+integration+worker on an earlier mid-tree revision failed once (`PARTIAL_FAILURE` vs `SUCCEEDED`) because the resume fixture’s first parent had `subtotalLineItemsQuantity: 0` while the second fetch used default `1`, triggering content-conflict. Fixture aligned; the **51**-test combined command later exited 0 on this package.

### 15.6 Corrected scale/resource ledger (third 1e6; not `1e04ddc`)

Observed JSON (`pr6dScaleEnvelope`) from the passing envelope starting `2026-09-17T00:34:23Z` (Cursor, this tree, parent `7710758`):

```json
{
  "lineFactTarget": 1000000,
  "plannedRoots": 5192,
  "plannedObjects": 1005192,
  "plannedLineFacts": 1000000,
  "childBuckets": { "zero": 101, "small": 4350, "eight": 520, "forty": 221 },
  "warmup": {
    "lineTarget": 1000,
    "roots": 5,
    "elapsedMs": 1099,
    "peakRssBytes": 166326272,
    "peakHeapBytes": 41401344,
    "rssSamples": 21,
    "heapSamples": 21
  },
  "crashPrefixLines": 2000,
  "crashPrefixRoots": 11,
  "crashCheckpointOrdinal": 201,
  "crashScratchPeakBytes": 2633131,
  "leftoverAttemptCountBeforeLoss": 0,
  "leftoverBytesBeforeLoss": 109,
  "interruptKind": "injected Admin throw after the first committed parent on a complete crash-prefix source, then test-operator deletion of that attempt scratch; not the historical truncated-prefix null-checkpoint case",
  "webhookOverlapStatus": "applied",
  "applied": 5192,
  "examined": 5192,
  "followUpReads": 1,
  "bulkDirectApplies": 5190,
  "verifiedReplayApplies": 1,
  "ledgerCounts": {
    "initial": 5191,
    "recheck": 5190,
    "agreement": 1,
    "sale": 1,
    "refund": 5,
    "fallback": 1,
    "throttle": 0
  },
  "shopBFacts": 1,
  "lineFactsA": 1000000,
  "liveLineFactsA": 1000000,
  "absentLineFactsA": 0,
  "zeroCurrentLineFactsA": 200000,
  "agreementCountA": 103,
  "refundCountA": 3,
  "graphqlCalls": 10393,
  "adminClassified": {
    "initial": 5191,
    "recheck": 5190,
    "agreement": 1,
    "sale": 1,
    "refund": 5,
    "fallback": 1,
    "poll": 1,
    "scope": 2,
    "shop": 1,
    "other": 0
  },
  "jsonlFetches": 2,
  "merchantSqlCalls": 3258946,
  "controlPlaneEngineRequests": 15664,
  "elapsedMs": 1060381,
  "sampleMs": 250,
  "peakRssBytes": 440074240,
  "peakHeapBytes": 239110640,
  "rssSamples": 3582,
  "heapSamples": 3582,
  "peakScratchBytes": 1507608226,
  "scratchSamples": 3583
}
```

Accounting notes (Cursor):

- Direct helper `runOrderFactsImportStep` executed this envelope. Durable-worker dispatch/retry/receipt tests are the separate **42** exactly-once + D046 and **13** SC-recovery worker-wrapper cases, not this 1e6 process.
- Crash checkpoint **201** is a complete prefix (root 1 = 1 JSONL parent + 200 children), not the historical truncated-null case.
- `verifiedReplayApplies: 1` is that receipted parent on resume. `bulkDirectApplies 5190 + followUpReads 1 + verifiedReplayApplies 1 = 5192`.
- Recheck **5190** equals bulk-direct applies. The overlapping `d-scale-51` webhook drifted to `OrderFactById` (`fallback: 1`) without a ledger recheck.
- Admin classified calls **sum to 10393** (`graphqlCalls`). Independent of `ledgerCounts`.
- SQL: merchant counted at `pg.Client.prototype.query` (includes `BEGIN`/`COMMIT`/`set_config` and C `$queryRaw`). Control-plane counted at `PrismaClient.prototype._request` (one engine request per Prisma operation, not a pg wire-message count). Post-import `countForShop` probes are included if they use `pg.Client`.
- Scratch peak **1507608226** bytes (~1.40 GiB) is a sampled high-water from a **250 ms** synchronous directory walk during the concurrent full import, plus **2633131** bytes sampled at **50 ms** during the crash prefix. Short-lived files between ticks can be missed. Crash leftover inspect saw **109** bytes (namespace marker) and **0** attempt dirs because the crashing process still owned the `att-*` dir and disposed it on unwind; the test then deleted `scratchRoot`. Resume used a fresh unique directory.
- RSS/heap peaks are `process.memoryUsage()` samples, not mathematical bounds.
- Default CI still skips this envelope. GitHub `validate` timeout-minutes remains **120**.

The `1e04ddc` envelope (5,192 initial, 0 rechecks, null crash checkpoint, no scratch-disk peak) remains historical only.

### 15.7 Unexecuted / pending

| Item | Status |
|---|---|
| `npm run graphql-codegen` | **not executed** locally |
| Live Shopify / store calls / production | **not executed** (forbidden) |
| Exact-head `pull_request` Classify + full Heavy + Gate on this SC head | **pending at report write** |
| Independent Claude Code SC review | **not this session**; Cursor must not author that artifact |
| ChatGPT technical acceptance / mark-ready / merge | **not authorized** |
| N-08 independent closure | **not claimed** |

R-176 remains **OPEN / P0**. R-164 unchanged. PR 6 / Phase 1 **IN PROGRESS**. No D-055.

---

## 16. SC-R-01…SC-R-04 control correction (same D-054 — not D-055)

**Authority:** PR #43 comment [5713115882](https://github.com/Vedang1998/Stocky/pull/43#issuecomment-5713115882). Work order `PR43_PR6D_Final_Control_Corrections_Work_Order.md` SHA-256 `d7f6a2f03bab86c7d72370c3e0c071fa4e11ed0bc012d47ac8b1c5d2f5e3da08`. Plan **C3.7** / brief §8 / D-054 subitem. Operator runbook: `PR6_D_SCRATCH_OPERATOR_RUNBOOK.md`. This is implementation/correction evidence only. It is **not** technical acceptance, independent approval, lane closure, mark-ready, merge, or D-055.

### 16.1 Identities and review preservation

| Field | Value |
|---|---|
| Required starting subject **H** | `4768033b6b9c09804a6d417f0bb10ab3e8fdab9b` |
| Required `origin/main` / squash **V** | `a3ff480f1477237f8055f10c43298480a05728a1` |
| Branch / PR | `phase-1/pr6-d-order-webhook-import` / [#43](https://github.com/Vedang1998/Stocky/pull/43) OPEN / DRAFT / UNMERGED |
| SC recovery independent review | `ec61089dcfc0530b81c64bc09fcea7f3b70b7aa5` |
| Review sole parent | **H** `4768033b6b9c09804a6d417f0bb10ab3e8fdab9b` |
| Review path / blob | `stocky-plus/docs/phases/phase-1/PR6_D_SC_RECOVERY_FINAL_INDEPENDENT_REVIEW.md` / `e8525c2fd2778c8baf118d0008a9213b7af4eca8` |
| Integration | `git merge --ff-only ec61089…` onto the D branch. One-file add. Artifact not re-authored. |
| SC-R runtime/test | `1a35bb22faba9c7f8fb1e5fa6e0c1965f276330c` |
| Scale-envelope attribution follow-up | `b2471676d0300487802a6a916eb5546943925cb2` |
| Complete-integration review | `53541112832f8da3dcfa65adea8e9a4447b0f18b` blob `48ac291a781b2347cb6017af862f2de9677826a5` preserved |
| Correction re-review | `a72b403fe3c0ed57fa69d262d7dfbec3d7646292` blob `ba82a3c981cda4bec52ea453c2618319288fa66c` preserved |
| Source-contract review | `7710758b181b5a49f1affa260a56b331adafdf7e` blob `1eb18cae44cdf7a6660256e2632ebc8019d6da0d` preserved |
| Historical exact-head CI on **H** | run [`35168858541`](https://github.com/Vedang1998/Stocky/actions/runs/35168858541) only — H evidence, not this SC-R head |

### 16.2 Finding dispositions

| ID | Severity | Disposition |
|---|---|---|
| SC-R-01 | P2 | **Repaired.** One D parent-operation wrapper covers ledger **and** full-reader fallback. Fallback receives `parentAdmin`, not the raw client. Run-level bulk/poll/scopes are counted separately. `fallbackOrders` ≠ `fallbackTransportAttempts`. Exhaustion is incomplete; no success receipt. |
| SC-R-02 | P2 | **Repaired.** `quota.lock` mkdir + `quota.reservation` ledger. Default omitted `reservedBytes` reserves remaining capacity (one large import). Concurrent reserved sums cannot exceed 2 GiB. Lease expiry does not free bytes. Leftovers occupy capacity. |
| SC-R-03 | P2 | **Repaired.** Sanitized occupancy on `persistOrderFactsCoverageHealth` / `failImport` / SyncHealth. Typed `order_facts_scratch_resource`. Success cannot HEALTHY-clear leftovers. Operator reclaim after quiescence; no auto-reaper. |
| SC-R-04 | P2 | **Repaired.** Digest v2 binds shop, SyncRun, Bulk GID, fingerprint, API, exact fence, job type, parent GID, content. Logical key stays `order-facts-d-import-src-v1:{jobType}:{durableJobId}:{gid}`. v1/legacy receipts require a fresh logical run. A new SyncRun is a new epoch. |
| SC-R-05 | P3 | **Retained** disclosed limitation: no full agreement-membership re-pagination. |
| SC-R-06 | P3 | **Closed with SC-R-01.** Nested B keeps `maxRequests: 250`. Disabling only `dTransportHardStop.throwOnExhaustion` lets nested graphql exceed the wrapper cap; restoring the throw keeps `used` and network attempts ≤ cap. |
| SC-R-07 | P3 | **Retained** nonblocking; malformed/id-less children already fail staging. |
| SC-R-08 | P3 | **Confirmatory only.** SIGKILL during staging leaves bytes and does not complete. Not claimed as a newly invented defect or a newly invented fix. |
| N-08 H-scale/SIGKILL | — | **Preserved** as independent H evidence. Not reopened as missing. New-head envelope is a separate Cursor measurement. |

Original D-R-01/04/05/06/07/08/09/12 remain **RESOLVED**. C3.5 / C3.6 source and recovery policy remain. Accepted A/B/C internals were not rewritten.

### 16.3 Cursor local commands (SC-R tree)

Environment: Node `v22.14.0`, npm `11.5.2`, linux, 4 CPUs, 16 GiB RAM, disposable PostgreSQL accepting, Redis `PONG`. Commands below are Cursor’s, this working tree (runtime `1a35bb22…` / attribution `b2471676…`).

| Command | Exit | Notes |
|---|---|---|
| `npx vitest run app/lib/order-facts` | 0 | **32** files, **313** tests |
| `npx tsc --noEmit` | 0 | — |
| `npm run lint` | 0 | — |
| `npx vitest run --config vitest.migrations.config.ts scripts/tenant-enforcement/tests/pr6-d-sc-recovery.test.ts` | 0 | **20** tests (prior SC-02 suite plus SC-R fallback/exact-budget/v1/fence/leftover/exhaustion) |
| `pr6-d-correction.test.ts` | 0 | **15** |
| `pr6-d-integration.test.ts` | 0 | **24** |
| `pr6-d-worker.test.ts` | 0 | **12** |
| `pr6-d-scale-envelope.test.ts` without `PR6_D_SCALE_1E6` | 0 | **3** passed / **1** skipped |
| `npm run test:sync-exactly-once` | 0 | **42** (**35** + **7** D046) |
| `npm run test:sync-envelope-fail-closed` | 0 | **6** |
| `npm run test:sync-dispatch-recovery` | 0 | **29** |
| `npm run test:tenant-access -- app/tenant/__tests__/job-envelope.test.ts` | 0 | **25** |
| `npm run test:sync-inventory-audit` | 0 | **5** |
| `npm run build` | 0 | — |
| `bash .github/scripts/classify-ci-change-set.test.sh` | 0 | 40/40 assertions |
| `git diff --check` | 0 | — |
| `npm run tenant:access:inventory` / `:check` / `:audit` | 0 | findings **1761**, violations **0**, scannedFiles **506**, digest `22b034454b3ebd48d1ecbb8761f063e065403315731a19a4d3631b5077ff00bc` |
| `npm run sync:inventory:check` | 0 | surfaces=**58**, digest `191b83498733…` |
| `npm run tenant:enforcement:inventory:check` | 0 | fresh |
| `PR6_D_SCALE_1E6=1` envelope on `b2471676…` | 0 | **4** passed; Duration **924.73s**; bash `elapsed_real=925.448` `user=165.554` `sys=47.713` |

`npm run graphql-codegen` was **not executed** locally. Combined correction+integration+worker in one vitest process skipped correction once (`schema "public" does not exist`) because parallel files reset the database; correction re-run **alone** exited 0 with **15** tests.

### 16.4 Independent H-scale evidence (preserved, not reused as this-head proof)

Claude’s independent envelope and SIGKILL recovery at **H** `4768033…` remain accepted for H (N-08). Cursor must not replace those H labels with this-head numbers.

H Cursor envelope on `4fd98ce` (recorded in §15.6): `graphqlCalls` **10393**, `merchantSqlCalls` **3258946**, `peakScratchBytes` **1507608226**, `crashCheckpointOrdinal` **201**, `verifiedReplayApplies` **1**. Exact-head H CI is run `35168858541` only.

### 16.5 Corrected-head envelope (Cursor; runtime `b2471676…`)

Observed JSON (`pr6dScaleEnvelope`) starting `2026-09-17T11:55:03Z`:

```json
{
  "lineFactTarget": 1000000,
  "plannedRoots": 5192,
  "plannedObjects": 1005192,
  "plannedLineFacts": 1000000,
  "childBuckets": { "zero": 101, "small": 4350, "eight": 520, "forty": 221 },
  "warmup": {
    "lineTarget": 1000,
    "roots": 5,
    "elapsedMs": 1274,
    "peakRssBytes": 166215680,
    "peakHeapBytes": 43146240,
    "rssSamples": 25,
    "heapSamples": 25
  },
  "crashPrefixLines": 2000,
  "crashPrefixRoots": 11,
  "crashCheckpointOrdinal": 201,
  "crashScratchPeakBytes": 2633333,
  "leftoverAttemptCountBeforeLoss": 0,
  "leftoverBytesBeforeLoss": 0,
  "interruptKind": "injected Admin throw after the first committed parent on a complete crash-prefix source, then test-operator deletion of that attempt scratch; not the historical truncated-prefix null-checkpoint case",
  "webhookOverlapStatus": "applied",
  "applied": 5192,
  "examined": 5192,
  "followUpReads": 1,
  "bulkDirectApplies": 5190,
  "verifiedReplayApplies": 1,
  "runTransportAttempts": 2,
  "parentTransportAttempts": 10391,
  "fallbackOrders": 1,
  "fallbackTransportAttempts": 3,
  "ledgerCounts": {
    "initial": 5191,
    "recheck": 5190,
    "agreement": 1,
    "sale": 1,
    "refund": 5,
    "fallback": 1,
    "fallbackOrders": 1,
    "fallbackTransportAttempts": 3,
    "throttle": 0
  },
  "shopBFacts": 1,
  "lineFactsA": 1000000,
  "liveLineFactsA": 1000000,
  "absentLineFactsA": 0,
  "zeroCurrentLineFactsA": 200000,
  "agreementCountA": 103,
  "refundCountA": 3,
  "graphqlCalls": 10393,
  "adminClassified": {
    "initial": 5191,
    "recheck": 5190,
    "agreement": 1,
    "sale": 1,
    "refund": 5,
    "fallback": 1,
    "poll": 1,
    "scope": 2,
    "shop": 1,
    "other": 0
  },
  "jsonlFetches": 2,
  "merchantSqlCalls": 3258946,
  "controlPlaneEngineRequests": 15664,
  "elapsedMs": 910992,
  "sampleMs": 250,
  "peakRssBytes": 438947840,
  "peakHeapBytes": 231262696,
  "rssSamples": 3643,
  "heapSamples": 3643,
  "peakScratchBytes": 1509576295,
  "scratchSamples": 3644
}
```

Attribution notes (Cursor, this head — do not relabel the §15.6 H measurements):

- `runTransportAttempts` **2** + `parentTransportAttempts` **10391** = `graphqlCalls` **10393**. The assertion is in `pr6-d-scale-envelope.test.ts`.
- `fallbackOrders` **1** is the overlapping webhook parent. `fallbackTransportAttempts` **3** is that fallback’s Admin calls, not a single GraphQL request.
- Recheck **5190** equals bulk-direct applies. SQL instrumentation is unchanged: merchant at `pg.Client.prototype.query`; control-plane at `PrismaClient.prototype._request`.
- Crash leftover inspect now skips the namespace marker / quota files, so `leftoverBytesBeforeLoss` is **0** (H Cursor inspect recorded **109** marker bytes). Not a claim that H was wrong.
- `peakScratchBytes` **1509576295** is a 250 ms sampled high-water, not quota enforcement. Quota is the reservation ledger.
- RSS/heap peaks are `process.memoryUsage()` samples.

### 16.6 Prior-evidence reuse table

| Evidence | Reuse |
|---|---|
| Independent Claude H-scale / SIGKILL (N-08 at H) | Reuse for **H only** |
| Cursor H envelope `graphqlCalls` 10393 / SQL 3258946 / scratch 1507608226 | Historical H/Cursor; do not overwrite with §16.5 |
| Exact-head CI `35168858541` | **H only** |
| D-R-01…12 / C3.5 remaining proofs / SC-01…04 policy | Reuse; not rebuilt |
| This-head unit/PG/worker/envelope | New; required because quota/transport/receipt changed |

### 16.7 Unexecuted / pending

| Item | Status |
|---|---|
| `npm run graphql-codegen` | **not executed** locally |
| Live Shopify / store calls / production | **not executed** (forbidden) |
| Exact-head `pull_request` Classify + full Heavy + Gate on SC-R head `62f7a06…` | **executed and failed** — preserve run [`35219870613`](https://github.com/Vedang1998/Stocky/actions/runs/35219870613); do not rerun-to-green |
| Exact-head `pull_request` Classify + full Heavy + Gate on the PR43-CI-CLEANUP-01 head | **pending at this docs write**; IDs belong in PR body after the new `pull_request` run, not in this commit |
| Independent Claude Code SC-R + cleanup re-review | **not this session**; Cursor must not author that artifact |
| ChatGPT technical acceptance / mark-ready / merge | **not authorized** |
| N-08 independent closure at this new head | **not claimed**; H evidence stands for H |

R-176 remains **OPEN / P0**. R-164 unchanged. PR 6 / Phase 1 **IN PROGRESS**. No D-055.

### 16.8 PR43-CI-CLEANUP-01 — inherited C disposable Git-fixture teardown

**Authority:** PR #43 comment [5723630213](https://github.com/Vedang1998/Stocky/pull/43#issuecomment-5723630213). Narrow exception on existing draft PR #43 / branch `phase-1/pr6-d-order-webhook-import`. One writer. Not independent acceptance of SC-R-01…04. Not D-055.

This is **not** a claim that Git automatic maintenance caused run `35219870613`. Node 22 `fs.rmSync` retry options and Git `fetch --no-auto-maintenance` were consulted as current official docs (Node `latest-v22.x` / Git fetch options, access date **2026-09-18**). Fixture-local `-c gc.auto=0` / `-c maintenance.auto=false` and fetch `--no-auto-maintenance` are **defensive per-invocation / fixture-repo** controls, not a reproduced causal proof.

#### 16.8.1 Preserved failed exact-head CI (do not relabel)

| Field | Value |
|---|---|
| Head | `62f7a06064bf9eaa5a4a11145bf5dfd369cef726` |
| Event | `pull_request` run [`35219870613`](https://github.com/Vedang1998/Stocky/actions/runs/35219870613) attempt 1 **FAILURE** |
| Classify | [`105197080405`](https://github.com/Vedang1998/Stocky/actions/runs/35219870613/job/105197080405) **SUCCESS** (`docs_only=false` `full_ci=true`) |
| Heavy | [`105197300810`](https://github.com/Vedang1998/Stocky/actions/runs/35219870613/job/105197300810) **FAILURE** (not SKIPPED). Step “Migration and tenant-backfill tests”: **1** failed / **705** passed / **2** skipped |
| Failed test | `pr6-c-b-pin-overlay.safety.test.ts` / `pin fetch is not a substitute for the accepted B SHA` |
| Error | `ENOTEMPTY: directory not empty, rmdir '/tmp/pr6-c-shallow-c-jxvZwT/.git/objects'` |
| CI Gate | [`105221162585`](https://github.com/Vedang1998/Stocky/actions/runs/35219870613/job/105221162585) **FAILURE** (`VALIDATE_RESULT=failure`) |
| Starting-head blobs | safety test `223c0df5e163733b12cae04360b8c402d53b00f7` and helper `eb8cae3c8640f06eacac817d1001a09a7f1dcb85` matched **V** (inherited C fixture, not a D applicator change) |

Do **not** rerun `35219870613` to obtain green. Do **not** `workflow_dispatch`.

#### 16.8.2 Identities for this exception

| Field | Value |
|---|---|
| Required starting head | `62f7a06064bf9eaa5a4a11145bf5dfd369cef726` |
| `origin/main` / squash **V** | `a3ff480f1477237f8055f10c43298480a05728a1` |
| Branch / PR | `phase-1/pr6-d-order-webhook-import` / [#43](https://github.com/Vedang1998/Stocky/pull/43) OPEN / DRAFT / UNMERGED |
| Runtime/test correction | `54cc1ca51a25e0ca8b7483dbaf0049de5eeeeec9` |
| Docs evidence commit | **this commit**; SHA is not embedded here |
| Allowed paths | `scripts/tenant-enforcement/tests/pr6-c-b-pin-overlay.ts`, `scripts/tenant-enforcement/tests/pr6-c-b-pin-overlay.safety.test.ts`, this report. `PR2_TENANT_ACCESS_INVENTORY.md` **not regenerated** (`tenant:access:inventory:check` fresh) |
| D runtime / scale harness vs `62f7a06…` | **byte-identical** (`git diff` empty for `stocky-plus/app` and D test files) |
| Immutable reviews | unchanged (`5354111…`, `a72b403…`, `7710758…`, `ec61089…`) |

#### 16.8.3 Correction (owned roots only)

- Delete only exact disposable roots **created and registered** by this test process. A `pr6-c-shallow-c-` prefix is not ownership.
- Bounded retry: 4 attempts, linear backoff 25 ms × attempt, for `ENOTEMPTY` / `EBUSY` / `EMFILE` / `ENFILE` / `EPERM` (Node 22 `fs.rmSync` transient set). Final absence includes a dangling-symlink `lstat` check.
- Persistent ENOTEMPTY after the budget, and unexpected codes (example `EIO`), still **fail** teardown. No catch-and-pass on disposable Git roots. `removeRegisteredDisposableGitRoots` continues other roots and then reports failures.
- Fixture Git: per-invocation `-c gc.auto=0 -c maintenance.auto=false` and `fetch --no-auto-maintenance` when cwd is not the live `REPO_ROOT`. Local fixture `git config gc.auto 0` / `maintenance.auto false` after `init`. No global/system Git config. No process killing. No `/tmp` sweep.
- Reader/pin/archive/acceptance semantics unchanged (`610ed050…` vs `7338aaa…`, unknown-SHA rejection, nonempty archive, all **15** original safety titles kept).

#### 16.8.4 Reproduction limits

Historical ENOTEMPTY **did not recur** locally. Do not manufacture a reproduction of run `35219870613`.

| Probe | N | Result |
|---|---|---|
| Old teardown `rmSync({ recursive: true, force: true })` after `git fetch --depth=1 origin HEAD` into a fresh `/tmp` shallow repo (no retry, no `--no-auto-maintenance`) | **20** | **20/20 ok**, 0 `ENOTEMPTY` |
| Induced extra writer into `.git/objects` during that `rmSync` | **10** | **10/10 ok**; this is **not** a claim that CI’s writer was this process |

Git automatic maintenance remains a **plausible** source of object-db writes, not a proven cause of job `105197300810`.

#### 16.8.5 Deterministic negative controls

Executed against the cleanup helper (fault seam = injected `removeDirectory`). Restored helper afterwards (`cmp` to pre-mutation file).

| Mutation | Command | Result |
|---|---|---|
| `DISPOSABLE_GIT_ROOT_RM_MAX_ATTEMPTS = 1` | `npm run test:migrations -- …/pr6-c-b-pin-overlay.safety.test.ts -t 'retries a transient ENOTEMPTY then proves the owned root is absent'` | **FAIL** `ENOTEMPTY` (1 failed / 25 skipped). Disabling recovery makes the transient-success test fail. |
| Swallow persistent failure (`return` instead of throw after retries) | same file `-t 'fails teardown after the retry limit for persistent ENOTEMPTY'` | **FAIL** `expected [Function] to throw an error` |

Permanent ENOTEMPTY, unexpected `EIO`, already-removed owned root, unowned prefix, and symlink-root refusal are committed tests that call `removeRegisteredDisposableGitRoot` / `removeRegisteredDisposableGitRoots` directly.

#### 16.8.6 Fixed batch of 10 shallow-fetch/cleanup executions

Predeclared N=10. Recorded every outcome. Not “repeat until green.” Helper: `removeRegisteredDisposableGitRoot` after `isolatedShallowCCheckout` + `ensurePinnedBCommit`. Artifact: `/opt/cursor/artifacts/pr43-ci-cleanup-ten-run.json`.

| i | outcome | ms | pin present | accepted B present | root absent after cleanup |
|---|---|---|---|---|---|
| 1 | ok | 383 | true | false | true |
| 2 | ok | 379 | true | false | true |
| 3 | ok | 378 | true | false | true |
| 4 | ok | 369 | true | false | true |
| 5 | ok | 370 | true | false | true |
| 6 | ok | 375 | true | false | true |
| 7 | ok | 383 | true | false | true |
| 8 | ok | 370 | true | false | true |
| 9 | ok | 381 | true | false | true |
| 10 | ok | 371 | true | false | true |

**10/10 ok.** Pin `610ed050…` materialized; accepted B `7338aaa…` remained absent on the shallow fixture.

#### 16.8.7 Cursor local commands (cleanup tree)

Environment: Node `v22.14.0`, npm `11.5.2`, Git `2.43.0`, linux, disposable PostgreSQL accepting, Redis configured. Subject: working tree then runtime `54cc1ca51a25e0ca8b7483dbaf0049de5eeeeec9`.

| Command | Exit | Notes |
|---|---|---|
| `npm run test:migrations -- …/pr6-c-b-pin-overlay.safety.test.ts` | 0 | **26** passed / 1 file (original **15** + **11** teardown cases). Nonzero; not a name-filter of zero. |
| `npm run test:migrations -- …/pr6-c-b-reader-overlay.test.ts` | 0 | **18** passed. Actual integrated-reader PostgreSQL suite. |
| `npx eslint …/pr6-c-b-pin-overlay.ts …/pr6-c-b-pin-overlay.safety.test.ts` | 0 | focused |
| `npx tsc --noEmit` | 0 | focused typecheck |
| `bash .github/scripts/classify-ci-change-set.test.sh` | 0 | **40/40** assertions |
| `git diff --check` | 0 | — |
| `npm run tenant:access:inventory:check` | 0 | fresh; **no** `PR2_TENANT_ACCESS_INVENTORY.md` rewrite |
| `npm run tenant:enforcement:inventory:check` | 0 | fresh |
| Tracked B `admin-read` | — | **44** `ls-files -s` paths; `orders.ts` blob `b5ce0d53cf29c8b370065330f1a3e84c55c7096d`; porcelain empty; index identical before/after overlay suite |

`PR6_D_SCALE_1E6` was **not** re-run. Existing §16.5 envelope on `b2471676…` remains the Cursor million-line evidence. D scale harness file is unchanged vs `62f7a06…`.

This exception does **not** independently accept SC-R-01…04. ChatGPT PR43 final control correction review remains required after exact-head Classify + full Heavy + Gate SUCCESS on the cleanup head.

### 16.9 PR43-CI-INDEX-01 — inherited F-F03 observation race and failure-path reset isolation

**Authority:** this ChatGPT assignment is an explicit narrow extension of PR #43 comment [5723630213](https://github.com/Vedang1998/Stocky/pull/43#issuecomment-5723630213) on the same writer / same draft PR. No newer GitHub issue comment existed at fetch time. Not a new tooling PR. Not independent acceptance of SC-R. Not D-055.

Allowed paths: `scripts/tenant-indexes/tests/indexes.migration.test.ts` (test-local scheduling / observation / teardown / regression coverage; helpers remain in EX-IDX-014) and this report. Production index helpers, CI/workflows, packages, allowlists, overlay C tests, and D runtime are unchanged.

#### 16.9.1 Preserved failed exact-head CI (do not relabel)

| Field | Value |
|---|---|
| Head | `2084aebdea6505ece536455611a80b30a3e1bd57` |
| Event | `pull_request` run [`35336443725`](https://github.com/Vedang1998/Stocky/actions/runs/35336443725) attempt 1 **FAILURE** |
| Classify | [`105572262202`](https://github.com/Vedang1998/Stocky/actions/runs/35336443725/job/105572262202) **SUCCESS** (`docs_only=false` `full_ci=true`) |
| Heavy | [`105572298557`](https://github.com/Vedang1998/Stocky/actions/runs/35336443725/job/105572298557) **FAILURE** (not SKIPPED). Step “Migration and tenant-backfill tests”: **2** failed / **715** passed / **2** skipped; **1** unhandled rejection |
| CI Gate | [`105587211245`](https://github.com/Vedang1998/Stocky/actions/runs/35336443725/job/105587211245) **FAILURE** |
| Earlier overlay failure (preserved) | run [`35219870613`](https://github.com/Vedang1998/Stocky/actions/runs/35219870613) / Heavy [`105197300810`](https://github.com/Vedang1998/Stocky/actions/runs/35219870613/job/105197300810) |

Do **not** rerun `35336443725` or `35219870613` to obtain green. Do **not** `workflow_dispatch`.

#### 16.9.2 Failure A — F-F03 observation race (distinct from Failure B)

| Field | Observed |
|---|---|
| Test | `DML overlaps active build-scan and validation-scan phases (F-F03), 3 iterations` (**6143ms**) |
| Statement | `AssertionError: expected 'building index: loading tuples in tree' to be 'building index: scanning table'` |
| Stack | `overlapWritesWithActiveScan` `indexes.migration.test.ts:1212` (`expect(after.phase).toBe(targetPhase)`), caller `1266` (build-scan overlap) |
| Iteration 1 | **succeeded** and emitted `tenant_index_active_phase_write_evidence` at `2026-09-18T11:28:36.197Z`. `builderPid` **4155**. `buildDurationMs` **208.921668**. Heap **5324** blocks. Build-scan trigger `blocksDone=125`, after-burst `871`, still `scanning table`. Validation-scan also observed. `loadavg` `[1.87, 1.91, 1.64]`, 4 CPUs, `maintenance_work_mem=1024`, `max_parallel_maintenance_workers=0`. |
| Failure iteration | **2+** (only one evidence event). After-burst sample had already left the required scan for `loading tuples in tree`. `expect(buildSettled).toBe(false)` at 1210 **passed**, so this is **not** the PR #42 Node-settlement race. |
| Relation | PostgreSQL oid **552782** (`Supplier`) |

This is an after-burst same-phase observation race on a cached subsequent CIC (iteration 1 already ~209ms end-to-end). It is **not** classified as an index/migration product defect. Production `buildCreateStatement` remains `CREATE INDEX CONCURRENTLY "Supplier_shopId_idx" ON "Supplier" ("shopId")` and was not edited.

#### 16.9.3 Failure B — leftover CIC vs `DROP SCHEMA` deadlock (distinct)

| Field | Observed |
|---|---|
| Test | `verify fails when indexes were dropped after apply` (**1027ms**) |
| Statement | `PrismaClientKnownRequestError` `resetPublicSchema` line 50 `DROP SCHEMA public CASCADE` |
| SQLSTATE | **40P01** |
| Backend PIDs | **4038** waits for `AccessExclusiveLock` on relation **552782** db **16384**, blocked by **4161**. **4161** waits for `ShareLock` on virtual transaction **3/91353**, blocked by **4038**. |
| Queries | `Process 4038: DROP SCHEMA public CASCADE`. `Process 4161: CREATE INDEX CONCURRENTLY "Supplier_shopId_idx" ON "Supplier" ("shopId")`. Timestamp `2026-09-18 11:28:37.537 UTC`. |
| Unhandled rejection | `Error: Connection terminated` from `pg/lib/client.js` while the latest test was F-F03. |

Disposition: **unfinished F-F03 work leaking past failed-test teardown**, not an independent dropped-index fixture bug and not a harmless cleanup warning. The previous `finally` rolled back gates then `await builder.end()` while CIC was still in-flight, which both (a) produced the unhandled rejection and (b) left backend **4161** holding `ShareUpdateExclusiveLock` so the next test’s schema reset deadlocked.

A later 40P01 at `11:34:56` on `enforcement_fault_a/b` is the existing D-050 adversarial fixture, **not** this index-test leak.

#### 16.9.4 Reproduction limits

Bounded local reproduction of the CI schedule is **not claimed in this commit**. The two causal chains above are taken from the exact Heavy + PostgreSQL logs of job `105572298557`. Do not manufacture a reproduction of run `35336443725`. Local F-F03 / full-file / 10-run batch evidence is recorded after execution; it is not this diagnosis.

#### 16.9.5 Repair (test-local only)

Observation proof (Failure A) — evidence equivalence:

| Previous assertion | Replacement | Equivalence |
|---|---|---|
| After-burst `after.phase === targetPhase` | Concurrent sampler on a dedicated client; require `isActiveScanSample(targetPhase)` samples whose `[sampledAtNs, sampledEndNs]` **intersect** the INSERT/UPDATE/DELETE window | Same required phases (`building index: scanning table` and `index validation: scanning table`), independently observed during the write window, not a later `loading tuples in tree` / `scanning index` substitute |
| `phaseAtWriteStart` copied from the pre-write trigger | Labels attached only from intersecting in-window active-scan samples | Copied trigger labels alone now **fail** (`copied_trigger_phase_is_not_independent_overlap`) |
| After-burst `blocksDone` strictly greater than trigger | In-window (or still-in-phase after) counters must advance vs trigger (`omitted_progress_evidence` otherwise) | Still requires remaining-work counters, not phase-text-only |
| `buildSettled === false` before/after burst; 15s write limit; ShareUpdateExclusiveLock; no AccessExclusiveLock; 3 iterations; `valid_exact` / `indisvalid` / `indisready` | **preserved** | Unchanged acceptance |
| After-burst phase may now be a later build phase | Recorded in evidence, **not** used as overlap proof | Later phase without in-window scan samples **fails** (`wrong_or_finished_phase`) |

Teardown (Failure B):

- Track every owned client/PID and the CIC promise, including partial `open()` failure.
- On success **and** assertion failure: stop the sampler, `pg_cancel_backend` **only the owned builder PID**, roll back owned gates, await CIC settlement or expected cancellation (`57014` / canceling statement / Connection terminated) within 8s, close every owned client even if a prior cleanup step failed, then verify no owned activity / progress / Supplier locks remain before the next `DROP SCHEMA`.
- Preserve the original assertion error; append cleanup failures. Persistent remainder stays red. No `pg_terminate_backend`, no unrelated-process kill, no retry-`DROP SCHEMA`-until-green, no catch-and-pass.

#### 16.9.6 Negative controls (committed with the harness)

- Wrong/finished phase or no in-window overlap (CI `loading tuples` after-burst with copied trigger labels).
- Blocked write (`durationMs >= 15000`) and `AccessExclusiveLock` during the window.
- Omitted progress (in-window scan sample with no counter advance).
- Leftover owned CIC activity/progress/locks block schema reset; idle non-builder leftovers are not CIC remainder.
- Injected early assertion while the builder is parked in `waiting for writers before build`: leftover CIC remainder is observed, cleanup must cancel and clear it, then `resetPublicSchema` must succeed. The original dropped-index negative test still follows.

#### 16.9.7 Identities for this exception

| Field | Value |
|---|---|
| Required starting head | `2084aebdea6505ece536455611a80b30a3e1bd57` |
| `origin/main` / squash **V** | `a3ff480f1477237f8055f10c43298480a05728a1` |
| Branch / PR | `phase-1/pr6-d-order-webhook-import` / [#43](https://github.com/Vedang1998/Stocky/pull/43) OPEN / DRAFT / UNMERGED |
| D runtime / scale harness / overlay C / immutable reviews vs `2084aeb…` | **must remain byte-identical** |
| Local 10-run batch / full-file / lint / inventory | **pending execution after this coherent push**; fill with actual commands and counts, never relabel prior measurements |

R-176 remains **OPEN / P0**. R-164 unchanged. No D-055. Actual Claude Code correction re-review remains required and must include this index-test change.
