# Phase 1 PR 4 — Synchronization Control Plane Correction Implementation Report

**Status:** `CORRECTIONS IMPLEMENTED — PENDING INDEPENDENT VERIFICATION`  
**Authority:** D-043  
**PR:** #20 — OPEN, DRAFT, UNMERGED  
**Branch:** `phase-1/sync-control-plane`  
**PR 5:** BLOCKED  
**Production / inventory writes:** UNAUTHORIZED; flags default OFF  

## Identity

| Identity | SHA |
|---|---|
| Unchanged `origin/main` / base | `e69bc53d91db75472b0d0998bf1b74ee6246adb1` |
| Independently reviewed implementation head | `7c36bc1bf2a1d6ccbd0e9d7131ae2d692fefea7a` |
| Correction starting head (preserved review report) | `944cd5922f12cccc73519e5cb4434985a296e923` |
| D-043 + backlog documentation | `01c8f9ae26e60dfa5a7fdffbd13179582a0176a9` |
| Correction runtime/schema/tests (primary) | `a38be9ffb4b6574d8612e522acde584fae038686` |
| Documentation tip / this report | filled after this documentation commit lands — see git tip on branch |

Do **not** treat any Cursor SHA as independent closure.

## Migration

| Field | Value |
|---|---|
| Name | `20260804210000_sync_control_plane_correction` |
| Prior migration (immutable) | `20260804180000_sync_control_plane` — not edited |
| Additive contents | `JobDispatch`; `SyncApplicationReceipt`; attempt lease/heartbeat columns; one-active-attempt partial unique; eligible partial indexes; DurableJob transition trigger; control-plane ENABLE+FORCE RLS + policies; nullable `shopifyWebhookId` + conflict fields; `stocky_has_application_receipt()`; execution strategy enum |
| Production execution | NOT RUN |

## Execution strategy matrix

| Job type | Strategy |
|---|---|
| `webhook:orders/create` | `ATOMIC_APPLICATION_RECEIPT` |
| `webhook:orders/cancelled` | `ATOMIC_APPLICATION_RECEIPT` |
| `webhook:refunds/create` | `ATOMIC_APPLICATION_RECEIPT` |
| `webhook:inventory_levels/update` | `ATOMIC_APPLICATION_RECEIPT` |
| `webhook:app/uninstalled` | `CONTROL_ONLY` |
| `catalog-sync` | `REBUILDABLE_IDEMPOTENT` |
| `abc-analysis-shop` | `REBUILDABLE_IDEMPOTENT` |
| `abc-analysis` | `CONTROL_ONLY` |
| Unknown | `NO_AUTOMATIC_RETRY` (fail closed) |

Application key: webhook jobs → `webhook-delivery:<WebhookDelivery.id>`; non-webhook → `logical:<idempotencyKey>`.

## Queue job ID encoding (F-PR4-02)

BullMQ forbids `:` in custom job IDs. Deterministic encoding:

```text
<durableJobId>__d<dispatchSequence>
```

Envelope version: `tenant-job-envelope-v3` (binds durable job ID, dispatch ID/sequence, queue job ID, payload digest, tenant, source, correlation, causation).

## Finding disposition (Cursor side only)

All twenty findings (F-PR4-01…20, reconciled 4/10/6) were addressed in correction commits.
Independent-review disposition for every finding remains:

```text
PENDING INDEPENDENT VERIFICATION
```

See `PR4_SYNC_CONTROL_PLANE_CORRECTION_BACKLOG.md` for per-finding evidence fields.

## Focused test evidence (disposable PostgreSQL 16 + Redis)

Observed on correction worktree after runtime commit `a38be9f` + follow-up test/CI fixes:

| Command | Result | Tests |
|---|---|---|
| `npm run test:sync-exactly-once` | pass | 4 |
| `npm run test:sync-dispatch-recovery` | pass | 3 |
| `npm run test:sync-uninstall` | pass | 8 |
| `npm run test:sync-attempt-recovery` | pass | 3 |
| `npm run test:sync-role-isolation` | pass | 6 |
| `npm run test:sync-inventory-audit` | pass | 5 |
| `npm run test:sync-performance` (`SYNC_PERF_JOB_COUNT=50000`) | pass | 1 |
| `npm run test:sync-integration` (aggregate) | pass | 68 |

Exact-head CI for the final documentation tip will be recorded when the live workflow run completes on the pushed tip.

## Open risks / questions

- R-031…R-039, R-099…R-114: OPEN pending independent correction review  
- R-095…R-098: unchanged (PR 3 residuals)  
- Q-003: OPEN until independent live-schema validation against `2026-07`

## Safety

- No production action  
- No merchant data  
- No inventory mutation  
- Inventory-write flags remain OFF  
- PR #20 remains draft  
- PR 5 remains blocked  
- Original independent review report unchanged  

## Next action

```text
Return to ChatGPT for exact-head verification and the independent Claude Code PR 4 correction-review prompt.
```
