# Phase 1 PR6-A — Foundation Closure

**Status:** `PR6-A FOUNDATION ACCEPTED / MERGED / CLOSED` (repository-foundation lane only)
**PR 6 overall:** `IN PROGRESS`
**Phase 1:** `IN PROGRESS`
**PR6-B / PR6-C:** `AUTHORIZED` after this admission record — complete-module work on separate branches from **M**
**PR6-D runtime:** `NOT AUTHORIZED`
**Production:** `NOT AUTHORIZED`
**Merchant production data:** `NOT AUTHORIZED`
**Shopify writes / inventory writes:** `NOT AUTHORIZED`
**Inventory-write flags:** `DEFAULT OFF`
**`read_all_orders` / `write_orders`:** `NOT AUTHORIZED`

This report freezes PR6-A repository-foundation identity after the accepted, independently reviewed, squash-merged, and post-merge-validated PR [#37](https://github.com/Vedang1998/Stocky/pull/37). It is **not** a new runtime decision, **not D-055**, **not** PR 6 completion, and **not** Phase 1 completion.

D-054 remains the implementation authority.

The Emergency Continuity Sprint **Monday 7 September 2026** internal/controlled operational target is **missed**. This closeout does **not** re-date that target.

Do **not** edit any immutable independent-review artifact.

## Foundation scope (closed)

PR6-A landed the shared order/refund fact foundation only:

- additive Prisma schema and migrations (`20260907010000_pr6_a_order_refund_fact_foundation`, successor `20260907020000_pr6_a_order_refund_existence_coherence`);
- tenant / RLS / role / immutability registration for the new merchant-domain tables;
- observation-generation reuse of `stocky_catalog_observation_gen_seq` (no second sequence);
- `OrderFactObservationInFlight` lifecycle constraints;
- order-domain lock-key derivation and transaction-scoped advisory-lock primitive;
- types-only `app/lib/order-facts/{types,constants,lock-key,advisory-lock}.ts`;
- nullable-first `Shop.ianaTimezone` / `Shop.currencyCode`;
- exact-money-capable columns and diagnostic lineage needed by later B/C.

Out of scope and **not** started by PR #37: Admin GraphQL extraction, bulk JSONL ingest, webhook fact application, the canonical apply engine, reconciliation, compatibility-projection writers, UI, PR6-D integration, production, or flag enablement.

## Identities

| Field | Value |
|---|---|
| PR | [#37](https://github.com/Vedang1998/Stocky/pull/37) — **CLOSED / MERGED** |
| Merged at | `2026-09-11T20:07:27Z` |
| Merged by | `Vedang1998` |
| Accepted merged subject head | `f7a39c3664a8a45b7a7cd3055079b4ebc888bb02` |
| Accepted subject tree | `9e5a700b0f4a3b0d9b7f0638bd431e0daea029dc` |
| Previous `origin/main` / squash parent | `09feffd3f36eb4698f2ed8a152efe414cd9b77bd` (PR #34 squash) |
| Squash merge **M** / current `origin/main` | `bdbb5bba91ac8af82e49a99e36cce5db8b401c68` |
| `M` parent count | 1 — sole parent `09feffd3f36eb4698f2ed8a152efe414cd9b77bd` |
| `git rev-parse M^{tree}` | `9e5a700b0f4a3b0d9b7f0638bd431e0daea029dc` (equals accepted subject tree) |
| ChatGPT technical acceptance | **ACCEPT PR6-A FOUNDATION** — [issuecomment-5638553192](https://github.com/Vedang1998/Stocky/pull/37#issuecomment-5638553192) |
| Owner squash-merge authorization | Same comment; squash merge only at that exact head against `09feffd3…` |
| B/C dispatch addendum | [issuecomment-5639320213](https://github.com/Vedang1998/Stocky/pull/37#issuecomment-5639320213) — does **not** merge; already-resolved product dispositions |
| Corrected D-readiness disposition | [issuecomment-5639842776](https://github.com/Vedang1998/Stocky/pull/37#issuecomment-5639842776) — preparation evidence only |
| Owner merge-identity verification | [issuecomment-5640040968](https://github.com/Vedang1998/Stocky/pull/37#issuecomment-5640040968) — identities satisfied; post-merge CI was then pending |
| Technical-authority heading | **D-054** (EFFECTIVE; remains the implementation authority; **no D-055**) |
| Foundation state | **ACCEPTED / MERGED / CLOSED** for the repository-foundation lane |

## Independent reviews (never edit)

| Artifact | Blob at **M** | Verdict |
|---|---|---|
| `PR6_A_FOUNDATION_INDEPENDENT_REVIEW.md` | `198e55548a2ca09942843798a9ebd3e03a30d0fa` | `CORRECTIONS REQUIRED` (P0=0 / P1=0 / P2=1 / P3=3) |
| `PR6_A_FOUNDATION_CORRECTION_INDEPENDENT_REVIEW.md` | `da388c5d2ffa8bc0e04312de9c14a831b5ba4010` | **`APPROVE PR6-A FOUNDATION CORRECTION`** |

Correction implementation identity `917080a3df47eb932e10b865bb4a7b018a5e7482` and independently reviewed correction head `1f615c516ff4db927fb641bb96418dd217fe3a22` are ancestors of the accepted subject `f7a39c36…`. The squash **M** tree equals that accepted subject tree.

## Planning reviews preserved at **M** (never edit)

| Artifact | Blob at **M** |
|---|---|
| `PR6_EMERGENCY_ORDER_REFUND_FACTS_PLAN_INDEPENDENT_REVIEW.md` | `d72340c01dd9c662d0e8bb4aa8d43482940470d9` |
| `PR6_EMERGENCY_ORDER_REFUND_FACTS_PLAN_CORRECTION_INDEPENDENT_REVIEW.md` | `fca2b260d03e3105782ed216f7773c53e6aef2a7` |
| `PR6_CURRENT_MAIN_FINAL_INDEPENDENT_REVIEW.md` | `4f5ea10f6d36175d3540cb977a8f3543f36c15c2` |

## CI

### Pre-merge exact-head PR CI (accepted subject `f7a39c36…`)

Evidence for the accepted PR head. **Not** a substitute for exact-**M** push CI.

| Field | Value |
|---|---|
| Workflow | CI |
| Event | `pull_request` |
| Run | [`34137287606`](https://github.com/Vedang1998/Stocky/actions/runs/34137287606) |
| Head | `f7a39c3664a8a45b7a7cd3055079b4ebc888bb02` |
| Conclusion | **SUCCESS** |
| Classify change set | `101791087231` SUCCESS |
| Heavy (`Lint, typecheck, test, build, Prisma, GraphQL`) | `101791122346` SUCCESS |
| CI Gate | `101806131016` SUCCESS |

### Post-merge exact-**M** main CI (admission)

| Field | Value |
|---|---|
| Workflow | CI |
| Event | `push` (merge to `main`) |
| Run | [`34642536795`](https://github.com/Vedang1998/Stocky/actions/runs/34642536795) |
| Head | `bdbb5bba91ac8af82e49a99e36cce5db8b401c68` (**M**) |
| Conclusion | **SUCCESS** |
| Classify change set | `103405479267` SUCCESS |
| Full Heavy (`Lint, typecheck, test, build, Prisma, GraphQL`) | `103405514450` SUCCESS (not SKIPPED) |
| CI Gate | `103422700596` SUCCESS |

## Risk disposition from this closure

| Risk | Disposition |
|---|---|
| R-176 | **OPEN / P0.** PR6-A **representability** is satisfied (kinds + successor CHECKs independently approved). Window-apply, two-confirmation revival, webhook/import, and reconcile obligations remain on C/D. Do **not** close R-176. |
| R-164 | **OPEN / P3** unchanged. This closeout does not alter DELETE privilege, RLS, or tombstone contract. |
| R-166 … R-175, R-177 … R-185 | Remain **OPEN** at approved severities. No other risk is closed here. |

## Explicit non-authorization

- Production remains **NOT AUTHORIZED**.
- Merchant production data remains **NOT AUTHORIZED**.
- Shopify writes, inventory mutations, `read_all_orders`, and `write_orders` remain **NOT AUTHORIZED**.
- Every inventory-write flag remains **DEFAULT OFF**.
- `FEATURE_PR5_ABSENCE_TOMBSTONE` remains **DEFAULT OFF**.
- No D-055.
- PR6-D runtime remains **NOT AUTHORIZED**.
- This closeout does not start C or D runtime by itself. B/C complete-module authorization is recorded in `PR6_BC_EXECUTION_BRIEF.md` after this admission.

## Related records

- Implementation report: `PR6_A_FOUNDATION_IMPLEMENTATION_REPORT.md` (historical live status on accepted head said re-review pending; this closeout overwrites live identity)
- Execution brief: `PR6_BC_EXECUTION_BRIEF.md`
- Decisions: `../../DECISIONS.md` D-054 item 24
- Risks: `../../RISK_REGISTER.md`
