# PR 5 Planning — FINAL Independent Corrections 6 + 7 Re-Review

**Review type:** FINAL independent Corrections 6 + 7 PR 5 planning re-review
**Reviewer:** Claude Code (independent principal engineer / architecture and
security reviewer)
**Authority:** D-053 — *Phase 1 PR 5 planning authorization* only
**Date:** 2026-08-16

This document is **immutable historical evidence**. Do not edit it after it is
committed.

---

## 1. Reviewed identity

| Item | Value |
|---|---|
| Reviewed base (`origin/main`) | `a15d58e0a9d99dd9497fe3243068d4a728aee52a` |
| Reviewed planning head | `2db55b6f11bf91d4a07aeabfcc3ce38a5122119f` |
| Branch | `phase-1/pr5-planning` |
| PR | [#24](https://github.com/Vedang1998/Stocky/pull/24) — OPEN / DRAFT / UNMERGED |
| Correction-6 head | `6dd041d058a847479f807814c2012af270f7f556` |
| Correction-7 head | `2db55b6f11bf91d4a07aeabfcc3ce38a5122119f` |
| Correction 7 vs Correction 6 | exactly **1** commit ahead (verified ancestor) |
| Full PR effective diff | 9 changed paths, 12 commits, docs-only |

### Prior immutable review blobs (verified unmodified at the reviewed head)

| Artifact | Blob | Result |
|---|---|---|
| `PR5_PLANNING_INDEPENDENT_REVIEW.md` | `f6e62fe16a63a79f778daaee6991296868a8285b` | **MATCH** |
| `PR5_PLANNING_CORRECTION_4_INDEPENDENT_REVIEW.md` | `e645c81c38419c962d6b8670542aee082fee56ee` | **MATCH** |
| `PR5_PLANNING_CORRECTION_5_INDEPENDENT_REVIEW.md` | `c465b7d0dbc50d1189af34e9ef8d7e0672186a31` | **MATCH** |

### No separate Correction-6 independent artifact

There is **no** `PR5_PLANNING_CORRECTION_6_INDEPENDENT_REVIEW.md`, and its
absence is **intentional and correct**. Correction 7 was inserted before that
independent gate could run, because ChatGPT identified a residual wall-clock
rollback path in the Correction-6 design. **This artifact therefore reviews
Corrections 6 and 7 cumulatively**, and is the single independent gate for both.

### Correction-7 delta (verified exact)

Commit `2db55b6` — *"Correct PR 5 planning for durable lease abandonment
fencing."* — exactly five files:

```
M stocky-plus/docs/DECISIONS.md
M stocky-plus/docs/PROJECT_STATUS.md
M stocky-plus/docs/RISK_REGISTER.md
M stocky-plus/docs/phases/phase-1/PR5_CATALOG_LOCATION_INVENTORY_FACTS_BRIEF.md
M stocky-plus/docs/phases/phase-1/README.md
```

`OPEN_QUESTIONS.md` unchanged in Correction 7. No runtime, schema, migration,
`.github`, or Shopify-configuration delta anywhere in the PR. Implementation
branch `phase-1/catalog-location-inventory-facts` **absent**. No D-054.

---

## 2. Correction-6 clock-model verdict — **SOUND**

Every rule required of the Correction-6 clock model is present and normative.

| Required rule | Evidence | Verdict |
|---|---|---|
| `clock_timestamp()` is the sole authoritative lease clock | §6.F.2.1 lines 654–689 | **MET** |
| `leaseExpiresAt` computed in PostgreSQL from PostgreSQL time | §6.E.1 line 351; §6.F.2.1 lines 691–706; §6.F.2 step 1 lines 536–540 | **MET** |
| Application supplies duration only, never absolute current time | §6.F.2.1 lines 700–704 | **MET** |
| `Date.now()` / `new Date()` / node / container / local timers / response-arrival wall time excluded | §6.F.1 line 433; §6.F.2.1 lines 659–671 | **MET** |
| Valid iff `clock_timestamp() < leaseExpiresAt` | §6.F.2.1 lines 713–714 | **MET** |
| Expired iff `clock_timestamp() >= leaseExpiresAt` | §6.F.2.1 lines 715–716 | **MET** |
| Equality is **expired** | §6.F.2.1 lines 718–719 | **MET** |
| One operator convention across every lease predicate | §6.F.2.1 lines 721–732 (enumerates all six predicate sites) | **MET** |
| Final fact fence re-evaluates real PostgreSQL time **after** lock waiting | §6.F.2.1 lines 954–978; §6.F.2 step 4 lines 550–557 | **MET** |
| `transaction_timestamp()` / `CURRENT_TIMESTAMP` / `now()` not substituted at the fence | §6.F.2.1 lines 679–682, 970–971 | **MET** |
| `statement_timestamp()` not relied on where a lock wait can stale it | §6.F.2.1 lines 683–684, 972–973 | **MET** |
| Lease is liveness/fencing only — never Shopify ordering or Clock A/B/C | §6.F.1 lines 432, 449–451; §6.F.2.1 lines 643–652, 688–689 | **MET** |

The PostgreSQL 18 citations in the brief are accurate against the official
current-date/time documentation: `CURRENT_TIMESTAMP` / `now()` /
`transaction_timestamp()` are transaction-start; `statement_timestamp()` is
statement-start; `clock_timestamp()` is actual server time when evaluated and
advances within a statement.

**Races AM / AO / AP / AQ / AR** were checked against these rules individually
and each is consistent with them. AO is notably strong: it fixes both node
clocks adversarially (one far ahead, one far behind) against the same lease
record and pins exact equality as expired, so it can genuinely fail an
implementation that reads a local clock.

---

## 3. Correction-5 finding dispositions

### F-CLAUDE-PR5C5-01 — P2 — authoritative lease clock unspecified → **RESOLVED**

§6.F.2.1 "Authoritative lease clock" (lines 654–689) names PostgreSQL database
time as the **sole** authoritative clock and `clock_timestamp()` as the
primitive, with an explicit prohibition list for application-node clocks
(lines 661–671) reinforced as a forbidden ordering key in §6.F.1 line 433.
Lease creation is database-computed (lines 691–706). The correction's third
requirement — that Race AM advance the *authoritative* clock rather than an
application timer — is satisfied: Race AM now states the crossing "**must** be
established using PostgreSQL-authoritative time (`clock_timestamp()`), **not**
an application fake clock or local timer", and Race AO adds the skew assertion.

### F-CLAUDE-PR5C5-02 — P3 — missing/deleted in-flight row not fail-closed → **RESOLVED**

§6.F.2.1 "Missing observation row — fail closed" (lines 1021–1039) states that
zero matching rows fail closed, enumerates the four forbidden interpretations,
forbids a stale worker recreating the row, and additionally makes
more-than-one-row a fail-closed data-integrity failure. Race AP asserts it.

### F-CLAUDE-PR5C5-03 — P3 — multiple-blocker partial-expiry race missing → **RESOLVED**

§6.F.2.1 "Explicit blocking semantics — all active blockers" (lines 734–784)
makes blocker evaluation existential across **all** overlapping observations
and forbids checking only the oldest / newest / one arbitrary row or releasing
on a single blocker's expiry. Race **AQ** is now mandatory and was extended by
Correction 7.

### F-CLAUDE-PR5C5-04 — P3 — response-before-expiry / apply-after-expiry race missing → **RESOLVED**

§6.F.2.1 lines 954–978 state the validity decision occurs at fact-application
time and that response arrival, `responseGen` allocation, transaction start,
and statement start each fail to reserve validity. Race **AR** encodes exactly
the five-step sequence the correction demanded, with the full negative
assertion set and burned `responseGen` as the only permitted residue.

**All four Correction-5 findings are closed.**

---

## 4. ChatGPT post-Correction-6 wall-clock rollback blocker — **PARTIALLY RESOLVED**

**Resolved for resultless observations.** The lease-invalidity / durable-
abandonment split (§6.F.2.1 lines 786–870) is correct and well-constructed. A
successor may rely on expiry only after durably transitioning the exact row
`ACTIVE -> ABANDONED`; `ABANDONED` is irreversible; the original worker's fence
requires `not ABANDONED`, so a persistently abandoned token fails regardless of
later wall-time movement.

**Residual for response-bearing ACTIVE observations.** The durable-abandonment
predicate requires `resultless`, so the one row class that can carry a usable
Shopify response across a pause is precisely the class that can never be
durably fenced. This is recorded as **F-CLAUDE-PR5C7-02** in §9 below.

---

## 5. Correction-7 durable-abandonment verdict — **SOUND (for resultless rows)**

| Required property | Evidence | Verdict |
|---|---|---|
| Conditional on exact `shopId` | §6.F.2.1 line 846 | **MET** |
| Conditional on exact canonical identity | line 847 | **MET** |
| Conditional on exact observation token | line 848 | **MET** |
| Conditional on `lifecycleState = ACTIVE` | line 849 | **MET** |
| Conditional on resultless | line 850 | **MET** (and see F-CLAUDE-PR5C7-02) |
| Conditional on `clock_timestamp() >= leaseExpiresAt` | line 851 | **MET** |
| `ABANDONED` can never return to `ACTIVE` | lines 856, 1017–1018; Race AN, AS | **MET** |
| Successor mutation + abandonment commit/roll back together | lines 887–895 | **MET** |
| No cross-role transaction introduced | lines 897, 1077–1091; §13 | **MET** |
| `stocky_control_plane` gets no merchant-domain DML | §6.E.1 line 337; §6.F.2.1 lines 1079–1088; §13 | **MET** |
| Physical DELETE / reaping remains maintenance | §6.E.1 line 356; §6.F.2.1 lines 858–860, 943–947 | **MET** |
| Successor correctness independent of background cleanup | lines 862–865 | **MET** |
| All blockers re-evaluated after fencing | lines 881–884; successor algorithm steps 4–5 | **MET** |
| Any remaining ACTIVE / unexpired / resultless overlap keeps mutation blocked | lines 882–884; §6.F.3 lines 1180–1200 | **MET** |

**Successor transaction atomicity verdict — SOUND.** Steps 3 and 7 of the
successor apply algorithm bind the abandonment fencing and the canonical fact
mutation into one tenant transaction under the identity-lock boundary, and
lines 891–895 make rollback symmetric with "no half-applied takeover state".

**All-blocker re-evaluation verdict — SOUND.** The algorithm fences, then
re-evaluates, then blocks if any ACTIVE unexpired resultless row survives.
The order is correct: fencing does not implicitly clear un-fenced blockers.

---

## 6. Database clock rollback verdict

**CASE 1 (rollback before any successor relies on expiry) — SOUND.**
§6.F.2.1 lines 923–931 and 1055–1062: the row may remain `ACTIVE` longer,
takeover may be delayed, no successor may mutate by treating a still-ACTIVE row
as abandoned, and this is explicitly classified as a liveness delay rather than
a safety violation. That classification is correct — a delayed takeover cannot
produce a stale apply.

**CASE 2 (rollback after durable `ACTIVE -> ABANDONED`) — SOUND for resultless
rows.** Lines 933–939 and 1064–1070: `lifecycleState = ABANDONED` is the
durable fencing evidence and the original worker always fails its token fence.
Lines 908–921 enumerate the full negative set — a stale worker cannot flip
`ABANDONED` back to `ACTIVE`, recreate a deleted row, write `LIVE`/`ABSENT`,
update null-version attributes, tombstone, revive, or clear newer evidence.

The brief correctly refuses to claim `clock_timestamp()` is monotonic
(lines 795–797, 941, 1043–1046), which is the honest reading of the official
PostgreSQL 18 documentation and the reason durable abandonment is needed at all.

**Race AS verdict — SUFFICIENT for the resultless case it covers.** AS proves
both required behaviors: after commit, A stays `ABANDONED`, cannot reactivate,
fails its fence, and cannot perform any of the seven forbidden writes while B's
canonical state remains authoritative; and the explicit rollback arm asserts
that B's abandonment transitions roll back with B's transaction, leaving no
half-applied takeover. The assertions are capable of failing an implementation
that fences on time alone rather than on durable lifecycle state.

**Race AQ verdict — CORRECT.** The extension states exactly the required shape:
A and B block C, A expires, C may durably fence A `ABANDONED`, B remains ACTIVE
and unexpired, and **C remains blocked by B**. It further states that A's
expiry/abandonment alone cannot release C, that the held C response is not
replayed as fresh, and that only a fresh observation after every blocker settles
may proceed. This matches §6.F.2.1 lines 752–784 exactly.

---

## 7. Final adversarial check 1 — nonexistent canonical fact identity — **FAILS**

**Verdict: the brief has no implementation-grade serialization contract for the
first-insert case.** This is recorded as **F-CLAUDE-PR5C7-01 (P1)** in §9.

The only serialization mechanism the brief states anywhere is row-level
`SELECT … FOR UPDATE` on the canonical fact row:

- §6.F.3 lines 1261–1266 — "Serialize apply per `(shopId, shopifyGid)` — or
  `(shopId, inventoryItemGid, locationGid)` for levels — with
  `SELECT … FOR UPDATE` inside the tenant transaction. This is row-level fact
  locking";
- §6.F.2 step 4 lines 550–551 — "enter the tenant fact transaction and take the
  identity `SELECT … FOR UPDATE`";
- §6.F.2.1 line 874 — "Under the canonical identity lock";
- §6.F.7 line 1369 — JSONL applicator step 1 is `SELECT … FOR UPDATE`.

Official PostgreSQL 18 documentation confirms that row-level locks apply only to
rows actually retrieved; a row that does not exist cannot be locked, and
predicate/gap locking is not available outside `SERIALIZABLE`. The brief
operates at READ COMMITTED (Race AA; §6.F.10 line 1747 forbids `REPEATABLE READ`
/ `SERIALIZABLE` for the sweep), so no predicate lock is available.

The first-insert path is explicitly in scope, not hypothetical: §6.F.5 rule 1
(line 1298) begins "If `S` does not exist: insert attributes from `I`", and
§6.F.7 step 1 applies the same `FOR UPDATE` to JSONL lines during initial sync —
which is the mass first-insert path. §6.F lines 378–383 explicitly require
initial-sync and webhook processing to overlap for one shop, so concurrent first
application of a brand-new identity is a routine onboarding path, not an
exotic one.

Two concrete consequences follow, detailed in the finding: overlap-conflict and
null-version semantics can be bypassed at first insert, and the Correction-7
successor algorithm's "identity-lock boundary" (step 7) is vacuous when the row
does not exist, so two successors can independently fence blockers and both
mutate without observing each other.

A uniqueness constraint does not close this. The `@@unique` violation is raised
only *after* both transactions have already made independent apply decisions,
and §8.3 line 2033 prescribes "Idempotent upsert on `(shopId, shopifyGid)`",
whose `ON CONFLICT DO UPDATE` branch would silently overwrite rather than
re-evaluate. Per the review instruction, this is reported because the current
approved brief does **not** already provide a mechanism — not because a
correction was invented.

---

## 8. Final adversarial check 2 — response-bearing ACTIVE observation — **FAILS**

**Verdict: the current brief requires durable persistence of
`observationResponseGen` before the fenced apply, and that creates a row class
that can neither block nor be durably abandoned.** Recorded as
**F-CLAUDE-PR5C7-02 (P2)** in §9.

§6.E.1 line 350 is the only statement of the persistence contract:
"`observationResponseGen` | Null while resultless. **Set** only after an
authoritative usable response is in hand and **before the fenced apply**, when
that path runs." As a column on `CatalogObservationInFlight`, "set … before the
fenced apply" is a durable write occurring while `lifecycleState` is still
`ACTIVE` and before the fenced canonical transaction. No language anywhere in
the brief offers the alternative safe contract of keeping `responseGen` in
process until the fenced tenant transaction.

Consequently a row in that window is simultaneously **not a blocker** (the
predicate at lines 739–750 requires `RESULTLESS`) and **not abandonable** (the
predicate at lines 844–851 also requires `resultless`, and the successor
algorithm at line 877 scans only "ACTIVE **resultless** observations"). The
Correction-7 durable fence is therefore structurally unavailable for exactly the
rows that carry a usable Shopify response across a crash or pause.

---

## 9. Final adversarial check 3 — lock/fence atomicity — **SOUND on integrity;
one P3 ordering gap**

| Required property | Evidence | Verdict |
|---|---|---|
| Final lease check occurs after required locking | §6.F.2.1 lines 961–967; §6.F.2 step 4 | **MET** |
| Exact observation row locked/fenced atomically with the fact decision | lines 975–978, 980–990; §6.F.2 step 5 | **MET** |
| Lifecycle cannot change between passing fence and mutation | fence and mutation are one tenant transaction; `ABANDONED` requires `ACTIVE` in its predicate, so a concurrent fencer must block on that row's lock and then fail | **MET** |
| Expiry after the fence passes, while the serialization boundary is held, cannot permit concurrent takeover | a successor's conditional transition requires `lifecycleState = ACTIVE` and must wait on the row lock held by the in-flight transaction; on commit the predicate re-evaluates against `COMPLETED` and matches zero rows | **MET** *(for an existing canonical row — see F-CLAUDE-PR5C7-01 for the nonexistent-row case)* |
| Background recovery cannot race around the locks | lines 862–865 make background abandonment optional and non-authoritative; the same conditional predicate and row lock apply to it | **MET** |

**Deadlock hazard.** The successor algorithm (step 3) fences "every blocker"
without specifying an order. Two successors relying on the same blocker set may
issue their conditional `UPDATE`s in different orders and deadlock. PostgreSQL
detects this and aborts one transaction; because mutation and fencing are
atomic (lines 891–895), the aborted transaction leaves no half-applied state.
This is therefore an **availability/operability** issue, **not** a data-integrity
one, and is recorded at **P3** as F-CLAUDE-PR5C7-03 with the required
deterministic order.

---

## 10. Findings

### F-CLAUDE-PR5C7-01 — **P1** — No canonical-identity serialization boundary exists before the canonical fact row exists

**Document / section:** `PR5_CATALOG_LOCATION_INVENTORY_FACTS_BRIEF.md`
§6.F.3 lines 1261–1266; §6.F.2 step 4 lines 550–551; §6.F.2.1 line 874 and
step 7 lines 887–889; §6.F.7 step 1 line 1369; §6.F.5 rule 1 line 1298;
§8.3 line 2033.

**Evidence.** The sole stated serialization mechanism is `SELECT … FOR UPDATE`
on the canonical fact row. Official PostgreSQL 18 documents row-level locks as
applying only to retrieved rows; nonexistent rows cannot be locked and predicate
locking exists only under `SERIALIZABLE`, which the brief does not use (Race AA;
§6.F.10 line 1747). §6.F.5 rule 1 explicitly contemplates the row not existing.

**Concrete failure scenario.** During initial sync (§6.F.7 step 1 — the mass
first-insert path) a JSONL line and a concurrent webhook-driven direct refetch
apply the first canonical fact for the same brand-new identity. §6.F lines
378–383 require exactly this overlap. Both execute `SELECT … FOR UPDATE`, both
retrieve zero rows, and **neither acquires any lock**. Under READ COMMITTED
neither sees the other's uncommitted work, so both evaluate blockers and
conflict rules against a state that omits the other, and both proceed.

1. *Null-version attribute last-writer-wins.* Two overlapping null-`updatedAt`
   observations (§6.F.9) both first-insert. With the prescribed
   `ON CONFLICT DO UPDATE` upsert, the loser overwrites the winner's attributes
   without the mandatory overlap evaluation — the exact defect R-158, Race M,
   and Race AK forbid, reintroduced on a path where the guarding lock is absent.
2. *Vacuous Correction-7 identity boundary.* Step 7 requires the successor's
   abandonment fencing and canonical mutation to share "the same tenant
   transaction / identity-lock boundary". When no canonical row exists that
   boundary does not exist, so two successors can each fence overlapping expired
   blockers and both mutate, neither observing the other.

**Why the current mitigation is insufficient.** The `@@unique` constraint raises
its violation only after both transactions have independently decided what to
apply; a raised error is not proof that overlap/conflict semantics were applied.
The brief prescribes an idempotent upsert (§8.3 line 2033) rather than a
conflict-and-re-evaluate contract, and specifies no retry rule requiring the
full §6.F.3 / §6.F.9 interval, blocker, and conflict evaluation to re-run
against the winner's committed row.

**Exact correction required.** State an explicit database serialization anchor
for the canonical identity that exists *before* the fact row. Either:

- **(a)** require a transaction-scoped advisory lock —
  `pg_advisory_xact_lock` keyed by a deterministic hash of
  `(shopId, resourceKind, canonical identity)` — acquired **before** blocker
  evaluation and **before** the canonical `SELECT … FOR UPDATE`, held for the
  whole tenant fact transaction, explicitly transaction-scoped and never
  session-scoped; or
- **(b)** mandate `INSERT … ON CONFLICT DO NOTHING` followed by a re-read and a
  **full** re-evaluation of §6.F.3 / §6.F.9 interval, blocker, and conflict
  rules under the now-existing row lock, and explicitly forbid
  `ON CONFLICT DO UPDATE` on existence and attribute columns.

Whichever is chosen, state that the Correction-7 successor algorithm's
"identity-lock boundary" means that anchor when the canonical row does not
yet exist.

**Missing acceptance test.** New mandatory race — **"AT. Concurrent first
canonical application of a nonexistent identity"**: two direct observations with
**overlapping** intervals and differing/conflicting payloads concurrently apply
the first canonical fact for an identity with no existing row. Assert exactly
one canonical row results; assert the overlap rule was actually applied
(preserved last unambiguous value plus
`CONCURRENT_EXISTENCE_OBSERVATION_CONFLICT` / `DEGRADED` plus bounded refetch)
rather than last-writer-wins; repeat for the null-version attribute path
(§6.F.9) and for the case where an ACTIVE unexpired resultless blocker exists at
first insert.

---

### F-CLAUDE-PR5C7-02 — **P2** — A response-bearing ACTIVE observation can neither block nor be durably abandoned, so the Correction-7 rollback fence is unavailable for that row class

**Document / section:** §6.E.1 field table line 350; §6.F.2.1 blocking predicate
lines 739–750; durable-abandonment predicate lines 844–851; successor apply
algorithm lines 877–882.

**Evidence.** §6.E.1 line 350 requires `observationResponseGen` to be set "after
an authoritative usable response is in hand and **before the fenced apply**" —
a durable column write while the row is still `ACTIVE`. The blocking predicate
requires `ACTIVE` **and** `UNEXPIRED` **and** `RESULTLESS`. The durable
`ACTIVE -> ABANDONED` predicate also requires `resultless`, and the successor
algorithm scans only "ALL overlapping ACTIVE **resultless** observations".

**Concrete failure scenario.** Worker A durably persists `responseGen` and
remains `ACTIVE`, then pauses (long GC pause, container freeze/thaw, VM suspend)
or crashes and later resumes holding its token and response. No successor ever
fences A, because no successor is *permitted* to — the predicate requires
resultless. A's lease expires, making A lease-invalid (Race AR). PostgreSQL wall
time then moves backward — the precise anomaly Correction 7 exists to survive.
A's final fence requires exactly one matching token row that is `ACTIVE`, not
`ABANDONED`, and `clock_timestamp() < leaseExpiresAt`. All three now hold, so
the fence **passes** and A applies a stale response. On the deletion path
(§6.F.7) that can write `ABSENT` against a currently live identity.

**Why the current mitigation is insufficient.** The CASE 2 guarantee is scoped
by its own wording to a token "whose expiry has already been relied upon to
unblock canonical mutation" (lines 867–870). A response-bearing row never blocks,
so its expiry is never relied upon, so it never becomes `ABANDONED` and never
acquires the durable fence. Race **AS** covers only a **resultless** A. Race
**AR** covers the forward-time case where the fence correctly fails, not the
rollback case where it passes. The §6.F.3 interval algebra constrains but does
not eliminate the outcome: where A's interval is later than and non-overlapping
with the evidence stored on the canonical row, A legitimately supersedes on
clock B and its stale result is written.

**Exact correction required.** Make one of the two safe contracts explicit and
normative:

- **(i)** `observationResponseGen` is held **in process only** and persisted
  **atomically inside** the fenced tenant fact transaction, so an `ACTIVE` row
  is always resultless and therefore always both blocks and remains abandonable;
  **or**
- **(ii)** if it is durably persisted before the fenced apply, then an `ACTIVE`
  response-bearing observation **still participates in blocker evaluation** and
  **remains eligible** for the conditional `ACTIVE -> ABANDONED` transition —
  drop `resultless` from the abandonment predicate while keeping exact
  `shopId`, canonical identity, observation token, `lifecycleState = ACTIVE`,
  and `clock_timestamp() >= leaseExpiresAt` — with the matching change to the
  successor algorithm's scan at line 877.

**Missing acceptance test.** Extend Race **AS** with a Case 3, or add a new
mandatory race: A persists `responseGen` while `ACTIVE`, pauses past
`leaseExpiresAt`, PostgreSQL wall time moves backward, and A resumes and
attempts application. Assert A cannot apply — either because a successor was
permitted to durably fence it `ABANDONED`, or because `responseGen` was never
durably persisted outside the fenced transaction — and that A cannot write
`LIVE`/`ABSENT`, tombstone, revive, update null-version attributes, or clear
newer evidence.

---

### F-CLAUDE-PR5C7-03 — **P3** — No deterministic lock order for multi-blocker abandonment fencing

**Document / section:** §6.F.2.1 successor apply algorithm step 3, lines 878–880.

**Evidence and scenario.** Step 3 requires fencing "every blocker whose
`clock_timestamp() >= leaseExpiresAt`" but specifies no ordering. Two successor
transactions relying on the same blocker set may issue their conditional
`UPDATE`s in opposite orders and deadlock.

**Why this is P3, not higher.** Data integrity is preserved: PostgreSQL detects
the deadlock and aborts one transaction, and because the successor mutation and
its abandonment transitions are atomic (lines 891–895), the aborted transaction
leaves no half-applied takeover state. The impact is availability and
operability — avoidable aborts and retry noise on a hot identity.

**Exact correction required.** Require a deterministic fencing order — fence
blockers in ascending `observationRequestGen`, ties broken by observation token
— and state that the canonical identity anchor is always acquired before any
observation row lock.

**Missing acceptance test.** Add to Race AQ or AS: two successors fencing an
identical multi-blocker set concurrently complete without deadlock under the
required deterministic order.

---

### F-CLAUDE-PR5C7-04 — **P3** — §16 D1.14 range label omits Race AS

**Document / section:** §16 D1 item 14 line 2368 ("Races P–AR in §6.F.13"),
versus §6.F.13 lines 1855–1860 which mandate **A–AS**.

**Evidence.** The D1.14 range label and its parenthetical enumeration stop at
AR. Race **AS** *is* separately mandated in §16 E (line 2407) with the correct
assertions, so this is a **stale range label, not a coverage gap** — recorded
for completeness of the immutable record.

**Exact correction required.** Update D1.14 to read "Races P–AS" and append
"database clock rollback after expiry takeover" to the parenthetical list.

---

## 11. Cumulative regression verdict — **NO REGRESSION**

Corrections 6 and 7 are strictly additive to the accepted Correction-4/5
architecture. Each previously accepted invariant was re-verified at the reviewed
head:

| Invariant | Evidence | Status |
|---|---|---|
| Global sequence, USAGE-only privileges | §6.F.2 lines 480–483; §13 | **INTACT** |
| No `setval` / reset / reuse | §6.F.2 lines 481, 494–497; Races AF, AD | **INTACT** |
| Explicit `NO CYCLE` | §6.F.2 lines 477, 482; Race AG | **INTACT** |
| `requestGen` before the Shopify request | §6.F.2 step 1 lines 530–541 | **INTACT** |
| `responseGen` after usable response, before apply | §6.F.2 step 3; §6.E.1 line 350 | **INTACT** *(see F-CLAUDE-PR5C7-02)* |
| No Shopify network lock | §6.F.2 lines 541–544, 1102; Race S | **INTACT** |
| Overlap conflict semantics | §6.F.3 lines 1209–1240; Races AH/AJ/AK | **INTACT** *(see F-CLAUDE-PR5C7-01 for first insert)* |
| No response-end LWW | §6.F.1 line 431; §6.F.2.1 line 776; §6.F.3 lines 1212, 1258–1259 | **INTACT** |
| InventoryLevel identity = item+location pair | §6.E lines 300–320; §13; Race X | **INTACT** |
| Bulk omission is candidate only | §6.F.10; Races U, O, D, V, W, AL | **INTACT** |
| Direct authoritative confirmation before tombstone | §6.F.7; Races H, N, W | **INTACT** |
| Terminal revival requires two non-overlapping LIVE confirmations | §6.F.8 line 1475; Race AB | **INTACT** |
| Cross-role merchant/control-plane two-phase boundary | §6.F.11; §6.F.2.1 lines 1077–1091; §13; Races E, Y | **INTACT** |
| Tenant RLS / role separation | §6.E.1 lines 329–338; §13 | **INTACT** |
| Deny-by-default Shopify mutation scanner | §12 lines 2205–2213; Race AC | **INTACT** |
| No PR 5 Shopify inventory writes | §1 line 68; §12 line 2207; §6.C line 261 | **INTACT** |

**Tenant / cross-role verdict — SOUND.** `CatalogObservationInFlight` remains
merchant-domain with non-null `shopId`, `@@unique([shopId, id])`, ENABLE+FORCE
RLS, immutable `shopId`, `stocky_runtime` DML only, no `stocky_control_plane`
DML, and no FK to control-plane tables. Correction 7 introduces no cross-role
transaction; the abandonment fencing is tenant-scoped merchant-domain DML.

**InventoryLevel identity verdict — SOUND.** `(shopId, inventoryItemGid,
locationGid)` remains canonical, with the level GID lineage-only and never
required to process disconnect.

**Bulk omission / deletion verdict — SOUND.** Omission remains candidate-only,
gated by bounded confirmation and a blast-radius circuit breaker, with no
tombstone while an overlapping LIVE direct check is unresolved.

**Shopify mutation-denial verdict — SOUND.** PR 5 is read-only against Shopify;
the forbidden-mutation list and deny-by-default AST/semantic scanner are intact,
and Race AC is a genuine negative fixture.

---

## 12. AM–AS test sufficiency verdict — **SUFFICIENT for the modelled cases;
two mandatory races missing**

| Race | Can it fail an incorrect implementation? | Verdict |
|---|---|---|
| **AM** | Yes — requires the crossing be established on PostgreSQL-authoritative time, not a fake clock; includes CASE 1 | **SUFFICIENT** |
| **AN** | Yes — a late response after durable abandonment must fail the token / active-lease / not-`ABANDONED` fence | **SUFFICIENT** |
| **AO** | Yes — adversarial node-clock skew both directions plus exact-equality-is-expired | **SUFFICIENT** (most discriminating clock test) |
| **AP** | Yes — zero rows fail closed; row cannot be recreated to apply | **SUFFICIENT** |
| **AQ** | Yes — C stays blocked by B after A is durably abandoned; held C never replayed | **SUFFICIENT** |
| **AR** | Yes — fails an implementation that validates at response time rather than at the post-lock fact fence | **SUFFICIENT** |
| **AS** | Yes — separates durable lifecycle state from time; includes the transaction-rollback arm | **SUFFICIENT for resultless A** |

**Missing mandatory coverage:**

1. **Concurrent first canonical application of a nonexistent identity**
   (F-CLAUDE-PR5C7-01) — no race in A–AS creates two concurrent applies against
   an identity with **no** existing canonical row. Every concurrency race in the
   matrix presupposes a row to lock.
2. **Clock rollback against a response-bearing ACTIVE observation**
   (F-CLAUDE-PR5C7-02) — AS covers only a resultless A; AR covers only the
   forward-time fence failure.

---

## 13. Control-record consistency — **CONSISTENT**

| Control record | Verified state |
|---|---|
| **D-053** | Unchanged as *"Phase 1 PR 5 planning authorization."* Correction 7 is additive item 17 under D-053 (`DECISIONS.md` line 654); the decision's scope, disposition, and title are untouched |
| **D-054** | **ABSENT** — no occurrence anywhere in the repository; every correction record states "do not create D-054" |
| **R-157** | **OPEN — PR 5 planning** (P1), sequence UPDATE/`setval` reset-and-reuse; explicitly not closed by the planning mitigation |
| **R-158** | **OPEN — PR 5 planning** (P1), concurrent-response scheduling inversion; explicitly not closed by the planning mitigation |
| **R-159** | **OPEN — PR 5 planning** (P2), extended with the Correction-7 mitigation and carrying "Do **not** close this risk merely because the planning mitigation exists" |
| `PROJECT_STATUS.md` | PR 5 planning IN PROGRESS — IMPLEMENTATION NOT AUTHORIZED; PR 5 implementation NOT STARTED / NOT AUTHORIZED; implementation branch not created; production NOT AUTHORIZED; inventory writes UNAPPROVED, flags DEFAULT OFF |
| `phases/phase-1/README.md` | Agrees with `PROJECT_STATUS.md` and `DECISIONS.md` |
| Implementation branch | `phase-1/catalog-location-inventory-facts` **absent** from the remote |

R-157 / R-158 / R-159 correctly remain OPEN. Specifying a mitigation in planning
is not implementation evidence, and none of the three should be closed here.

---

## 14. Pre-review exact-head CI verdict — **VERIFIED**

Run [`31915742074`](https://github.com/Vedang1998/Stocky/actions/runs/31915742074),
`head_sha = 2db55b6f11bf91d4a07aeabfcc3ce38a5122119f`:

| Job | ID | Result |
|---|---|---|
| Classify change set | `95087158101` | **SUCCESS** |
| Lint, typecheck, test, build, Prisma, GraphQL | `95087176110` | **SKIPPED** |
| CI Gate | `95087175838` | **SUCCESS** |

Classifier output verified from the job log:

```
event_name=pull_request
pr_base_sha=a15d58e0a9d99dd9497fe3243068d4a728aee52a
pr_head_sha=2db55b6f11bf91d4a07aeabfcc3ce38a5122119f
changed_path_count=9
classification_reason=every_changed_path_is_docs_allowlist
docs_only=true
full_ci=false
```

All nine changed paths classified `[docs]`. Exactly **one** automatic workflow
run exists for this head, event `pull_request`. **No** duplicate feature-branch
push run. **No** `workflow_dispatch`. This matches `CI_POLICY.md` §Triggers and
`AGENTS.md` §CI evidence policy.

---

## 15. Findings summary

| Severity | Count |
|---|---|
| **P0** | **0** |
| **P1** | **1** |
| **P2** | **1** |
| **P3** | **2** |

| ID | Severity | One-line disposition |
|---|---|---|
| F-CLAUDE-PR5C5-01 | P2 | **RESOLVED** — `clock_timestamp()` named as sole authoritative lease clock, computed in-database |
| F-CLAUDE-PR5C5-02 | P3 | **RESOLVED** — zero/multiple matching in-flight rows explicitly fail closed (Race AP) |
| F-CLAUDE-PR5C5-03 | P3 | **RESOLVED** — existential all-blocker predicate plus mandatory Race AQ |
| F-CLAUDE-PR5C5-04 | P3 | **RESOLVED** — validity decided at fact-application time plus mandatory Race AR |
| F-CLAUDE-PR5C7-01 | **P1** | **NEW** — `SELECT … FOR UPDATE` cannot serialize a canonical identity before its row exists; first-insert overlap semantics unguarded |
| F-CLAUDE-PR5C7-02 | **P2** | **NEW** — response-bearing ACTIVE observation can neither block nor be durably abandoned, so the CASE 2 rollback fence is unavailable to it |
| F-CLAUDE-PR5C7-03 | P3 | **NEW** — no deterministic lock order for multi-blocker abandonment fencing (availability, not integrity) |
| F-CLAUDE-PR5C7-04 | P3 | **NEW** — §16 D1.14 range label omits Race AS (stale label; AS is covered in §16 E) |

---

## 16. Final verdict

**CORRECTIONS REQUIRED**

Corrections 6 and 7 are genuinely good work. The Correction-6 clock model is
complete and closes all four Correction-5 findings, and the Correction-7
lease-invalidity / durable-abandonment split is the right architectural
distinction — it correctly identifies that a wall-clock source cannot be trusted
to stay fenced and replaces time-based reasoning with irreversible durable
lifecycle state. Races AO, AR, and AS are discriminating tests that would fail a
plausibly wrong implementation.

The planning is nevertheless **not yet implementation-grade**, for two reasons
that sit inside the mechanism these corrections introduce:

1. **F-CLAUDE-PR5C7-01 (P1)** — the entire §6.F apply architecture rests on one
   serialization primitive, and that primitive provably does not serialize the
   canonical identity before its row exists. Because initial sync is the mass
   first-insert path and is required to overlap webhook processing, this is a
   routine path, not a corner case. The Correction-7 successor algorithm's own
   "identity-lock boundary" is vacuous there.
2. **F-CLAUDE-PR5C7-02 (P2)** — the durable-abandonment predicate requires
   `resultless`, which structurally excludes the one row class that can carry a
   usable Shopify response across a pause. The clock-rollback hole Correction 7
   was written to close therefore remains open for that class.

Both are closable with documentation-only corrections plus two mandatory races.
Neither requires redesigning Correction 5, 6, or 7.

This verdict does **not** authorize implementation, production, or inventory
writes. Per the review instruction, no correction has been implemented here;
Cursor should make any correction only after ChatGPT approves it.

---

## 17. Review scope statement

Repository changes made by this review: **exactly one new file** — this
artifact. No existing file was modified. The PR 5 brief, `DECISIONS.md`,
`PROJECT_STATUS.md`, `RISK_REGISTER.md`, `OPEN_QUESTIONS.md`, the phase README,
and all three prior immutable review reports are untouched.

PR 5 implementation remains **NOT STARTED** and **NOT AUTHORIZED**.
D-053 is unchanged. No D-054 was created. The implementation branch was not
created. Production remains **NOT AUTHORIZED**. Inventory-write flags remain
**DEFAULT OFF**.
