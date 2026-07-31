# Phase 1 Correction Implementation Report — PR 1 Tenant Expansion

**Status:** CORRECTIONS IMPLEMENTED — AWAITING FRESH CLAUDE REVIEW
**Implementer:** Cursor

## Identity (immutable heads vs live tip)

Do not store a commit’s own SHA inside itself as a “final PR head.” Distinctions:

| Item | Value |
|---|---|
| Base main SHA | `8ccc8d29a78e05615b31324b38df17f4f1d1296e` |
| Branch | `phase-1/tenant-expand` |
| Pull request | [#11](https://github.com/Vedang1998/Stocky/pull/11) (draft, OPEN, unmerged) |
| Initial Claude-reviewed head | `7aabb095806716697bfea2783379351b15e1cda2` |
| Claude-reviewed-head CI | run `30578683952` / job `90993206934` / success |
| Claude verdict | `NOT READY` (preserved verbatim) |
| Primary correction implementation head | `3a6ae28d714ab95f54ae6b48dd8c8e5291f997a8` |
| Primary correction-head CI | run `30592780673` / job `91038478251` / success |
| Correction record-association head | `e8f91ae46e4b1a2dc09ea29c2f72dac3e25cc115` |
| Correction record-association CI | run `30593038504` / job `91039234708` / success |
| Pre-review residual gap prior tip (R1–R8) | `adf0b52103c517c904a7a33ee76cfaca29971860` |
| R9–R13 evidence-gap implementation commit(s) | Recorded in PR description after push (not self-referential here) |
| Current live PR tip + exact-head CI | Recorded in PR description and ChatGPT verification — **mutable** |

## Summary

Addressed Claude findings F-PR1-01…F-PR1-15 and ChatGPT residual gaps R1–R8 on draft PR #11 without merging, without starting PR 2/3, and without activating enforcement. Findings remain **open for fresh Claude verification** — implementation status is not independent closure.

### R9–R13 (ChatGPT evidence gaps before Claude)
- R9: Concurrent index overlap proved via builder PID + `pg_stat_progress_create_index` / locks before writes
- R10: Dataset boundaries with membership SHA-256; ownership checksums bounded; diagnostics bounded; diagnostic resume rehydrates
- R11: Full-engine races via `onBeforeShopIdUpdate` hook + separate sessions; exact `CONCURRENT_SHOP_ID_CONFLICT`
- R12: `tenant:indexes:apply` requires explicit `TENANT_MAINTENANCE_DATABASE_URL`
- R13: Drift uses `--from-schema-datasource` with `DATABASE_URL` in child env (not argv)

## Residual-gap corrections (R1–R8)

### R1 — Real Prisma schema drift
- `tenant:schema:drift` runs `prisma migrate diff --from-url <db> --to-schema-datamodel prisma/schema.prisma --exit-code`
- Exit 0 only when empty; exit non-zero on drift (Prisma exit 2) or tool error
- `tenant:indexes:verify` remains the exact compatibility-index manifest check (separate)

### R2 — Index safety tests
- Wrong-table same-name collision; wrong uniqueness/columns/definition; missing; valid_exact; invalid
- Genuine failed `CREATE UNIQUE INDEX CONCURRENTLY` leaving `indisvalid/indisready` false
- Concurrent INSERT/UPDATE/DELETE during CONCURRENTLY build with timing + lock evidence
- Rerun idempotency

### R3 — Bounded timeouts
- `TENANT_INDEX_STATEMENT_TIMEOUT_MS` (default 1_800_000 ms); rejects 0/invalid/over-max
- `TENANT_INDEX_LOCK_TIMEOUT_MS` (default 5_000 ms); remains finite
- Applied on the same pinned maintenance connection

### R4 — Apply-lock backend identity
- Unlock returns `pg_backend_pid()` + `pg_advisory_unlock(...)`
- Release requires PID match and unlock=true; client closed on every path
- Pooler URLs rejected; no Prisma pooled advisory fallback

### R5 — Affected-row concurrency
- Zero-row `UPDATE … WHERE shopId IS NULL` re-reads current `shopId` in-transaction
- Classifies `concurrently_resolved` / `unresolved`+issue / missing-row error / still-null error
- Never returns unresolved without durable issue draft

### R6 — Durable detection history
- Additive migration `20260730220000_tenant_ownership_issue_detection`
- Model `TenantOwnershipIssueDetection` with `@@unique([runId, fingerprint])`
- Persisted in same transaction as issue upsert + checkpoint
- `currentRunDetectedIssueCount` / `currentRunOpenIssueCount` derived from detection rows
- `blockingIssueCount` = current global OPEN issue count (documented)
- `firstDetectedRunId` / `lastDetectedRunId` retained as current-state pointers

### R7 / R8 — Wording honesty
- Non-self-referential head labels; backlog not marked closed without Claude acceptance
- F-016/R-022, Q-011, R-028/R-029, R-041–R-046 remain open; PR 2/3 not started

## Migrations

1. `20260730160000_tenant_expansion`
2. `20260730160100_tenant_compatibility_indexes` — no-op marker (D-024)
3. `20260730210000_tenant_backfill_correction`
4. `20260730220000_tenant_ownership_issue_detection` — durable detections (R6)

## Explicit statements

- No production or merchant data accessed
- No deployment occurred
- No RLS or runtime conversion added
- PR 2 and PR 3 remain unstarted
- Production inventory writes remain UNAPPROVED
- All inventory-write flags remain DEFAULT OFF
- Findings are **not** independently closed; await fresh Claude review of the live tip

## Next action

Return to ChatGPT for exact-head verification before fresh Claude correction review.
