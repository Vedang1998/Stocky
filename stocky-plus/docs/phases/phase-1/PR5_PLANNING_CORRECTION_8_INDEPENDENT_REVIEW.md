# PR 5 Planning — Correction 8 Independent Review (Claude Code)

**Immutable artifact.** This file is historical review evidence. Do **not** edit
it in a later correction. Later reviews create new files.

**Reviewer role:** independent principal engineer / architecture, security, and
release-risk reviewer (`AGENTS.md` § Claude Code; `CLAUDE.md` § Independent
review mission).

**Review date:** 2026-08-16

**Authority:** D-053 (Phase 1 PR 5 **planning** authorization only). This review
does **not** authorize implementation, does **not** create D-054, does **not**
create the implementation branch, does **not** mark PR #24 ready, does **not**
merge, and does **not** authorize production or inventory writes.

---

## 1. Reviewed identities

| Role | SHA |
|---|---|
| Reviewed base (`origin/main`; PR #24 base) | `a15d58e0a9d99dd9497fe3243068d4a728aee52a` |
| Reviewed planning head (Correction 8) | `a7d23bcfb6d82a209a986302e10b3a9a46601c87` |
| Starting PR head before Correction 8 | `a757baa2e7b93e7b212984d52858231ffea0b9d0` |
| Correction-8 diff reviewed | `a757baa…..a7d23bc…` |
| Branch | `phase-1/pr5-planning` |
| PR | [#24](https://github.com/Vedang1998/Stocky/pull/24) |

Verified locally:

- `git rev-parse origin/phase-1/pr5-planning` → `a7d23bcfb6d82a209a986302e10b3a9a46601c87`
- `git merge-base origin/main origin/phase-1/pr5-planning` → `a15d58e0a9d99dd9497fe3243068d4a728aee52a`
- `git merge-base --is-ancestor a15d58e… origin/phase-1/pr5-planning` → exit `0`

PR #24 state at review time (GitHub API): `state=open`, `draft=true`,
`merged=false`, `mergeable_state=clean`, `base.ref=main`,
`base.sha=a15d58e0a9d99dd9497fe3243068d4a728aee52a`,
`head.sha=a7d23bcfb6d82a209a986302e10b3a9a46601c87`, `changed_files=10`.

**Base unchanged. PR remains OPEN / DRAFT / UNMERGED.**

---

## 2. Prior immutable review blobs — all present and unmodified

`git ls-tree -r a7d23bc… -- stocky-plus/docs/phases/phase-1/`:

| Report | Required blob | Blob at reviewed head | Status |
|---|---|---|---|
| `PR5_PLANNING_INDEPENDENT_REVIEW.md` | `f6e62fe16a63a79f778daaee6991296868a8285b` | `f6e62fe16a63a79f778daaee6991296868a8285b` | **UNMODIFIED** (65,481 bytes) |
| `PR5_PLANNING_CORRECTION_4_INDEPENDENT_REVIEW.md` | `e645c81c38419c962d6b8670542aee082fee56ee` | `e645c81c38419c962d6b8670542aee082fee56ee` | **UNMODIFIED** (29,767 bytes) |
| `PR5_PLANNING_CORRECTION_5_INDEPENDENT_REVIEW.md` | `c465b7d0dbc50d1189af34e9ef8d7e0672186a31` | `c465b7d0dbc50d1189af34e9ef8d7e0672186a31` | **UNMODIFIED** (38,879 bytes) |
| `PR5_PLANNING_CORRECTION_7_INDEPENDENT_REVIEW.md` | `b1c4265ac9eb096b1914640da31518f82a12a1ac` | `b1c4265ac9eb096b1914640da31518f82a12a1ac` | **UNMODIFIED** (38,173 bytes) |

All four blob object types and sizes were confirmed with `git cat-file`. None of
the four paths appears in the Correction-8 diff.

---

## 3. Correction-8 change scope

`git diff --stat a757baa…..a7d23bc…` — **5 files, +457 / −65**, all under the
docs allowlist:

| File | Change |
|---|---|
| `stocky-plus/docs/phases/phase-1/PR5_CATALOG_LOCATION_INVENTORY_FACTS_BRIEF.md` | +505 / −65 (new §6.F.2.2, §6.F.2.3; Races AT / AU / AV; D1.14 range) |
| `stocky-plus/docs/DECISIONS.md` | +1 (item 18 — planning correction 8) |
| `stocky-plus/docs/RISK_REGISTER.md` | +1 / −1 (R-160 added; R-159 extended) |
| `stocky-plus/docs/PROJECT_STATUS.md` | +4 / −4 |
| `stocky-plus/docs/phases/phase-1/README.md` | +2 / −2 |

Runtime, schema, Prisma, migration, `.github/**`, script, lockfile, package,
Shopify/GraphQL, and test-config delta: **NONE**. `OPEN_QUESTIONS.md` untouched
by this correction. The new database invariant is explicitly stated as a
**planned** contract with "do **not** create that migration in this planning
PR" (brief §6.E.1 and §6.F.2.3).

Full-PR path set (`a15d58e…..a7d23bc…`, 10 paths) is entirely
`stocky-plus/docs/**` — zero non-allowlist paths. The `docs_only=true`
classification is independently correct, not merely asserted.

---

## 4. Official PostgreSQL 18 documentation verification

Every documentation claim added by Correction 8 was checked against the primary
source, not against the brief's paraphrase.

**https://www.postgresql.org/docs/18/explicit-locking.html** (accessed
2026-08-16):

- Row-level locks, § 13.3.2: "FOR UPDATE causes the rows retrieved by the SELECT
  statement to be locked as though for update." → the brief's claim that a
  nonexistent row cannot be locked this way is **correct**.
- Advisory locks, § 13.3.5: "session-level advisory lock requests do not honor
  transaction semantics: a lock acquired during a transaction that is later
  rolled back will still be held following the rollback… Transaction-level lock
  requests, on the other hand, behave more like regular lock requests: they are
  automatically released at the end of the transaction, and there is no explicit
  unlock operation." → **correct**, and the prohibition on session-level
  `pg_advisory_lock` is the right conclusion.
- Deadlocks, § 13.3.4: "The best defense against deadlocks is generally to avoid
  them by being certain that all applications using a database acquire locks on
  multiple objects in a consistent order." → **correct**; this is exactly the
  basis for the F-CLAUDE-PR5C7-03 correction.

**https://www.postgresql.org/docs/18/functions-admin.html#FUNCTIONS-ADVISORY-LOCKS**
(§ 9.28.10, Table 9.109, accessed 2026-08-16):

- `pg_advisory_xact_lock(key1 integer, key2 integer) → void`: "Obtains an
  exclusive transaction-level advisory lock, waiting if necessary." → **correct**.
- `pg_advisory_lock(...)`: exclusive **session-level** → **correct**.
- "resources… can be identified either by a single 64-bit key value or two
  32-bit key values (note that these two key spaces do not overlap)." →
  **correct**, and the two-integer choice is a sound way to avoid an IEEE-754
  round-trip in JavaScript.

Section numbers, function signatures, and the non-overlapping key-space note in
the brief's §17 documentation table match the primary source. No citation drift,
no invented behavior, no over-claim. The brief also correctly refrains from
calling `clock_timestamp()` monotonic.

---

## 5. Verification 1 — Universal identity serialization — **MET**

Brief §6.F.2.2, §6.F.2 step 4, §6.F.2.1 successor algorithm step 0, §6.F.3,
§6.F.7 step 1, §8.3.

| Required property | Evidence | Verdict |
|---|---|---|
| `pg_advisory_xact_lock(key1, key2)` is transaction-scoped | §6.F.2.2 "Primary primitive"; "The lock **MUST** be transaction-scoped"; docs § 13.3.5 quoted correctly | **MET** |
| Serializes the identity even when the canonical fact row does not exist | §6.F.2.2 enumerates exists / does not yet exist / tombstoned / first-created during initial sync / InventoryLevel pair | **MET** |
| Session-level `pg_advisory_lock` prohibited | §6.F.2.2 "**Do not** use session-level `pg_advisory_lock` for this contract" | **MET** |
| No advisory lock held across Shopify I/O | §6.F.2 ("**No** PostgreSQL / merchant row lock **and no advisory identity lock** may be held across Shopify HTTP / network I/O"); §6.F.2 step 1 ("must not acquire the canonical advisory identity lock for the Shopify request itself"); §6.F.2.2; §6.F.7 bulk start; Race **S** rewritten to assert it | **MET** |
| Every canonical writer uses the same anchor | §6.F.2.2 "Covered writers include": direct refetch, delete/disconnect confirmation, reconciliation, full-sync / JSONL application, InventoryLevel pair application, first insert, successor takeover / abandonment fencing, background merchant-domain abandonment that changes correctness state. "**No** canonical writer may bypass the identity anchor." | **MET** |
| Existing-row `SELECT … FOR UPDATE` is secondary only | §6.F.2.2 "**SECONDARY**… **no longer** the serialization primitive that correctness depends on". Independently confirmed: **every** one of the 11 `FOR UPDATE` occurrences at the reviewed head is now qualified as secondary/after the anchor or is a documentation citation. No unqualified survivor. | **MET** |
| First-insert decisions re-read canonical / in-flight evidence after the anchor | §6.F.2.2 "After acquiring the advisory anchor, **re-read** canonical state and all relevant in-flight / blocker evidence **before** deciding"; "First insert (no canonical row)" section; §6.F.5 rule 1 rewritten | **MET** |
| Blind `ON CONFLICT DO UPDATE` cannot bypass interval / conflict rules | §6.F.2.2 ("Do **NOT** treat `INSERT … ON CONFLICT DO UPDATE` as a substitute for the apply algorithm"; a unique conflict despite the anchor "**MUST** fail closed / retry through the **full** canonical apply algorithm… **MUST NOT** blindly overwrite existence or attribute columns"); §6.F.3; §6.F.5 rule 1; §8.3 rewritten so uniqueness is "a safety net, **not** the apply algorithm" | **MET** |

The brief chose option **(a)** from the F-CLAUDE-PR5C7-01 required correction and
additionally imported the guardrail from option **(b)** (no blind upsert, fail
closed and re-run the full algorithm on an unexpected unique conflict). That is
stronger than either option alone. The correction also explicitly binds the
Correction-7 phrase "identity-lock boundary" to the advisory anchor (§6.F.2.1
successor algorithm preamble and step 7), which was the specific vacuity the
prior review identified.

---

## 6. Verification 2 — Lock key contract — **MET, with one residual (P3)**

Brief §6.F.2.2 "Canonical lock-key encoding and derivation".

| Required property | Evidence | Verdict |
|---|---|---|
| Versioned canonical preimage | Field 1 is exactly `stocky-pr5-canonical-lock-v1`; "Changing the version label creates a **new** lock namespace" | **MET** |
| Length-prefixed (no delimiter ambiguity) | "Do **not** concatenate fields with a bare delimiter"; 4-byte big-endian unsigned length + UTF-8 bytes per field; "No extra separators" | **MET** |
| Includes `shopId` + `resourceKind` + exact identity | Fields 2–4, fixed order | **MET** |
| InventoryLevel includes `inventoryItemGid` + `locationGid` | `(shopId, resourceKind, inventoryItemGid, locationGid)`, in that order | **MET** |
| SHA-256 derivation | `digest = SHA-256(preimage)` | **MET** |
| First eight bytes → two signed 32-bit integers | bytes `[0..3]` → `key1`, `[4..7]` → `key2`, big-endian two's complement | **MET** |
| No JavaScript floating-point 64-bit conversion | "Do **not** pack those eight bytes into a JavaScript `Number` / float and then pass a 64-bit key. Bind `key1` and `key2` as 32-bit integers"; the two-integer form is chosen for exactly this reason | **MET** |
| Deterministic across all callers | Stated as a requirement ("Same identity always produces the same `(key1, key2)`") | **STATED — not verifiable by any mandated test** (see F-CLAUDE-PR5C8-02) |
| Collisions over-serialize only, never under-serialize | "different canonical identities that happen to hash-collide may **OVER-SERIALIZE**. That is **safe**. A collision **MUST NOT** cause under-serialization of the same identity"; Race AV includes a collision case | **MET** |

### Is a fixed deterministic test vector needed? — **YES, and it is absent.**

This was checked directly. There is **no** known-answer/golden test vector
anywhere in the brief (`test vector`, `known answer`, `golden` all return zero
matches at the reviewed head), and Race **AV** asserts *ordering* and *collision
over-serialization* but never asserts that two independent call sites derive
**identical** `(key1, key2)` for the same identity. Recorded as
**F-CLAUDE-PR5C8-02 (P3)** in §11. This is a verification gap plus one
underspecified preimage field, not a design error.

---

## 7. Verification 3 — Lock order — **MET**

Brief §6.F.2.2 "Lock acquisition order inside a tenant transaction" and
"Batch / multi-identity lock order"; §6.F.2.1 successor algorithm step 0 and
step 3; §6.F.2 step 4; §6.F.7 step 1.

| Required property | Evidence | Verdict |
|---|---|---|
| Canonical advisory lock precedes fact-row and observation-row locks | Ordered list: (1) tenant/RLS context, (2) advisory anchor, (3) optional `FOR UPDATE`, (4) in-flight rows, (5) evaluate, (6) apply, (7) complete/abandon, (8) commit. Restated in §6.F.2.1 step 0 and §6.F.2 step 4 | **MET** |
| Multi-identity locks in deterministic ascending key order | "compute **all** advisory lock key pairs first… acquire them in deterministic **ascending** `(key1, key2)` order… after lock acquisition, process identities deterministically" | **MET** |
| Duplicate advisory keys deduplicated | "**deduplicate** identical advisory keys before acquisition" | **MET** |
| Observation rows locked by ascending `observationRequestGen` then token | §6.F.2.2 and §6.F.2.1 step 0 / step 3 both state ascending `observationRequestGen`, ties broken by observation token, and step 3 fences "in that same deterministic observation-row order" | **MET** |
| No reverse-order path exists | "The canonical advisory identity lock is acquired **BEFORE** observation-row locks"; "No code path may invent its own reverse ordering"; "Background recovery / fencing follows the **same** ordering rules"; "Hash-key collisions… must not create a reverse lock order or a half-applied canonical state". Confirmed by inspecting every `FOR UPDATE` site at head | **MET** |

**Race AV** (deterministic canonical lock ordering) is present and
discriminating: opposite input orders for identities X and Y, plus the
observation-row case, plus the hash-collision case; required outcome includes "no
AB/BA lock-order deadlock", "hash-key collision causes **only**
over-serialization", and "no half-applied canonical state". The brief also
correctly cites § 13.3.4 for the residual case: PostgreSQL aborts one
transaction, and because mutation and abandonment fencing share the transaction,
an abort leaves no half-applied takeover state. **F-CLAUDE-PR5C7-03 is closed.**

---

## 8. Verification 4 — First insert (Race AT) — **MET**

Race **AT** is mandated in §6.F.13 with four subcases, and is echoed in §16 E.

| Subcase | Bypass class it must close | Required outcome as written | Verdict |
|---|---|---|---|
| **AT-1** direct vs direct, overlapping intervals, conflicting payloads | overlap-conflict rules | same anchor; only one fact transaction evaluates the identity at a time; the second **re-reads state / evidence after obtaining the anchor**; exactly zero or one canonical row, **never** duplicates; "conflicting overlap cannot become response-end or commit-order LWW"; preserve-no-unambiguous-fact + refetch where the existing rules require it; **no** `ON CONFLICT DO UPDATE` blind overwrite; conflict/degraded/refetch evidence preserved | **MET** |
| **AT-2** two overlapping null-`updatedAt` observations, no canonical row | null-version rules | "no last-writer-wins; advisory serialization does not bypass interval conflict rules; DEGRADED / conflict / refetch behavior follows §6.F.9" | **MET** |
| **AT-3** initial bulk / JSONL first application vs webhook-driven direct refetch | full-sync / direct-refetch ordering | same anchor; "full-sync fence / direct-observation ordering rules are re-evaluated **after** lock acquisition"; "bulk cannot blindly overwrite a newer / conflicting direct observation"; exactly one coherent canonical result or conflict/refetch state | **MET** |
| **AT-4** ACTIVE unexpired resultless blocker present, no canonical row | blocker rules | "absence of a canonical row does **not** bypass blocker logic; mutation remains blocked under the existing rule" | **MET** |

Combined with §6.F.2.2's normative first-insert text and the §6.F.5 rule 1
rewrite ("insert attributes from `I` **only after** the canonical advisory
identity lock is held and canonical / in-flight evidence has been re-read…
Overlapping conflicting first-insert evidence follows §6.F.3 / §6.F.9 — **not**
last-writer-wins and **not** `ON CONFLICT DO UPDATE` overwrite"), a nonexistent
Product / Variant / InventoryItem / Location or InventoryLevel pair **cannot**
bypass overlap-conflict rules, null-version rules, blocker rules, or
full-sync / direct-refetch ordering. The mass first-insert path called out by the
prior review (initial sync overlapping webhook processing) is covered by AT-3
specifically. **F-CLAUDE-PR5C7-01 is closed.**

---

## 9. Verification 5 — responseGen lifecycle — **MET**

Brief §6.F.2.3 (new), §6.E.1 field table and planned invariant block, §6.F.2
steps 3–5, §6.F.2 "Graceful completion / failure / hard crash", §6.F.2.1
Correction-8 interaction block, §6.F.3, §6.F.9.

| Required property | Evidence | Verdict |
|---|---|---|
| Allocated **after** a usable Shopify response | §6.F.2.3 step 1–2: "This remains **AFTER** usable response and **BEFORE** canonical fact application, preserving Correction 4. Do **not** move allocation to after the identity-lock wait." | **MET — Correction 4 preserved** |
| Remains process-local until the fenced transaction | §6.F.2.3 steps 3–4: "Keep `responseGen` and the response payload **IN PROCESS ONLY**"; "Do **NOT** issue a separate database update that persists `responseGen` while `CatalogObservationInFlight` remains `ACTIVE`" | **MET** |
| Persisted only atomically as the observation leaves ACTIVE | §6.F.2.3 step 9; §6.F.2 step 5; graceful-completion bullet: "persist `observationResponseGen` **atomically** with marking **that exact** observation `COMPLETED`… There is no committed `ACTIVE` + non-null `observationResponseGen` window." | **MET** |
| Committed `ACTIVE AND observationResponseGen IS NOT NULL` made impossible | Stated three times normatively (§6.E.1 field table, §6.F.2.3, §6.F.2 step 3) plus the planned DB constraint plus Race AU's assertion that "the database constraint rejects any attempted commit of `ACTIVE` + `observationResponseGen != NULL`" | **MET** |
| Planned DB invariant `ACTIVE ⇒ NULL`, `COMPLETED ⇒ NOT NULL` | §6.E.1 "Planned database invariant" block and §6.F.2.3 "Planned schema invariant", both with "do **not** create that migration in this planning PR" | **MET** |
| Permitted ABANDONED cases | "`ABANDONED` may have `observationResponseGen IS NULL` (timeout / crash / no usable completed response), or non-null **only** when a usable response existed but was discarded / abandoned **atomically** while the row left `ACTIVE`" | **MET** |

**Coherence check against the graceful-failure lifecycle.** `COMPLETED ⇒ NOT
NULL` is consistent with the rest of the brief: graceful timeout / throttle /
error marks the observation `ABANDONED` (not `COMPLETED`) and creates no
authoritative fact; hard crash reaches `ABANDONED` only via successor fencing.
`COMPLETED` is therefore reachable only on the usable-response path, where
`responseGen` is persisted in the same statement. No contradictory state was
found.

**Race AU** covers all four scenarios required: crash (explicit "Crash variant:
A terminates after `responseGen` allocation"), lease expiry (step 7), clock
rollback (step 9 — "Database wall clock later moves backward"), and stale resume
(step 10 — "A resumes with the old response payload and its in-process
`responseGen`"). Step 6 is a direct positive assertion on the persisted row
(`ACTIVE` and `observationResponseGen = NULL`), which is what makes the test
discriminating rather than merely narrative.

**The Correction-7 coherence hole is genuinely closed.** The prior review's
failure scenario required a committed `ACTIVE` + response-bearing row that no
successor was *permitted* to fence, because both the blocking predicate and the
abandonment predicate require `resultless`. Under §6.F.2.3 that row class cannot
exist in committed state, so every durably `ACTIVE` row is resultless, so the
`ACTIVE + expired + resultless` predicate is total over the ACTIVE population.
The brief states this explicitly in §6.F.2.1 and §6.F.2.3 and re-lists the
Correction-6/7 invariants that must not be weakened in doing so.
**F-CLAUDE-PR5C7-02 is closed via safe contract (i).**

---

## 10. Verification 6 — Cumulative regression check — **NO REGRESSION**

Every listed invariant was re-verified at the reviewed head, not assumed from the
Correction-8 summary. All 731 diff lines were read; every deletion in the diff is
replaced by strictly stronger text.

| Invariant | Evidence at `a7d23bc…` | Status |
|---|---|---|
| `clock_timestamp()` lease authority | 50 occurrences; §6.F.2.1 unchanged in substance; Correction-8 block explicitly lists "PostgreSQL `clock_timestamp()` lease authority" among what must **not** be weakened | **INTACT** |
| `<` valid / `>=` expired boundary (equality is expired) | §6.F.2.1 lines 634, 759, 862, 876, 911; Correction-8 block re-asserts "the exact `<` / `>=` boundary" | **INTACT** |
| Durable `ACTIVE -> ABANDONED` fencing | 26 occurrences; successor algorithm intact, now anchored; Race AS unchanged | **INTACT** |
| `requestGen` / `responseGen` interval semantics | §6.F.2, §6.F.3; requestGen still before the network request; interval `[requestGen, responseGen]` unchanged; only the **persistence moment** of responseGen moved | **INTACT** |
| No response-end LWW | §6.F.3, §6.F.9, §6.F.12; Races M / T / AH / AK unchanged: "must **not** resolve by end-generation" | **INTACT** |
| Bulk omission is candidate-only | §6.F.6 "A bulk omission **alone** never writes ABSENT"; Races U / AL unchanged | **INTACT** |
| Terminal revival rules (non-overlapping two confirmations) | §6.F.7 `second.observationRequestGen > first.observationResponseGen`; Race AB Case 2 unchanged | **INTACT** |
| InventoryLevel item+location identity | 15 occurrences of `(… inventoryItemGid, locationGid)`, including the new lock-key preimage and §8.3 | **INTACT** |
| Tenant / RLS isolation | §6.E.1 forced RLS + `USING` / `WITH CHECK` + shopId immutability; lock-order step 1 requires tenant/RLS context **before** the anchor; advisory key is declared "transient locking metadata… **not** merchant identity", so it neither replaces nor relaxes RLS; `shopId` is inside the preimage so identities cannot collide across tenants except by hash collision, which over-serializes only | **INTACT** |
| Sequence USAGE-only / no `setval` / NO CYCLE | §6.F.2 privilege table (USAGE only, no SELECT, no UPDATE, no ownership, no PUBLIC, no blanket `ON SEQUENCES`), explicit `NO CYCLE`, `setval` denial; Races AD / AE / AF / AG unchanged | **INTACT** |
| Mutation-denial scanner | §14 scanner contract; Race AC unchanged | **INTACT** |
| No Shopify inventory writes | Header "**Inventory writes:** UNAPPROVED"; §16 "Production inventory writes remain **UNAPPROVED**"; flags DEFAULT OFF; no mutation introduced anywhere in the diff | **INTACT** |
| No `stocky_control_plane` DML on merchant tables | §6.E.1 and §6.F.2 unchanged; §6.F.13 scope statement still excludes granting it | **INTACT** |
| READ COMMITTED candidate sweep | §6.F.10 unchanged; Race AA unchanged; §6.F.2.2 cites it correctly as the reason predicate/gap locking is unavailable | **INTACT** |

Three edits deserve explicit mention because they *replace* previously accepted
text; all three are strengthenings, not weakenings:

1. §6.F.3 serialization paragraph: `SELECT … FOR UPDATE` demoted to secondary,
   advisory anchor promoted to primary. Strengthening.
2. §6.F.7 step 1 (JSONL applicator): now acquires the anchor (or all batch
   anchors in ascending key order) before the optional `FOR UPDATE`, with "Do
   **not** hold the advisory lock across Shopify I/O". Strengthening.
3. §8.3: "Idempotent upsert on `(shopId, shopifyGid)`…" replaced by "Apply each
   identity through the **canonical apply algorithm**… Uniqueness… is a safety
   net, **not** the apply algorithm." This is the exact defect the prior review
   cited at that line. Strengthening.

**Cumulative regression verdict: NO REGRESSION.** Correction 8 is strictly
additive to the accepted Correction 1–7 architecture and redesigns none of the
observation-interval, lease, clock, deletion, bulk-ingest, or tenant models.

---

## 11. Findings

### Dispositions of the four Correction-7 findings

| ID | Prior severity | Disposition |
|---|---|---|
| **F-CLAUDE-PR5C7-01** | **P1** | **RESOLVED** — universal transaction-scoped `pg_advisory_xact_lock` canonical-identity anchor (§6.F.2.2), independent of row existence; option (a) adopted **and** option (b)'s no-blind-upsert guardrail imported; Correction-7 "identity-lock boundary" explicitly bound to the anchor; Race AT with all four required subcases |
| **F-CLAUDE-PR5C7-02** | **P2** | **RESOLVED** — safe contract (i): `responseGen` allocated after a usable response (Correction 4 preserved) but kept in process and persisted only atomically as the row leaves `ACTIVE`; committed `ACTIVE` + non-null `responseGen` forbidden; planned DB invariant; Race AU covering crash, expiry, clock rollback, stale resume |
| **F-CLAUDE-PR5C7-03** | **P3** | **RESOLVED** — deterministic ascending `(key1, key2)` multi-identity order with deduplication, ascending `observationRequestGen` / token order for observation rows, anchor always before observation-row locks, "no code path may invent its own reverse ordering"; Race AV |
| **F-CLAUDE-PR5C7-04** | **P3** | **RESOLVED** — §16 D1.14 updated to "Races P–AV" with AS, AT, AU, AV appended to the parenthetical enumeration; §6.F.13 preamble updated to A–AD / AE–AL / AM–AN / AO–AR / AS / AT–AV |

### New findings

#### F-CLAUDE-PR5C8-01 — **P2** — Advisory-lock capacity is unbounded against the shared lock table, on the path Correction 8 just made mandatory

**Document / section:** brief §6.F.2.2 "Batch / multi-identity lock order";
§8.3 batch ceiling ("start at ≤500 rows / transaction, configurable") and "**No**
one database transaction per row as the steady-state pattern"; §6.F.7 step 1.

**Evidence.** Correction 8 makes one transaction-scoped advisory lock per
canonical identity mandatory, held to commit, and §6.F.2.2 explicitly
contemplates a single bounded transaction applying **multiple** canonical
identities ("compute **all** advisory lock key pairs first… acquire them in
deterministic ascending `(key1, key2)` order"). §8.3 simultaneously forbids
one-transaction-per-row as the steady state and sets the planning batch ceiling
at ≤500 rows per transaction. Official PostgreSQL 18
(https://www.postgresql.org/docs/18/runtime-config-locks.html, accessed
2026-08-16): "The shared lock table has space for `max_locks_per_transaction`
objects… per server process or prepared transaction" (default **64**), and "This
parameter limits the average number of object locks used by each transaction;
individual transactions can lock more objects as long as the locks of all
transactions fit in the lock table." Advisory locks occupy that same shared lock
table. The brief nowhere mentions `max_locks_per_transaction`, a per-transaction
advisory-lock ceiling, or lock-table exhaustion (zero matches at the reviewed
head).

**Concrete failure scenario.** Initial sync of a large merchant (the brief's own
R-034 target: 50k variants / 15 locations / 750k inventory levels) runs bounded
JSONL ingest batches of up to 500 identities per transaction, each transaction
now holding up to 500 advisory locks plus row locks until commit, while PR 4
workers interleave concurrent direct-refetch and reconciliation transactions on
the same database. With the default configuration the shared lock table is sized
at `max_locks_per_transaction × (max_connections + max_prepared_transactions)`;
a handful of concurrent large-batch ingest transactions can exhaust it, and
further lock acquisition fails with an out-of-shared-memory error advising an
increase to `max_locks_per_transaction` — which can only be changed at server
start.

**Why this is P2, not higher.** Data integrity is preserved. The failure mode is
an aborted transaction, and because canonical mutation and abandonment fencing
share that transaction, an abort leaves no half-applied state (§6.F.2.2, § 13.3.4).
The impact is reliability and operability on the highest-volume merchant path —
initial sync — plus a configuration dependency that cannot be fixed without a
database restart. It is also not a defect in the serialization design itself; it
is an unstated operating envelope for a mechanism this correction introduced.

**Expected behavior.** The planning document should bound the number of advisory
identity locks a single fact transaction may hold, require the §8.3 batch
ceiling to be validated jointly against `max_locks_per_transaction` and expected
worker concurrency rather than chosen independently, and state fail-closed
behavior (bounded retry with a smaller batch; never split a single identity's
apply across transactions; never downgrade to an unanchored write) when lock
acquisition fails for want of shared memory.

**Missing acceptance test.** Extend Race **AV**, or add a mandatory race: run
concurrent bounded multi-identity ingest transactions at the configured batch
ceiling against a database configured with the intended
`max_locks_per_transaction`, and assert that either every transaction completes
or a failing transaction aborts cleanly with no canonical mutation, no
half-applied batch, no advisory lock leaked past transaction end, and no fallback
to an unanchored apply path.

#### F-CLAUDE-PR5C8-02 — **P3** — No fixed deterministic test vector for the lock-key derivation, and the `shopId` preimage encoding is unpinned

**Document / section:** brief §6.F.2.2 "Canonical lock-key encoding and
derivation", preimage field 2; Race AV.

**Evidence.** The derivation is otherwise specified tightly (version label, fixed
field order, 4-byte big-endian length prefix, UTF-8, SHA-256, first eight bytes,
big-endian two's complement). Two things are not pinned. First, field 2 is
`shopId` "(canonical string form of the internal shop id)" — "canonical string
form" is defined nowhere in the brief, so a numeric id rendered as decimal, a
UUID with or without hyphens, and a case-normalized versus raw identifier are all
admissible readings of the same sentence. Second, no fixed known-answer vector is
mandated anywhere: `test vector`, `known answer`, and `golden` all return zero
matches at the reviewed head. Race AV asserts ordering, collision
over-serialization, and observation-row order, but never asserts that two
independent call sites derive **identical** `(key1, key2)` for the same identity.

**Concrete failure scenario.** The brief requires the anchor from writers that
plausibly do not share one code path — the JSONL applicator, direct refetch,
reconciliation, and "background merchant-domain abandonment that changes
correctness state". If any one of them is implemented separately (a SQL/PL/pgSQL
helper, a maintenance job, a later service) and encodes `shopId` differently, the
two writers derive different keys for the same identity, acquire different
advisory locks, and run concurrently. That is precisely the
F-CLAUDE-PR5C7-01 damage class — concurrent first insert and null-version
last-writer-wins — reintroduced through **under-serialization**, which
§6.F.2.2 itself declares must never happen.

**Why this is P3.** The requirement "same identity always produces the same
`(key1, key2)`" is already normative, and the intended single shared derivation
helper makes drift unlikely rather than latent-by-construction. What is missing
is the artifact that would *detect* drift, plus one under-specified field.

**Expected behavior.** Pin the `shopId` encoding exactly (which column, which
string rendering, and whether any normalization applies). Mandate at least one
fixed known-answer vector per `resourceKind` — literal preimage bytes, the
SHA-256 digest, and the resulting `key1` / `key2` — recorded in the brief so that
every implementation, present or future, is checked against the same constants.

**Missing acceptance test.** Add to Race AV or as a standalone mandatory test: a
known-answer test asserting the derived `(key1, key2)` for fixed sample
identities of each `resourceKind` (including an InventoryLevel pair and a
non-ASCII GID/shop id) equals the recorded constants, and that every production
call site for the anchor routes through that one derivation.

### Findings summary

| Severity | Count |
|---|---|
| **P0** | **0** |
| **P1** | **0** |
| **P2** | **1** |
| **P3** | **1** |

| ID | Severity | One-line disposition |
|---|---|---|
| F-CLAUDE-PR5C7-01 | P1 | **RESOLVED** — universal transaction-scoped advisory identity anchor; Race AT (AT-1..AT-4) |
| F-CLAUDE-PR5C7-02 | P2 | **RESOLVED** — safe contract (i); no committed response-bearing ACTIVE; Race AU |
| F-CLAUDE-PR5C7-03 | P3 | **RESOLVED** — deterministic deduplicated ascending lock order; Race AV |
| F-CLAUDE-PR5C7-04 | P3 | **RESOLVED** — D1.14 updated to Races P–AV |
| F-CLAUDE-PR5C8-01 | **P2** | **NEW** — advisory-lock count per transaction unbounded against `max_locks_per_transaction`; large-batch initial sync can exhaust the shared lock table |
| F-CLAUDE-PR5C8-02 | **P3** | **NEW** — no fixed known-answer vector for the lock-key derivation; `shopId` preimage encoding unpinned; cross-caller drift would under-serialize |

---

## 12. Risks

Verified in `RISK_REGISTER.md` and `PROJECT_STATUS.md` at the reviewed head:

| Risk | Required state | Observed | Verdict |
|---|---|---|---|
| **R-157** | OPEN | `**OPEN — PR 5 planning** (D-053)`, P1, "Do **not** close this risk merely because the planning mitigation exists" | **CORRECT** |
| **R-158** | OPEN | `**OPEN — PR 5 planning** (D-053)`, P1, same non-closure clause | **CORRECT** |
| **R-159** | P2 OPEN | `**OPEN — PR 5 planning** (D-053)`, P2, extended with the F-CLAUDE-PR5C7-02 cause and the Correction-8 mitigation; races list extended to `… / AS / AU` | **CORRECT** |
| **R-160** | P1 OPEN | Newly added, P1, `**OPEN — PR 5 planning** (D-053)`, cause stated as F-CLAUDE-PR5C7-01 with the correct PostgreSQL reasoning; mitigation is the advisory anchor; "Do **not** close this risk merely because the planning mitigation exists"; races AT / AV | **CORRECT** |

`R-129 through R-160` are recorded as OPEN in both `PROJECT_STATUS.md` and
`phases/phase-1/README.md`. §6.F.13 scope statement was updated so the brief does
not close R-157, R-158, R-159, **or R-160**.

**Planning mitigations close no implementation risk.** Every race named in this
correction — AT, AU, AV included — is a future obligation, not evidence. Nothing
in Correction 8 has been executed, and no test in it exists yet.

The two new findings above should be tracked as risks (or folded into R-160 and a
new entry) when ChatGPT decides on them. They are **pre-implementation**
obligations, not planning-acceptance blockers.

---

## 13. CI evidence — exact head `a7d23bcfb6d82a209a986302e10b3a9a46601c87`

Run **31931311474** (`.github/workflows/ci.yml`, run number 319, attempt 1):

| Field | Observed |
|---|---|
| `event` | `pull_request` |
| `head_sha` | `a7d23bcfb6d82a209a986302e10b3a9a46601c87` |
| `head_branch` | `phase-1/pr5-planning` |
| `status` / `conclusion` | `completed` / **`success`** |
| Classify change set (job `95126473763`) | **SUCCESS** — includes a classification self-test step |
| Lint, typecheck, test, build, Prisma, GraphQL (job `95126488407`) | **SKIPPED** |
| CI Gate (job `95126488254`) | **SUCCESS** |
| Total jobs | 3 |

`docs_only=true` / `full_ci=false` /
`classification_reason=every_changed_path_is_docs_allowlist` is independently
corroborated: the full PR path set is 10 paths, all `stocky-plus/docs/**`, zero
non-allowlist paths (§3 above).

**Duplicate push workflow: NONE.** Enumerating all CI runs on
`phase-1/pr5-planning` shows exactly **one** run for `a7d23bc…`, event
`pull_request`. Push-triggered duplicates existed only for heads before the
CI-cost-control merge (`a15d58e…`); every head since — `578276…`, `f7b78f1…`,
`8262bdb…`, `1c1cba2…`, `6dd041d…`, `2db55b6…`, `a757baa…`, `a7d23bc…` — has
exactly one `pull_request` run. This matches `AGENTS.md` § CI evidence policy
items 1 and 2.

**`workflow_dispatch`: NOT USED.** No `workflow_dispatch` run appears for this
branch.

---

## 14. Scope statement

Repository changes made by this review: **exactly one new file** — this artifact,
at `stocky-plus/docs/phases/phase-1/PR5_PLANNING_CORRECTION_8_INDEPENDENT_REVIEW.md`.
The path was verified not to exist at `a7d23bc…` before creation.

No existing file was modified. `PR5_CATALOG_LOCATION_INVENTORY_FACTS_BRIEF.md`,
`DECISIONS.md`, `PROJECT_STATUS.md`, `RISK_REGISTER.md`, `OPEN_QUESTIONS.md`,
`phases/phase-1/README.md`, and all four prior immutable review reports are
untouched.

No runtime code, no schema, no migration, no planning correction, no D-054, no
implementation branch, no mark-ready, no merge, no production change, no
inventory write.

---

## 15. Final verdict

**APPROVE PR5 PLANNING**

All four findings from the immutable final Corrections 6+7 review
(`PR5_PLANNING_CORRECTION_7_INDEPENDENT_REVIEW.md`, blob `b1c4265…`) are closed
at planning head `a7d23bcfb6d82a209a986302e10b3a9a46601c87`, and no previously
accepted PR 5 planning invariant was weakened.

The two substantive corrections are architecturally right, not merely responsive.
Making the serialization boundary an identity anchor rather than a row lock
removes the failure mode instead of guarding it: correctness no longer depends on
whether a row happens to exist, which is what made the first-insert path
unguarded and the Correction-7 "identity-lock boundary" vacuous. Choosing safe
contract (i) for `responseGen` likewise removes the response-bearing `ACTIVE` row
class rather than extending predicates to tolerate it, which restores totality to
the Correction-7 abandonment predicate and preserves the Correction-4 allocation
point unchanged. Both corrections import guardrails beyond the minimum asked for
— the no-blind-upsert / fail-closed rule and the explicit "must not be weakened"
list in §6.F.2.1. Races AT, AU, and AV are discriminating: AT-2 and AT-4 in
particular would fail a plausibly wrong implementation that treated the advisory
anchor as licence to upsert. Every PostgreSQL 18 citation was verified against
the primary source and none over-claims.

**No P0 and no P1 finding was identified.** The two new findings are
pre-implementation obligations of the same character as F-CLAUDE-PR5C4-01 under
the Correction-4 review, not planning-acceptance blockers:
**F-CLAUDE-PR5C8-01 (P2) must be corrected before implementation authorization**
— the advisory mechanism now mandatory on the highest-volume path has no stated
operating envelope against the PostgreSQL shared lock table — and
**F-CLAUDE-PR5C8-02 (P3)** should be folded into the same correction so that
key-derivation determinism is verified rather than asserted. Neither requires
redesigning Correction 5, 6, 7, or 8.

Approval means the corrected planning architecture is technically ready for
ChatGPT's planning acceptance / merge decision. It does **not** authorize PR 5
runtime implementation, production, deployment, or inventory writes.

PR 5 implementation remains **NOT STARTED** and **NOT AUTHORIZED**. The
implementation branch `phase-1/catalog-location-inventory-facts` remains absent.
D-053 is unchanged and no D-054 is created by this report. R-157, R-158, R-159,
and R-160 remain **OPEN**. Production remains **NOT AUTHORIZED**. Every
inventory-write flag remains **DEFAULT OFF**. PR #24 remains **OPEN, DRAFT,
UNMERGED** on base `a15d58e0a9d99dd9497fe3243068d4a728aee52a`.
