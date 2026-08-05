# Phase 1 PR 4 — Synchronization Control Plane Second Correction Backlog

**Authority:** ChatGPT (product / architecture)  
**Implementation owner:** Cursor  
**Independent second-correction reviewer:** Claude Code  
**Technical acceptance authority:** ChatGPT  
**Merge authority:** User only after ChatGPT acceptance  

```text
PHASE 1 PR 4 SECOND CORRECTIONS REQUIRED.
NEW-PR4-C01 AND NEW-PR4-C02 ARE BLOCKING P1 DEFECTS.
NEW-PR4-C03 THROUGH NEW-PR4-C08 ARE INCLUDED IN THE SECOND-CORRECTION SCOPE.
THE ORIGINAL REVIEW AND FIRST CORRECTION-REVIEW REPORTS MUST REMAIN UNCHANGED.
PR 5 REMAINS BLOCKED.
PRODUCTION EXECUTION AND INVENTORY WRITES REMAIN UNAUTHORIZED.
```

**Source first correction-review:** `PR4_SYNC_CONTROL_PLANE_CORRECTION_REVIEW_REPORT.md` (preserved verbatim — **do not edit**)  
**Original independent review:** `PR4_SYNC_CONTROL_PLANE_REVIEW_REPORT.md` (preserved verbatim — **do not edit**)  
**Decision:** D-044 — Phase 1 PR 4 second corrections required  

## Finding-count reconciliation

| Source | P0 | P1 | P2 | P3 | Total |
|---|---:|---:|---:|---:|---:|
| First correction-review new findings (§14) | 0 | 2 | 2 | 4 | 8 |
| **Second-correction scope (D-044)** | **0** | **2** | **2** | **4** | **8** |

NEW-PR4-C01 and NEW-PR4-C02 are **blocking**. NEW-PR4-C03 through NEW-PR4-C08 are included in this cycle.

**Status legend:** every finding below uses

```text
IMPLEMENTED — PENDING INDEPENDENT VERIFICATION
```

or, for Cursor’s overall work status:

```text
SECOND CORRECTIONS IMPLEMENTED — PENDING INDEPENDENT VERIFICATION
```

Do **not** mark any finding or risk closed on Cursor evidence alone. PR #20 remains **OPEN, DRAFT, UNMERGED**. PR 5 remains blocked. Production execution and inventory writes remain unauthorized. All inventory-write flags remain default OFF.

---

## Identity chain of custody

| Commit | Role |
|---|---|
| `e69bc53d91db75472b0d0998bf1b74ee6246adb1` | Unchanged `origin/main` / authorized base |
| `7c36bc1bf2a1d6ccbd0e9d7131ae2d692fefea7a` | Original independently reviewed implementation head |
| `0697a2878eed3ce8013f59af54de7d0adf98d548` | First correction runtime/test head |
| `4c15028f72be20e4138bdbf85bc5e1d3894b53c6` | First correction-review tip; D-044 starting head |
| `1f5b74bca35e580278b9980cb18aa81f0e9c6568` | Original second-correction tip; mechanical-completion starting head |
| `0158a09eb3b0f1b62c9459e2db4df344183a6f59` | NEW-PR4-C01 mechanical-completion runtime/test head |
| *(docs tip)* | Final PR tip after documentation sync — pending independent verification |

Do not amend, rebase, squash, reset away, replace, or force-push the independent review commits. Do not edit:

- `PR4_SYNC_CONTROL_PLANE_REVIEW_REPORT.md`
- `PR4_SYNC_CONTROL_PLANE_CORRECTION_REVIEW_REPORT.md`

---

## P1 — blocking

### NEW-PR4-C01 · P1 · Dispatcher acks `ENQUEUED` for a non-runnable retained queue job

| Field | Value |
|---|---|
| Severity | P1 |
| Object | `app/sync/dispatcher.server.ts`; `app/sync/queue-presence.server.ts`; migrations `20260805120000_sync_control_plane_second_correction`, `20260805140000_sync_control_plane_enqueued_failed` |
| Independent evidence | ADV-1 — `durableJobState='ENQUEUED'`, `runnableInRedis=0`, `failedInRedis=1`; mere `getJob()` object presence treated as success |
| Required correction | Runnable-state allowlist (`waiting` / `delayed` / `active` / `prioritized` / `waiting-children` / `paused`); never ack `DISPATCH_LEASED → ENQUEUED` unless runnable presence is demonstrated; terminal retained jobs must be superseded with a new dispatch sequence; **unknown BullMQ states fail closed** (no supersede, no new sequence, no ack, no Redis delete); **queue unavailability is indeterminate** (not proof of absence); stranded `ENQUEUED` (no unfinished attempt, confirmed missing or terminal Redis dispatch) must **retry or dead-letter according to execution strategy and attempt limits** (`ENQUEUED → RETRY_WAIT` when retryable below limits; `ENQUEUED → FAILED → DEAD_LETTERED` for `NO_AUTOMATIC_RETRY` / max attempts, with `finalAttemptId` nullable); atomic `ackEnqueued`; additive transition-guard including `ENQUEUED → FAILED` + stranded index migration |
| Acceptance tests | `test:sync-dispatch-recovery` — retained failed/completed queue job does not ack ENQUEUED; terminal supersede + new sequence enqueues runnable job; ack-loss with live runnable reuses dispatch; stranded ENQUEUED recovery by strategy/limits; unknown queue state fails closed (no new sequence / no FAILED/SUPERSEDED / no ack); queue outage does not duplicate dispatch; non-retryable and max-attempt stranded jobs dead-letter; dual-dispatcher / identity mismatch fail closed; DB/app transition graphs agree |
| Affected risks | R-099; R-031; R-032 |
| Status | IMPLEMENTED — PENDING INDEPENDENT VERIFICATION |

### NEW-PR4-C02 · P1 · Reaper throws on `NULL` `webhookDeliveryId`, stranding the job and aborting the batch

| Field | Value |
|---|---|
| Severity | P1 |
| Object | `app/sync/lifecycle.server.ts` (`recoverExpiredRunningAttempts`); `app/sync/execution-strategy.server.ts` |
| Independent evidence | ADV-5 — `threw: webhook_application_key_requires_delivery`, `jobState: 'RUNNING'`, `attemptFinishedAt: null`; batch abort strands all shops |
| Required correction | Per-attempt try/catch isolation; unresolvable application identity dead-letters with `application_outcome_uncertain` (never throws out of the reaper loop); return `isolatedFailures` count; poison Shop A must not block Shop B recovery |
| Acceptance tests | `test:sync-attempt-recovery` — NULL / missing webhook delivery dead-letters with `application_outcome_uncertain`; batch continues; `isolatedFailures` increments; concurrent shops recover independently |
| Affected risks | R-104; R-032 |
| Status | IMPLEMENTED — PENDING INDEPENDENT VERIFICATION |

---

## P2 — mandatory this cycle

### NEW-PR4-C03 · P2 · P1 acceptance-test evidence materially short of the declared criteria

| Field | Value |
|---|---|
| Severity | P2 |
| Object | `app/sync/__tests__/sync-exactly-once.test.ts`; `app/sync/__tests__/sync-attempt-recovery.test.ts` |
| Independent evidence | First correction shipped ~4 exactly-once and ~3 attempt-recovery tests vs backlog ~14 / ~9 named scenarios |
| Required correction | Expand CI-gated suites so each F-PR4-01 / F-PR4-04 acceptance row maps to at least one committed test (~19 exactly-once; ~16 attempt-recovery) |
| Acceptance tests | Crash after first write; crash before receipt; crash after receipt before commit; crash after tenant commit before CP success; duplicate delivery; concurrent workers; cancel / refund / inventory-BOM-low-stock exact once; catalog/ABC rebuildable; unknown job NO_AUTOMATIC_RETRY; concurrent reapers; stale completion; expired with/without receipt; uncertain + max-attempt dead-letter; heartbeat renewal; cross-shop poison isolation |
| Affected risks | R-109; R-104; R-032; R-112 |
| Status | IMPLEMENTED — PENDING INDEPENDENT VERIFICATION |

### NEW-PR4-C04 · P2 · Exactly-once is conditional on envelope version

| Field | Value |
|---|---|
| Severity | P2 |
| Object | `app/jobs/workers/webhook-processor.ts`; `app/sync/__tests__/sync-envelope-fail-closed.test.ts` |
| Independent evidence | v1 path called legacy handler with no receipt; v2 skipped receipt when `webhookDeliveryId` null |
| Required correction | Fail closed on `tenant-job-envelope-v1` (no merchant writes); v2 / v3 durable webhook paths require application receipt; missing delivery identity fails closed before merchant writes |
| Acceptance tests | Envelope suite — v1 cannot apply merchant writes twice; v2 without delivery fails closed; v3 mismatch fails closed before merchant access |
| Affected risks | R-109; R-039 |
| Status | IMPLEMENTED — PENDING INDEPENDENT VERIFICATION |

---

## P3 — included this cycle

### NEW-PR4-C05 · P3 · Evidence hygiene — stale "implement corrections" next action

| Field | Value |
|---|---|
| Severity | P3 |
| Object | `docs/PROJECT_STATUS.md`; `docs/phases/phase-1/README.md`; this backlog / implementation report; `docs/DECISIONS.md` (D-044) |
| Independent evidence | PROJECT_STATUS still said “Implement all 20 findings” after first corrections were implemented |
| Required correction | Align status documents to D-044 second-correction required / implemented-pending-verification language; remove stale “implement all 20” next action |
| Acceptance tests | Documentation identity review — PROJECT_STATUS and phase README agree; no acceptance/merge language |
| Affected risks | R-112 |
| Status | IMPLEMENTED — PENDING INDEPENDENT VERIFICATION |

### NEW-PR4-C06 · P3 · Unreachable `completeAttemptFail` branch would strand a `RUNNING` job

| Field | Value |
|---|---|
| Severity | P3 |
| Object | `app/sync/lifecycle.server.ts` (`completeAttemptFail`) |
| Independent evidence | `deadLetter !== true` path finished attempt then asserted illegal `RUNNING → DEAD_LETTERED`; unreachable today only by caller discipline |
| Required correction | `completeAttemptFail` always dead-letters in one transaction; remove caller-controlled `deadLetter?` bypass |
| Acceptance tests | Direct `completeAttemptFail` without `deadLetter` prop → dead-lettered; no stranded RUNNING + finished attempt |
| Affected risks | R-107; R-104 |
| Status | IMPLEMENTED — PENDING INDEPENDENT VERIFICATION |

### NEW-PR4-C07 · P3 · Migration fixture hygiene

| Field | Value |
|---|---|
| Severity | P3 |
| Object | `scripts/tenant-backfill/tests/tenant-expansion.migration.test.ts` |
| Independent evidence | Role created and never dropped → role-absent branch unreachable; second-deploy string assert `/0/` near-vacuous |
| Required correction | Dedicated role-present and role-absent fixtures with restore/`afterAll` cleanup; tighten second-deploy assert to `/no pending migrations/` (keep `_prisma_migrations` count asserts) |
| Acceptance tests | Role-present creates eleven control-plane policies; role-absent creates zero; second deploy reports no pending migrations; role restored after suite |
| Affected risks | R-112 |
| Status | IMPLEMENTED — PENDING INDEPENDENT VERIFICATION |

### NEW-PR4-C08 · P3 · `SECURITY DEFINER` probe ownership

| Field | Value |
|---|---|
| Severity | P3 |
| Object | Migration `20260805120000_…`; `scripts/sync-control-plane/roles.ts` (`stocky_receipt_probe_owner`); `scripts/sync-control-plane/tests/sync-role-isolation.test.ts` |
| Independent evidence | `stocky_has_application_receipt` SECURITY DEFINER owned by superuser migration role in CI |
| Required correction | REVOKE EXECUTE from PUBLIC / control-plane until provision; provision least-privilege `stocky_receipt_probe_owner` (non-superuser, non-BYPASSRLS); transfer ownership; role-isolation asserts |
| Acceptance tests | `test:sync-role-isolation` — probe owner attributes; runtime denied EXECUTE; control-plane EXECUTE only after provision |
| Affected risks | R-102 |
| Status | IMPLEMENTED — PENDING INDEPENDENT VERIFICATION |

---

## Residual notes (not closed)

### F-PR4-01 residual — concurrent receipt race / `25P02`

First correction-review closed F-PR4-01 **with residual**: inside a tenant transaction, a unique-violation race on `SyncApplicationReceipt` aborted with PostgreSQL `25P02` instead of a clean already-applied classification. Outcome remained safe (rollback + retry convergence), but classification was opaque.

Second-correction work addresses the residual with `INSERT … ON CONFLICT DO NOTHING RETURNING` in `application-receipt.server.ts` so the loser can classify without aborting the transaction erroneously. **Independent verification still required.** Do **not** close R-109 on Cursor evidence.

### F-PR4-18 / Q-003 — remain open

F-PR4-18 (API-version transition / live `2026-07` schema validation) and **Q-003** remain **OPEN**. This second-correction cycle does not claim live Shopify schema closure. Exact-head webhook + GraphQL validation against `2026-07` is still required before Q-003 may close.

---

## Permanent risk mapping (do not close on Cursor evidence)

| Risk | Permanent meaning | Related second-correction items |
|---|---|---|
| R-039 | Unvalidated job/queue envelope authority | NEW-PR4-C04 |
| R-099 | DB/Redis dispatch gap or duplicate enqueue | NEW-PR4-C01 |
| R-102 | Control-plane role access to merchant data | NEW-PR4-C08 |
| R-104 | Stuck leases/concurrent attempts | NEW-PR4-C02; NEW-PR4-C06 |
| R-107 | Job state-machine corruption | NEW-PR4-C06 |
| R-109 | Duplicate merchant-domain effects after retry/replay | NEW-PR4-C03; NEW-PR4-C04; F-PR4-01 residual |
| R-112 | Independent-review finding-count / evidence hygiene | NEW-PR4-C05; NEW-PR4-C07 |

Do **not** alter R-095…R-098. Do **not** mark a risk closed on Cursor evidence.

---

## Safety boundaries (unchanged)

- PR #20 remains OPEN, DRAFT, UNMERGED
- PR 5 remains BLOCKED
- No production deployment / migration / role change / queue execution
- No webhook replay against real shops
- No merchant-data access / ownership repair
- No inventory writes; all inventory-write flags remain DEFAULT OFF
- Original review and first correction-review report files remain unchanged
- No amend / rebase / squash / force-push of review commits

## Final next action after Cursor implementation

```text
Return to ChatGPT for exact-head verification and a fresh independent Claude Code PR 4 second-correction review.
```
