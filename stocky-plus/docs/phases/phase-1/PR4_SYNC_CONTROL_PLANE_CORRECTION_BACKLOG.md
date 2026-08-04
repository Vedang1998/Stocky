# Phase 1 PR 4 — Synchronization Control Plane Correction Backlog

**Authority:** ChatGPT (product / architecture)  
**Implementation owner:** Cursor  
**Independent correction reviewer:** Claude Code  
**Technical acceptance authority:** ChatGPT  
**Merge authority:** User only after ChatGPT acceptance  

**Source review:** `PR4_SYNC_CONTROL_PLANE_REVIEW_REPORT.md` (preserved verbatim — **do not edit**)  
**Independently reviewed implementation head:** `7c36bc1bf2a1d6ccbd0e9d7131ae2d692fefea7a`  
**Preserved independent review-report head / correction starting head:** `944cd5922f12cccc73519e5cb4434985a296e923`  
**Unchanged base / `origin/main`:** `e69bc53d91db75472b0d0998bf1b74ee6246adb1`  
**Decision:** D-043 — Phase 1 PR 4 corrections required  

## Finding-count reconciliation

| Source | P0 | P1 | P2 | P3 | Total |
|---|---:|---:|---:|---:|---:|
| Independent report declared totals (§2) | 0 | 4 | 7 | 4 | 15 |
| Independent report actual headings | 0 | 4 | 10 | 6 | 20 |
| **Correction scope (D-043)** | **0** | **4** | **10** | **6** | **20** |

Do **not** silently use the incorrect summary totals from the review report.
The original independent report remains immutable. Correction review must
reconcile counts and use permanent `RISK_REGISTER.md` definitions (not the
report’s shifted R-099…R-108 disposition labels).

**Status legend:** every finding below remains

```text
IMPLEMENTATION PENDING INDEPENDENT VERIFICATION
```

No finding closes on Cursor evidence alone. PR #20 remains **OPEN, DRAFT,
UNMERGED**. PR 5 remains blocked. Production execution and inventory writes
remain unauthorized. All inventory-write flags remain default OFF.

---

## Identity chain of custody

| Commit | Role |
|---|---|
| `e69bc53d91db75472b0d0998bf1b74ee6246adb1` | Unchanged `origin/main` / authorized base |
| `7c36bc1bf2a1d6ccbd0e9d7131ae2d692fefea7a` | Independently reviewed implementation head |
| `89aeea8…` | Actual last runtime/test implementation head before review |
| `329aa929…` | First independent review-report commit (preserved) |
| `944cd5922f12cccc73519e5cb4434985a296e923` | Preserved review-report head; required correction starting head |
| *(correction commits)* | Cursor correction implementation — pending independent verification |

Do not amend, rebase, squash, reset away, replace, or force-push the
independent review commits. Do not edit
`PR4_SYNC_CONTROL_PLANE_REVIEW_REPORT.md`.

---

## P1 — blocking

### F-PR4-01 · P1 · Durable idempotency does not provide exactly-once business application

| Field | Value |
|---|---|
| Severity | P1 |
| Object | `app/jobs/workers/webhook-processor.ts` (legacy handlers + completion split) |
| Independent evidence | Merchant writes execute separately from control-plane completion; no application marker; retry after partial sales increment duplicates effects |
| Required correction | Tenant-owned `SyncApplicationReceipt` (`shopId` + `applicationKey` unique); atomic tenant transaction: check receipt → merchant writes → insert receipt last → commit; control-plane success later; job execution strategy matrix (`ATOMIC_APPLICATION_RECEIPT` / `REBUILDABLE_IDEMPOTENT` / `NO_AUTOMATIC_RETRY` / `CONTROL_ONLY`); webhook application key from durable webhook delivery (not replay job ID) |
| Acceptance test | `test:sync-exactly-once` — crash after first sales line; crash after tenant commit before control-plane success; retry; replay; duplicate delivery; concurrent workers; BOM; low-stock; cancel; refund; inventory; catalog/ABC repeated execution; exact merchant outcomes |
| Affected risks | R-109 (new); R-032; R-104 |
| Correcting commit | `a38be9ffb4b6574d8612e522acde584fae038686` (+ follow-up test/CI docs commits) |
| Exact test evidence | focused gates green locally — see CORRECTION_IMPLEMENTATION_REPORT; pending exact-head CI |
| Independent-review disposition | PENDING INDEPENDENT VERIFICATION |
| Status | IMPLEMENTATION PENDING INDEPENDENT VERIFICATION |

### F-PR4-02 · P1 · Retry re-dispatch is silently deduplicated by BullMQ but acknowledged as ENQUEUED

| Field | Value |
|---|---|
| Severity | P1 |
| Object | `app/sync/dispatcher.server.ts` (`jobId: job.id`, `ackEnqueued`) |
| Independent evidence | Retry reuses durable job ID; BullMQ retains failed job; `add` returns old job; DB falsely transitions to `ENQUEUED`; waiting count stays 1 |
| Required correction | Append-only `JobDispatch` with `(durableJobId, dispatchSequence)` and `(queueName, queueJobId)` uniqueness; queue job ID `<durableJobId>:<dispatchSequence>`; envelope `tenant-job-envelope-v3` binds durable job, dispatch identity, queue job ID, digest, tenant, source, correlation, causation; unacknowledged dispatch recovery inspects deterministic queue job ID before new sequence |
| Acceptance test | `test:sync-dispatch-recovery` — retry while failed BullMQ job retained; after retention deletion; enqueue-then-ack-loss; recovery observes existing / missing queue job; dual dispatcher; ID/envelope mismatch; monotonic sequence; handler execution count |
| Affected risks | R-099; R-031 |
| Correcting commit | `a38be9ffb4b6574d8612e522acde584fae038686` (+ follow-up test/CI docs commits) |
| Exact test evidence | focused gates green locally — see CORRECTION_IMPLEMENTATION_REPORT; pending exact-head CI |
| Independent-review disposition | PENDING INDEPENDENT VERIFICATION |
| Status | IMPLEMENTATION PENDING INDEPENDENT VERIFICATION |

### F-PR4-03 · P1 · Uninstall is denied and fully rolled back when any job is DISPATCH_LEASED

| Field | Value |
|---|---|
| Severity | P1 |
| Object | `app/sync/uninstall.server.ts`; `app/sync/state-machine.server.ts` |
| Independent evidence | `CANCELLABLE` includes `DISPATCH_LEASED` but no `DISPATCH_LEASED → CANCELLED` edge; `assertTransition` aborts entire uninstall transaction; `processingEnabled` remains true |
| Required correction | Legal transitions `DISPATCH_LEASED → CANCELLED` and `RUNNING → CANCELLED` (or equivalent terminal shutdown); atomic disable + cancel + close attempts + persist delivery; session deletion only after durable disablement commits; session-delete failure must not re-enable shop |
| Acceptance test | `test:sync-uninstall` — PENDING / DISPATCH_LEASED / ENQUEUED / RUNNING / RETRY_WAIT / mixed; duplicate uninstall; failed session deletion; enqueue race; worker-completion race; uninstall after validation before merchant tx; reinstall after UNINSTALLED; denied reinstall after REDACTED |
| Affected risks | R-031; R-101 |
| Correcting commit | `a38be9ffb4b6574d8612e522acde584fae038686` (+ follow-up test/CI docs commits) |
| Exact test evidence | focused gates green locally — see CORRECTION_IMPLEMENTATION_REPORT; pending exact-head CI |
| Independent-review disposition | PENDING INDEPENDENT VERIFICATION |
| Status | IMPLEMENTATION PENDING INDEPENDENT VERIFICATION |

### F-PR4-04 · P1 · Worker crash after attempt claim strands the job permanently

| Field | Value |
|---|---|
| Severity | P1 |
| Object | `app/sync/lifecycle.server.ts`; `JobAttempt` schema |
| Independent evidence | No RUNNING lease/heartbeat; expired-lease recovery covers only `DISPATCH_LEASED`; redelivery hits `attempt_conflict`; two open attempts insertable (no DB partial unique) |
| Required correction | Partial unique `UNIQUE (durableJobId) WHERE finishedAt IS NULL`; attempt lease owner/expiry/heartbeat/dispatch identity; heartbeat renewal; reaper for expired RUNNING; outcome `ABANDONED` / `LEASE_EXPIRED` / `WORKER_LOST`; recovery by execution strategy + application receipt |
| Acceptance test | `test:sync-attempt-recovery` — worker death; heartbeat expiry/renewal; concurrent reapers; two active-attempt inserts; stale completion after recovery; expired with/without receipt; uncertain job; max-attempt dead letter |
| Affected risks | R-104; R-032 |
| Correcting commit | `a38be9ffb4b6574d8612e522acde584fae038686` (+ follow-up test/CI docs commits) |
| Exact test evidence | focused gates green locally — see CORRECTION_IMPLEMENTATION_REPORT; pending exact-head CI |
| Independent-review disposition | PENDING INDEPENDENT VERIFICATION |
| Status | IMPLEMENTATION PENDING INDEPENDENT VERIFICATION |

---

## P2 — significant

### F-PR4-05 · P2 · Job state transitions are TOCTOU-prone

| Field | Value |
|---|---|
| Severity | P2 |
| Object | `app/sync/lifecycle.server.ts`; `app/sync/dispatcher.server.ts` |
| Independent evidence | `findFirst`/`findUnique` without `FOR UPDATE`; concurrent callers can both pass `assertTransition` |
| Required correction | `SELECT … FOR UPDATE` or CAS `UPDATE … WHERE id AND state RETURNING`; DB trigger rejecting illegal DurableJob transitions for every writer including raw SQL; drift-verified transition definition matching application graph |
| Acceptance test | success vs uninstall; retry vs dead letter; two completions; two attempt claims; lease recovery vs ack; replay vs DL resolution; stale completion after cancel — exactly one legal outcome |
| Affected risks | R-107 |
| Correcting commit | `a38be9ffb4b6574d8612e522acde584fae038686` (+ follow-up test/CI docs commits) |
| Exact test evidence | focused gates green locally — see CORRECTION_IMPLEMENTATION_REPORT; pending exact-head CI |
| Independent-review disposition | PENDING INDEPENDENT VERIFICATION |
| Status | IMPLEMENTATION PENDING INDEPENDENT VERIFICATION |

### F-PR4-06 · P2 · Control-plane role isolation is not drift-verified

| Field | Value |
|---|---|
| Severity | P2 |
| Object | `scripts/sync-control-plane/roles.ts`; ten platform control-plane tables |
| Independent evidence | No RLS on control-plane tables; planted runtime DML / merchant SELECT / sequence / default-privilege drift undetected |
| Required correction | ENABLE+FORCE RLS on all control-plane tables; no policy for `stocky_runtime`; explicit global policy only for `stocky_control_plane`; exact drift verification matrix (read-only); narrow Shop lifecycle access; no BYPASSRLS / CREATEROLE / CREATEDB / merchant DML / session access |
| Acceptance test | `test:sync-role-isolation` — one negative fixture per prohibited privilege/policy condition |
| Affected risks | R-102 |
| Correcting commit | `a38be9ffb4b6574d8612e522acde584fae038686` (+ follow-up test/CI docs commits) |
| Exact test evidence | focused gates green locally — see CORRECTION_IMPLEMENTATION_REPORT; pending exact-head CI |
| Independent-review disposition | PENDING INDEPENDENT VERIFICATION |
| Status | IMPLEMENTATION PENDING INDEPENDENT VERIFICATION |

### F-PR4-07 · P2 · Control-plane inventory cannot detect unauthorized surfaces

| Field | Value |
|---|---|
| Severity | P2 |
| Object | `scripts/sync-control-plane/inventory.ts`; `manifest.ts` |
| Independent evidence | Hand-maintained list; planted shadow DML / aliased client / direct Queue / unlisted producer passed inventory check |
| Required correction | TypeScript compiler-API (or equivalent) semantic scanner; exact-file exceptions with stable ID; CI fails for planted shadow/alias/Queue/producer/worker/re-export/computed name/replay/raw-SQL cases; docs claim only what scanner proves |
| Acceptance test | `test:sync-inventory-audit` — all planted negative fixtures fail CI check |
| Affected risks | R-110 (new) |
| Correcting commit | `a38be9ffb4b6574d8612e522acde584fae038686` (+ follow-up test/CI docs commits) |
| Exact test evidence | focused gates green locally — see CORRECTION_IMPLEMENTATION_REPORT; pending exact-head CI |
| Independent-review disposition | PENDING INDEPENDENT VERIFICATION |
| Status | IMPLEMENTATION PENDING INDEPENDENT VERIFICATION |

### F-PR4-08 · P2 · Divergent payload for a known webhook ID is silently discarded

| Field | Value |
|---|---|
| Severity | P2 |
| Object | `app/sync/intake.server.ts` duplicate branch |
| Independent evidence | Same webhook ID + different digest increments duplicateCount only; no mismatch record; original projection retained silently |
| Required correction | Preserve original projection/digest; increment mismatch count; record conflicting digest + first/last mismatch timestamps; bounded DataIssue; conflict/quarantine state; no second logical job; no automatic apply of divergent payload; cancel/quarantine unapplied first job per fail-closed rule |
| Acceptance test | Concurrent and post-completion same-ID divergent-payload intake |
| Affected risks | R-106; R-032 |
| Correcting commit | `a38be9ffb4b6574d8612e522acde584fae038686` (+ follow-up test/CI docs commits) |
| Exact test evidence | focused gates green locally — see CORRECTION_IMPLEMENTATION_REPORT; pending exact-head CI |
| Independent-review disposition | PENDING INDEPENDENT VERIFICATION |
| Status | IMPLEMENTATION PENDING INDEPENDENT VERIFICATION |

### F-PR4-11 · P2 · Dispatch claim query cannot use its index at scale

| Field | Value |
|---|---|
| Severity | P2 |
| Object | `app/sync/dispatcher.server.ts` claim SQL |
| Independent evidence | At 50,200 jobs: Seq Scan + external merge disk sort; single-state query uses index ~290× faster |
| Required correction | Partial indexes for eligible states; index-supported claim plan with `FOR UPDATE SKIP LOCKED`; avoid full sequential scan and external sort at ≥50k jobs |
| Acceptance test | `test:sync-performance` — `EXPLAIN (ANALYZE, BUFFERS)` at 50k+ jobs; plan-shape assertions |
| Affected risks | R-111 (new) |
| Correcting commit | `a38be9ffb4b6574d8612e522acde584fae038686` (+ follow-up test/CI docs commits) |
| Exact test evidence | focused gates green locally — see CORRECTION_IMPLEMENTATION_REPORT; pending exact-head CI |
| Independent-review disposition | PENDING INDEPENDENT VERIFICATION |
| Status | IMPLEMENTATION PENDING INDEPENDENT VERIFICATION |

### F-PR4-12 · P2 · No size/depth/node limits on persisted projections

| Field | Value |
|---|---|
| Severity | P2 |
| Object | `app/sync/sanitize.server.ts` |
| Independent evidence | Unbounded line_items; untyped pass-through of nested objects under scalar ID fields |
| Required correction | Configurable validated bounds (UTF-8 bytes, depth, nodes, array elements, line items, string length, object keys); fail closed on overflow with bounded issue/quarantine and no processing job; validate scalar field types; preserve exact money strings |
| Acceptance test | Oversized, deeply nested, scalar-object, unusual Unicode, high-line-count fixtures |
| Affected risks | R-113 (new); R-103 |
| Correcting commit | `a38be9ffb4b6574d8612e522acde584fae038686` (+ follow-up test/CI docs commits) |
| Exact test evidence | focused gates green locally — see CORRECTION_IMPLEMENTATION_REPORT; pending exact-head CI |
| Independent-review disposition | PENDING INDEPENDENT VERIFICATION |
| Status | IMPLEMENTATION PENDING INDEPENDENT VERIFICATION |

### F-PR4-13 · P2 · No per-shop fairness in dispatch

| Field | Value |
|---|---|
| Severity | P2 |
| Object | `app/sync/dispatcher.server.ts` claim ordering |
| Independent evidence | Global `ORDER BY nextEligibleAt, createdAt LIMIT` lets one shop consume every batch slot |
| Required correction | Per-shop fairness (one-per-shop round / bounded max per shop / fair cursor / equivalent starvation-resistant algorithm) |
| Acceptance test | `test:sync-performance` — multi-shop with dominant backlog; each active shop makes progress; concurrent dispatchers; measured p50/p95 on disposable env (no invented production SLA) |
| Affected risks | R-111 (new) |
| Correcting commit | `a38be9ffb4b6574d8612e522acde584fae038686` (+ follow-up test/CI docs commits) |
| Exact test evidence | focused gates green locally — see CORRECTION_IMPLEMENTATION_REPORT; pending exact-head CI |
| Independent-review disposition | PENDING INDEPENDENT VERIFICATION |
| Status | IMPLEMENTATION PENDING INDEPENDENT VERIFICATION |

### F-PR4-18 · P2 · Strict API-version rejection can drop webhooks during transition

| Field | Value |
|---|---|
| Severity | P2 |
| Object | `app/sync/api-version.server.ts`; intake |
| Independent evidence | Non-`2026-07` throws before durable record; events lost after Shopify retry exhaustion |
| Required correction | Explicit adapters for `2025-10` and `2026-07`; authenticated unsupported version → durable quarantine/delivery + DataIssue + no processing job; document HTTP ack/redelivery policy; Q-003 remains open until live-schema validation |
| Acceptance test | Intake with `2025-10` and unsupported version asserting durable record and no job |
| Affected risks | R-033; R-105 |
| Correcting commit | `a38be9ffb4b6574d8612e522acde584fae038686` (+ follow-up test/CI docs commits) |
| Exact test evidence | focused gates green locally — see CORRECTION_IMPLEMENTATION_REPORT; pending exact-head CI |
| Independent-review disposition | PENDING INDEPENDENT VERIFICATION |
| Status | IMPLEMENTATION PENDING INDEPENDENT VERIFICATION |

### F-PR4-19 · P2 · REDIS_URL default is literal `"[REDACTED]"`

| Field | Value |
|---|---|
| Severity | P2 |
| Object | `app/jobs/queue.server.ts`; `app/tenant/__tests__/queue-redis.test.ts` |
| Independent evidence | Committed source uses `?? "[REDACTED]"`; connects to placeholder hostname |
| Required correction | Require explicit `REDIS_URL`; lazy fail with stable descriptive configuration error; search PR for other redaction-corrupted source strings; tests/CI set explicit test Redis URL |
| Acceptance test | Queue module fails closed when `REDIS_URL` unset |
| Affected risks | R-114 (new) |
| Correcting commit | `a38be9ffb4b6574d8612e522acde584fae038686` (+ follow-up test/CI docs commits) |
| Exact test evidence | focused gates green locally — see CORRECTION_IMPLEMENTATION_REPORT; pending exact-head CI |
| Independent-review disposition | PENDING INDEPENDENT VERIFICATION |
| Status | IMPLEMENTATION PENDING INDEPENDENT VERIFICATION |

### F-PR4-20 · P2 · Missing webhook ID produces time-based key that defeats idempotency

| Field | Value |
|---|---|
| Severity | P2 |
| Object | `app/routes/webhooks.*.tsx` |
| Independent evidence | `missing-${Date.now()}` creates distinct keys per redelivery |
| Required correction | Quarantine with internal receipt UUID; `shopifyWebhookId = null`; reason `missing_shopify_webhook_id`; DataIssue; no processing job; no business application; partial unique for non-null Shopify webhook IDs; concurrent missing-ID receipts may be separate quarantine rows but never merchant effects |
| Acceptance test | Concurrent missing-ID deliveries; no merchant effects |
| Affected risks | R-106; R-109 |
| Correcting commit | `a38be9ffb4b6574d8612e522acde584fae038686` (+ follow-up test/CI docs commits) |
| Exact test evidence | focused gates green locally — see CORRECTION_IMPLEMENTATION_REPORT; pending exact-head CI |
| Independent-review disposition | PENDING INDEPENDENT VERIFICATION |
| Status | IMPLEMENTATION PENDING INDEPENDENT VERIFICATION |

---

## P3 — quality / evidence

### F-PR4-09 · P3 · Implementation report and PR body record incorrect/stale identity

| Field | Value |
|---|---|
| Severity | P3 |
| Object | Implementation report; PR #20 body |
| Independent evidence | Wrong/stale head SHA; documentation tip behind tip commit; incomplete commit list |
| Required correction | Separate identities for implementation head, documentation tip, and review-report head; no self-referential “current SHA” claim that becomes false when committed; update PR body and report |
| Acceptance test | Documentation identities match live Git classifications |
| Affected risks | R-112 (new) |
| Correcting commit | `a38be9ffb4b6574d8612e522acde584fae038686` (+ follow-up test/CI docs commits) |
| Exact test evidence | focused gates green locally — see CORRECTION_IMPLEMENTATION_REPORT; pending exact-head CI |
| Independent-review disposition | PENDING INDEPENDENT VERIFICATION |
| Status | IMPLEMENTATION PENDING INDEPENDENT VERIFICATION |

### F-PR4-10 · P3 · PROJECT_STATUS.md does not name PR #20

| Field | Value |
|---|---|
| Severity | P3 |
| Object | `docs/PROJECT_STATUS.md` |
| Independent evidence | “Active implementation PR: pending draft open” while PR #20 is open |
| Required correction | Set `Active implementation PR: #20 — OPEN, DRAFT, UNMERGED` |
| Acceptance test | Status file names PR #20 |
| Affected risks | R-112 (new) |
| Correcting commit | `a38be9ffb4b6574d8612e522acde584fae038686` (+ follow-up test/CI docs commits) |
| Exact test evidence | focused gates green locally — see CORRECTION_IMPLEMENTATION_REPORT; pending exact-head CI |
| Independent-review disposition | PENDING INDEPENDENT VERIFICATION |
| Status | IMPLEMENTATION PENDING INDEPENDENT VERIFICATION |

### F-PR4-14 · P3 · `assertTransition("FAILED", "DEAD_LETTERED")` is a no-op

| Field | Value |
|---|---|
| Severity | P3 |
| Object | `app/sync/lifecycle.server.ts:314` |
| Independent evidence | Literal-to-literal always passes |
| Required correction | Real state assertion or rely on database-enforced transition validation |
| Acceptance test | Covered by transition / dead-letter suite |
| Affected risks | R-107 |
| Correcting commit | `a38be9ffb4b6574d8612e522acde584fae038686` (+ follow-up test/CI docs commits) |
| Exact test evidence | focused gates green locally — see CORRECTION_IMPLEMENTATION_REPORT; pending exact-head CI |
| Independent-review disposition | PENDING INDEPENDENT VERIFICATION |
| Status | IMPLEMENTATION PENDING INDEPENDENT VERIFICATION |

### F-PR4-15 · P3 · Replay does not assert original job is DEAD_LETTERED

| Field | Value |
|---|---|
| Severity | P3 |
| Object | `app/sync/replay.server.ts` |
| Independent evidence | Only DeadLetter OPEN checked |
| Required correction | Require `original.state = DEAD_LETTERED` and `DeadLetter.state = OPEN`; lock both records transactionally |
| Acceptance test | Replay denied when original not DEAD_LETTERED |
| Affected risks | R-100; R-108 |
| Correcting commit | `a38be9ffb4b6574d8612e522acde584fae038686` (+ follow-up test/CI docs commits) |
| Exact test evidence | focused gates green locally — see CORRECTION_IMPLEMENTATION_REPORT; pending exact-head CI |
| Independent-review disposition | PENDING INDEPENDENT VERIFICATION |
| Status | IMPLEMENTATION PENDING INDEPENDENT VERIFICATION |

### F-PR4-16 · P3 · Worker does not assert durable.shopId === envelope.shopId

| Field | Value |
|---|---|
| Severity | P3 |
| Object | `app/jobs/workers/webhook-processor.ts` |
| Independent evidence | No explicit equality before merchant access |
| Required correction | Assert shopId, payloadDigest, durableJobId, and dispatch identity match envelope and BullMQ job ID before merchant access |
| Acceptance test | Mismatch fails closed before merchant writes |
| Affected risks | R-039; R-100 |
| Correcting commit | `a38be9ffb4b6574d8612e522acde584fae038686` (+ follow-up test/CI docs commits) |
| Exact test evidence | focused gates green locally — see CORRECTION_IMPLEMENTATION_REPORT; pending exact-head CI |
| Independent-review disposition | PENDING INDEPENDENT VERIFICATION |
| Status | IMPLEMENTATION PENDING INDEPENDENT VERIFICATION |

### F-PR4-17 · P3 · Long-running-transaction uninstall visibility is undocumented

| Field | Value |
|---|---|
| Severity | P3 |
| Object | Architecture documentation |
| Independent evidence | Statement-level READ COMMITTED boundary undocumented |
| Required correction | Document precisely: completed statements before uninstall commit cannot be undone; subsequent statements see disabled Shop; atomic merchant application txs roll back when later statement denied; long-running txs / external side effects outside guarantee unless explicitly prevented |
| Acceptance test | Documentation review |
| Affected risks | R-101 |
| Correcting commit | `a38be9ffb4b6574d8612e522acde584fae038686` (+ follow-up test/CI docs commits) |
| Exact test evidence | focused gates green locally — see CORRECTION_IMPLEMENTATION_REPORT; pending exact-head CI |
| Independent-review disposition | PENDING INDEPENDENT VERIFICATION |
| Status | IMPLEMENTATION PENDING INDEPENDENT VERIFICATION |

---

## Permanent risk mapping (do not use report’s shifted labels)

| Risk | Permanent meaning | Related findings |
|---|---|---|
| R-031 | Queued jobs continuing after uninstall | F-PR4-02, F-PR4-03 |
| R-032 | Webhook replay/reconciliation failure | F-PR4-01, F-PR4-04, F-PR4-08 |
| R-033 | Shopify API-version retirement/invalid operations | F-PR4-18 |
| R-039 | Unvalidated job/queue envelope authority | F-PR4-16 |
| R-099 | DB/Redis dispatch gap or duplicate enqueue | F-PR4-02 |
| R-100 | Replay authority or lineage forgery | F-PR4-15, F-PR4-16 |
| R-101 | Uninstall race | F-PR4-03, F-PR4-17 |
| R-102 | Control-plane role access to merchant data | F-PR4-06 |
| R-103 | Unnecessary PII in persisted projection | F-PR4-12 |
| R-104 | Stuck leases/concurrent attempts | F-PR4-01, F-PR4-04 |
| R-105 | API-version fixture/schema drift | F-PR4-18 |
| R-106 | False rejection of legitimate distinct events | F-PR4-08, F-PR4-20 |
| R-107 | Job state-machine corruption | F-PR4-05, F-PR4-14 |
| R-108 | Dead-letter/replay evidence loss or mutation | F-PR4-15 |
| R-109 | Duplicate merchant-domain effects after retry/replay | F-PR4-01, F-PR4-20 |
| R-110 | Control-plane inventory scanner blind spots | F-PR4-07 |
| R-111 | Dispatch plan and per-shop starvation | F-PR4-11, F-PR4-13 |
| R-112 | Independent-review finding-count and risk-mapping inconsistency | F-PR4-09, F-PR4-10; D-043 |
| R-113 | Unbounded persisted webhook projection | F-PR4-12 |
| R-114 | Source/configuration corruption by redaction tooling | F-PR4-19 |

Do **not** alter R-095…R-098. Do **not** mark a risk closed on Cursor evidence.

---

## Safety boundaries (unchanged)

- PR #20 remains OPEN, DRAFT, UNMERGED
- PR 5 remains BLOCKED
- No production deployment / migration / role change / queue execution
- No webhook replay against real shops
- No merchant-data access / ownership repair
- No inventory writes; all inventory-write flags remain DEFAULT OFF
- Independent review report file remains unchanged
- No amend / rebase / squash / force-push of review commits

## Final next action after Cursor implementation

```text
Return to ChatGPT for exact-head verification and the independent Claude Code PR 4 correction-review prompt.
```
