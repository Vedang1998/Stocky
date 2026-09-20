# PR6-D Complete Integration — Independent Tier-A Review

**Reviewer:** Claude Code (independent; not Cursor, not the PR #40 review)
**Subject PR:** #43 — `phase-1/pr6-d-order-webhook-import`
**Exact subject:** `25226e46905b082fe3af09bb1d9f5c68a8e39785`
**Base / current main V:** `a3ff480f1477237f8055f10c43298480a05728a1`
**Review date:** 2026-09-15

## Verdict

**CORRECTIONS REQUIRED**

Established implementation defects prevent approval, and the mandatory D-scale
evidence remains unexecuted because a correctness defect blocks the workload.
This review is not acceptance, merge authorization, deployment authorization, or
authorization to enable inventory writes.

R-176 remains OPEN/P0. R-164 and upstream residuals unchanged. PR6 and Phase 1
remain IN PROGRESS. No D-055 is created.

---

## 1. Subject, ancestry, scope, admission and preservation

All independently recomputed from the repository, not from the report.

| Item | Reported | Independently verified |
|---|---|---|
| Subject head | `25226e46` | **Confirmed** — PR #43 head, OPEN / DRAFT / UNMERGED |
| Base V | `a3ff480f` | **Confirmed** — equals live `origin/main` |
| V parent U | `1ec7af31` | **Confirmed** |
| V tree (accepted C tree) | `ba55f5d5` | **Confirmed** |
| Commits ahead of V | 7 | **Confirmed** (7) |
| Commits behind V | 0 | **Confirmed** (0) |
| Merge base | V | **Confirmed** |
| Changed paths | 57 | **Confirmed** (57; +7229 / −122) |
| Docs admission checkpoint | `f288b10b`, sole parent V | **Confirmed** — parent is V, and the diff V→`f288b10b` touches **only** `stocky-plus/docs/**` (8 files). Admission precedes runtime. |
| First runtime commit | `55a2ba29` | **Confirmed** — parent is the docs checkpoint |

Commit chain V → subject:

```
a3ff480 (V)
 └─ f288b10  docs: record PR6-B/C closure and PR6-D admission      [docs-only]
     └─ 55a2ba2  Implement PR6-D order webhook, import, reconciliation runtime
         └─ 93e7add  Add PR6-D PostgreSQL integration evidence
             └─ 9063f2d  Fix lock capacity, fail-closed money, revival, fence retry
                 └─ 17d1324  Record implementation evidence; repair scanner/typecheck
                     └─ 97ee6c6  Fix report trailing whitespace that failed Classify
                         └─ 25226e4  Record 93e7add Heavy inventory-check failure  [subject]
```

### Immutable upstream review preservation

All six mandated pinned blobs match their recorded identities **exactly** at the
subject:

| Artifact | Required blob | At subject |
|---|---|---|
| Final C | `0daa0e5395c69b1fb86508f133f6ade3f8430f56` | ✅ match |
| Original C | `a90ae442a80ee593bb43bee3b15c2228f32d6e15` | ✅ match |
| Prior C correction | `8c384b698bc45a7a9ac0a1dffa2ab8fdbcc65704` | ✅ match |
| B correction | `e902a1ce07e30174cd56cea13114be7325195c98` | ✅ match |
| Original B | `b4533610b5af305816aef5434b884c3065b06f94` | ✅ match |
| Tooling | `5a47f6f8133806848ad71a545e07c030a2137e37` | ✅ match |

No prior review file was modified or deleted. No competing
`PR6_D_COMPLETE_INTEGRATION_INDEPENDENT_REVIEW.md` existed before this one.

### Controls

- `shopify.app.toml` adds exactly three subscriptions (`orders/edited`,
  `orders/delete`, `order_transactions/create`). **Scopes and `api_version`
  unchanged.** No `read_all_orders`. Verified by diff.
- No workflow, dependency, schema, grant, or global-test changes in the delta.
- No D-055 entry. R-176 remains OPEN/P0 in `RISK_REGISTER.md`.

---

## 2. Exact-head CI — independently read from GitHub

Run [`34934317232`](https://github.com/Vedang1998/Stocky/actions/runs/34934317232),
event `pull_request`, `head_sha` `25226e46905b082fe3af09bb1d9f5c68a8e39785`,
`run_attempt` 1, conclusion **success**. Triggering actor `cursor[bot]`.

| Job | ID | Conclusion |
|---|---|---|
| Classify change set | `104268867535` | success |
| Lint, typecheck, test, build, Prisma, GraphQL (Full Heavy) | `104268902312` | success — **not skipped**, 146 steps |
| CI Gate | `104282899644` | success |

Ordering verified: *Generate Prisma client* (step 8) and *GraphQL codegen /
schema validation* (step 129) both precede *Migration and tenant-backfill tests*
(step 142), which is where the D PostgreSQL suite executes. No
`workflow_dispatch`. No later push. The PR's CI claims are **accurate**.

The three superseded runs (`34931435422`, `34932750380`, `34934129024`) remain
failures and are recorded as such. They are not counted as evidence.

**Material observation:** no CI step exercises the D module through the real
durable worker or queue. Steps 68–72 (`NEW-CLAUDE-D045-02`) appear to do so but
have been retargeted by this PR — see **D-R-07**.

---

## 3. Reviewer environment and independently executed evidence

Disposable environment: PostgreSQL 16 (`max_connections=200`,
`max_locks_per_transaction=256`), Redis 7, Node v22.22.2, npm pinned to 11.5.2
per `package.json` `packageManager`. No production or merchant data. No Shopify
store calls. No live subscription registration.

Full provisioning chain executed on the **pristine** subject, all exit 0:

```
tenant:enforcement:inventory:check   tenant:roles:provision --apply
tenant:enforcement:preflight         tenant:enforcement:apply --apply
tenant:roles:verify                  tenant:rls:verify
tenant:enforcement:verify            sync:inventory:check
sync:roles:provision --apply         sync:roles:verify
tenant:access:inventory:check
```

Independently reproduced suites on the pristine subject:

| Suite | Result |
|---|---|
| `npm run test` (unit) | **65 files / 594 passed** — matches the report exactly |
| `scripts/tenant-enforcement/tests/pr6-d-integration.test.ts` | **22 passed** — matches the report |
| `app/sync/__tests__/sync-d046-worker-finalize.test.ts` | **7 passed** |

### Reviewer-environment errors, correctly attributed — NOT PR defects

Recorded for completeness, and explicitly **not** charged against the PR:

1. `tenant:access:inventory:check` initially failed with *"PR2_TENANT_ACCESS_INVENTORY.md is stale"*. Root cause: **my own probe files** had been added to the scanned tree (`scannedFiles` 483 → 485). On a pristine subject the gate passes (`tenant_access_inventory_fresh`, exit 0). This is the same gate that failed in superseded runs `34931435422` / `34932750380`; at the subject head it is genuinely fixed.
2. Two D integration tests initially failed on an absent `app/types/admin-2026-07.schema.json`. Root cause: codegen had not yet run in my environment. After `npm run graphql-codegen`, 22/22 pass. CI orders this correctly.
3. `dangerous_privilege_drift:unsafe_default_function_absent_acldefault` on a rebuilt cluster. Root cause: I had omitted `tenant:roles:provision` before `preflight`. Restoring CI's step order clears it.
4. A PostgreSQL data directory placed under the session scratchpad was killed mid-run by a permissions reset (`PANIC: could not open file .../global/pg_control`). Environment only; relocated and rebuilt.

---

## 4. The three source-derived targets — independently reproduced

All three are **confirmed**. None is refuted.

### 4.1 The 32-root bound is a cap on total import size, not an active-assembly window — **CONFIRMED**

`sync/jsonl.ts` inserts every root into `roots` (line 82) and **never deletes
from it**. The bound check `roots.size + orphans.size > maxOpenParents`
(lines 85, 99) therefore compares against a monotonically growing total.
`sync/constants.ts:69` sets `ORDER_FACTS_JSONL_MAX_OPEN_PARENTS = 32`.
`sync/import.ts:189` awaits the whole assembly before applying anything.

Reviewer probe results (pure function, no DB):

| Input | Status |
|---|---|
| 0 roots | COMPLETE |
| 1 root | COMPLETE |
| 31 roots | COMPLETE |
| 32 roots | COMPLETE |
| **33 roots** | **OPEN_PARENT_BOUND** — `open parent assemblies exceeded 32` |
| 40 roots, each **fully closed** before the next begins (3 children each) | **OPEN_PARENT_BOUND** |
| 100 roots × 20 children (2 100 objects) | **OPEN_PARENT_BOUND** |
| 1 root × 50 000 children (50 001 objects) | COMPLETE |

The 40-fully-closed-roots case is decisive: a bounded *active* window would
accept it, because no two roots are ever open simultaneously. It fails. The
bound is on **total import size**.

Confirmed end-to-end against PostgreSQL:

```
33 roots -> {"status":"PARTIAL_FAILURE","reason":"open parent assemblies exceeded 32"}
```

A Bulk A export for any shop with 33 or more orders cannot be imported at all.
The 1 000 000-line Phase 1 envelope is unreachable except by hiding the entire
workload under fewer than 33 orders.

**Bulk A line data is discarded.** The assembler returns only
`{status, rootGids, objectCount, rootCount}`. Children whose parent is already
in `roots` are dropped (line 93–95); pending orphans are deleted without being
attached (line 83–84). `import.ts` then refetches **every** nominated order
individually via `applyNominatedOrderGid`. The Bulk operation functions solely
as a list of order IDs, at a cost of N Admin round-trips.

### 4.2 The real legacy worker receives a query-only wrapper — **CONFIRMED, and more severe than stated**

`apply-composition.ts:36-40`:

```ts
function asApplyDb(db: OrderApplyDb): OrderApplyDb {
  return { $queryRaw: db.$queryRaw };
}
```

That object — whose **only** property is `$queryRaw` — is passed to
`input.runLegacy` (line 129–133). The production worker wires
(`webhook-processor.ts`):

```ts
runLegacy: (topic, db, payload) =>
  runLegacyWebhookHandler(topic, db as unknown as TenantDb, payload),
```

and every legacy handler dereferences TenantDb members on its **first
statement** — `handleOrderCreate`, `handleOrderCancelled` (line 148) and
`handleRefundCreate` (line 190) all begin `const shop = db.authority.myshopifyDomain;`
and then use `db.salesDailyAggregate.*`.

Executed through the **real `processWebhookJob`** with a valid v3 durable
envelope, a real dispatch row, a TenantDb carrying `authority` and model
delegates, and only the Shopify transport boundary mocked:

| Topic | Thrown | DurableJob | Legacy rows | Canonical facts | Receipts |
|---|---|---|---|---|---|
| `orders/create` | `TypeError: Cannot read properties of undefined (reading 'myshopifyDomain')` | `RETRY_WAIT` / `processor_error` | 0 | 0 | 0 |
| `orders/cancelled` | `TypeError: Cannot read properties of undefined (reading 'myshopifyDomain')` | `RETRY_WAIT` / `processor_error` | 0 | 0 | 0 |
| `refunds/create` | (my fixture blocked earlier, at refund parent adjudication) | `DEAD_LETTERED` | 0 | 0 | 0 |

Two of the three frozen v1 topics are **executably reproduced**. The third is
the same defect by construction: identical wiring, identical stripped object,
identical first statement. I state that distinction rather than claiming an
execution I did not obtain.

The throw occurs inside the canonical transaction, so the whole transaction
rolls back: no canonical facts, no legacy effects, no receipt. Every delivery of
these topics fails, retries, and ultimately dead-letters.

**Why the submitted suite cannot see this.** `pr6-d-integration.test.ts` never
calls `processWebhookJob`. It calls `processOrderFactsWebhookJob` directly and
supplies `legacyRunner(shopId)` from its own harness — a callback that uses
**only** `queryRows(applyDb)`, i.e. exactly the `$queryRaw`-only shape
`asApplyDb` provides. The harness's `asOrderFactsTxnHost` is likewise a raw
`pg`-client host with only `$queryRaw` and `$transaction`. The test double
matches the bug, so all 22 tests pass against a path that cannot run in
production.

### 4.3 First confirmation certifies success without a receipt, and the second confirmation is never scheduled — **CONFIRMED**

`apply-composition.ts:189-200` catches `OrderApplyReceiptNotCertifiableError`
containing `terminal_first_confirmation`, re-runs apply with `receipt:
undefined`, and returns `status: "applied"` unconditionally.

Reviewer probe against PostgreSQL (LIVE → tombstone → first LIVE confirmation):

```
after tombstone      : ABSENT
returned status      : applied
returned reason      : terminal_first_confirmation
existenceState AFTER : ABSENT      <-- identity still terminal
receipts before/after: 2 / 2       <-- no receipt certified
DurableJob rows      : 0           <-- nothing scheduled for confirmation #2
SyncRun rows         : 0
DataIssue rows       : 0
```

And the worker's treatment of that result, executed through the real
`processWebhookJob`:

```
durableJob.state       = SUCCEEDED
attempt.resultMetadata = {"applicationStatus":"applied"}
```

The chain is complete: a first LIVE observation drives `completeAttemptSuccess`
and marks the durable job SUCCEEDED while the merchant-visible identity is still
`ABSENT` and `receiptStatus` is `none`. `terminal_first_confirmation` appears
in **no** scheduler, queue, reconciliation or nomination path anywhere in the
application — grep across `app/` and `scripts/` returns only the decision site,
the certification denylist, this catch block, and tests. The mandatory second
non-overlapping confirmation is therefore **not durably scheduled and has no
bounded retry**; it occurs only if Shopify happens to deliver another qualifying
webhook. In the submitted test the second confirmation is supplied manually by
the test itself (a third hand-written `order_edit`).

A deliberately committed observation-only intermediate step is legitimate. What
is not legitimate is reporting it to the durable job state machine as a
completed merchant application, with no receipt, no scheduled follow-up, and no
DataIssue.

---

## 5. Additional material findings

### D-R-05 (P1) — legacy effects silently skipped on the no-receipt retry

`apply-composition.ts:125` gates the legacy call on
`batch.receiptStatus === "applied"`. `apply/index.ts:1284` initialises
`receiptStatus` to `"none"` and only promotes it when a receipt row is inserted
(line 1306). On the `runApply(undefined)` first-confirmation retry there is no
receipt, so `receiptStatus` is `"none"` and **`runLegacy` is never invoked** —
yet the function returns `status: "applied"` and the worker records success.
For the three legacy topics this means canonical state advancing without the
paired legacy effect, reported as a completed application.

### D-R-03 (P1) — an incomplete JSONL completes coverage and advances the watermark

`import.ts` persists Shopify's `objectCount` / `rootObjectCount` via
`persistBulkCounts` (line 137) but **never compares them** to the assembled
`objectCount` / `rootCount`. The streamed counts are passed only on the
*partial-failure* branch (lines 267–268); the success branch at line 292 does no
comparison at all.

Executed against PostgreSQL:

| Scenario | Result | SyncCursor | SyncHealth | DataIssues |
|---|---|---|---|---|
| **Empty download** | `SUCCEEDED`, applied 0, examined 0 | **advanced** (`full-sync-epoch:…`) | `HEALTHY` / `latest_succeeded` | 0 |
| **Truncated at a newline** (5 roots expected, 2 delivered) | `SUCCEEDED`, applied 2, examined 2 | **advanced** | `HEALTHY` / `latest_succeeded` | 0 |

The completed `SyncRun` carries `errorCode: null`. The requirement *"prove no
incomplete file can complete coverage or advance watermarks"* does not hold.

This is a regression against an accepted upstream property: the PR5-F3 streamer
`streamJsonlBatches` — which D does not use — enforces `object_count_mismatch`
and `root_object_count_mismatch`.

### D-R-06 (P2) — checkpoint ordinals are in the wrong units and are never read

`import.ts:253` writes `endLineOrdinal: index + 1`, where `index` is the
position in the **root GID array**. The PR5-F3 contract
(`catalog-sync.ts:448-485`) treats `jsonlCommittedLineOrdinal` as a **physical
JSONL line ordinal** (`batch.startLineOrdinal`, `batch.endLineOrdinal`,
`line.ordinal`). For any export containing child lines the two numberings
diverge immediately: root #5 may be physical line 40, yet the acknowledged
prefix claims 5.

Independently worse: `jsonlCommittedLineOrdinal` is read in exactly one place in
the application — `catalog-sync.ts:448`. **`runOrderFactsImportStep` never reads
it.** Every retry re-downloads, re-assembles and re-applies from index 0. The
checkpoint is written but cannot resume anything; "retries actually resume
rather than rescan" is not satisfied.

### D-R-07 (P2) — accepted PR4/D046 real-worker coverage was weakened, not preserved

The subject modifies `app/sync/__tests__/sync-d046-worker-finalize.test.ts`
(topic `orders/create`, i.e. a D-owned topic, so the new D branch intercepts
before the accepted `applyWithApplicationReceipt` path):

- Two assertions changed from `already_applied_verified_after_rollback` to
  `already_applied`. The D branch returns early, so the verified-after-rollback
  certification no longer runs for order topics. The test retains its name.
- Two uncertain-outcome tests were retargeted from `applyMock` to
  `dWebhookMock`, so they no longer exercise the real apply path they were
  written to cover.
- The *RepeatableRead transaction option* test had its forcing mock deleted.
- `unauthenticated.admin` is mocked to return `{ data: {} }`, so the D path can
  never reach `applyCanonicalAndLegacy` — which is precisely why **D-R-01** is
  invisible to it.

The net effect is that the one CI-executed real-worker suite no longer covers
either the accepted PR4 behaviour or the new D composition. Accepted coverage
should not be relaxed to accommodate new interception.

### D-R-08 (P2) — multi-byte UTF-8 split across chunks is silently corrupted

`jsonl.ts:109` constructs `new TextDecoder().decode(chunk)` **per chunk**, with
no streaming mode. A multi-byte sequence spanning a chunk boundary decodes to
U+FFFD on both sides. Reproduced:

```
original : {"id":"gid://shopify/Order/1","note":"café-日本-🎉"}
rejoined : {"id":"gid://shopify/Order/1","note":"café-���本-🎉"}
U+FFFD count: 3   -> assembly status: COMPLETE (not rejected)
```

Because replacement characters are valid inside a JSON string, `JSON.parse`
succeeds and the corruption does not fail closed. Impact is currently limited by
D-R-02/D-R-10 (line payloads are discarded and GIDs are ASCII), but the
fail-closed guarantee the module claims is not met, and the exposure becomes
real as soon as line data is used.

### D-R-09 (P2) — the bulk poll retry budget is dead code

`import.ts:159-165` returns `CONTINUE` when `attempt === 0` and the operation is
not yet terminal, so the loop body never reaches `attempt === 1`.
`ORDER_FACTS_BULK_POLL_MAX_ATTEMPTS = 120` and
`ORDER_FACTS_BULK_POLL_INTERVAL_MS` describe a polling policy that is never
executed. The constant should not be read as evidence of a bounded poll.

### D-R-10 (P2) — Bulk A is reduced to an ID list

Every nominated order is refetched individually (`applyNominatedOrderGid`), so a
Bulk export of N orders costs N Admin round-trips in addition to the bulk
operation. No line data from Bulk A is used. This should be assessed against the
approved follow-up budget before the cap in D-R-02 is lifted, or the cost scales
directly with catalogue size.

### D-R-11 (P3) — whole-stream `seenIds` retention

`seenIds` accumulates every id for the life of the stream and is never pruned.
Latent while D-R-02 caps imports at 32 roots; a scale defect the moment the cap
is lifted.

### D-R-12 (P3) — the reported memory figure is not a bound and is not reproducible

The packet reports `{"pr6dQuarantineRecovery":{"orderFactByIdQueries":8,"heapDeltaBytes":53336}}`.
The same instrumented test in my environment emitted **`heapDeltaBytes: 10999720`**
— a 200× difference. An allocation delta between two `heapUsed` samples is not a
peak-memory bound and is not stable across environments. It should not be cited
as memory evidence.

---

## 6. Requirement-to-evidence matrix

| Requirement | Status |
|---|---|
| Six coherent topic registrations (TOML, routes, sanitizer, schema version, envelope, strategy, dispatch, worker) | **Verified** — three new subscriptions added; scopes and API version unchanged |
| B readers → D mapper → C → PostgreSQL, independent clocks, money/currency rejection, at-sale identity | **Reused with applicability** — 22/22 reproduced; direct-function level only |
| Frozen v1 topics executable after new-topic code (T51) | **FAILED** — passes as a direct call; fails through the real worker (D-R-01) |
| Real durable worker / queue execution of D | **FAILED** — absent from the packet; executed by this review, defect found |
| Legacy atomicity, no duplicate legacy effects | **FAILED** — legacy never runs in production wiring (D-R-01); silently skipped on the no-receipt path (D-R-05) |
| Receipt atomicity, digest conflict, uncertain commit, receipt-probe failure | **Reused with applicability** — covered at direct-function level; **not** covered through the real worker |
| First/second LIVE confirmation, durable scheduling, bounded retries | **FAILED** — D-R-04 |
| Import submission intent/fence, lost submit, polling by GID, cross-shop mismatch, partialDataUrl refusal | **Verified** — reproduced; both B gates present, Bulk C rejected, Bulk B disabled |
| Import completeness, no watermark advance on incomplete input | **FAILED** — D-R-03 |
| Checkpoint/restart and genuine resume | **FAILED** — D-R-06 |
| Quarantine → coalesced scheduling → sweep → 300-line facts, incl. behind watermark | **Reused with applicability** — reproduced at direct-function level; worker registration not exercised |
| Reconciliation, exhaustive sweep vs sampling, monotonic watermarks, DataIssue lifecycle | **Partially verified** — submitted tests reproduce; undermined by D-R-03 writing HEALTHY on zero coverage |
| Tenant isolation (Shop A / Shop B), processing-disabled refusal | **Verified** — reproduced; `tenant:rls:verify`, `tenant:roles:verify`, `sync:roles:verify` all pass |
| No control-plane DML under merchant runtime, no broad grants, no CI/allowlist bypass | **Verified** — full enforcement chain passes on pristine subject |
| Admin 2026-07 schema validity from generated artifact | **Verified** — codegen artifact, not a network fetch |
| Actual store execution | **Not executed** — no live Shopify calls authorized; correctly disclosed, not invented |
| **D-specific 1 000 000-line scale / streaming / queue / recovery** | **UNEXECUTED — BLOCKED** (see §7) |

---

## 7. The scale gate is blocked, not waived

The mandatory D-scale requirement cannot be executed at this subject. The
assembler rejects any input containing 33 or more root orders (D-R-02,
reproduced), so a 1 000 000-line envelope cannot be processed by the real path
at all. Per the review order I did **not** benchmark a path already proven
unable to process its input, and I did **not** manufacture a pass by hiding the
whole workload under fewer than 33 roots.

**Prerequisite for the gate:** replace the total-root cap with a genuine bounded
*active-assembly* window that releases completed roots, and add whole-stream
count verification (D-R-03). Once both land, the scale gate must be executed
with varied root counts and children-per-root, batch-boundary
interruption/restart, and concurrent shop/stream activity, recording elapsed
time, row counts, request/query counts, **peak** memory (not an allocation
delta) and completeness/watermark outcomes.

The C-only million-line benchmark, the eight `OrderFactById` requests and the
53 336-byte heap delta are not D-scale evidence and are not accepted as such.

---

## 8. Required corrective acceptance tests

Each correction must ship with a test that fails before the fix:

1. **D-R-01** — Execute all three frozen v1 topics through the real
   `processWebhookJob` with a real `TenantDb`, mocking only the Shopify
   transport. Assert canonical facts, legacy `SalesDailyAggregate` effects and
   exactly one receipt, in one transaction. Assert rollback after a legacy
   failure and after a canonical failure, and no duplicate legacy effects on
   redelivery. A harness callback that consumes only `$queryRaw` must not be
   accepted as the production runner.
2. **D-R-02** — Assert 33, 100 and 1 000 roots all assemble COMPLETE, with roots
   released as they close, and bounded peak memory under many children per root.
3. **D-R-03** — Assert that an empty download, a newline-truncated download, and
   any stream whose counts differ from `objectCount` / `rootObjectCount` all fail
   closed, leave the cursor unchanged, and open a DataIssue.
4. **D-R-04 / D-R-05** — Assert that a first LIVE confirmation does not reach
   `completeAttemptSuccess` as a completed application; that the second
   confirmation is durably scheduled with a bounded retry; and that legacy
   effects are never skipped on a path reported as `applied`.
5. **D-R-06** — Assert `endLineOrdinal` is a physical JSONL ordinal and that a
   restart resumes from it rather than rescanning; inject a gap before later
   successful roots and assert the acknowledged prefix cannot leap across
   uncommitted work.
6. **D-R-07** — Restore the accepted `already_applied_verified_after_rollback`
   assertions and the real-apply targeting of the uncertain-outcome tests, and
   add a real-worker D test with a functional admin so the D path reaches apply.
7. **D-R-08** — Assert a multi-byte UTF-8 sequence split across chunks decodes
   losslessly (streaming decoder) or fails closed.

---

## 9. Findings summary

| ID | Severity | Location | Summary |
|---|---|---|---|
| D-R-01 | **P1 (top blocker)** | `sync/apply-composition.ts:36-40,129-133`; `jobs/workers/webhook-processor.ts` | Legacy handlers receive a `$queryRaw`-only object; all three frozen v1 topics fail permanently in production |
| D-R-02 | **P1** | `sync/constants.ts:69`; `sync/jsonl.ts:82,85,99` | 32-root cap is on total import size; ≥33 orders cannot be imported; blocks the scale gate |
| D-R-03 | **P1** | `sync/import.ts:137,189,292` | Empty/truncated JSONL completes coverage, advances the watermark and reports HEALTHY |
| D-R-04 | **P1** | `sync/apply-composition.ts:189-200` | First LIVE confirmation reported as a completed application; no receipt; second confirmation never scheduled |
| D-R-05 | **P1** | `sync/apply-composition.ts:125` | Legacy effects silently skipped on the no-receipt retry while reporting `applied` |
| D-R-06 | **P2** | `sync/import.ts:253` | Checkpoint ordinal in wrong units and never read; no resume |
| D-R-07 | **P2** | `app/sync/__tests__/sync-d046-worker-finalize.test.ts` | Accepted PR4/D046 real-worker coverage weakened and retargeted |
| D-R-08 | **P2** | `sync/jsonl.ts:109` | Split multi-byte UTF-8 silently corrupted, not rejected |
| D-R-09 | **P2** | `sync/import.ts:159-165` | Bulk poll retry budget is dead code |
| D-R-10 | **P2** | `sync/import.ts:223-259` | Bulk A reduced to an ID list; N refetches per import |
| D-R-11 | **P3** | `sync/jsonl.ts:49` | Whole-stream `seenIds` retention |
| D-R-12 | **P3** | `PR6_D_IMPLEMENTATION_REPORT.md` | Reported heap delta is not a peak-memory bound and is not reproducible |

---

## 10. Residual ownership and scope

- R-176 remains **OPEN / P0**, pending a separate ChatGPT risk decision. This
  review does not close it.
- R-164 and all upstream residuals are unchanged.
- The accepted F-F03 timing residual remains tracked; the exact-head pass does
  not close it.
- PR6 and Phase 1 remain **IN PROGRESS**.
- No D-055 entry was created.
- The docs admission checkpoint, the B/C closure record and all prior immutable
  reviews are unmodified.

Nothing in this review authorizes merging, deployment, inventory writes,
subscription registration, or release of the remaining commercial application.

---

*This review was produced by read-only inspection of the exact subject, isolated
synthetic PostgreSQL and Redis, and temporary reviewer-authored probes. No
implementation branch, peer branch, main branch, schema, grant, scope, flag,
workflow or prior review artifact was modified. No production or merchant data
was accessed and no Shopify store calls were made.*
