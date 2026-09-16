# Phase 1 PR6-D — Complete Integration Execution Brief

**Status:** `PR6-D COMPLETE INTEGRATION ADMITTED AFTER VERIFIED GATES`
**Branch:** `phase-1/pr6-d-order-webhook-import`
**PR:** one new DRAFT PR for this complete module (number not predetermined; do not reuse PR #39 / #40 / #41 / #42)
**Risk tier:** A
**Decision owner:** ChatGPT
**Authority:** PR [#40](https://github.com/Vedang1998/Stocky/pull/40) comment [5673830675](https://github.com/Vedang1998/Stocky/pull/40#issuecomment-5673830675)
**Work order:** `PR6_D_Complete_Integration_Work_Order.md` SHA-256 `3cf9d0d752b732836311cafd5072c45a63fa8ea74119b36d3ed06eaa7a0f2f49`
**Base / squash V:** `a3ff480f1477237f8055f10c43298480a05728a1`
**Parent U:** `1ec7af31f1a6ffd1c0c1d9b4bcd28043c5516505`
**`V^{tree}` / accepted-C tree:** `ba55f5d5d138911aca83fd715e6f2c8a455e9917`
**D-054:** EFFECTIVE — remains the implementation authority (**no D-055**)
**PR 6 / Phase 1:** **IN PROGRESS**
**Production / merchant data / Shopify writes / inventory writes / flag enablement / live subscription registration / deployment:** **NOT AUTHORIZED**
**Monday 7 September 2026 target:** **missed** (not re-dated)

This brief records the approved D execution contract. It does **not** add product decisions. It is **not** a completion claim.

## 1. Exact base and admission

D branches from **V** only. Do not branch from unmerged historical B/C implementation or parked PR #41.

Independently verified before this brief:

1. PR #40 CLOSED/MERGED from accepted final head `88251df1d22639c021aa083bfb953c50dd6bc8a1`; **V** is its squash; sole parent **U**; tree equals the accepted final head.
2. Current `origin/main` is **V**.
3. PR #39 CLOSED/MERGED at **U**; retained B review blobs match.
4. Exact-V **push** run [`34921292975`](https://github.com/Vedang1998/Stocky/actions/runs/34921292975): Classify `104229798042` SUCCESS; full Heavy `104229820630` SUCCESS (not SKIPPED; Migration and tenant-backfill tests SUCCESS; Build SUCCESS); CI Gate `104241657531` SUCCESS.
5. No competing D implementation writer/PR. PR #41 remains parked tooling. D-readiness branch `claude/pr6-d-integration-readiness-8vs1ar` is not a D runtime writer.

This checkpoint is documentation-only. Runtime starts only after this commit is published.

## 2. Exclusive D ownership

Implement the approved §17.2 D ownership:

- `app/lib/order-facts/sync/**`: orchestration, production B-to-C mapping, observation lifecycle, bounded import and reconciliation helpers and pure unit tests.
- D order-domain worker modules under `app/jobs/workers/order-facts/**` if needed; keep resource kinds order-domain siblings.
- Three new order-domain webhook routes using repository naming conventions.
- Existing `app/jobs/workers/webhook-processor.ts` and actual worker/scheduler dispatch registration required to call D (minimal additive wiring only).
- `app/sync/sanitize.server.ts`, `app/tenant/job-envelope.server.ts`, `app/sync/execution-strategy.server.ts`, and `scripts/sync-control-plane/manifest.ts`: exact additive D registrations; frozen legacy projections retained.
- Minimal existing scope-update, reconciliation scheduling and health-domain wiring required for D. No broad refactor or new platform framework.
- `shopify.app.toml`: the three approved webhook topic/route declarations only. Requested scopes and API version unchanged. No live registration/deployment.
- PostgreSQL/Redis D integration suites in `scripts/tenant-enforcement/tests/pr6-d-*.test.ts`, using the existing serialized migration config. Pure `app/lib/order-facts/**/*.test.ts` tests stay database-free.
- D reports/brief/closure records and necessary live controls; mechanical existing inventories regenerated from the actual tree.

Preserve A schema/migrations/constraints/grants and B `admin-read/**` and C `apply/**` internals. Import accepted APIs. A newly demonstrated missing primitive that requires widening those boundaries is a precise blocker.

No `.github` redesign, package/global-test-config changes, allowlist expansion, F-F03 cleanup, unrelated `/tmp` cleanup, catalog-enum widening, forecast/ABC/PO/receiving work, AI, billing, public branding changes, or later-phase runtime.

## 3. Testable runtime outcome

1. **Signals / coherent registration.** Keep `orders/create`, `orders/cancelled`, `refunds/create` v1 sanitizers, line arrays, persisted schema versions, and legacy consumption. Add `orders/edited`, `orders/delete`, `order_transactions/create` identity-only projections. Topic declarations, routes, sanitizer dispatch, envelope validation, strategy registration, and worker dispatch arrive in the same review boundary. Dispatch on persisted `payloadSchemaVersion`. No catalog-style global version fence on the three frozen v1 topics. `order_transactions/create` is not a PENDING source; refetch settlement-bearing facts.
2. **Real B-to-C mapping.** Execute merged B readers through the same trusted installed-app context as B's granted-scope query, then map into accepted C inputs. Persist D-owned `OrderFactObservationInFlight` using existing tenant/sequence machinery. Request generation precedes resource I/O; response generation follows a complete response. No Shopify I/O while canonical/advisory locks are held. B `null_observed` is neutral query evidence. Construct absence/inaccessibility from authoritative query outcome, retained fact history, and trusted scope continuity. Missing/stale/downgraded continuity denies destructive absence. Do not overwrite established tombstones with inaccessible. Preserve C/A unverified-delete shape. Persist Shop timezone/currency through the authorized tenant path without widening control-plane column grants.
3. **Legacy compatibility / exactly-once.** For new unreceipted legacy-topic deliveries, preserve legacy effects while adding the canonical path. C owns receipt-bearing canonical application inside the caller's tenant transaction; apply the permitted legacy handler only when the operation was not already applied; commit only after both required effects succeed. Existing pre-D receipts are not replayed to duplicate legacy effects or retroactively labelled canonical-complete. Canonical catch-up uses rebuildable import/reconciliation.
4. **Large-order quarantine recovery.** Keep >250-line sanitizer bounds and `job:null`. Recover through bounded coalesced shop-wide complete in-window sweeps, including orders behind the incremental watermark. Out-of-window cases remain unresolved.
5. **Historical/incremental import.** Bulk A orchestration and **C3 per-order** agreement/sale/refund ledgers (not edited/refund-bearing-only). Bulk B disabled. Bulk C rejected. Run both B gates (GraphQL schema validity and bulk eligibility) before calling the existing audited bulk-query submitter as read-job transport. Default inner QUERY is the **D-owned** Bulk A projection (`sync/bulk-a-query.ts`), fingerprinted separately from frozen B `ORDER_FACTS_BULK_A_ORDERS_LINES`. No store submission in this assignment. Spool/index/validate JSONL on D-owned scratch **before** C apply. Parent closure is indexed membership after EOF. Persist checkpoints only for committed accepted work on a revalidated epoch. Old fingerprints are not transferable.
6. **Reconciliation and health.** Durable `order-facts-sync` and `order-facts-reconcile` jobs. Exhaustive eligible updated-order sweeps repair missed in-window events; samples detect drift only. Mirror merchant diagnostics to `DataIssue` through authorized control-plane code only. Never report HEALTHY over unresolved required coverage.
7. **Cancellation / off switches.** Check processing/installation authority at intake/claim, before external work where applicable, and before canonical apply. Preserve C's post-lock recheck. No inventory-write flag is enabled.

## 4. Tests and evidence

Map ALL D-owned plan §19 cases and corrected readiness transitions/crash boundaries in `PR6_D_IMPLEMENTATION_REPORT.md`. Required proof includes actual merged B → production D mapper → actual C → disposable PostgreSQL; durable job/receipt and interruption recovery; 300-line quarantine recovery including watermark-behind orders; complete import and reconciliation; scope/window/identity safeguards; query/memory bounds.

Do not use the copied-type C compatibility mapper as the production integration proof. Do not delete or skip tests to pass. F-F03 failure still fails CI.

## 5. Stop conditions

Stop when the complete authorized D module is review-ready, or on a concrete admission/contract/resource/scope blocker that cannot safely be resolved. Ordinary in-scope failures are corrected in the same assignment.

Independent Claude review and a later ChatGPT merge decision remain required. Cursor must not certify its own independent approval.

## 6. Source-contract correction checkpoint (same D-054 — not D-055)

**Authority:** PR [#43](https://github.com/Vedang1998/Stocky/pull/43) comment [5692110528](https://github.com/Vedang1998/Stocky/pull/43#issuecomment-5692110528).

**Plan record:** `PR6_EMERGENCY_ORDER_REFUND_FACTS_PLAN.md` **C3**.

| Field | Value |
|---|---|
| Prior | Quantity-equals-child-count closure; 64-root duplicate ring; mid-stream apply; frozen Bulk A plus invented `confirmed`/empty-complete agreements; follow-up only for edited or refund-bearing roots; scale = JSONL objects |
| New | Validated scratch staging; indexed EOF membership closure; D Bulk A selects actual `confirmed`, with-code discounts, and required nullable fields; queried ledger for **every** imported order; scale ≥ 1,000,000 **canonical order-line facts** |
| Reason | Claude re-review D-R-02 unresolved; D-R-03/10/11 partial. ChatGPT chose staging + actual reads rather than a C contract change |
| Merchant impact | No certification of truncated/mis-parented bulk; ordinary orders receive real agreement/refund evidence; `confirmed` is inventory reservation |
| Technical impact | Per-order Admin ledger; worker-local scratch; new query fingerprint |
| Migration impact | None (no schema) |
| Tradeoffs | Higher request count vs silent empty ledgers; disk vs RAM assembly |
| Acceptance | C3.5 tests; N-01…N-09 preserved; exact-head Classify + full Heavy + Gate |
| Out of scope | D-055; B/C internals; production; store calls; flags; A/B/C reopen |

This brief still does **not** add product decisions beyond the ChatGPT-owned C3 contract. It is **not** a completion claim.
