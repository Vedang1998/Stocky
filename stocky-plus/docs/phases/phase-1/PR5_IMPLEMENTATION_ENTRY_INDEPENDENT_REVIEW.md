# PR 5 Implementation-Entry Independent Review (conditional D-054)

Immutable independent review artifact. Do **not** edit this file after it is
committed. Later corrections belong in a **new** artifact.

This is a **documentation / governance gate** review. It is **not** a runtime
implementation review. No PR 5 runtime was implemented, inspected as runtime, or
authorized by this review.

---

## 1. Reviewed identity

| Field | Value |
|---|---|
| Repository | `Vedang1998/Stocky` |
| Base branch | `main` |
| Verified `origin/main` | `edabd8de1f1b25cc5f5f1026e34ddf69aa104f7e` |
| PR | [#26](https://github.com/Vedang1998/Stocky/pull/26) |
| PR state | **OPEN / DRAFT / UNMERGED** (`merged=false`, `draft=true`, `mergeable_state=clean`) |
| Head branch | `phase-1/pr5-implementation-entry` |
| Exact reviewed head | `930c1a728b3256e4932cb297cc91569c53d17020` |
| Commits | **4** |
| Changed files | **14** |
| Diff size | +864 / −112 |
| Review date | 2026-08-16 |

Commits in `main..head`:

| SHA | Subject |
|---|---|
| `3e00ea5` | Record PR5 implementation-entry lock capacity and key contract. |
| `f8f7584` | Make Accelerated Safe Delivery v1 permanent agent governance. |
| `e846030` | Record PR24 planning merge and conditional D-054. |
| `930c1a7` | Remove trailing whitespace from Accelerated Safe Delivery header. |

No stop condition was triggered. `origin/main` and the PR head both matched the
required SHAs at review start and at artifact creation.

---

## 2. PR 24 / planning closure verification

Verified directly against GitHub and Git, not against agent claims.

| Item | Required | Observed | Result |
|---|---|---|---|
| PR #24 state | CLOSED / MERGED | `state=closed`, `merged=true`, `merged_at=2026-08-16T16:49:46Z` | PASS |
| Squash merge / `main` | `edabd8de…` | `edabd8de1f1b25cc5f5f1026e34ddf69aa104f7e` | PASS |
| Planning review head before squash | `1691933e…` | PR #24 `head.sha = 1691933ec126eed44de81162e8492fb7f0bfae0c` | PASS |
| Final immutable review blob | `0d322db7…` | `0d322db701f5f27b89bc4069e6fb1f3d751d15a3` | PASS |
| Planning verdict | `APPROVE PR5 PLANNING` | recorded in DECISIONS.md §19 and PROJECT_STATUS.md | PASS |
| Post-merge main CI | run `31959761072` SUCCESS | `event=push`, `head_sha=edabd8de…`, `conclusion=success` | PASS |

Immutable blob check:

```
git rev-parse edabd8de…:…/PR5_PLANNING_CORRECTION_8_INDEPENDENT_REVIEW.md
  -> 0d322db701f5f27b89bc4069e6fb1f3d751d15a3
git rev-parse 930c1a72…:…/PR5_PLANNING_CORRECTION_8_INDEPENDENT_REVIEW.md
  -> 0d322db701f5f27b89bc4069e6fb1f3d751d15a3
```

The blob is **identical at base and head**. No historical review artifact was
edited by this PR. All five immutable PR 5 review reports
(`PR5_PLANNING_INDEPENDENT_REVIEW.md`,
`PR5_PLANNING_CORRECTION_4_INDEPENDENT_REVIEW.md`,
`PR5_PLANNING_CORRECTION_5_INDEPENDENT_REVIEW.md`,
`PR5_PLANNING_CORRECTION_7_INDEPENDENT_REVIEW.md`,
`PR5_PLANNING_CORRECTION_8_INDEPENDENT_REVIEW.md`) are absent from the diff.

---

## 3. Scope verification

Exactly the 14 approved files changed, and nothing else:

| # | File | Status |
|---|---|---|
| 1 | `AGENTS.md` | M |
| 2 | `stocky-plus/docs/ACCELERATED_SAFE_DELIVERY.md` | **A** |
| 3 | `stocky-plus/docs/DECISIONS.md` | M |
| 4 | `stocky-plus/docs/PROJECT_STATUS.md` | M |
| 5 | `stocky-plus/docs/README.md` | M |
| 6 | `stocky-plus/docs/RISK_REGISTER.md` | M |
| 7 | `stocky-plus/docs/agents/07_CURSOR_MASTER_PROMPT.md` | M |
| 8 | `stocky-plus/docs/agents/08_CLAUDE_CODE_MASTER_REVIEW_PROMPT.md` | M |
| 9 | `stocky-plus/docs/agents/CHATGPT_PROJECT_INSTRUCTIONS.md` | M |
| 10 | `stocky-plus/docs/agents/CLAUDE_PROJECT_INSTRUCTIONS.md` | M |
| 11 | `stocky-plus/docs/agents/README.md` | M |
| 12 | `stocky-plus/docs/phases/README.md` | M |
| 13 | `stocky-plus/docs/phases/phase-1/PR5_CATALOG_LOCATION_INVENTORY_FACTS_BRIEF.md` | M |
| 14 | `stocky-plus/docs/phases/phase-1/README.md` | M |

Negative verification — **none** of the following appear in the diff:

- `app/` runtime — **NONE**
- Prisma schema / model change — **NONE**
- migration — **NONE**
- runtime tests / fixtures — **NONE**
- package manifest / lockfile — **NONE**
- Shopify configuration (`*.toml`) — **NONE**
- GraphQL documents — **NONE**
- `.github/**` workflow or CI script — **NONE**
- feature-flag change — **NONE**
- runtime implementation of any kind — **NONE**

**Docs-only / no-runtime verdict: CONFIRMED.** This is a documentation and
governance change only. It is independently corroborated by the CI classifier
(§9), which classified all 14 paths as `[docs]`.

`OPEN_QUESTIONS.md` and `CI_POLICY.md` are unchanged, consistent with the stated
scope.

---

## 4. D-054 activation-boundary review

**Exact wording verified** (DECISIONS.md item 3):

> **Phase 1 PR 5 implementation authorization under Accelerated Safe Delivery v1.**

| Requirement | Observed | Result |
|---|---|---|
| D-054 is CONDITIONAL | Item 4: "D-054 is **CONDITIONAL** while the implementation-entry PR is open" | PASS |
| D-054 is NOT EFFECTIVE | Item 4: "It is **NOT EFFECTIVE** merely because the heading exists"; item 15: "**D-054 IS CONDITIONAL / NOT EFFECTIVE.**" | PASS |
| Nine activation conditions | Item 5.1–5.9, verbatim match to the required nine | PASS |
| Branch only after condition 9 | Item 6: "**After condition 9 only:** `phase-1/catalog-location-inventory-facts` may be created" | PASS |
| No premature effectiveness claim | Repository-wide grep found no assertion that D-054 is effective | PASS |

The nine conditions as recorded:

1. PR #24 / D-053 planning is merged.
2. Post-merge main CI at `edabd8de…` is successful.
3. F-CLAUDE-PR5C8-01 is resolved in this implementation-entry contract.
4. F-CLAUDE-PR5C8-02 is resolved in this implementation-entry contract.
5. Accelerated Safe Delivery v1 governance is durably recorded.
6. Claude independently reviews the exact implementation-entry PR head and returns the required approval verdict with no blocking P0/P1/P2.
7. ChatGPT explicitly authorizes merge.
8. This implementation-entry PR is squash-merged to `main`.
9. Post-merge main CI succeeds.

At the reviewed head, conditions 1, 2, 3, 4 and 5 are satisfied. This artifact
discharges condition 6. Conditions 7, 8 and 9 remain outstanding, so **D-054
remains conditional and not effective**.

**Explicit non-authorization verified** (item 10). D-054 does **not** authorize:
production, merchant production data, enabling inventory-write flags, Shopify
inventory mutations, Phase 2 runtime, or PR 6 runtime.

The only occurrence of the phrase "Until D-054 is EFFECTIVE:" (brief line 3203)
introduces a list of **prohibitions**. It is a conditional guard, not an
assertion of effectiveness.

**Implementation branch absent — CONFIRMED.** `git ls-remote --heads origin`
enumerates every remote branch; `phase-1/catalog-location-inventory-facts` is
**not present**.

**No D-055 — CONFIRMED.** Every `D-055` occurrence in the repository is a
prohibition ("Do not create D-055") in DECISIONS.md, PROJECT_STATUS.md, and
`phases/phase-1/README.md`. No D-055 decision record exists.

---

## 5. F-CLAUDE-PR5C8-01 — advisory-lock capacity

**Disposition: RESOLVED for implementation entry. R-161 correctly remains OPEN.**

### 5.1 PostgreSQL claims verified against primary documentation

Every PostgreSQL claim in the contract was checked against official PostgreSQL 18
documentation rather than accepted from the brief.

| Claim in contract | Primary source | Verified |
|---|---|---|
| Shared lock table has space for `max_locks_per_transaction` objects per server process or prepared transaction | `runtime-config-locks.html` | YES — verbatim |
| Limits the **average**; individual transactions **can lock more objects** as long as all transactions fit | `runtime-config-locks.html` | YES — verbatim |
| Default 64; **not** a hard per-transaction cap; server-start only | `runtime-config-locks.html` | YES — verbatim |
| Advisory locks are session-level or transaction-level; session-level does not honor rollback; transaction-level released at transaction end | `explicit-locking.html` §13.3.5 | YES |
| Both advisory and regular locks share a memory pool sized by `max_locks_per_transaction` and `max_connections`; exhausting it prevents granting any locks | `explicit-locking.html` §13.3.5 | YES — verbatim |
| `pg_advisory_xact_lock(key1 integer, key2 integer)` is exclusive, transaction-level, waits if necessary | `functions-admin.html` §9.28.10 | YES |
| `max_connections` default typically 100; server-start only | `runtime-config-connection.html` | YES |
| `max_prepared_transactions` default 0; server-start only | `runtime-config-resource.html` | YES |

The contract **correctly refuses** to treat `max_locks_per_transaction = 64` as a
literal hard per-transaction maximum, and correctly labels
`shared_lock_object_budget` an **estimate** rather than guaranteed free capacity.
Both were required review points and both are honoured.

### 5.2 Capacity arithmetic — independently recomputed

Conditions under review:

```
A: canonicalLocksPerTransaction <= floor(max_locks_per_transaction / 2)
B: canonicalLocksPerTransaction * configuredWorstCaseConcurrentCanonicalTransactions
     <= floor(shared_lock_object_budget * 0.25)
shared_lock_object_budget = max_locks_per_transaction * (max_connections + max_prepared_transactions)
```

Evaluated at the proposed defaults `batch = 32`, `concurrency = 4`:

| Configuration (`mlpt`/`max_conn`/`max_prep`) | budget | A cap | A | B need | B cap | B | Accepted |
|---|---|---|---|---|---|---|---|
| PostgreSQL defaults 64/100/0 | 6400 | 32 | PASS | 128 | 1600 | PASS | **YES** |
| Small managed 64/25/0 | 1600 | 32 | PASS | 128 | 400 | PASS | YES |
| Very small 64/10/0 | 640 | 32 | PASS | 128 | 160 | PASS | YES |
| Reduced lock table 32/100/0 | 3200 | 16 | FAIL | 128 | 800 | PASS | **NO → reduce** |
| Reduced lock table 16/100/0 | 1600 | 8 | FAIL | 128 | 400 | PASS | **NO → reduce** |
| Large 256/200/0 | 51200 | 128 | PASS | 128 | 12800 | PASS | YES |
| With 2PC 64/100/100 | 12800 | 32 | PASS | 128 | 3200 | PASS | YES |
| Connection-constrained 64/5/0 | 320 | 32 | PASS | 128 | 80 | FAIL | **NO → reduce** |

Automatic downward reduction produces a safe effective batch in every rejecting
case (`32/100/0 → 16`; `16/100/0 → 8`; `64/5/0 → 20`). No configuration produces
an unsafe accepted batch, and no configuration leaves the algorithm without a
usable smaller batch above the guaranteed one-identity floor.

**Conservatism check.** Real PostgreSQL sizes the lock table by
`max_locks_per_transaction * (MaxBackends + max_prepared_transactions)`, where
`MaxBackends` includes autovacuum workers, background workers, and WAL senders in
addition to `max_connections`. The contract's formula counts only
`max_connections`, therefore it **undercounts** the true budget and makes
condition B **stricter** than reality. The direction of error is fail-safe.

**Capacity arithmetic verdict: SOUND AND CONSERVATIVE.** The `32 / 4 / 25%`
values are acceptable as **initial implementation defaults**, because they are
not asserted as proven production safety: they are gated on settings actually
read at runtime, automatically reduced when unsafe, never used to raise server
configuration, and explicitly subject to deployment evidence under R-161 and Race
AW. No pre-implementation P2 correction is required.

### 5.3 Coverage of the required capacity dimensions

| Dimension | Addressed | Notes |
|---|---|---|
| Direct one-identity PR5 transactions | YES | Must be included in capacity evidence even on a separate request path |
| Ordinary PostgreSQL/application locks sharing the table | YES | 25% ceiling reserves ≥75% for the rest of the system |
| Simultaneous reconciliation / bulk workers | YES | "must include all relevant PR 5 bulk / reconciliation worker concurrency" |
| Advisory-key collisions | YES | Collisions over-serialize only; never under-serialize |
| Transaction lock lifetime | YES | Transaction-scoped only; session-level forbidden; no lock across Shopify I/O |
| Actual shared lock-resource exhaustion | YES | Explicit fail-closed path |
| Waiting/contending locks vs lock-table exhaustion | PARTIAL | See F-CLAUDE-PR5IE-02 (P3) |
| Configurations smaller/larger than defaults | YES | Verified in §5.2 across eight configurations |
| Bounded retries | YES | Bounded exponential backoff; halving sub-batch |
| Minimum one-identity failure | YES | "stop at one identity", then degrade/fail |
| Degraded/failure reporting | YES | Explicit degraded/failed job state under PR 4 / PR 5 semantics |

### 5.4 Failure behavior

All eleven required failure properties are present and correctly stated: abort;
zero canonical partial commit; zero half-applied `ACTIVE -> ABANDONED` fencing;
transaction-level advisory locks released through rollback; bounded backoff;
smaller sub-batch; never split one canonical identity; never unanchored fallback;
stop at one identity; repeated one-identity failure ends explicitly
degraded/failed; no infinite retry; no silently dropped identities; no Shopify
mutation.

**Lock-wait / exhaustion verdict:** exhaustion is handled correctly and
fail-closed. Deadlock is prevented by the deterministic ascending `(key1, key2)`
ordering with PostgreSQL deadlock detection as backstop, and hold time is bounded
because no advisory lock is ever held across Shopify I/O. Indefinite *waiting* on
a stalled holder is the one uncovered sub-case — recorded as
**F-CLAUDE-PR5IE-02 (P3)**.

**Bounded-retry verdict:** SOUND for acquisition failure; see F-CLAUDE-PR5IE-02
for acquisition stall.

### 5.5 Race AW

Race AW requires a disposable PostgreSQL instance at the intended
`max_locks_per_transaction` envelope, concurrent canonical multi-identity
transactions at the configured ceiling, concurrent direct one-identity work, an
intentionally unsafe configured envelope, and a lock-resource exhaustion case.
Expected outcomes cover envelope rejection/reduction, whole-transaction abort, no
half-applied canonical or abandonment state, no surviving advisory locks, bounded
retry with a smaller sub-batch, absence of any unanchored fallback, one identity
never split, explicit degraded/failure termination, no infinite retry, no
inventory mutation, and reproduction of vectors 1–3.

**Race AW verdict: ADEQUATE** as an implementation-entry test contract. Its only
gap is a stalled-holder case, folded into F-CLAUDE-PR5IE-02.

**R-161: OPEN — CONFIRMED.** Recorded P2, "OPEN — PR 5 implementation entry
(D-054 conditional)", with an explicit instruction not to close it in this docs
PR. This review does **not** close R-161; deployment and test evidence remain
required.

---

## 6. F-CLAUDE-PR5C8-02 — lock-key determinism

**Disposition: RESOLVED. R-160 correctly remains OPEN.**

### 6.1 Encoding verdict

| Requirement | Observed | Result |
|---|---|---|
| Version `stocky-pr5-canonical-lock-v1` | Pinned | PASS |
| `<decimal UTF-8 byte length>:<UTF-8 bytes>` per component | Exact | PASS |
| No separator beyond length-prefix encoding | "concatenated with **NO** additional separator" | PASS |
| Byte length, not JS string length | "The **byte length**, not JavaScript string length, is authoritative" | PASS |
| No trim / lowercase / Unicode normalization / domain normalization | All four explicitly forbidden | PASS |
| `shopId` = exact persisted `Shop.id` bytes | Required; `myshopifyDomain` explicitly forbidden | PASS |
| Resource kinds exact | `Product`, `ProductVariant`, `InventoryItem`, `Location`, `InventoryLevel` | PASS |
| Component orders as documented | Verified for all five kinds | PASS |
| SHA-256 | Yes | PASS |
| Digest bytes 0..3 → signed int32 BE `key1` | Yes | PASS |
| Digest bytes 4..7 → signed int32 BE `key2` | Yes | PASS |
| No JS `Number` 64-bit conversion | Explicitly forbidden; two-key 32-bit form chosen for this reason | PASS |
| One canonical derivation function | Required; duplicated hand-written derivation forbidden | PASS |

The Prisma model was inspected directly:
`stocky-plus/prisma/schema.prisma:48-49` declares
`model Shop { id String @id @default(cuid()) … }`, matching the contract's
description of `Shop.id` exactly.

**Superseded-encoding check.** The earlier 4-byte binary length prefix and
SCREAMING_SNAKE resource-kind literals appear **exactly once**, in the sentence
declaring them superseded. No SCREAMING_SNAKE resource-kind literal survives
anywhere in the brief, and only one encoding version is referenced. There is no
residual second encoding that could cause two writers to derive different keys.

**Injectivity check (independently tested).** The length-prefixed encoding is
unambiguously parseable: the decimal length is read up to the first `:`, then
exactly that many bytes are consumed, and `String(n)` never emits a leading zero.
Adversarial components that themselves contain `<digits>:` sequences produce
distinct preimages — e.g. `["…","a","Product","7:Product"]` yields
`28:…1:a7:Product9:7:Product`, distinct from the differently-split
`28:…1:a7:Product8:7:Produc1:t`. **No under-serialization is possible from
encoding ambiguity.** Same identity always yields the same `(key1, key2)`.

### 6.2 Known-answer vector reproduction

Reproduced independently from the written specification using a disposable Node
`crypto` script. The implementation was written from the contract text — not by
copying the recorded preimage strings — and the computed preimages then matched
the recorded preimages byte for byte.

**Vector 1 — Product**

- Components: `stocky-pr5-canonical-lock-v1`, `cm1234567890abcdefghijk`, `Product`, `gid://shopify/Product/1234567890`
- Computed preimage: `28:stocky-pr5-canonical-lock-v123:cm1234567890abcdefghijk7:Product32:gid://shopify/Product/1234567890`
- Computed SHA-256: `872f7a6ab5d396d0738736ef15c37065e2bf6fba6f7480dd8f517fe487d799c1` — **MATCH**
- `key1 = -2026931606` — **MATCH**
- `key2 = -1244424496` — **MATCH**
- **REPRODUCED**

**Vector 2 — ProductVariant**

- Components: `stocky-pr5-canonical-lock-v1`, `cm1234567890abcdefghijk`, `ProductVariant`, `gid://shopify/ProductVariant/9876543210`
- Computed preimage: `28:stocky-pr5-canonical-lock-v123:cm1234567890abcdefghijk14:ProductVariant39:gid://shopify/ProductVariant/9876543210`
- Computed SHA-256: `74825407ef1400f9b02bf51b778b04cf20c765605c541131e4a6a84701d92e7e` — **MATCH**
- `key1 = 1954698247` — **MATCH**
- `key2 = -283901703` — **MATCH**
- **REPRODUCED**

**Vector 3 — InventoryLevel**

- Components: `stocky-pr5-canonical-lock-v1`, `cm1234567890abcdefghijk`, `InventoryLevel`, `gid://shopify/InventoryItem/1111111111`, `gid://shopify/Location/2222222222`
- Computed preimage: `28:stocky-pr5-canonical-lock-v123:cm1234567890abcdefghijk14:InventoryLevel38:gid://shopify/InventoryItem/111111111133:gid://shopify/Location/2222222222`
- Computed SHA-256: `3c8acc13010dc2cc5e30275b4c581f156acb07eb914e3f59e8bf5e80a9cb0713` — **MATCH**
- `key1 = 1015729171` — **MATCH**
- `key2 = 17679052` — **MATCH**
- **REPRODUCED**

All three key pairs are within signed 32-bit range and are therefore valid
PostgreSQL `integer` advisory-lock keys.

**Canonical encoding verdict: CORRECT, DETERMINISTIC, AND INDEPENDENTLY
REPRODUCIBLE.**

### 6.3 Non-ASCII vector

All three vectors are pure ASCII, so for every component the UTF-8 byte length
equals the JavaScript string length. The vectors therefore have **zero
discriminating power** for the contract's own byte-length invariant: an
implementation that incorrectly used `s.length` would pass all three unchanged.

A non-ASCII vector would discriminate. Verified concretely: for components
`[version, "shop-😀", "Product", "gid://shopify/Product/1"]` a correct
byte-length implementation yields `key1 = 1363557841, key2 = -948525148`, whereas
a `s.length` implementation yields `key1 = -24703316, key2 = -1873164610`.

However, this is **test hardening, not material contract ambiguity**, because:

1. the contract prose states the rule unambiguously and in bold;
2. every PR 5 identity component is structurally ASCII-only — `Shop.id` is a
   Prisma `cuid()` (`[a-z0-9]`), `resourceKind` values are fixed ASCII literals,
   and Shopify GIDs are ASCII `gid://shopify/<Kind>/<digits>` — so a divergence
   cannot be reached by PR 5's own inputs.

**Recommendation severity: P3** (F-CLAUDE-PR5IE-01). Add a fourth known-answer
vector with a multi-byte UTF-8 component as defensive regression coverage.

**R-160: OPEN — CONFIRMED.** Recorded P1, "OPEN — PR 5 planning / implementation
entry (D-053 / D-054 conditional)", extended with the F-CLAUDE-PR5C8-02 encoding
mitigation and explicitly not closed from planning. This review does **not**
close R-160.

---

## 7. Accelerated Safe Delivery v1 — governance verdict

`stocky-plus/docs/ACCELERATED_SAFE_DELIVERY.md` (270 lines, new) was reviewed in
full against every required property.

| Required property | Section | Result |
|---|---|---|
| Safety gates unchanged | §1 | PASS |
| Runtime dependencies merge sequentially | §2, §6 | PASS |
| Shared foundations freeze before dependent runtime lanes | §2, §5 | PASS |
| One-level-ahead work is planning/research only | §3 | PASS |
| One-level-ahead planning requires explicit ChatGPT authorization | §3 | PASS |
| Future runtime cannot start early | §3, §12 | PASS |
| 2–4 Cursor lanes only when ChatGPT defines them | §4 | PASS |
| Separate branch / chat / objective per lane | §4 | PASS |
| Exclusive file/module ownership | §4 | PASS |
| No concurrent schema/migration/shared transaction writers | §4 | PASS |
| Small PRs, not a giant phase PR | §6 | PASS |
| Tier A keeps independent Claude review and full CI | §7 | PASS |
| Early Claude red team enumerates the full material finding set | §8 | PASS |
| Final exact-head Claude review still mandatory | §8 | PASS |
| Independent review cannot be replaced by another Cursor lane | §8 | PASS |
| ChatGPT consolidates corrections where practical | §9 | PASS |
| GitHub remains the durable handoff evidence | §10 | PASS |
| No test deletion for speed | §11 | PASS |
| No CI sharding authorized by this PR | §11 | PASS |

**Governance verdict: the canonical model does NOT weaken the phase workflow.**
It constrains calendar execution only. §1 explicitly forbids using a faster
schedule to skip a gate, shrink a required test, or treat a polished interface as
proof of completion. §7 states that risk tier does not override an explicit phase
gate. §12 preserves the phase boundary while clarifying that authorized,
labelled, one-level-ahead planning is not "silently starting the next phase".

**One-level-ahead planning verdict: SAFE.** Permission is explicitly conditioned
on express ChatGPT authorization, the allowed artifact list is research/design
only, and future-phase runtime, migrations, Shopify configuration, and production
actions are enumerated as forbidden.

**Parallel-lane safety verdict: SAFE.** Lanes require frozen shared contracts
first, are capped at 2–4, exist only when ChatGPT defines them, and mandate one
writer per branch/PR with exclusive ownership and no overlapping schema,
migration, or shared transaction-contract ownership.

**Tier-A review verdict: PRESERVED.** Tier A retains an explicit architecture /
acceptance contract, independent Claude review, exact-head full CI, and
adversarial failure/race testing, with final exact-head review still mandatory
and non-substitutable.

### 7.1 Permanent agent instructions

| Document | Links to canonical doc | Mandatory summary | Verdict |
|---|---|---|---|
| `AGENTS.md` | YES | 11-point rule block plus both agent constraints | PASS |
| `stocky-plus/docs/README.md` | YES | Listed among core control documents | PASS |
| `agents/README.md` | YES | Cursor and Claude summaries, plus "do not copy the whole document" | PASS |
| `07_CURSOR_MASTER_PROMPT.md` | YES | 8-point mandatory Cursor block | PASS |
| `08_CLAUDE_CODE_MASTER_REVIEW_PROMPT.md` | YES | 6-point mandatory Claude block | PASS |
| `CHATGPT_PROJECT_INSTRUCTIONS.md` | YES | 8-point mandatory ChatGPT block | PASS |
| `CLAUDE_PROJECT_INSTRUCTIONS.md` | YES | 6-point mandatory Claude block | PASS |
| `phases/README.md` | YES | Clarifies "next phase not silently started early" | PASS |

**Cursor permanent-instruction verdict: SUFFICIENT.** The Cursor summary
independently carries the four self-start prohibitions that matter most —
lanes only when ChatGPT defines them, no adjacent runtime work on its own,
one-level-ahead planning only when expressly authorized, and foundations freeze
first. A Cursor agent reading only `07_CURSOR_MASTER_PROMPT.md` or `AGENTS.md`
cannot conclude it may self-start runtime or invent a lane.

**Claude permanent-instruction verdict: SUFFICIENT.** Both Claude documents carry
the early-red-team duty, the one-pass enumeration duty, the mandatory final
exact-head review, and the non-substitution rule.

**Stale-instruction review.** Both master prompts retain Phase-0-era scoping —
`07` still contains "First assignment: Phase 0 only" and "Stop after Phase 0",
and `08` still contains "Review Cursor's Phase-0 PR only", the `docs/CLAUDE_PHASE_0_REVIEW.md`
artifact paths, a verdict enum capped at `READY FOR PHASE 1 FOUNDATION`, and a
"then fix only P0 / narrow P1" fix policy that sits awkwardly beside the current
model in which Cursor is the writer for corrections.

This residue is **pre-existing on `main`** and this PR is **purely additive** to
both files (zero deleted lines). It does not make the accelerator ambiguous: the
new blocks are additive and non-contradictory, both stale sections are explicitly
labelled as the *first* assignment/review rather than standing rules, and
`CLAUDE.md` already governs with "Use the verdict required by the active phase".
Recorded as **F-CLAUDE-PR5IE-04 (P3)** documentation maintenance.

---

## 8. Control-record consistency

| Assertion | AGENTS.md | PROJECT_STATUS | DECISIONS | RISK_REGISTER | phases/README | phase-1/README | PR5 brief | agent docs |
|---|---|---|---|---|---|---|---|---|
| PR #24 merged | — | YES | YES | — | — | YES | YES | — |
| D-053 planning accepted / merged | — | YES | YES | — | — | YES | YES | — |
| D-054 conditional / not effective | — | YES | YES | YES | — | YES | YES | — |
| PR 5 implementation not started / not authorized | — | YES | YES | — | — | YES | YES | — |
| Production not authorized | YES | YES | YES | — | — | YES | YES | — |
| Inventory-write flags DEFAULT OFF | YES | YES | YES | — | — | YES | YES | — |
| Accelerated Safe Delivery v1 canonical | YES | — | YES | — | YES | YES | — | YES |

Risk status at the reviewed head:

| Risk | Severity | Status | Verified |
|---|---|---|---|
| R-157 | P1 | **OPEN — PR 5 planning (D-053)** | YES |
| R-158 | P1 | **OPEN — PR 5 planning (D-053)** | YES |
| R-159 | P2 | **OPEN — PR 5 planning (D-053)** | YES |
| R-160 | P1 | **OPEN — PR 5 planning / implementation entry (D-053 / D-054 conditional)** | YES |
| R-161 | P2 | **OPEN — PR 5 implementation entry (D-054 conditional)** | YES |

- No D-055 — CONFIRMED.
- Implementation branch absent — CONFIRMED.
- D-054 not marked effective anywhere — CONFIRMED.
- No immutable review artifact edited — CONFIRMED.

**Control-record consistency verdict: CONSISTENT.** No contradiction was found
between any two control records.

---

## 9. Exact-head CI evidence

Run [`31962317982`](https://github.com/Vedang1998/Stocky/actions/runs/31962317982):

| Field | Value |
|---|---|
| Event | `pull_request` |
| Base | `edabd8de1f1b25cc5f5f1026e34ddf69aa104f7e` |
| Head | `930c1a728b3256e4932cb297cc91569c53d17020` |
| Conclusion | **success** |

| Job | ID | Result |
|---|---|---|
| Classify change set | `95202024967` | **SUCCESS** |
| Lint, typecheck, test, build, Prisma, GraphQL (Heavy) | `95202046620` | **SKIPPED** |
| CI Gate | `95202046284` | **SUCCESS** |

Classifier output read directly from the job log:

```
compare_base=edabd8de1f1b25cc5f5f1026e34ddf69aa104f7e
compare_head=930c1a728b3256e4932cb297cc91569c53d17020
range_usable=true
changed_path_count=14
… all 14 paths classified [docs] …
classification_reason=every_changed_path_is_docs_allowlist
docs_only=true
full_ci=false
```

The classifier self-test reported `assertions=40 pass=40 fail=0`, and
`git diff --check` passed at the exact head.

- `changed_path_count=14` — MATCHES the approved scope.
- `docs_only=true`, `full_ci=false` — as expected.
- `workflow_dispatch` — **NOT USED** (`event=pull_request`).
- Total automatic runs for this exact head: **1**. No duplicate feature-branch
  push run.

The prior run [`31962278945`](https://github.com/Vedang1998/Stocky/actions/runs/31962278945)
failed at head `e8460301696b56c0362daa6c9c773f1773f94e16` on a `git diff --check`
trailing-whitespace violation in the new governance header. That head is **not**
the reviewed head; commit `930c1a7` fixed it. The failed run is correctly
retained as historical/superseded evidence.

**Exact-head CI verdict: PASS.**

---

## 10. Findings

**P0: 0   P1: 0   P2: 0   P3: 4**

No blocking finding was identified. D-054 condition 6 ("no blocking P0/P1/P2") is
satisfied.

---

### F-CLAUDE-PR5IE-01 — P3 — Known-answer vectors cannot detect a JS-string-length implementation

- **File / line:** `stocky-plus/docs/phases/phase-1/PR5_CATALOG_LOCATION_INVENTORY_FACTS_BRIEF.md:1365-1435`
- **Evidence:** All three vectors use only ASCII components, so UTF-8 byte length equals JavaScript string length for every component. An implementation using `s.length` instead of `Buffer.byteLength(s,'utf8')` reproduces all three vectors exactly.
- **Merchant impact:** None reachable today. PR 5 identity components are structurally ASCII-only (`Shop.id` is a `cuid()`; `resourceKind` values are fixed ASCII literals; Shopify GIDs are ASCII), so the divergence cannot be triggered by PR 5 inputs.
- **Reproduction:** For `[version, "shop-😀", "Product", "gid://shopify/Product/1"]`, byte-length derivation gives `key1=1363557841, key2=-948525148`; string-length derivation gives `key1=-24703316, key2=-1873164610`. Substituting an ASCII component makes the two identical.
- **Expected behavior:** The mandatory vector set should be able to fail an implementation that violates the stated byte-length rule.
- **Recommended correction:** Add **Vector 4** with a multi-byte UTF-8 component (for example a `resourceKind`-adjacent test string or a synthetic `shopId`) and pin its preimage, SHA-256, `key1`, and `key2`.
- **Missing test:** Non-ASCII known-answer vector in the runtime unit-test suite.
- **Classification rationale:** The contract prose is unambiguous ("The **byte length**, not JavaScript string length, is authoritative"), so this is **test hardening**, not material ambiguity. **P3**, non-blocking.

---

### F-CLAUDE-PR5IE-02 — P3 — Bounded-retry policy covers acquisition failure but not acquisition stall

- **File / line:** `stocky-plus/docs/phases/phase-1/PR5_CATALOG_LOCATION_INVENTORY_FACTS_BRIEF.md:1636-1674`
- **Evidence:** `pg_advisory_xact_lock` waits indefinitely by default (official PostgreSQL 18 §9.28.10, confirmed). The fail-closed contract is written for the case where locks *cannot be granted* because shared lock resources are exhausted. No `lock_timeout`, `pg_try_advisory_xact_lock` variant, or `idle_in_transaction_session_timeout` bound is specified for the case where the lock is simply *held* by a stalled peer.
- **Merchant impact:** Availability only, not integrity. A worker whose backend stalls inside a canonical transaction (for example an `idle in transaction` session after an application-node hang) holds the identity anchor until that backend terminates; other workers on the same identity block inside the lock call and therefore never reach steps 5–10 of the fail-closed policy, so the "bounded retry" and "explicit degraded / failure state" guarantees do not engage for that path.
- **Reproduction:** Open session A, `BEGIN`, `pg_advisory_xact_lock(k1,k2)`, then leave the session idle in transaction. Session B calling the same keys blocks indefinitely rather than degrading.
- **Expected behavior:** Every path that can prevent canonical progress should terminate in bounded time and end in an explicit degraded/failed state, matching the stated "Do not loop indefinitely" intent.
- **Recommended correction:** In the capacity envelope, specify a bounded acquisition wait — a transaction-scoped `lock_timeout`, or `pg_try_advisory_xact_lock` with bounded backoff — and require a deployment `idle_in_transaction_session_timeout`. Extend Race AW with a stalled-holder sub-case.
- **Missing test:** Race AW sub-case for a stalled lock holder (as distinct from lock-table exhaustion).
- **Classification rationale:** Materially contained by three existing invariants — no advisory lock is held across Shopify I/O, locks are transaction-scoped and always released at transaction end including backend termination, and multi-identity ordering is deterministic. R-161 is already **OPEN** and explicitly requires deployment and test evidence, which is the correct place to close this. **P3**, non-blocking for a documentation gate.

---

### F-CLAUDE-PR5IE-03 — P3 — Condition A has zero headroom at PostgreSQL defaults

- **File / line:** `stocky-plus/docs/phases/phase-1/PR5_CATALOG_LOCATION_INVENTORY_FACTS_BRIEF.md:1596-1610`
- **Evidence:** At the PostgreSQL default `max_locks_per_transaction = 64`, condition A evaluates to `32 <= floor(64/2) = 32` — satisfied at exact equality, with a margin of 0. Condition B by contrast carries roughly 12.5× headroom (`128 <= 1600`).
- **Merchant impact:** None directly. The consequence is that any deployment with `max_locks_per_transaction < 64` immediately fails condition A and forces automatic downward reduction. That behavior is correct and fail-safe, and was verified (`32/100/0 → 16`, `16/100/0 → 8`).
- **Reproduction:** Evaluate condition A at `mlpt = 64, batch = 32` and at `mlpt = 63`.
- **Expected behavior:** The chosen default's proximity to its own acceptance boundary should be explicit, so a future batch increase is not mistaken for available headroom.
- **Recommended correction:** Record in the brief that 32 sits exactly on condition A's boundary at the PostgreSQL default, and that any increase above 32 requires both capacity evidence **and** a `max_locks_per_transaction` above 64.
- **Missing test:** Capacity-gate unit test asserting acceptance at `mlpt = 64` and reduction at `mlpt = 63`.
- **Classification rationale:** The arithmetic is correct and the fail-safe path is specified and verified. Documentation clarity only. **P3**, non-blocking.

---

### F-CLAUDE-PR5IE-04 — P3 — Stale Phase-0-only residue in both master prompts

- **File / line:** `stocky-plus/docs/agents/07_CURSOR_MASTER_PROMPT.md:40,175`; `stocky-plus/docs/agents/08_CLAUDE_CODE_MASTER_REVIEW_PROMPT.md:22,24,79,100,113,118,177`
- **Evidence:** `07` retains "First assignment: Phase 0 only" and "Stop after Phase 0 and open a PR." `08` retains "Review Cursor's Phase-0 PR only", required artifacts `docs/CLAUDE_PHASE_0_REVIEW.md` / `docs/REVIEW_FINDINGS.md` / `docs/RELEASE_READINESS.md` (which do not match the current `stocky-plus/docs/phases/phase-1/` convention), a verdict enum capped at `READY FOR PHASE 1 FOUNDATION` that omits the phase verdicts actually in use, and a "then fix only P0 / narrowly unambiguous P1" fix policy that conflicts with the current model in which Cursor is the writer for corrections.
- **Merchant impact:** None. Governance clarity only.
- **Reproduction:** Read either master prompt end to end without also reading `CLAUDE.md` and the active phase prompt.
- **Expected behavior:** Permanent agent instructions should not present superseded Phase-0 scope, artifact paths, verdict vocabulary, or fix policy as current.
- **Recommended correction:** Mark both sections as historical Phase-0 bootstrap, point verdict selection at the active phase prompt, and align the `08` fix policy with the current Cursor-is-writer model.
- **Missing test:** None applicable (documentation).
- **Classification rationale:** **Pre-existing on `main`** — this PR deletes zero lines from either file and only adds the new mandatory blocks. The accelerator itself is unambiguous, both stale sections are self-labelled as the *first* assignment/review, and `CLAUDE.md` already directs "Use the verdict required by the active phase". **P3**, non-blocking, and explicitly **not** attributable to this PR.

---

## 11. What this review does and does not do

This approval means only that **PR #26 is safe for ChatGPT's merge decision**.

It does **NOT**:

- make D-054 effective while the PR remains unmerged;
- authorize PR 5 runtime implementation;
- authorize creation of `phase-1/catalog-location-inventory-facts`;
- authorize production or merchant production data;
- authorize enabling any inventory-write flag or any Shopify inventory mutation;
- authorize Phase 2 runtime or PR 6 runtime;
- close R-157, R-158, R-159, R-160, or R-161.

PR 5 runtime remains **NOT STARTED / NOT AUTHORIZED**. Production remains **NOT
AUTHORIZED**. All inventory-write flags remain **DEFAULT OFF**. D-052 remains PR 4
technical-acceptance authority and D-053 remains PR 5 planning-acceptance
authority.

Corrections for the four P3 findings are recorded here only. **Cursor remains the
writer** for any correction.

---

## 12. Verdict

**APPROVE PR5 IMPLEMENTATION ENTRY**

Findings: **P0 0 / P1 0 / P2 0 / P3 4**
(F-CLAUDE-PR5IE-01, F-CLAUDE-PR5IE-02, F-CLAUDE-PR5IE-03, F-CLAUDE-PR5IE-04 —
all non-blocking.)

Reviewed base `edabd8de1f1b25cc5f5f1026e34ddf69aa104f7e`, reviewed head
`930c1a728b3256e4932cb297cc91569c53d17020`, PR #26 OPEN / DRAFT / UNMERGED.
