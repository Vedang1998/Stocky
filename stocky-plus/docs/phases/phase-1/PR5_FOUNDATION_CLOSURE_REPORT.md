# Phase 1 PR5-F1 — Foundation Closure

**Status:** `PR5-F1 FOUNDATION ACCEPTED / MERGED / FROZEN`
**PR 5 overall:** `IN PROGRESS`
**Phase 1:** `IN PROGRESS`
**Downstream PR5 runtime lanes:** `NOT STARTED` — eligible only when ChatGPT separately defines Accelerated Safe Delivery lanes
**Production:** `NOT AUTHORIZED`
**Merchant production data:** `NOT AUTHORIZED`
**Shopify inventory mutations:** `NOT AUTHORIZED`
**Inventory-write flags:** `DEFAULT OFF`

This report freezes the PR5-F1 foundation in the live control records after the accepted, independently reviewed, squash-merged, and post-merge-validated PR [#27](https://github.com/Vedang1998/Stocky/pull/27). It is **not** a new runtime decision, **not** D-055, **not** PR 5 completion, and **not** Phase 1 completion.

D-054 remains the implementation authority.

## Foundation scope

PR5-F1 landed the shared canonical fact foundation only:

- canonical fact schema and additive migration;
- tenant / RLS / role / immutability registration for the new merchant-domain tables;
- observation-generation sequence and USAGE-only privileges;
- observation lifecycle constraints;
- canonical identity lock-key derivation;
- transaction-scoped advisory-lock primitive;
- lock-capacity evaluator and PostgreSQL settings reader.

Out of scope and **not** started: Shopify extraction, GraphQL ingest, bulk JSONL, webhook fact application, the canonical apply engine, reconciliation, compatibility-projection writers, UI, PR 6, or any later PR5 runtime lane.

## Identities

| Field | Value |
|---|---|
| PR | [#27](https://github.com/Vedang1998/Stocky/pull/27) — **CLOSED / MERGED** |
| Accepted base / previous `origin/main` | `ae1b428039152efc6b4a46107e1bcca5eb17586a` (PR #26 squash merge) |
| Initial independently reviewed runtime head | `7cea26ca1199326a600eed2662af5959c47d6bc5` |
| Initial independent review | `stocky-plus/docs/phases/phase-1/PR5_FOUNDATION_INDEPENDENT_REVIEW.md` (never edit) |
| Initial review commit | `1f561cff9c35f667b37792e75c42be6390d7bb25` |
| Initial review blob | `7161c481baf597d54bf57e745f9c06d8812d7468` |
| Initial independent-review finding counts | P0 0 / P1 1 / P2 2 / P3 7 — verdict `CORRECTIONS REQUIRED` |
| Correction implementation identity | `63e157d918a408c155cbfea3ae9996bbb35006c2` |
| Final reviewed / accepted review-record head | `56c764d00f8350cf22e8b37acf5c61a5b5757e7b` |
| Correction independent re-review | `stocky-plus/docs/phases/phase-1/PR5_FOUNDATION_CORRECTION_INDEPENDENT_REVIEW.md` (never edit) |
| Correction re-review commit before squash | `56c764d00f8350cf22e8b37acf5c61a5b5757e7b` |
| Correction re-review blob | `4b73536057fdb43e8f470385fd58b786c522edbe` |
| Correction re-review verdict | **`APPROVE PR5-F1 FOUNDATION CORRECTION`** |
| Final findings | P0 0 / P1 0 / P2 0 / P3 4 |
| ChatGPT technical acceptance | **ACCEPT PR5-F1 FOUNDATION** under D-054 |
| Explicit user merge authorization | User authorized squash merge of PR #27 |
| Squash merge / current `origin/main` | `7827e535415c9acbacfbbb4bdedff08be6650d5c` |
| Merge timestamp | `2026-08-17T13:48:17Z` |
| Technical-acceptance authority | **D-054 — Phase 1 PR 5 implementation authorization under Accelerated Safe Delivery v1** (EFFECTIVE; remains the implementation authority) |
| Foundation state | **ACCEPTED / MERGED / FROZEN** |

Do **not** edit either independent review artifact.

## Acceptance

- Initial independent verdict: `CORRECTIONS REQUIRED` (P0:0 P1:1 P2:2 P3:7)
- Correction independent verdict: `APPROVE PR5-F1 FOUNDATION CORRECTION` (P0:0 P1:0 P2:0 P3:4)
- ChatGPT: **PR5-F1 technically accepted**
- User authorized squash merge of PR #27
- This closure report records merge/freeze identity under D-054. It does **not** create D-055, start a downstream PR5 runtime lane, or authorize production.

## CI

### Pre-merge final exact-head PR CI (`56c764d0…`)

| Field | Value |
|---|---|
| Workflow | CI |
| Event | `pull_request` |
| Run | [`31988065401`](https://github.com/Vedang1998/Stocky/actions/runs/31988065401) |
| Head | `56c764d00f8350cf22e8b37acf5c61a5b5757e7b` |
| Conclusion | **SUCCESS** |
| Classify change set | `95266433114` SUCCESS |
| Heavy (`Lint, typecheck, test, build, Prisma, GraphQL`) | `95266463137` SUCCESS |
| CI Gate | `95274109133` SUCCESS |

### Post-merge main CI (`7827e535…`)

| Field | Value |
|---|---|
| Workflow | CI |
| Event | `push` (merge to `main`) |
| Run | [`32036740386`](https://github.com/Vedang1998/Stocky/actions/runs/32036740386) |
| Head | `7827e535415c9acbacfbbb4bdedff08be6650d5c` |
| Conclusion | **SUCCESS** |
| Classify change set | `95408642308` SUCCESS |
| Full Heavy validation | `95408670595` SUCCESS |
| CI Gate | `95417341718` SUCCESS |

## P3 dispositions from the correction re-review

| ID | Disposition |
|---|---|
| NEW-CLAUDE-PR5F1C-01 | **OPEN as R-162** — lock-capacity evaluator direct-input safe-integer hardening. Must be resolved before a downstream worker relies on untrusted/directly configured evaluator inputs. The PostgreSQL settings reader already rejects unsafe values. Do **not** reopen PR5-F1. |
| NEW-CLAUDE-PR5F1C-02 | **OPEN as R-163** — canonical read-boundary mutation scanner / module discovery hardening. The downstream admin-read/query-boundary lane must make production module enumeration recursive and mutation safety semantic/deny-by-default as required by the PR5 brief. Do **not** reopen PR5-F1. |
| NEW-CLAUDE-PR5F1C-03 | **RESOLVED BY THIS DOCS CLOSEOUT** — stale live “D-054 conditional” parenthetical. No long-lived risk. |
| NEW-CLAUDE-PR5F1C-04 | **OPEN as R-164** — canonical fact physical-delete surface versus tombstone-only runtime contract. Mandatory acceptance gate for the canonical applicator lane. Do **not** close R-164 in this docs PR. Do **not** weaken tenant/RLS architecture. |

## Existing risks that remain OPEN

Foundation primitives alone do not close these risks.

| Risk | Status after PR5-F1 freeze |
|---|---|
| R-157 | **OPEN** — sequence primitive/privileges landed; remain OPEN until all allocation paths and regressions are verified |
| R-158 | **OPEN** — canonical apply engine not yet implemented |
| R-159 | **OPEN** — observation schema exists; downstream abandonment/apply writers pending |
| R-160 | **OPEN** — lock primitive exists; must prove every canonical writer uses it |
| R-161 | **OPEN** — deployment/concurrency capacity evidence still required |

## Explicit non-authorization

- Production remains **NOT AUTHORIZED**.
- Merchant production data remains **NOT AUTHORIZED**.
- Shopify inventory mutations remain **NOT AUTHORIZED**.
- Every inventory-write flag remains **DEFAULT OFF**.
- No D-055.
- No PR 6.
- No downstream PR5 runtime implementation is started by this closeout.

Downstream PR5 runtime is now allowed **only** through separately defined Accelerated Safe Delivery lanes. ChatGPT must define those lanes. Cursor must not invent them.

## Next action

Return to ChatGPT for closeout acceptance and merge decision on this documentation PR.

After this closeout is merged, ChatGPT may authorize separately owned PR5 runtime lanes under Accelerated Safe Delivery v1. Do **not** start any downstream PR5 runtime branch from this closeout.
