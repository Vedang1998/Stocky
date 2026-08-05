# Phase 1 PR 4 — Synchronization Control Plane Second Correction Implementation Report

**Status:** `SECOND CORRECTIONS IMPLEMENTED — PENDING INDEPENDENT VERIFICATION`  
**Authority:** D-044  
**PR:** #20 — OPEN, DRAFT, UNMERGED  
**Branch:** `phase-1/sync-control-plane`  
**PR 5:** BLOCKED  
**Production / inventory writes:** UNAUTHORIZED; flags default OFF  

```text
PHASE 1 PR 4 SECOND CORRECTIONS REQUIRED.
NEW-PR4-C01 AND NEW-PR4-C02 ARE BLOCKING P1 DEFECTS.
NEW-PR4-C03 THROUGH NEW-PR4-C08 ARE INCLUDED IN THE SECOND-CORRECTION SCOPE.
THE ORIGINAL REVIEW AND FIRST CORRECTION-REVIEW REPORTS MUST REMAIN UNCHANGED.
PR 5 REMAINS BLOCKED.
PRODUCTION EXECUTION AND INVENTORY WRITES REMAIN UNAUTHORIZED.
```

This report records Cursor second-correction work only. It does **not** claim acceptance, readiness, merge authorization, or risk closure.

## Identity

| Identity | SHA |
|---|---|
| Unchanged `origin/main` / base | `e69bc53d91db75472b0d0998bf1b74ee6246adb1` |
| Original independently reviewed implementation head | `7c36bc1bf2a1d6ccbd0e9d7131ae2d692fefea7a` |
| First correction runtime/test head | `0697a2878eed3ce8013f59af54de7d0adf98d548` |
| First correction-review tip / D-044 starting head | `4c15028f72be20e4138bdbf85bc5e1d3894b53c6` |
| Original second-correction tip / mechanical-completion starting head | `1f5b74bca35e580278b9980cb18aa81f0e9c6568` |
| Mechanical-completion runtime/test head | `0158a09eb3b0f1b62c9459e2db4df344183a6f59` |
| Documentation / this report tip | `71bb576005501155a2965568db0d6b08b30ca48e` |
| Exact-head CI `head_sha` | pending at docs write — authoritative in PR #20 body after green |
| Exact-head CI run / job | pending — see PR #20 body |

Do **not** treat any Cursor SHA as independent closure. Live PR-head identity is authoritative only in the GitHub PR #20 body after exact-head CI.

Both independent review reports remain unchanged:

- `PR4_SYNC_CONTROL_PLANE_REVIEW_REPORT.md`
- `PR4_SYNC_CONTROL_PLANE_CORRECTION_REVIEW_REPORT.md`

## Migration

| Field | Value |
|---|---|
| Name (second correction) | `20260805120000_sync_control_plane_second_correction` |
| Name (mechanical completion) | `20260805140000_sync_control_plane_enqueued_failed` |
| Prior migrations (immutable) | `20260804180000_sync_control_plane`; `20260804210000_sync_control_plane_correction`; `20260805120000_…`; `20260805130000_…` — not edited |
| Additive contents | DurableJob transition guard including `ENQUEUED → RETRY_WAIT` and `ENQUEUED → FAILED`; stranded-ENQUEUED index; REVOKE on `stocky_has_application_receipt` until restricted owner provision |
| Production execution | NOT RUN |

## Finding disposition (Cursor side only)

Every NEW-PR4-C01…C08 finding: **IMPLEMENTED — PENDING INDEPENDENT VERIFICATION**

| ID | Sev | Exact correction | Primary files | Regression tests |
|---|:---:|---|---|---|
| NEW-PR4-C01 | P1 | Runnable allowlist; terminal supersede + new sequence; **UNKNOWN_STATE fail-closed** (`queue_state_unknown`); **QUEUE_UNAVAILABLE / UNKNOWN_STATE indeterminate** in stranded reaper; stranded recovery **retries or dead-letters by strategy/limits** (`ENQUEUED→RETRY_WAIT` or `ENQUEUED→FAILED→DEAD_LETTERED` with nullable `finalAttemptId`); atomic `ackEnqueued`; migrations `20260805120000` + `20260805140000` | `queue-presence.server.ts`, `dispatcher.server.ts`, `state-machine.server.ts`, migration SQL | `sync-dispatch-recovery` (27 tests incl. mechanical completion gates) |
| NEW-PR4-C02 | P1 | Per-attempt isolation in `recoverExpiredRunningAttempts`; unresolvable identity → `application_outcome_uncertain` dead-letter; `isolatedFailures` count; poison shop does not abort batch | `lifecycle.server.ts`, `execution-strategy.server.ts`, `errors.ts` | `sync-attempt-recovery` poison / null-delivery / cross-shop cases |
| NEW-PR4-C03 | P2 | Expanded exactly-once (~19 tests) and attempt-recovery (~16 tests) covering backlog acceptance rows | `sync-exactly-once.test.ts`, `sync-attempt-recovery.test.ts` | focused sync gates |
| NEW-PR4-C04 | P2 | webhook-processor fail-closed for v1; v2/v3 durable paths require receipt / fail closed without delivery identity | `webhook-processor.ts`, `sync-envelope-fail-closed.test.ts` | envelope fail-closed suite |
| NEW-PR4-C05 | P3 | Status docs this cycle: D-044 backlog/report, PROJECT_STATUS, phase README, DECISIONS, RISK_REGISTER disposition notes | docs listed in handoff | documentation review |
| NEW-PR4-C06 | P3 | `completeAttemptFail` always dead-letters in one transaction; `deadLetter?` removed | `lifecycle.server.ts` | attempt-recovery C06 unit path |
| NEW-PR4-C07 | P3 | Role-present / role-absent migration fixtures + restore/`afterAll`; tight second-deploy assert `/no pending migrations/` | `tenant-expansion.migration.test.ts` | migration expansion suite |
| NEW-PR4-C08 | P3 | `stocky_receipt_probe_owner` provision; REVOKE until provision; ownership transfer; role-isolation asserts | migration SQL, `scripts/sync-control-plane/roles.ts`, `sync-role-isolation.test.ts` | `test:sync-role-isolation` |

### NEW-PR4-C01 mechanical completion (post `1f5b74b`)

ChatGPT exact-head inspection found three incomplete behaviors despite earlier green CI. Cursor completed:

1. **UNKNOWN_STATE** no longer treated as terminal — no supersede / FAILED / new sequence / ack.
2. **QUEUE_UNAVAILABLE** / **UNKNOWN_STATE** are indeterminate in stranded recovery — no job/dispatch mutation.
3. **NO_AUTOMATIC_RETRY** / max-attempt stranded jobs dead-letter (`application_outcome_uncertain` / `max_attempts_exceeded`) instead of universal `RETRY_WAIT`.

### F-PR4-01 residual (25P02 receipt conflict)

`application-receipt.server.ts` now uses `INSERT … ON CONFLICT DO NOTHING RETURNING` so a concurrent loser classifies without relying on a unique-violation path that aborted the tenant transaction with `25P02`. Independent verification still required; **R-109 remains OPEN**.

## Focused test evidence (local / disposable — not acceptance)

| Suite | Observed tests |
|---|---:|
| `sync-dispatch-recovery` | **27** passed (0 skipped) |
| `sync-exactly-once` | ~19 |
| `sync-attempt-recovery` | ~16 |
| `sync-envelope-fail-closed` | expanded (v1/v2 fail-closed) |
| `sync-role-isolation` | includes NEW-PR4-C08 + ENQUEUED→FAILED graph assert |
| tenant-expansion migration | NEW-PR4-C07 role-present / role-absent |

Exact-head CI command results, exit codes, and `head_sha` are recorded in the PR #20 body after the pushed tip is green. Do not treat local green as acceptance.

## Open risks / questions

Keep **OPEN** (permanent `RISK_REGISTER.md` definitions). Do **not** close on Cursor evidence:

- **R-099** — D-044 second corrections pending independent verification (NEW-PR4-C01)
- **R-104** — D-044 second corrections pending independent verification (NEW-PR4-C02)
- **R-109** — D-044 second corrections pending independent verification (NEW-PR4-C03/C04 + F-PR4-01 residual)
- **R-039** — D-044 second corrections pending independent verification (NEW-PR4-C04 envelope fail-closed)
- **R-102** — D-044 second corrections pending independent verification (NEW-PR4-C08 probe owner)
- **R-107** — D-044 second corrections pending independent verification (NEW-PR4-C06)
- **R-112** — D-044 second corrections pending independent verification (NEW-PR4-C05/C07 evidence hygiene)
- **Q-003** — OPEN until independent live-schema validation against `2026-07` (F-PR4-18 residual)
- **R-095…R-098** — unchanged (PR 3 residuals; not modified)

## Safety

- No production action  
- No merchant data  
- No inventory mutation  
- Inventory-write flags remain OFF  
- PR #20 remains draft  
- PR 5 remains blocked  
- Original review report unchanged  
- First correction-review report unchanged  

## Next action

```text
Return to ChatGPT for exact-head verification and a fresh independent Claude Code PR 4 second-correction review.
```

## Exact-head CI (Cursor-recorded)

| Field | Value |
|---|---|
| Mechanical-completion starting head | `1f5b74bca35e580278b9980cb18aa81f0e9c6568` |
| Mechanical-completion runtime/test head | `0158a09eb3b0f1b62c9459e2db4df344183a6f59` |
| Final PR tip | `71bb576005501155a2965568db0d6b08b30ca48e` |
| First correction-review tip / D-044 start | `4c15028f72be20e4138bdbf85bc5e1d3894b53c6` |
| Base / main | `e69bc53d91db75472b0d0998bf1b74ee6246adb1` |
| Exact-head CI | pending at docs write — see PR body after green |

Status remains **SECOND CORRECTIONS IMPLEMENTED — PENDING INDEPENDENT VERIFICATION**.
Do not close findings or risks on Cursor evidence alone.
