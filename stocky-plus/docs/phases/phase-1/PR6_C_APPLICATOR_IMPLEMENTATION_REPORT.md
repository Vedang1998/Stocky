# Phase 1 PR6-C — Order / Refund Canonical Applicator Implementation Report

**Slice:** PR6-C complete-module canonical order/refund applicator
**Branch:** `phase-1/pr6-c-order-fact-applicator`
**Authority:** D-054 **EFFECTIVE** (no D-055); ChatGPT B/C addendum [5639320213](https://github.com/Vedang1998/Stocky/pull/37#issuecomment-5639320213); admission [5640728436](https://github.com/Vedang1998/Stocky/pull/37#issuecomment-5640728436)
**Status:** Implementation on this branch. Independent Claude review and ChatGPT complete-module acceptance are **pending**. Merge is **not** authorized.
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
| Squash **M** / `origin/main` at branch creation | `bdbb5bba91ac8af82e49a99e36cce5db8b401c68` |
| **M** sole parent | `09feffd3f36eb4698f2ed8a152efe414cd9b77bd` |
| `M^{tree}` | `9e5a700b0f4a3b0d9b7f0638bd431e0daea029dc` (equals accepted subject tree) |
| Correction review at **M** | `PR6_A_FOUNDATION_CORRECTION_INDEPENDENT_REVIEW.md` blob `da388c5d2ffa8bc0e04312de9c14a831b5ba4010` — `APPROVE PR6-A FOUNDATION CORRECTION` |
| Original A review blob | `198e55548a2ca09942843798a9ebd3e03a30d0fa` |
| Planning review blobs at **M** (never edit) | `d72340c01dd9c662d0e8bb4aa8d43482940470d9`, `fca2b260d03e3105782ed216f7773c53e6aef2a7`, `4f5ea10f6d36175d3540cb977a8f3543f36c15c2` |
| Exact-M **push** CI | run [34642536795](https://github.com/Vedang1998/Stocky/actions/runs/34642536795) `event=push` `head=bdbb5bba…` **SUCCESS** |
| B admission comment | [5640728436](https://github.com/Vedang1998/Stocky/pull/37#issuecomment-5640728436) body starts `PR6_BC_ADMISSION_READY`, user `cursor[bot]`, created `2026-09-11T21:15:39Z` |
| Control commit (docs-only, parent = **M**) | `4a5478dd0daa658ffd2d50cce4a33571cb0ab6f6` on `phase-1/pr6-b-order-admin-read` |

C started from **M**, not from B runtime. B later commits on `phase-1/pr6-b-order-admin-read` are not this lane’s base. C does not edit B’s shared-control files.

## 2. Exclusive C ownership

**Owned**

- `stocky-plus/app/lib/order-facts/apply/**` including module-local unit tests
- `stocky-plus/scripts/tenant-enforcement/tests/pr6-c-canonical-applicator.test.ts`
- `stocky-plus/docs/phases/phase-1/PR6_C_APPLICATOR_IMPLEMENTATION_REPORT.md` (this report)
- Mechanical scanner exception: `stocky-plus/docs/phases/phase-1/PR2_TENANT_ACCESS_INVENTORY.md` (`scannedFiles` 372 → 392 only; findings 1741; violations 0; digest unchanged; no unused allowlist entries)

**Not owned / not edited**

- Prisma schema and migrations
- A types/constants/locks (`app/lib/order-facts/types.ts`, `constants.ts`, `lock-key.ts`, `advisory-lock.ts`)
- B `admin-read/**` and generated `app/types/**`
- Shared control docs (`PROJECT_STATUS.md`, `DECISIONS.md`, `RISK_REGISTER.md`, `PR6_BC_EXECUTION_BRIEF.md`, `PR6_A_CLOSURE_REPORT.md`, phase README, `ACCELERATED_SAFE_DELIVERY.md`)
- Webhook/worker/import, Shopify config, packages, CI workflows, global test configs
- Allowlist files (no unused exception added)

Mechanical CI exception, if required after scanner: regenerate `stocky-plus/docs/phases/phase-1/PR2_TENANT_ACCESS_INVENTORY.md` only because new apply TypeScript files change `scannedFiles`. Do not add unused allowlist entries.

## 3. What the applicator does

`applyOrderFacts(db, input)` applies already-authoritative Order/Refund observations inside an open tenant transaction. The caller owns COMMIT/ROLLBACK. There is no Shopify network I/O.

`applyOrderFactsWithRetry(begin, input)` retries `order_apply_unique_conflict` / `order_advisory_lock_timeout` only by rolling back and starting a **fresh** PostgreSQL transaction. No in-process unique retry. No `ON CONFLICT DO UPDATE`. No savepoint recovery.

Supported identities locked: Order GID and nested Refund GIDs only — never every line. Refund jobs lock Order **and** Refund even when no local Order row exists. Keys are ordered ascending `(key1, key2)` via the frozen A primitive `acquireOrderIdentityAdvisoryLock` / `stocky-pr6-canonical-lock-v1`. Capacity uses the frozen catalog evaluator.

Kill switch: runtime cannot `SELECT "Shop"`. Apply calls granted helper `stocky_shop_processing_enabled(text)`.

Receipt: `SyncApplicationReceipt` insert is the **final** write (`ATOMIC_APPLICATION_RECEIPT`); `ON CONFLICT DO NOTHING`. Duplicate same digest short-circuits. Digest mismatch fails closed.

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

Default-discovered `app/lib/order-facts/apply/*.test.ts` are database-free. PostgreSQL suites live only in `scripts/tenant-enforcement/tests/pr6-c-canonical-applicator.test.ts`.

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
| T50 | bypass | Unit + PG scope downgrade voids absence |
| T55 | + | Unit + PG documented RETURN quantity −2 |
| T56 | + | PG two complete refund snapshots both persist (apply side) |
| T57 | − | PG incomplete nested walk → `SNAPSHOT_PAGINATION_INCOMPLETE`; no facts |
| T58 | + | Unit + PG mixed ORDER+RETURN on one agreement does not set `UNIT_SALE_SIGN_INCONSISTENT` |
| Revival | + | PG two-step revival; first confirmation does not overwrite `#ORIG` |
| Refund w/o Order | + | PG complete refund stands without local Order row |
| Independent refund clock | + | PG stale order + newer nested refund still applies |
| Kill switch | − | PG `processingEnabled=false` fails closed via helper |
| R-164 surface | − | PG + unit no physical-delete operation |
| First-insert ABSENT | − | Unit + PG writes no row |

**Not C:** T02, T19, T20, T30 reader, T39, T52, T53 (B). T21, T22, T24, T32, T33, T37, T43 webhook/import orchestration, T51 (D). T56/T57 **reader pagination** remains B.

## 6. Local validation (executed)

Recorded after commands execute. This documentation snapshot does **not** invent results and does **not** embed its own commit SHA.

Environment: disposable PostgreSQL 16 / Redis on localhost, `DATABASE_URL` pointing at local `stocky_plus`, `STOCKY_RUNTIME_ROLE_PASSWORD=stocky_runtime_ci_only` (CI allowlist secret, not committed). Inventory-write flags unchanged. Generated Admin schema (`app/types/admin-*.schema.json`) is gitignored and was materialized locally with `npm run graphql-codegen` before `npm test`.

Runtime/test implementation head for the commands below: `18a2f68a8a0b3a7733a4f176cd38d0129bbf1ec8` (inventory freshness, T14 RLS count, kill-switch observation-before-disable). Prior C commits on this branch: `af790529a917affef91add15e97ad888613c6032` (applicator), `7d0f99a194ff0dc1513db5a1059e7c127c6f7669` (typecheck). This report is a later C-owned documentation commit on the same exclusive files.

| Command | Exit | Result |
|---|---|---|
| `npx vitest run app/lib/order-facts/apply/*.test.ts` | 0 | **33** passed / 5 files |
| `npx vitest run app/lib/order-facts` | 0 | **52** passed / 8 files |
| `npx tsc --noEmit` | 0 | no errors |
| focused eslint on `app/lib/order-facts/apply` + `pr6-c-canonical-applicator.test.ts` | 0 | no errors |
| `npm run lint` | 0 | no errors |
| `npm run typecheck` (`react-router typegen && tsc --noEmit`) | 0 | no errors |
| `npm run test:migrations -- scripts/tenant-enforcement/tests/pr6-c-canonical-applicator.test.ts` | 0 | **49** passed / 1 file (nonzero; collected 49) |
| `npm run tenant:access:audit` | 0 | `scannedFiles: 392`, `findings: 1741`, `violations: 0` |
| `npm run tenant:access:inventory` + `tenant:access:inventory:check` | 0 | regenerated `scannedFiles` 372 → 392; findings 1741; violations 0; content digest still `d4fc40275641ec9a16904e210bf37b7c0d3cfb89cf89227b592842c9788ee771`; check `tenant_access_inventory_fresh` |
| `npx tsx scripts/pr5-f3-safety-scan.ts` | 0 | `filesScanned: 169`, `findings: []` |
| `npm run graphql-codegen` | 0 | Admin 2026-07 schema + types written under gitignored `app/types/` |
| `npm test` (after codegen) | 0 | **425** passed / 47 files |
| `npm run build` | 0 | `react-router build` succeeded |
| Full `npm run test:migrations` (entire tenant-enforcement corpus) | — | **not executed locally**; required on exact-head full CI |
| exact-head `pull_request` Classify + Heavy + CI Gate | — | **not** recorded in this file. Authoritative run IDs belong to the live PR head after this documentation commit is pushed. Do not treat superseded failed/cancelled runs as exact-head success. |

Superseded `pull_request` CI (not substituted for the live head):

- Run [34651762649](https://github.com/Vedang1998/Stocky/actions/runs/34651762649) — failure (earlier C head).
- Run [34651974372](https://github.com/Vedang1998/Stocky/actions/runs/34651974372) on `7d0f99a194ff0dc1513db5a1059e7c127c6f7669` — Classify `103435982023` SUCCESS; Heavy `103436042861` FAILURE at tenant-enforcement preflight (`tenant:access:inventory:check_failed_exit_1`); CI Gate `103436575673` FAILURE. Cause: new apply TypeScript files raised `scannedFiles` 372 → 392. Corrected at `18a2f68a8a0b3a7733a4f176cd38d0129bbf1ec8`.
- Run [34652494303](https://github.com/Vedang1998/Stocky/actions/runs/34652494303) — cancelled (superseded).

Mechanical inventory exception: `PR2_TENANT_ACCESS_INVENTORY.md` only. No unused allowlist entries. No A/B/shared-control edits.

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

## 9. Packet for ChatGPT

Issued only after local focused suites pass **and** exact-head pull_request Classify + full Heavy + CI Gate SUCCESS on this branch head. Until those exist, this lane is **not** `READY FOR CHATGPT PR6-C COMPLETE-MODULE REVIEW`.
