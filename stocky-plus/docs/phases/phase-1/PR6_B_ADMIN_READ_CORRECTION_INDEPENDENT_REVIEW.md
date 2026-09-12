# PR #39 / PR6-B — focused independent correction re-review (Admin READ)

**Reviewer:** Claude Code (independent) · **Scope:** focused correction re-review of F-CLAUDE-PR6B-01…11
**Repository:** `Vedang1998/Stocky` · **PR:** [#39](https://github.com/Vedang1998/Stocky/pull/39) · **Branch:** `phase-1/pr6-b-order-admin-read`

**Verdict: `APPROVE PR6-B ADMIN READ CORRECTION`** — P0 0 / P1 0 / P2 0 / P3 1 (new, residual, dispositioned).

Technical approval only. **Not merge authorization**, not PR6-C acceptance, and not PR6-D/production authorization.

---

## 1. Identity, state and delta — independently recomputed

| | Verified value |
|---|---|
| Corrected subject (PR head) | `610ed0503a3aa2998aca7228f4fca9617bed23a3` |
| Previously reviewed subject | `d9717f68ea981aa68f108428a31d7726d0ba2a8f` |
| Base / squash **M** (`origin/main`) | `bdbb5bba91ac8af82e49a99e36cce5db8b401c68` |
| `git merge-base main subject` | `bdbb5bba…` — equals M |
| Ahead / behind | **9 ahead / 0 behind** |
| Total PR paths vs M | **55** (`git diff --name-only` count; GitHub `changed_files` 55) |
| PR state | **OPEN / DRAFT / UNMERGED**, `mergeable_state: clean` |

`origin/main` is unmoved at `bdbb5bba…`. No push superseded the subject: the newest `pull_request` CI run is on this exact head.

**Correction delta from `d9717f68…` — four commits, as authorized:**

| Commit | Content |
|---|---|
| `59f469a` | Immutable B independent review artifact (1 file, +638) |
| `b4b8282` | Consolidated runtime correction, F-01…F-10 (32 files, all under `admin-read/`) |
| `08d699d` | Mechanical `PR2_TENANT_ACCESS_INVENTORY.md` refresh (2 lines) |
| `610ed05` | Report + shared-control addendum + `DECISIONS.md` item 25 + status/README |

Enumerated every delta path. The delta touches **only** `stocky-plus/app/lib/order-facts/admin-read/**` and `stocky-plus/docs/**`. A negative scan for `package*.json`, lockfiles, `.github/**`, `prisma/**`, migrations, `schema.prisma`, `shopify.app.toml`, `*.toml`, codegen/tsconfig/vite config, webhook and flag paths returned **zero hits**. No A contract, no A schema/types/locks, no C runtime, no D runtime, no CI, no dependency, no scope, no flag change.

**Immutable artifacts — all blobs byte-identical at the corrected subject:**

| Artifact | Expected blob | Observed |
|---|---|---|
| `PR6_B_ADMIN_READ_INDEPENDENT_REVIEW.md` (source `59f469a1…`) | `b4533610b5af305816aef5434b884c3065b06f94` | **match** |
| `PR6_EMERGENCY_ORDER_REFUND_FACTS_PLAN_INDEPENDENT_REVIEW.md` | `d72340c01dd9c662d0e8bb4aa8d43482940470d9` | **match** |
| `PR6_EMERGENCY_…_PLAN_CORRECTION_INDEPENDENT_REVIEW.md` | `fca2b260d03e3105782ed216f7773c53e6aef2a7` | **match** |
| `PR6_CURRENT_MAIN_FINAL_INDEPENDENT_REVIEW.md` | `4f5ea10f6d36175d3540cb977a8f3543f36c15c2` | **match** |
| `PR6_A_FOUNDATION_INDEPENDENT_REVIEW.md` | `198e55548a2ca09942843798a9ebd3e03a30d0fa` | **match** |
| `PR6_A_FOUNDATION_CORRECTION_INDEPENDENT_REVIEW.md` | `da388c5d2ffa8bc0e04312de9c14a831b5ba4010` | **match** |

My original **CORRECTIONS REQUIRED** review and its recorded severities are unedited and remain the baseline.

---

## 2. Exact-head CI — verified at source, not inherited

Run [`34669708517`](https://github.com/Vedang1998/Stocky/actions/runs/34669708517): `event=pull_request`, `head_sha=610ed050…`, `run_attempt=1`, conclusion **SUCCESS**.

| Job | ID | Result |
|---|---|---|
| Classify change set | `103488632065` | **SUCCESS** |
| Lint, typecheck, test, build, Prisma, GraphQL (full Heavy) | `103488650664` | **SUCCESS — executed, 146 steps, not SKIPPED** |
| CI Gate | `103494551526` | **SUCCESS** |

I downloaded the full log archive and read the gate values rather than trusting the summary:

- Classify: `docs_only=false`, `full_ci=true`, `classification_reason=non_docs_or_unknown_path`.
- CI Gate: `classify_result=success`, `validate_result=success`, `full_ci=true`, `docs_only=false`, `CI Gate SUCCESS: full validate succeeded`.
- Heavy genuinely ran schema generation (step 129 `GraphQL codegen / schema validation`) and the B tests (step 141 `Unit tests`).
- Heavy unit step, log line 7813–7814: **`Test Files 52 passed (52)` / `Tests 511 passed (511)`**.

Old run `34651155935` (on `d9717f68…`) and superseded run `34650235398` (on `3031119…`) are baseline only and were not used as evidence.

---

## 3. Local reproduction — isolated environment, real B exports

Node v22.22.2, npm pinned to the repo-required 11.5.2, `npm ci` clean, codegen materialized **before** schema/unit tests.

| Command | Exit | Independently observed result |
|---|---:|---|
| `npm run graphql-codegen` | 0 | clean; `admin-2026-07.schema.json` generated |
| `npx vitest run app/lib/order-facts/admin-read` | 0 | **10 files / 119 tests passed** |
| `npm test` | 0 | **52 files / 511 tests passed** |
| `npm run lint` | 0 | clean |
| `npm run typecheck` | 0 | clean |
| `npm run build` | 0 | clean |
| `npx tsx scripts/pr5-f3-safety-scan.ts` | 0 | `filesScanned 186, findings []` |
| `npm run tenant:access:inventory:check` | 0 | fresh (`scannedFiles 416, findings 1741, violations 0`) |
| `git diff --check bdbb5bb..610ed05` | 0 | clean |

Every PR-body claim reproduces exactly. Counts were not assumed: I enumerated per-file results and confirmed **all ten** B files execute individually — `bulk-query-schema` 20, `correction` 56, `cursor-pagination` 5, `decimal` 4, `documents` 5, `money` 5, `mutation-safety` 6, `orders` 13, `static-safety` 3, `tenant` 2 = **119**.

**CI-only coverage cited, not re-run:** the PostgreSQL suites (tenant isolation, migration/backfill `60 files / 467 tests`, sync control-plane) ran green in Heavy `103488650664`. No PostgreSQL is available in my environment, and the work order forbids inflating counts with unrelated historical architecture.

**Own counterexamples.** I wrote and executed **52 independent probes** against the real B exports and the real generated 2026-07 schema — 34 reader probes and 18 bulk-validator probes — none derived from the vendor's fixtures. All 52 pass. Scratch probes were deleted before this artifact was committed; the tree is clean.

---

## 4. Finding-by-finding adjudication

### F-CLAUDE-PR6B-01 — P1 — required `Order.refunds` fabricated as empty → **RESOLVED**

`required-list.ts` `requireObjectList` rejects any non-array and any null / non-object / nested-array entry as `MALFORMED_ENVELOPE`; `assertUniqueNonEmptyGids` rejects missing, empty, non-string and duplicate refund GIDs as `IDENTITY_MISMATCH`. Both are **invoked**, not merely defined — `orders.ts:486,491`.

My probes confirm that absent field, explicit `null`, `{}`, a connection-shaped object, a string, a number and a boolean each produce a typed failure with `resourceKind: "Order"`, `phase: "refunds"` — **never** `status: "complete"`. A genuine `refunds: []` still yields a complete snapshot with an empty collection. Transport/GraphQL error separation is preserved: `envelope.ts` routes non-empty `errors` to `ADMIN_READ_ERROR` and envelope defects to `MALFORMED_ENVELOPE`, distinct outcomes.

### F-CLAUDE-PR6B-02 — P1 — mixed-version snapshots reported complete → **RESOLVED**

`snapshot-pin.ts` introduces **two independent** pin types. `OrderClockPin` = `{gid, updatedAt, currencyCode}` taken from the authoritative first response; `RefundClockPin` = `{gid, updatedAt}` taken from the first page of that Refund's own walk. Comparison is exact **validated timestamp string** equality — no `Date` conversion, raw evidence not rewritten. `assertRefundClockPin` compares a Refund only against its own pin; it never requires `Refund.updatedAt == Order.updatedAt`, and `correction.test.ts` plus my own probe confirm an independently newer valid Refund is accepted rather than rejected for a stale Order Clock A.

Checks are invoked on every continuation: line and agreement continuations (`orders.ts` → `requireOrderContinuation` → `assertOrderClockPin`), agreement-sales continuations (`agreements.ts:96`, which also re-selects and re-checks `updatedAt` **and** `currencyCode`), refund child continuations (`refunds.ts:260`), and the bounded final version recheck (`orders.ts:507`, `refunds.ts:406`) counted in the shared request budget.

The header is mapped from the first response and every child is pinned to it — there is no first-header/last-children or last-header/first-children hybrid. My probe confirms `updatedAt` drift and `currencyCode` drift during continuation both fail closed, **including drift observed on the final recheck** (`phase: "version_recheck"`).

**T19 verified, not inherited:** 300 lines at page size 100 → **four** `OrderFactById` calls (three pages + one bounded recheck), 300 unique line records, `cost.requests === 4`. **Positive control passes:** one line of quantity ten yields a complete one-record snapshot. A repository-wide grep confirms `subtotalLineItemsQuantity` / `currentSubtotalLineItemsQuantity` are only *validated and carried*, never compared to `lineItems.length` anywhere in the module.

The report describes the mechanism accurately — first-page pin, repeated identity/currency evidence, bounded recheck — and does **not** claim server snapshot isolation.

### F-CLAUDE-PR6B-03 — P2 — shrinking child collection reported complete → **RESOLVED**

`cursor-pagination.ts` fails closed on missing/non-object `pageInfo`, non-boolean `hasNextPage`, non-string `endCursor`, missing `edges` array ("missing/null/object/scalar is not an empty page"), empty page while `hasNextPage`, `hasNextPage` without `endCursor`, missing edge node, and missing/empty edge cursor. `requireNonEmpty` rejects a promised continuation that arrives empty. `assertAdvancingCursor` rejects a repeated cursor rather than looping or skipping. Cross-page GID dedup is enforced for lines, agreements, sales, adjustments and transactions.

My probes confirm a shrinking collection, an empty promised continuation, a changed header/currency, a duplicate cursor and a disappearing selected root after prior presence all yield `SNAPSHOT_PAGINATION_INCOMPLETE`. No silent truncation; no infinite restart — traversal is bounded by distinct-cursor enforcement and by `executeBudgetedQuery`, through which every request passes.

A genuinely restarted independent Refund walk discards earlier partial children: `mapEmbeddedOrContinueRefund` delegates to `readCompleteRefundSnapshot`, which rebuilds from `after: null` into fresh accumulators; the truncated embed's rows are never carried forward.

### F-CLAUDE-PR6B-04 — P2 — every null collapsed to `INACCESSIBLE_HISTORY_WINDOW` → **RESOLVED**

`INACCESSIBLE_HISTORY_WINDOW` and `REFUND_OUTSIDE_ACCESSIBLE_WINDOW` no longer appear anywhere in B's runtime, and `static-safety.test.ts:38` now *guards* against their reintroduction. **B no longer adjudicates existence** — stored history, durable scopes and absence adjudication remain C/D.

`nullObservedResult` is reachable **only** from a well-formed, error-free initial explicit-null selected root, and returns exactly `{status: "null_observed", resourceKind, requestedGid, queryCompleted: true, nodeReturned: null, phase: "initial", cost}`. My probe asserts the shape and that no `detail` field is present.

Everything else is excluded, as I verified individually: missing `data` key, `data: null`, non-object `data`, missing selected root key, non-object root, non-array `errors`, and non-empty `errors` each produce `MALFORMED_ENVELOPE` or `ADMIN_READ_ERROR`; authentication/transport failures produce `TENANT_DENIED`/`ADMIN_READ_ERROR`. Null after positive presence, and null while completing an embedded refund, are `SNAPSHOT_PAGINATION_INCOMPLETE`.

Structured fields survive nested propagation: `OrderFactReadWalkError` carries `kind`/`reason`/`resourceKind`/`requestedGid`/`phase`, `walkErrorToResult` merges them, and the typed `OrderReadPhase` union spans all twelve walk phases including `options`, `tenant` and `version_recheck`. **Consumers never need to parse English `detail`** — my probes discriminate every outcome using `status`/`kind`/`reason`/`phase`/`resourceKind` alone.

### F-CLAUDE-PR6B-05 — P2 — inaccessible refund classified as a pagination failure → **RESOLVED**

`readRefundFact` returns `null_observed` with `resourceKind: "Refund"` for an **initial** explicit-null refund; it is not a pagination failure. Confirmed by my own probe. Only a null observed *after* positive presence — the truncated-embed continuation path — is `SNAPSHOT_PAGINATION_INCOMPLETE`, which is correct. B makes no confirmed-absence claim.

### F-CLAUDE-PR6B-06 — P2 — bulk validator false PASS and lost depth across fragments → **RESOLVED** (one P3 residual, below)

`bulk-operation-rules.ts` now walks the **single executable operation** and only the fragments reachable from it. `atRoot`, `connectionDepth` and the resolved parent type are threaded through both named and inline fragment spreads, so root context, type context and connection depth are preserved.

Executed against the **real generated 2026-07 schema**, my 18 counterexamples — including the originals that produced the false PASS — all behave correctly:

- a named fragment hiding top-level `nodes`, and an inline fragment hiding top-level `node`, are **caught** (`hasTopLevelNodeOrNodes: true`, ineligible);
- a nested `node` inside a connection edge is correctly *not* a top-level node;
- three-level depth hidden across two fragment spreads reports `maxDepth: 3` and is rejected — the fragment form and the inline-equivalent form return **identical** `maxDepth`, `eligible` and connection counts;
- aliases hide neither a connection nor a top-level `node` (the real field name is used);
- a fragment reused at two sites counts once per executed site;
- an **unused** fragment's six connections are **not** counted (1 connection observed, not 7) — and the separate `specifiedRules` schema gate independently rejects the unused definition, demonstrating the two gates separately;
- fragment cycles, undefined spreads, inapplicable type conditions, unknown fields and a traversal bound all set `unresolved` and can never return `eligible: true`;
- malformed input is ineligible rather than throwing;
- **multiple executable operations are rejected**, not silently aggregated or selected (`connections: []`);
- >5 connections and zero connections are rejected.

Bulk B remains disabled (`BULK_B_PRODUCTION_ENABLED = false`); there is no `bulkOperationRunQuery` and no submit path anywhere in the module. No validation result is described as an executed Shopify bulk acceptance, and no store submission occurred.

### F-CLAUDE-PR6B-07 — P3 — `restocked` and `location { id }` never selected → **RESOLVED**

Both are now selected in the standalone `RefundFactById` selection (`documents.ts:387-390`), the embedded Order selection (`documents.ts:670-673`) and the bulk candidate document (`bulk-query-documents.ts:242-245`). Mapping preserves nullability without inventing defaults: `restocked: optionalBoolean(...)`, `restockLocationId: optionalString(node.location?.id)`. The report and addendum both state these are restock signals, **not** sale-location or inventory-write authority.

### F-CLAUDE-PR6B-08 — P3 — no explicit refund-line ordinal → **RESOLVED**

`refundLineOrdinal` is assigned at push time from the running per-refund accumulator length, in both the complete-embed path and the paginated walk. Verified by reading the code and by probe:

- **never reset by page** — a five-row refund walked at page size 2 yields ordinals `[0,1,2,3,4]`;
- **never collapsed on null IDs** — three distinct null-ID rows retain three distinct ordinals (dedup is gated on `if (item.id)`, and `allowNullNodeId` permits the rows);
- **never global across refunds** — the accumulator is local to each refund walk;
- duplicate non-null identities and duplicate cursors still fail closed.

Enclosing-order lineage is correct: `applyRefundParentLineage` fills `orderId` from the authenticated enclosing Order GID for embedded refunds, **fails** on a contradictory returned parent GID, and leaves a standalone unknown parent as `null` rather than guessing or string-casting. A missing local parent row is documented as distinct from an unknown authoritative parent GID.

### F-CLAUDE-PR6B-09 — P3 — unvalidated `pageSize` / `maxRequests` → **RESOLVED**

`read-options.ts` `resolveReadOptions` runs **before any transport** (`orders.ts:284`, ahead of the first fetch) and rejects non-number, `NaN`, `±Infinity`, fractional, zero, negative, unsafe-magnitude, and out-of-range values (`pageSize > 250`, `maxRequests > 250`) as `INVALID_READ_OPTIONS` with `phase: "options"`. My twelve probes confirm every one of these rejects with **zero recorded transport calls**.

### F-CLAUDE-PR6B-10 — P3 — negative / unsafe `lineItem.quantity` accepted → **RESOLVED**

`requireNonnegativeGraphqlInt` validates the signed-32-bit GraphQL `Int` range and rejects negatives; it guards `lineItem.quantity`, `currentQuantity`, `refundableQuantity`, `unfulfilledQuantity`, `nonFulfillableQuantity`, `refundLineItem.quantity` and both order-level quantity sums. `Sale.quantity` correctly uses `optionalSignedGraphqlInt`, preserving signed nullable values — the source comments the contract explicitly ("Do not abs() or ban negatives"). No `abs()` repair, no integer rounding, no unsafe conversion exists in the module.

Per the work order I did **not** reopen the already-adjudicated raw decimal-text boundary. B still preserves exact source text and C remains the decimal-semantics boundary; money field/currency integrity tests are intact (`money.test.ts`, 5 tests) and no lossy normalization was introduced.

### F-CLAUDE-PR6B-11 — P3 — PR body contradicted the recorded admission → **RESOLVED**

The PR body now states "C's separately authorized lane is **in correction**, not globally unauthorized" and "B cannot implement C on this branch" — consistent with `DECISIONS.md` item 24 and the new item 25. The body makes **no** independent-approval or merge claim: it records DRAFT/UNMERGED status pending independent re-review, ChatGPT acceptance and explicit user merge authorization, and lists the local gates as claims rather than approval.

**Correction addendum** (`PR6_BC_EXECUTION_BRIEF.md`, additive, merged plan not weakened) preserves every required control: neutral query evidence, same-snapshot quantity authority (SalesAgreement/Sale remains the sole unit ledger; refund-line quantities are not a second one), absent-local-row versus unknown-parent-GID distinction, first-observation catalog-link source limitation, canonical `withCodeDiscounts: true` mapping with both aliases retained, and all D / non-production boundaries. `read_all_orders` and the live refund-bearing-order ratio remain **UNVERIFIED**; R-176 stays **OPEN / P0**; R-164 unchanged; no D-055.

---

## 5. Regression review of the correction itself

No regressions found.

- **No weakened fixtures or tests.** Every deletion in the modified test files is a contract change the correction required: the fixed 3-call T19 expectation was replaced by the stronger 4-call assertion, and the T41 `INACCESSIBLE_HISTORY_WINDOW` assertions were replaced by `null_observed` exactly as directed. The sales-page mock gained `id`/`updatedAt`/`currencyCode` because the new pin check demands them — strengthening, not weakening.
- **Tenancy intact.** `tenant.ts` changes only attach `phase: "tenant"` to the existing `TENANT_DENIED` error; `assertTrustedOrderAdminReadContext` behaviour is unchanged and is still called before transport in every public reader.
- **Transport hardened.** `execute.ts` now rejects a non-object JSON envelope and a non-array `errors` before use; `budgeted-execute.ts` propagates structured extras. `shop.ts` and `access-scopes.ts` correctly classify an explicit null as `ADMIN_READ_ERROR` rather than `null_observed`, since `null_observed` is restricted to Order/Refund.
- **Budget bounded.** Every request passes through `executeBudgetedQuery`, which refuses at `cost.requests >= maxRequests`; combined with distinct-cursor enforcement, no walk can spin.
- **Module safety.** `mutation-safety.test.ts` and `static-safety.test.ts` pass; the F3 safety scan is clean over 186 files; no DML of facts/observations/`SalesDailyAggregate`/Prisma from B modules.

---

## 6. New finding

### NEW-CLAUDE-PR6B-C01 — **P3** — duplicate fragment names are silently last-wins in the rule gate considered alone

- **File / line:** `stocky-plus/app/lib/order-facts/admin-read/bulk-operation-rules.ts:279-284`
- **Evidence:** `fragments.set(definition.name.value, definition)` overwrites an earlier definition of the same name without diagnosis. Reproduced: for a document declaring `fragment D on Order` twice, `evaluateBulkOperationRules` returns `eligible: true` and counts `["orders","lineItems"]` — the *second* definition — rather than reporting an ambiguity.
- **Merchant impact:** **none.** No merchant-visible path exists.
- **Reproduction:** spread `...D` from a query, declare `fragment D on Order { id }` and `fragment D on Order { lineItems(first: 1) { edges { node { id } } } }`, call `evaluateBulkOperationRules`.
- **Expected behaviour:** either diagnose the duplicate name as `unresolved`, or document that name uniqueness is delegated to the schema gate.
- **Disposition — accepted residual.** The separate, mandatory `specifiedRules` gate (`assertQuerySchemaValid`) rejects such a document via `UniqueFragmentNames`; I verified `validate(...)` returns errors for exactly this input. Bulk B is disabled, there is no `bulkOperationRunQuery` and no submit path, so no document can reach a store from this branch. This does not meet P2 and does not block approval.
- **Missing test:** a `bulk-query-schema.test.ts` case asserting the schema gate rejects duplicate fragment names, with a comment recording that the rule gate delegates name uniqueness.

---

## 7. Coverage, limitations and safety state

**Mandatory B gates supported by executed evidence:** required-list rejection; independent per-resource Clock A pinning across all continuations and the bounded final recheck; neutral initial-null evidence; malformed-versus-incomplete separation; fragment-aware bulk validation; restock extraction and per-refund ordinals; option validation before transport; nonnegative-versus-signed quantity domains; cross-lane wording.

**Limitations, stated plainly:**

1. **No live store call and none authorized.** The live refund-bearing-order ratio and `read_all_orders` remain **UNVERIFIED**. R-176 stays **OPEN / P0**.
2. **No PostgreSQL locally.** The PostgreSQL suites are cited from Heavy `103488650664`, not re-executed here.
3. **Reader-level evidence only.** These are vitest unit/mock tests over the real B exports. They do not prove C apply, D webhook, import or reconcile behaviour. I did **not** treat C's committed copied-type mapper tests as execution of B; C's separate obligation to run the real B reader through mocked transport into C/PostgreSQL is unaffected by this review and remains outstanding.
4. **Two-clock consistency is a contract, not server snapshot isolation.** An Order header and an independently restarted Refund can in principle be observed at different Shopify versions; the final Order recheck catches any Order-visible drift. This is the approved design (ChatGPT `5642819080`: "Preserve independent Order/Refund clocks") and the report describes it without overclaiming.
5. Bulk eligibility results are **static validation only** — never an executed Shopify bulk acceptance.

**Safety state.** PR #39 head unchanged at `610ed050…`; `main` unchanged at `bdbb5bba…`; PR #40 untouched. No edit to either implementation branch, to any immutable review, to A contracts, to CI, to dependencies, to scopes or flags, and nothing in production. No Shopify merchant call, no mutation, no bulk submission. No merge, rebase, force-push or mark-ready action. No new Actions run was triggered by me. Scratch probes deleted; working tree clean.

---

## 8. Verdict

All eleven original findings are **RESOLVED** with executed proof rather than asserted labels. No regression was introduced by the correction. One new **P3** residual is recorded above with an explicit justified disposition and a named missing test. Original severities and the original CORRECTIONS REQUIRED evidence remain immutable.

**`APPROVE PR6-B ADMIN READ CORRECTION`**

Technical approval of the B Admin READ correction only. This is **not** merge authority, **not** PR6-C acceptance, and **not** authorization for PR6-D, production, merchant data, store calls, Shopify or inventory writes, scope additions, or flag enablement.
