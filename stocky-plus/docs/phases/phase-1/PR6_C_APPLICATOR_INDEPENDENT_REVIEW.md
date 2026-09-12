# PR #40 / PR6-C — independent Tier-A implementation review of the canonical order/refund applicator

**Reviewer:** Claude Code (independent adversarial reviewer; not an implementation owner)
**Review date:** 2026-09-12
**Verdict:** `CORRECTIONS REQUIRED` — **P0 0 / P1 6 / P2 2 / P3 4**

This artifact is immutable. It records identities, executed evidence, and
findings reproduced against real PostgreSQL. It is not product authority and
does not authorize PR6-D, merge, flag enablement, or scope addition.

---

## 1. Reviewed identities

| Item | Value | Verified |
|---|---|---|
| Subject PR | #40 — "Phase 1 PR6-C — order/refund canonical applicator" | OPEN / DRAFT / UNMERGED, `mergeable_state: clean` |
| Subject branch | `phase-1/pr6-c-order-fact-applicator` | matches |
| Exact subject head | `04a3e276c9d607e440051603e54e7c96dc9ad19f` | live PR head equals pinned head; no later push |
| Base / current main **M** | `bdbb5bba91ac8af82e49a99e36cce5db8b401c68` | squash of PR #37, sole parent `09feffd3f36eb4698f2ed8a152efe414cd9b77bd` |
| Scope vs M | **4 ahead / 0 behind, 22 changed paths** | matches expectation exactly |
| B admission/control commit | `4a5478dd0daa658ffd2d50cce4a33571cb0ab6f6` | present; **docs-only** (0 non-`stocky-plus/docs/` paths) |
| B reference subject | `d9717f68ea981aa68f108428a31d7726d0ba2a8f` (`phase-1/pr6-b-order-admin-read`, PR #39) | matches |

C's four commits: `af79052` (implement) → `7d0f99a` (typecheck fixes) →
`18a2f68` (freshness / T14 / kill-switch order) → `04a3e27` (validation evidence).
C branches from **M**, not from B runtime — confirmed.

### 1.1 Admission ordering

| Event | Timestamp (UTC) |
|---|---|
| PR #37 merged to M | 2026-09-11T20:07:27Z |
| Exact-M push CI `34642536795` (`event=push`, `head_sha=bdbb5bba…`) | SUCCESS, completed 21:08:00Z |
| Control commit `4a5478dd…` (docs-only) | 21:15:07Z |
| `PR6_BC_ADMISSION_READY` comment `5640728436` (cursor[bot]) | 21:15:39Z |
| C's **first runtime commit** `af79052` | 21:56:23Z |

Admission precedes C's first runtime commit. PR37 decision/admission comments
`5638553192`, `5639320213`, `5639842776`, `5640040968`, `5640728436` all exist
and are consistent; none was invented.

### 1.2 Unchanged pinned blobs

All five required blobs are byte-identical on the C subject tree:

| Blob | Path |
|---|---|
| `d72340c01dd9c662d0e8bb4aa8d43482940470d9` | `PR6_EMERGENCY_ORDER_REFUND_FACTS_PLAN_INDEPENDENT_REVIEW.md` |
| `fca2b260d03e3105782ed216f7773c53e6aef2a7` | `PR6_EMERGENCY_ORDER_REFUND_FACTS_PLAN_CORRECTION_INDEPENDENT_REVIEW.md` |
| `4f5ea10f6d36175d3540cb977a8f3543f36c15c2` | `PR6_CURRENT_MAIN_FINAL_INDEPENDENT_REVIEW.md` |
| `198e55548a2ca09942843798a9ebd3e03a30d0fa` | `PR6_A_FOUNDATION_INDEPENDENT_REVIEW.md` |
| `da388c5d2ffa8bc0e04312de9c14a831b5ba4010` | `PR6_A_FOUNDATION_CORRECTION_INDEPENDENT_REVIEW.md` |

### 1.3 Exact-head CI (authoritative)

Run **`34652673104`**, `event=pull_request`, `head_sha=04a3e276…` — equals the
live PR head. Conclusion SUCCESS.

| Job | ID | Result |
|---|---|---|
| Classify change set | `103438252744` | SUCCESS |
| Lint, typecheck, test, build, Prisma, GraphQL (Heavy) | `103438295453` | SUCCESS — **146 steps executed, not SKIPPED** |
| CI Gate | `103451349054` | SUCCESS |

The cancelled run `34652672927` is a distinct run id on the same head; it does
not substitute for, and does not invalidate, `34652673104`. Superseded
attempts named in the PR body (`34651762649`, `34651974372`, `34652494303`,
`34652508208`) were inspected and are genuinely superseded, not re-labelled
failures. No `workflow_dispatch`; no later docs-only push.

---

## 2. Independently executed evidence

All apply paths were executed as the **`stocky_runtime`** role inside real
tenant transactions; migration/admin roles were used only to prepare and
inspect fixtures.

| Property | Value |
|---|---|
| PostgreSQL | **16.13** (Ubuntu 16.13-0ubuntu0.24.04.1), disposable cluster, dedicated port 55433 |
| Isolation | `read committed` (default) |
| `max_locks_per_transaction` / `max_connections` / `max_prepared_transactions` | 64 / 100 / 0 (CI-equivalent; an earlier corpus run used 200 connections — see §2.1) |
| Roles present | `stocky` (owner/migration), `stocky_runtime`, `stocky_control_plane`, `stocky_receipt_probe_owner` — as provisioned by `tenant:roles:provision --apply` |
| Node / npm | v22.22.2 / 11.5.2 (npm pinned to the CI version) |
| Enforcement | `tenant:indexes:apply --apply`, `tenant:roles:provision --apply`, `tenant:enforcement:apply --apply` — all exit 0; `enforcement:verify`, `rls:verify`, `roles:verify` all exit 0 |

This cluster is separate from any parallel B reviewer's services; no other
agent's environment was reset.

### 2.1 Gates executed

| Gate | Command | Exit | Result |
|---|---|---|---|
| Prisma generate | `npx prisma generate` | 0 | pass |
| Migrations | `npx prisma migrate deploy` | 0 | all applied |
| Tenant access inventory freshness | `npm run tenant:access:inventory:check` | 0 | `tenant_access_inventory_fresh` on the clean C tree |
| Enforcement preflight | `npm run tenant:enforcement:preflight` | 0 | pass |
| Lint | `npm run lint` | 0 | pass |
| Typecheck | `npm run typecheck` | 0 | pass |
| Build | `npm run build` | 0 | pass |
| GraphQL codegen | `npm run graphql-codegen` | 0 | pass |
| **C PostgreSQL suite** | `npm run test:migrations -- scripts/tenant-enforcement/tests/pr6-c-canonical-applicator.test.ts` | 0 | **49 tests discovered and passed** (9.7 s), serialized under `vitest.migrations.config.ts` (`fileParallelism: false`) |
| Unit tests | `npm test` | 0 after codegen | **425 tests / 47 files** |
| **Full migration corpus** | `npm run test:migrations` | see note | **516 tests / 61 files** — 515 passed; the single failure was an environment deviation of mine, not the subject (below). Duration 967.65 s |

**Reported-count adjudication.** The PR body's "49 C PostgreSQL tests" and
"425 unit tests" are **independently confirmed**. On a first run before
`graphql-codegen`, 5 of 425 unit tests failed — all in
`app/lib/catalog-facts/admin-read/bulk-query-schema.test.ts` (PR5-F2A, not
C-owned), solely because `app/types/admin-2026-07.schema.json` was not yet
materialized. After running codegen the file passes 8/8. These were
environment artifacts, **not** C defects and **not** a CI discrepancy.

**Migration-corpus adjudication.** The reported **"516 migration-corpus tests"**
is also **independently confirmed**: the serialized corpus discovered
**61 files / 516 tests**, and `pr6-c-canonical-applicator.test.ts` passed
**49/49 inside the corpus run** as well as standalone.

One test failed — `scripts/tenant-enforcement/tests/pr5-f3-lock-capacity-aw.test.ts`
› "reduces an unsafe requested batch instead of raising PostgreSQL settings"
(`expected false to be true`). This is a **PR5-F3** test, not C-owned, and it
reads **live** PostgreSQL settings through
`assertCanonicalWriterCapacityAtStartup`. I had started the cluster with
`max_connections=200`; CI's `postgres:16-alpine` uses the default **100**. The
larger connection count widens the derived lock envelope so a requested batch of
32 no longer needs reducing, making `reduced` false. I restarted the cluster
with `64 / 100 / 0` — exactly CI's settings — and re-ran the file:
**12/12 passed, exit 0**.

The failure therefore demonstrates nothing about the subject and is **not**
counted as a finding. Corrected corpus result: **516/516 green under CI-equivalent
settings.**

### 2.2 Reviewer-authored probe suites

Five scratch suites were authored independently (not derived from subject
tests) and executed against the disposable cluster. They are **not** part of
any commit to C and are not included in this review branch.

- `zz-claude-pr6c-probe.test.ts` — 8 targeted probes (A–H)
- `zz-claude-pr6c-races.test.ts` — 2 race probes + 8 positive controls
- `zz-claude-pr6c-extra.test.ts` — 4 receipt/child-retention probes
- `zz-claude-f04.test.ts` — F-04 end-to-end receipt-suppression confirmation
- `zz-claude-b-to-c-compat.test.ts` — 6 B→C compatibility cases (separate overlay worktree)

An initial probe run failed on my own fixture error (observation rows inserted
outside a tenant transaction → RLS denial). Those failures demonstrated
nothing and were discarded; every finding below comes from a corrected run in
which the intended invariant was actually exercised. A mid-run PostgreSQL
PANIC (the harness reset the scratch directory's traverse permission, so the
checkpointer lost access to `pg_control`) was resolved by relocating the
cluster; it is an environment artifact, not subject behaviour.

---

## 3. Priority probe verdicts

| # | Probe area (work-order hypothesis) | Verdict |
|---|---|---|
| 1 | Refund existence must not bypass its own decision | **CONFIRMED** — F-01 (never tombstoned; diagnostics also lost), F-03 (blocked existence still writes the refund subtree) |
| 2 | Receipts, error results and partial success | **CONFIRMED** — F-04 (non-success still certified), F-08 (empty batch reports `applied`). The receipt short-circuit itself is **correct** under two real concurrent sessions, including same-key/different-identity |
| 3 | Presence evidence, ordering and full-sync fencing | **CONFIRMED** — F-02 (`already_live` never advances the interval). Full-sync branch keeps LIVE without a fence comparison but cannot tombstone or revive, so no defect there |
| 4 | Durable observation, identity and scope provenance | **CONFIRMED** — F-05 (caller-supplied `lastConfirmedAccessScopes` overrides persisted history), F-07 (durable `accessScopeSnapshot` never read). Token, resource kind, GID and request generation **are** correctly fenced |
| 5 | Complete parent/child replacement and historical identity | **CONFIRMED** — F-06 (§5.1 child absence not implemented). Historical identity rules (no SKU relink, at-sale preservation, ordinal identity, no physical delete) **hold** |
| 6 | Money / unit contracts and replay | **PASS** — no defect found across all 8 required-money groups / 21 bags, PO-10, and replay |

---

## 4. Findings

Severity: **P0** critical/destructive/tenant safety · **P1** blocking high
correctness/security · **P2** blocking correctness/governance/reliability ·
**P3** non-blocking residual. Approval requires P0 = P1 = P2 = 0.

### F-CLAUDE-PR6C-01 — P1 — A confirmed-absent Refund is never tombstoned; Refund identities have no existence control

**File:** `stocky-plus/app/lib/order-facts/apply/index.ts:626`
(`if (existenceDecision.mutate && identity.resourceKind === "Order")`)

**Evidence.** `applyOneObservation` loads Order **or** Refund state and calls
`decideOrderExistence` for both, but the mutating existence branch is guarded
by `identity.resourceKind === "Order"`. The sibling `else if` requires
`!existenceDecision.mutate`, so for a Refund identity with `mutate: true`
**neither branch runs** and the decision is silently discarded.

**Reproduction (PROBE-C).** Seed a LIVE Refund via a nested refund, then issue
one direct Refund observation: `existenceKind=ABSENT_CONFIRMED_QUERY`,
`queryCompleted=true`, `queryReturnedNull=true`, in-window, scopes intact,
interval `[9,10]` strictly later than stored.

```
PROBE-C refund after live: {"existenceState":"LIVE","existenceKind":"LIVE_REFETCH"}
PROBE-C final: {"outcome":"noop","mutated":false,"state":"LIVE","kind":"LIVE_REFETCH"}
```

**Expected:** `existenceState=ABSENT`, `existenceKind=ABSENT_CONFIRMED_QUERY`,
`deletedAt` set, `deletionSource=CONFIRMED_QUERY` (plan §8.6).
**Actual:** row unchanged; outcome `noop`; no diagnostic anywhere.

**Diagnostic writers target the wrong table (PROBE-G).** The same root cause
also silently discards Refund diagnostics. `updateOrderDiagnosticsOnly`
(`writers.ts:390`) and `nominateAbsenceCandidate` (`writers.ts:405`) both
`UPDATE "ShopifyOrderFact" … WHERE id = $factId`. For a Refund identity
`fact.id` is a `ShopifyOrderRefundFact` id, so the statement matches **zero
rows** and raises no error. Re-run with `existenceKind=INACCESSIBLE_HISTORY_WINDOW`
on a Refund identity — a decision that is `mutate: true` — and nothing lands:

```
PROBE-G: {"outcome":"noop","mutated":false,
          "refundRow":{"existenceKind":"LIVE_REFETCH",
                       "existenceDiagnosticState":null,"historyWindowState":null}}
```

Expected `ORDER_EXISTENCE_UNVERIFIABLE_WINDOW` and
`ORDER_HISTORY_WINDOW_TRUNCATED` on the refund row (§8.5). Actual: both NULL.

**Merchant impact.** A refund deleted at Shopify remains permanently LIVE in
canonical facts. Its refund lines, adjustments and transactions keep
contributing to refunded money and unit-return evidence forever. No terminal
revival, unverified-delete, window, or scope rule can ever apply to a Refund,
and no merchant-visible diagnostic is ever recorded for one.

**Contract.** §5.1's frozen clock table defines a Clock B existence source for
Refund (`refund(id:)` / presence in `Order.refunds`) and binds Refund Clock A
independently of the order gate. Refund existence is therefore in scope, not
undefined.

**Correction.** Apply the existence decision for `resourceKind === "Refund"`
against `ShopifyOrderRefundFact`, or explicitly and durably document Refund
existence as out of C's scope and fail closed rather than returning `noop`.

**Missing test:** direct Refund `ABSENT_CONFIRMED_QUERY`, unverified delete,
and terminal revival on a Refund identity.

---

### F-CLAUDE-PR6C-02 — P1 — `already_live` never advances the existence interval, so a delayed older ABSENT tombstones a live order

**File:** `stocky-plus/app/lib/order-facts/apply/existence.ts:413`
(`return { mutate: false, reason: "already_live", diagnostic: null }`)

**Evidence.** When stored is LIVE and incoming is `LIVE_REFETCH` of the same
kind, the decision is `mutate: false`. `existenceRequestGen` /
`existenceResponseGen` therefore keep the values of the **first** LIVE
observation. A later `ABSENT_CONFIRMED_QUERY` is admitted whenever
`isNonOverlappingLater(incoming, storedInterval)` holds — which it does
against the stale stored interval.

**Reproduction (PROBE-A).** LIVE `[1,2]` → LIVE `[9,10]` → delayed ABSENT `[5,6]`:

```
PROBE-A intervals: {"afterFirst":{"req":"1","resp":"2"},"afterNewerLive":{"req":"1","resp":"2"}}
PROBE-A final: {"outcome":"applied","state":"ABSENT","kind":"ABSENT_CONFIRMED_QUERY",
                "deletedAt":"2026-09-01T00:00:00.000Z","src":"CONFIRMED_QUERY"}
```

`loadCompletedOverlappingIntervals` does not rescue this: `[9,10]` and `[5,6]`
do not overlap, so `extraOverlap` is false.

**Expected:** `[5,6]` is older evidence than the `[9,10]` presence proof. With
the interval advanced, `isNonOverlappingLater([5,6],[9,10])` is false and the
decision becomes `absent_not_later` with
`CONCURRENT_EXISTENCE_OBSERVATION_CONFLICT` — the documented "no
last-writer-wins" outcome (T25).
**Actual:** the order is tombstoned with `deletedAt` and
`deletionSource=CONFIRMED_QUERY`.

**Merchant impact.** A live order is removed from canonical facts by stale
evidence. Its lines, agreements and sales stop being authoritative; demand and
refund history for those variants are silently wrong until two independent
non-overlapping LIVE confirmations revive it.

**Correction.** Persist the latest valid presence evidence (advance
`existenceRequestGen`/`existenceResponseGen` on `already_live`), or compare
incoming absence against the newest completed LIVE observation interval rather
than only the stored row.

**Missing test:** LIVE `[1,2]` → LIVE `[9,10]` → ABSENT `[5,6]` must not tombstone.

---

### F-CLAUDE-PR6C-03 — P1 — Active-blocker fencing does not cover refund child writes

**File:** `stocky-plus/app/lib/order-facts/apply/index.ts:709` (refund loop),
`applyRefundIfClockAllows` → `liveChildWrite` (always `nextState: "LIVE"`)

**Evidence.** The Order children path is guarded by `!existenceBlocked`. The
refund loop is not. `liveChildWrite` unconditionally synthesises a
`mutate: true, nextState: "LIVE"` write regardless of the enclosing decision.

**Reproduction (PROBE-J / PROBE-L).** With an ACTIVE, unexpired, resultless
blocker at a lower `observationRequestGen` on the Refund identity — so
`decideOrderExistence` returns `active_blocker`, `mutate: false` — apply a
direct Refund observation carrying a refund snapshot:

```
PROBE-L: {"outcome":"applied","existenceMutated":false,"childrenApplied":true,
          "rows":1,"row":{"existenceState":"LIVE","existenceKind":"LIVE_REFETCH"}}
```

**Expected:** an active blocker prevents canonical mutation for that identity;
no `ShopifyOrderRefundFact` row is created and the outcome is `blocked`.
**Actual:** a brand-new LIVE refund fact row (plus its lines, adjustments and
transactions) is created, and the batch reports `applied`, not `blocked`,
because `childrenApplied` is true.

**Merchant impact.** Concurrent-observation fencing is bypassed for the entire
refund subtree. A losing/concurrent observation can create or overwrite refund
money while a competing in-flight observation is still authoritative.

**Correction.** Gate the refund loop on `!existenceBlocked`, and do not report
`applied` when the existence decision was `active_blocker`.

**Missing test:** blocked existence must write no refund subtree row.

---

### F-CLAUDE-PR6C-04 — P1 — A rejected or incomplete apply still writes the application receipt, permanently certifying an effect that never happened

**File:** `stocky-plus/app/lib/order-facts/apply/index.ts:951`
(`insertReceiptFinal` runs unconditionally after the per-observation loop)

**Evidence.** Per-observation outcomes `rejected`, `incomplete`, `blocked`,
`conflict` and `lease_invalid` are collected into `results`, and the receipt is
then inserted regardless. On any later delivery of the same application key,
`shortCircuitIfApplied` returns `already_applied` and the applicator performs
no merchant write at all.

**Reproduction (PROBE-F).** One order whose `netPaymentSet.shopAmount` is
`"not-a-number"`, with a receipt supplied:

```
PROBE-F: {"outcome":"rejected","receiptStatus":"applied","receiptRows":1,"orderRows":0}
```

`orderRows: 0` correctly confirms whole-snapshot fail-apply (T48 holds).
`receiptRows: 1` is the defect.

**Expected:** the receipt certifies a merchant effect. A snapshot that produced
no canonical write must not be certified; the key must remain retryable.
**Actual:** the key is permanently `already_applied` and the order is never applied.

**End-to-end confirmation (PROBE-F04).** Same application key, two attempts in
two committed tenant transactions — the first with a malformed required bag, the
second with a **perfectly valid** snapshot:

```
F04: {"attempt1":{"outcome":"rejected","receiptStatus":"applied","orders":0,"receipts":1},
      "attempt2":{"outcome":"already_applied","receiptStatus":"already_applied","orders":0,"receipts":1}}
```

The corrected retry is short-circuited and writes **nothing**. The order is
never applied — `ShopifyOrderFact` holds 0 rows for that GID after both
attempts, permanently.

**Merchant impact.** Permanent, silent loss of an order or refund whenever a
transient malformed field, an incomplete pagination walk, or a lease/blocker
condition occurs. Retry and redelivery both no-op. Only a differently-keyed
reconcile sweep can heal it.

**Correction.** Insert the receipt only when the batch is a genuine terminal
success, or record the outcome on the receipt (`resultMetadata` is already
written as `NULL`) and have the short-circuit re-apply non-success keys.

**Missing test:** rejected/incomplete/blocked outcomes must not leave a receipt
that suppresses re-application.

---

### F-CLAUDE-PR6C-05 — P1 — Caller-supplied `lastConfirmedAccessScopes` overrides stronger persisted scope history, defeating T50

**File:** `stocky-plus/app/lib/order-facts/apply/existence.ts:114`
(`scopeContinuityAllowsAbsence`) and `:329`
(`lastConfirmedScopes: input.lastConfirmedScopes ?? stored.accessScopeSnapshot`)

**Evidence.** The `??` fallback only applies when the caller supplies
`null`/`undefined`. A caller-supplied `[]` is truthy-present, and
`scopeContinuityAllowsAbsence` then skips **all** downgrade checks because
`last.length > 0` is false. The persisted `accessScopeSnapshot` — which is the
recorded evidence of the last LIVE confirmation — is never consulted as a floor.

**Reproduction (PROBE-B).** Confirm LIVE with `["read_orders","read_all_orders"]`,
then send a downgraded `ABSENT_CONFIRMED_QUERY` with
`accessScopeSnapshot: ["read_orders"]` and `lastConfirmedAccessScopes: []`:

```
PROBE-B persisted scopes: ["read_orders","read_all_orders"]
PROBE-B final: {"outcome":"applied","state":"ABSENT","kind":"ABSENT_CONFIRMED_QUERY","diag":null}
```

**Expected:** plan §8.16 / T50 — losing `read_all_orders` voids prior absence
authority; decision `scope_continuity_denied` with
`ORDER_SCOPE_DOWNGRADE_VOIDS_ABSENCE`.
**Actual:** absence applied, no diagnostic.

**Merchant impact.** After a scope downgrade, orders that are merely no longer
visible are tombstoned as confirmed-deleted. This is the exact failure T50
exists to prevent, and it is reachable purely through caller input.

**Correction.** Treat the persisted `accessScopeSnapshot` as a floor: take the
union of caller-supplied and persisted last-confirmed scopes, or ignore the
caller value entirely and use durable evidence.

**Missing test:** `scopeContinuityAllowsAbsence` with an explicitly supplied
empty/weaker `lastConfirmedAccessScopes` against stronger persisted history.

---

### F-CLAUDE-PR6C-06 — P1 — §5.1 child-absence on complete-snapshot replacement is not implemented: omitted children stay LIVE, and refund parents contradict their own children

**File:** `stocky-plus/app/lib/order-facts/apply/writers.ts` (every child
writer), `index.ts:applyOrderChildren`, `upsertRefundSnapshot`

**Evidence.** Every writer is INSERT-or-UPDATE over the **present** set only.
No writer marks a previously-stored child that a newer complete snapshot omits
as non-authoritative, and no evidence of the omission is recorded anywhere.

**Reproduction (PROBE-D) — order children.** Apply a complete 2-line snapshot,
then a complete **newer** snapshot containing only line 1:

```
PROBE-D lines: [{"...Line/1","existenceState":"LIVE"},{"...Line/2","existenceState":"LIVE"}]
        sales: [{"...Sale/1","existenceState":"LIVE"},{"...Sale/2","existenceState":"LIVE"}]
```

**Reproduction (PROBE-M) — refund children, with a money consequence.** Apply a
refund with two lines (`totalRefunded = 20.00`), then a complete newer refund
snapshot with one line (`totalRefunded = 10.00`):

```
PROBE-M: {"lines":[{"refundLineOrdinal":0,"existenceState":"LIVE","quantity":1},
                   {"refundLineOrdinal":1,"existenceState":"LIVE","quantity":1}],
          "parent":{"t":"10.000000","d":null}}
```

The persisted parent now reports `10.000000` refunded while the retained child
rows sum to `20.00`, with `moneyDiagnosticState = null`.

**Expected — frozen contract, §5.1 "Snapshot atomicity (frozen)":**

> Child absence from a **complete, fully-paginated** parent snapshot marks that
> child `existenceState=ABSENT` **scoped to the parent**; it never tombstones
> the parent and never physically deletes the row.

C honours the second half (§8.11 retention, no physical delete) and omits the
first half entirely. No writer in `writers.ts` ever sets a child to `ABSENT`.
The §6.6 money identity is defined over child sums, so the stored parent must
not silently contradict its stored children.
**Actual:** stale children stay LIVE with no diagnostic and no absence evidence.

**Merchant impact.** Over-counted refunded money and refunded/removed units for
any edited order or amended refund. Because the identity check runs on the
*incoming* snapshot only, no diagnostic is ever raised, so the reconciler has
nothing to key on.

**Correction.** Implement the §5.1 rule: on a complete, fully-paginated parent
snapshot, set omitted children to `existenceState=ABSENT` scoped to that parent
(retained, never deleted). Incomplete pagination must continue to produce no
child absence, which C already enforces.

**Missing test:** complete newer snapshot omitting a stored line / sale /
refund line / adjustment / transaction.

---

### F-CLAUDE-PR6C-07 — P2 — Durable observation `accessScopeSnapshot` is never read or compared; caller-supplied scopes are persisted as if authenticated

**File:** `stocky-plus/app/lib/order-facts/apply/fencing.ts:87`
(`fenceDirectObservation` SELECT list)

**Evidence.** PR6-A provisions `OrderFactObservationInFlight.accessScopeSnapshot
String[]` (`prisma/schema.prisma:2108`). The fencing read selects `id`,
`lifecycleState`, `observationRequestGen`, `observationResponseGen`,
`leaseExpiresAt`, `terminalOutcome` — and never `accessScopeSnapshot`. C
instead trusts `observation.accessScopeSnapshot` from caller input, uses it for
absence adjudication and for the `hasReadAllOrders` window predicate, and
persists it onto every fact row.

**Reproduction (PROBE-H).** Durable row records `["read_orders"]`; caller
supplies `["read_orders","read_all_orders"]`:

```
PROBE-H: {"outcome":"applied",
          "persistedOnFact":["read_orders","read_all_orders"],
          "durableOnObservation":["read_orders"]}
```

**Expected:** plan §8.6 — "the effective token scope set at observation time
**is recorded on the observation**". The durable row is the provenance; C
should compare against it, or at minimum not silently overwrite it.
**Actual:** unauthenticated caller input governs. Because
`isWithinHistoryWindow` returns `true` unconditionally when
`hasReadAllOrders`, a fabricated `read_all_orders` makes the 60-day window
predicate unconditional — enabling tombstones of out-of-window orders that
§8.7 / §8.8 forbid.

**Ownership.** The token, resource kind, GID and request generation **are**
correctly fenced against the durable row (verified: a token for a different
identity or generation is rejected). Scope is the one trusted input with
durable evidence available and unused. Authenticating the grant itself is
D-owned (R-176); comparing against the row A already provisioned is C's.

**Correction.** Select `accessScopeSnapshot` in `fenceDirectObservation` and
compare it against the supplied value, failing closed on mismatch.

**Missing test:** fabricated `read_all_orders` in caller input against a
durable row that does not carry it.

---

### F-CLAUDE-PR6C-08 — P2 — Empty observation batch reports `receiptStatus: "applied"` without inserting a receipt

**File:** `stocky-plus/app/lib/order-facts/apply/index.ts:889`
(`receiptStatus: input.receipt ? "applied" : "none"`)

**Reproduction (PROBE-E).**

```
PROBE-E: {"receiptStatus":"applied","receiptRows":0}
```

**Expected:** `applied` means the receipt is durably written. An empty batch
writes none.
**Actual:** the caller is told the application key is certified when the
`SyncApplicationReceipt` table has no such row.

**Merchant impact.** A D caller that treats `applied` as exactly-once proof will
acknowledge and discard work that was never receipted, and the same key will be
re-applied later. This is the mirror image of F-04 and is reachable whenever a
filtered batch legitimately empties.

**Correction.** Return `"none"` (or insert the receipt) on the empty-batch path.

---

### F-CLAUDE-PR6C-09 — P3 — B→C: `restocked` and `restockLocationGid` are unfillable from B's extraction

A provisions `ShopifyOrderRefundLineFact.restocked Boolean?` and
`restockLocationGid String?` (`schema.prisma:1831-1832`); C accepts and
persists both. B selects **only** `restockType` — verified across
`documents.ts:383`, `documents.ts:660`, `bulk-query-documents.ts:241`,
`map-nodes.ts:270` and `types.ts:112` (`RefundLineRead` has no `restocked`,
no location).

Executed (BC-3) — the adapter refused to fabricate, so both persist as NULL:

```
BC-3 refundLines: [{"refundLineOrdinal":0,"shopifyGid":null,"restockType":"CANCEL",
                    "restocked":null,"restockLocationGid":null,...}, {...ordinal 1...}]
```

Plan §5.4 names `restockType` / `restocked` as the restock signal and
`restockLocationGid` from `location.id`. **Owner: PR6-B / PR6-D** (reader
selection), not C. Flagged as a cross-lane integration gate.

---

### F-CLAUDE-PR6C-10 — P3 — B→C: nullable `RefundRead.orderId` cannot satisfy C's required `shopifyOrderGid`

B maps `orderId: optionalString(node.order?.id)` (`map-nodes.ts:377`) — nullable.
C's `RefundSnapshot.shopifyOrderGid` is a required `string`, and
`ShopifyOrderRefundFact.shopifyOrderGid` is NOT NULL (`schema.prisma:1760`).

Executed (BC-2) — the deterministic adapter refused rather than fabricating:

```
BC-2 read: {"status":"complete",...}
BC-2 orphan adapter: ADAPTER_BLOCKED: C RefundSnapshot.shopifyOrderGid is required but B returned orderId=null
```

C correctly handles a refund whose **local `ShopifyOrderFact` row is absent**
(subject test "applies a complete refund snapshot without a local Order row"),
and the accepted PR6-A correction re-review adjudicated the **absent FK** as
necessary so an out-of-window refund remains storable. Both hold. The residual
is narrower: the GID **column and type are mandatory**, so a refund whose
`order` field itself comes back null cannot be represented at all. Narrow, and D-owned in practice (D must fail closed rather than
invent a parent GID), but it should be explicitly dispositioned rather than
discovered at D time.

---

### F-CLAUDE-PR6C-11 — P3 — B→C: at-sale vs current catalog linkage and line legacy id are not separable from one B read

`OrderLineRead` exposes a single `variant` / `product` `CatalogNodeRef` (the
**current** linkage, §4.6) and no line-level `legacyResourceId`. C needs four
distinct values plus `shopifyLegacyResourceId`.

Executed (BC-1):

```
BC-1 lines: [{"shopifyGid":".../LineItem/1","dt":"9.000000",
              "variantGidAtSale":"gid://shopify/ProductVariant/1",
              "currentVariantGid":"gid://shopify/ProductVariant/1","lrid":null}, ...]
```

C's writer correctly **preserves** an existing stored `variantGidAtSale`
(`COALESCE(existing, incoming)`), so §8.13 holds on re-apply and history is
never relinked by SKU — verified. The residual is confined to **first insert**
from a later refetch, where the current linkage is recorded as the at-sale
linkage. Inherent to the source, not a C logic defect; flagged for the D import
ordering decision.

---

### F-CLAUDE-PR6C-12 — P3 — B→C: malformed required decimal text reaches C's boundary; discount-alias lineage is not recorded

Executed (BC-5): B returned `status: "complete"` while passing through a
malformed required line bag:

```
BC-5: {"status":"complete","passedThrough":{"shopAmount":"not-a-number","shopCurrencyCode":"USD",...}}
```

C's whole-snapshot fail-apply is therefore load-bearing — and it works
(CONTROL-T48: `outcome rejected`, 0 order rows, 0 line rows). Recorded as a
**B-lane** observation; the B reviewer owns extraction correctness.

Separately, plan §4.2 directs persisting the `withCodeDiscounts: true` value
**and recording the argument in lineage**. The adapter mapped
`discountedTotalSetWithCodeDiscounts` → `discountedTotalSet` and C persisted
`9.000000` (not the `9.50` without-code variant) — correct authority — but no
column records which argument variant was stored, and
`discountedTotalSetWithoutCodeDiscounts` has no destination.

---

## 5. What is correct — executed positive controls

These were independently reproduced and **pass**. They are recorded so the
finding set is not mistaken for a broad failure.

| Control | Plan ref | Executed result |
|---|---|---|
| Stale parent writes **no** children | T09 / T44 | only the pre-existing line remains, `quantity 3`; the stale snapshot's new line was not written |
| Equal `updatedAt` repairs drifted children | T45 | drifted `quantity 77` repaired to `3` |
| Aged-out null must not tombstone | T41 | `LIVE` + `INACCESSIBLE_HISTORY_WINDOW` + `ORDER_HISTORY_WINDOW_TRUNCATED`, `deletedAt` NULL |
| Exact decimal, no rounding; dual currency, no FX | T15 / T27 | `0.123456` persisted exactly; presentment `EUR` beside shop `USD` |
| Cross-shop identical GID isolation | T14 | one row per shop, RLS-isolated |
| One invalid required bag rejects the whole snapshot | T48 | `rejected`; **0** order rows, **0** line rows — no partial canonical write |
| PO-10 clean fixture 6 ordered / 3 current / 3 returned / 0 removed | T54 | `unitDiagnosticState = null` (no spurious diagnostic) |
| PO-10 negative control, stale ordered 5 | T54 | `LINE_UNIT_IDENTITY_INCONSISTENT` detected |
| Duplicate refund GID applied twice | T05 | 1 refund row, 1 refund line — idempotent, not doubled |
| Independently newer nested Refund under a **stale** Order clock | §13 | refund applied; stale order children not written |
| Receipt short-circuit under two real concurrent sessions | T04 | loser observed the winner's receipt, returned `already_applied`, and performed **no** merchant write (the order row kept the winner's generations `1/2`) |
| Same application key, different identity sets | §13 | loser short-circuited (`already_applied`); `orderY` **not** written, 1 receipt row |

Money handling was examined closely and no defect was found: no `Number`,
`parseFloat`, or division-derived unit price on the apply path; `Prisma.Decimal`
throughout; `DECIMAL(20,6)` scale/precision enforced by
`isExactlyRepresentableAsDecimal20_6`; mixed shop-currency sums rejected; all
eight required-money groups / 21 bags match §6.3; refund children (lines,
adjustments, transactions, shipping) are fully pre-validated in
`parseRefundMoney` **before** any DML, so nested-refund fail-apply is atomic.
The §6.6 identity is computed exactly and yields
`REFUND_MONEY_UNBALANCED` without rewriting Shopify values (observed in BC-3).

Identity and lock behaviour: advisory identities are Order + Refund GIDs only,
deduped and acquired in ascending `(key1, key2)`; capacity is evaluated through
the R-161 evaluator; `ORDER_APPLY_PHYSICAL_DELETE_OPERATIONS` is empty and
`denyOrderFactPhysicalDelete` throws (R-164 respected — no physical delete on
ordinary apply); the kill switch uses `stocky_shop_processing_enabled(...)` with
no `SELECT "Shop"`; client-supplied shop id is denied; tenant GUC is required.
Token, resource kind, GID and request generation **are** fenced against the
durable observation row.

---

## 6. C requirement-to-test matrix (plan §19, C-owned cases)

The subject suite contains **49** PostgreSQL tests, all discovered and passing.
Coverage below is what the suite actually asserts, verified by reading each
test, not by trusting its name.

| Plan case | Covered by subject test | Independently re-verified | Verdict |
|---|---|---|---|
| T01 first LIVE order upserts order + lines, exact decimals | yes | yes (BC-1) | PASS |
| T03 client shop header cannot set tenant | yes | — | PASS |
| T04 duplicate delivery receipt short-circuits | yes | yes (PROBE-I, two real sessions) | PASS |
| T05 duplicate refund GID idempotent | yes | yes (CONTROL-T05) | PASS |
| T06 partial then second refund, no double-count | yes | — | PASS |
| T07 edit then refund, one unit ledger | yes | — | PASS |
| T08 cancel then refund, no double subtract | yes | — | PASS |
| T09 / T44 stale parent writes no children | yes | yes (CONTROL-T44) | PASS |
| T10 newer refetch after stale applies | yes | — | PASS |
| T11 / T12 deleted & recreated variant, no SKU relink | yes | — | PASS |
| T13 out-of-order cancelled before create | yes | — | PASS |
| T14 cross-shop identical order id | yes | yes (CONTROL-T14) | PASS |
| T15 sub-cent `1.234567` | yes | yes (`0.123456`) | PASS |
| T16 zero-price line qty 2 kept | yes | — | PASS |
| T17 / T18 test orders, gift-card/tip lines | yes | — | PASS |
| T23 retry helper restarts a fresh transaction | yes | — | PASS (real contended `lock_timeout` not exercised — §8) |
| T25 **overlapping** LIVE vs ABSENT conflict | yes (intervals genuinely overlap: `[g1,g3]` vs `[g2,g4]`) | — | PASS for the overlapping case only |
| — **non-overlapping** stale ABSENT after newer LIVE | **no test** | yes (PROBE-A) | **FAIL — F-02** |
| T27 presentment EUR beside shop USD, no FX | yes | yes (CONTROL-T15/T27) | PASS |
| T31 earlier ACTIVE fence blocks a later overlapping direct apply | yes (Order identity) | — | PASS for Order |
| — same fence against a **refund child write** | **no test** | yes (PROBE-J / PROBE-L) | **FAIL — F-03** |
| T34 aged-out LIVE excluded from full-sync nomination | yes | — | PASS |
| T35 advisory lock held before first insert | yes | — | PASS |
| T36 PENDING refund transaction stored from snapshot | yes | — | PASS |
| T38 raw SQL shopId reassignment denied | yes | — | PASS |
| T41 aged-out null does not tombstone | yes | yes (CONTROL-T41) | PASS |
| T42 in-window null tombstones `CONFIRMED_QUERY` | yes | — | PASS (Order identity) |
| — same on a **Refund** identity | **no test** | yes (PROBE-C) | **FAIL — F-01** |
| T43 unverified delete retains row, WEBHOOK `deletedAt` | yes | — | PASS |
| T45 equal `updatedAt` repairs children | yes | yes (CONTROL-T45) | PASS |
| T46 null refund-line id, ordinal identity | yes | yes (BC-3) | PASS |
| T47 / T55 reversal sale stores −1 / −2, magnitudes correct | yes | — | PASS |
| T48 one invalid required bag rejects whole snapshot | yes (×2) | yes (CONTROL-T48) | PASS |
| T49 unbalanced refund persists Shopify fields + diagnostic | yes | yes (BC-3) | PASS |
| T50 scope downgrade voids absence | yes — but only with an **honest** explicitly supplied `lastConfirmedAccessScopes: ["read_orders","read_all_orders"]` | yes | PASS for the honest-caller path |
| — T50 when the caller supplies an empty/weaker `lastConfirmedAccessScopes` despite stronger persisted history | **no test** | yes (PROBE-B) | **FAIL — F-05** |
| T54 injected contradictory identity detected | yes | yes (BC-6 clean + negative control) | PASS |
| T56 two complete refund snapshots both persist | yes | — | PASS |
| T57 incomplete nested walk ⇒ `SNAPSHOT_PAGINATION_INCOMPLETE`, no facts | yes | — | PASS |
| T58 mixed ORDER+RETURN on one agreement | yes | yes (BC-1) | PASS |
| §5.1 child absence on complete-snapshot replacement | **no test** | yes (PROBE-D, PROBE-M) | **FAIL — F-06** |
| §13 receipt certifies a merchant effect | partial (success path only) | yes (PROBE-E, PROBE-F) | **FAIL — F-04, F-08** |
| §8.6 scope evidence recorded on the observation | **no test** | yes (PROBE-H) | **FAIL — F-07** |
| R-164 no physical delete on ordinary apply | yes (×2) | yes (read) | PASS |
| Kill switch `stocky_shop_processing_enabled` | yes | — | PASS |
| Lock-capacity guard (R-161) | yes | — | PASS |
| Terminal revival needs two non-overlapping LIVE confirmations | yes | — | PASS (Order identity) |
| First-insert ABSENT writes no row | yes | — | PASS |
| Full-sync omission nominates in-window LIVE as CANDIDATE only | yes | — | PASS (Order identity) |
| Complete refund snapshot without a local Order **row** | yes | — | PASS |

The subject suite is genuine and well-targeted; every case it claims, it
actually asserts. The eight defects below sit in the gaps between those cases —
principally Refund-identity equivalents of Order-identity rules, non-overlapping
interval ordering, child absence, and non-success receipt semantics.

---

## 7. B→C field-level compatibility matrix

Scratch overlay only — **no** branch was merged and **no** combined
implementation commit exists.

| Item | Value |
|---|---|
| C subject (base of overlay) | `04a3e276c9d607e440051603e54e7c96dc9ad19f` |
| B source | `d9717f68ea981aa68f108428a31d7726d0ba2a8f` |
| Files overlaid | `stocky-plus/app/lib/order-facts/admin-read/**` only (39 files) |
| Adapter | deterministic; renames, validated ISO→`Date`, positional ordinal; **no** fabrication, **no** casts past C, **no** failure-as-success |

Both lanes import `MoneyBagSides` from A's `app/lib/order-facts/types.ts`, so
every money bag maps 1:1 with no transformation.

| Source selection | B output | Adapter mapping | C input | Persisted evidence | Disposition |
|---|---|---|---|---|---|
| `Order.id` | `OrderFactSnapshot.id` | identity | `shopifyGid` | `ShopifyOrderFact.shopifyGid` | OK |
| `Order.legacyResourceId` | `legacyResourceId` | rename | `shopifyLegacyResourceId` | `"1"` | OK |
| `Order.currencyCode` | `currencyCode` | rename | `shopCurrencyCode` | `USD` | benign rename |
| `Order.retailLocation.id` | `retailLocationId` | rename | `retailLocationGid` | column | benign rename |
| `createdAt/updatedAt/processedAt/cancelledAt/closedAt` | ISO strings | contracted ISO→`Date`; raw string also kept | `Date` + `processedAtShopify` | both persisted | OK — raw preserved |
| 7 required order bags | `MoneyBagSides` | pass-through | same | `10.000000`, `USD`/`EUR` | OK, no FX |
| 4 optional order bags | nullable bags | pass-through | same | nullable columns | OK |
| `LineItem.discountedTotalSet(withCodeDiscounts:)` | **two** fields | **§4.2: `WithCodeDiscounts` is authoritative** | single `discountedTotalSet` | `9.000000` (not `9.50`) | correct authority; **lineage not recorded** (F-12) |
| `LineItem.variant/product` | one `CatalogNodeRef` | at-sale ← current on first insert | 4 fields | at-sale == current | **F-11** |
| line legacy id | *absent* | forced `null` | `shopifyLegacyResourceId` | `null` | **F-11** source loss |
| `LineItem.nonFulfillableQuantity` | present | dropped | *no C field* | — | benign; no A column |
| `SalesAgreement.*` / `Sale.*` | `OrderAgreementRead` / `OrderAgreementSaleRead` | rename `typename`→`saleTypename`, `lineItemId`→`shopifyLineItemGid` | same | raw signed `+1` / `-1`, `ORDER` / `RETURN` | OK — signs preserved, never `abs()` |
| completeness | `OrderReadResult.status` + `salesComplete` + `childrenComplete` | status→`linesComplete`/`agreementsComplete` | same | gate for `incomplete` | OK |
| `Refund.id / updatedAt / processedAt` | `RefundRead` | rename + ISO→`Date` | `RefundSnapshot` | persisted | OK |
| `Refund.createdAt` | `string \| null` | null preserved | `Date \| null` | `2026-01-02T00:00:00.000Z` | OK — §5.4 null never coerced |
| `Refund.order.id` | **nullable** `orderId` | adapter **blocks** on null | **required** `shopifyOrderGid` | NOT NULL column | **F-10** |
| `RefundLineItem.id` | `string \| null` | preserved | `shopifyGid` nullable | `null` persisted | OK — §5.4 null-safe |
| refund-line ordinal | *not emitted* | derived from array position | `refundLineOrdinal` | `0`, `1` | OK — contracted derivation |
| `RefundLineItem.restockType` | present | pass-through | same | `"CANCEL"` | OK |
| `RefundLineItem.restocked` | **absent** | forced `null` | accepted | **always NULL** | **F-09** |
| `RefundLineItem.location.id` | **absent** | forced `null` | accepted | **always NULL** | **F-09** |
| refund shipping / adjustments / transactions | present | rename | same | counts + bags | OK |
| `order(id:) == null` | `failure`, kind `INACCESSIBLE_HISTORY_WINDOW` | **not** forwarded as an existence decision | C re-adjudicates | — | see below |
| malformed required decimal | `complete`, passed through | passed to C unchanged | C fail-applies | 0 rows | **F-12**, C-side safe |
| effective scopes | `readCurrentAppInstallationAccessScopes` → `{handles}` | caller-supplied to C | `accessScopeSnapshot` | persisted | **F-07** — durable row unused |

**BC-4 note.** B labels a null `order(id:)` as `INACCESSIBLE_HISTORY_WINDOW` at
read time. Plan §8.4/§8.5 make that adjudication dependent on stored
`processedAt`, the 60-day window, and scope continuity — facts only C/D hold.
C does re-adjudicate correctly. **D must not forward B's label as the existence
kind**; this is a named D obligation, not a C defect.

**BC-6 executed end-to-end** through B's real reader → adapter → C → PostgreSQL:
clean 6/3/3/0 → `unitDiagnostic: null`; stale-ordered-5 negative control →
`LINE_UNIT_IDENTITY_INCONSISTENT`. An earlier run of this case produced a false
positive from my own fixture (B's `agreementNode` hardcodes `reason: "ORDER"`,
so the RETURN sale was not counted); corrected by setting
`reason: "REFUND"` / `__typename: "RefundAgreement"`. Only the corrected run is
reported.

**Conclusion.** The B→C interface is broadly compatible: money, identity,
signed units, nullable refund-line ids, multi-page children, and completeness
evidence all survive with benign renames and contracted conversions. Four
specific gaps (F-09 – F-12) are real and none is silently recoverable. This
proves interface compatibility only — it is **not** evidence of D webhook or
import completion.

---

## 8. Executed / failed / unexecuted gates

**Executed and passing:** Prisma generate; `migrate deploy`; tenant index apply
+ verify; role provision + verify; enforcement preflight + apply + verify; RLS
verify; tenant access inventory freshness; lint; typecheck; build; GraphQL
codegen; C PostgreSQL suite (49/49); unit tests (425/425 after codegen);
full migration corpus (516/516 under CI-equivalent settings); reviewer probe
suites; B→C compatibility suite (6/6).

**Failed:** none attributable to the subject. Three failures were encountered
and all three were mine or environmental: (a) my own RLS fixture error, corrected
and re-run; (b) 5 PR5-F2A unit tests before codegen materialised
`admin-2026-07.schema.json`, which pass after codegen; and (c) one PR5-F3
lock-capacity test caused by my `max_connections=200` cluster, which passes
12/12 once the cluster matches CI's `64 / 100 / 0`. None is a C defect.

**Unexecuted / partially executed — remaining gates:**

1. **Interruption/crash recovery matrix** — interruption before commit, after
   commit before acknowledgement, and corrupted/missing-receipt recovery were
   reasoned from the code and the receipt contract but not executed as killed
   processes.
2. **Receipt/identity lock-order deadlock** — not forced to a real
   `40P01`/SQLSTATE observation.
3. **Lock-timeout classification and kill-switch flip while waiting for locks** —
   `applyOrderFactsWithRetry` was read (bounded attempts, retries only on
   `order_advisory_lock_timeout` / `order_apply_unique_conflict`, requires a
   fresh transaction, no savepoint recovery, no `ON CONFLICT DO UPDATE`) but
   not exercised under a real contended `lock_timeout`.
4. **Same-key/different-identity double-commit** — the observed interleaving
   short-circuited correctly (loser wrote nothing). The theoretical window in
   which both transactions pass `shortCircuitIfApplied` before either inserts a
   receipt was **not** reproduced and remains an unproven residual.
5. **Scale/performance** (1,000,000 line facts) — not exercised.

Every item above is a remaining gate, not an assumed pass.

**Commands to close them** (from `stocky-plus/`, with the CI environment and a
disposable cluster):

```bash
# 1-3. contention, deadlock and interruption matrices require a harness that
#      can hold a transaction open and kill it mid-flight; drive two sessions
#      with an explicit barrier and a transaction-local lock_timeout:
#      SET LOCAL lock_timeout = '5000ms';
#      then assert code order_advisory_lock_timeout and that
#      applyOrderFactsWithRetry re-enters begin() on a FRESH transaction.

# 4. same-key / different-identity double-commit: both sessions must execute
#    shortCircuitIfApplied BEFORE either inserts its receipt. This needs an
#    injection point inside applyOrderFacts; it is not reachable from the
#    public API, which is why it stayed unproven here.

# 5. scale
npm run test:migrations -- scripts/tenant-enforcement/tests/pr5-f3-scale-completeness.test.ts
```

Reproducing the eight defects needs no new harness: each probe in §2.2 is a
plain vitest file under `scripts/tenant-enforcement/tests/` driving the real
exported `applyOrderFacts` against a tenant transaction as `stocky_runtime`.

---

## 9. Risk and ownership disposition

- **R-176 remains OPEN / P0.** C's portion is not sufficient to close it, and
  F-07 sits directly on its boundary. D still owns actual fetch/window/scope
  integration, webhook/import, and reconciliation evidence.
- **R-164 remains the accepted DB-layer tenant-scoped DELETE residual.** C adds
  no physical-delete operation on the ordinary apply path (verified). No grant
  change is demanded by this review.
- **PR2 tenant-access inventory.** M = 372 scanned files; B = 411; C = 392.
  C's diff is the `scannedFiles` count only — findings 1741, violations 0,
  converted paths 513, no new allowlist entries. Neither count is correct for a
  combined tree; regeneration is a **future integration requirement**. The
  subject was not edited to avoid review, and no allowlist change is authorized.
- **Cross-lane:** F-09 – F-12 are owned by PR6-B and PR6-D, recorded here
  because they are only visible at the interface.

---

## 10. Safety state

- PR #40 was **not** modified, rebased, marked ready, or merged.
- PR #39 / branch `phase-1/pr6-b-order-admin-read` was **not** modified.
  Head remains `d9717f68ea981aa68f108428a31d7726d0ba2a8f`.
- `main` was **not** modified. Head remains `bdbb5bba91ac8af82e49a99e36cce5db8b401c68`.
- No combined implementation commit was created. The B overlay existed only in
  a disposable worktree and is not part of any branch.
- No PR6-D runtime was written. No CI or global configuration change.
- No production, merchant data, Shopify API call, mutation, or submission.
  Feature flags remain default off. All database work ran on a disposable local
  cluster.
- All temporary working-tree mutations were restored before this artifact was
  committed; reviewer probe suites are excluded from this branch.

---

## 11. Verdict

Six P1 findings block approval. Four of them (F-01, F-02, F-03, F-05) let
canonical existence state be wrong in ways a merchant would see as orders or
refunds disappearing, or failing to disappear, on evidence the applicator
itself judged insufficient. F-04 can permanently suppress an order's
application. F-06 leaves stale children authoritative and lets a refund parent
contradict its own children. Two P2 findings concern provenance and receipt
honesty.

The money contract, unit ledger, tenancy, lock discipline, physical-delete
denial, snapshot atomicity, and clock-A independence are implemented correctly
and were independently reproduced. The defects are concentrated in existence
adjudication, Refund-identity handling, snapshot replacement, and receipt
semantics.

`CORRECTIONS REQUIRED`
