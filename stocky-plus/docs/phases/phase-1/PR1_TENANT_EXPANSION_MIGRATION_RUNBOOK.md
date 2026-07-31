# PR 1 — Tenant Expansion Migration Runbook

**Phase:** 1
**Work unit:** PR 1 — Tenant expansion and backfill (post-correction)
**Audience:** Implementers and reviewers
**Production execution:** **PROHIBITED** without a later reviewed deployment plan and explicit authorization.

## Exact migrations

1. `20260730160000_tenant_expansion` — `Shop`, backfill control tables, nullable `shopId` columns
2. `20260730160100_tenant_compatibility_indexes` — **no-op marker** (indexes are NOT created here; see D-024)
3. `20260730210000_tenant_backfill_correction` — `COMPLETED_WITH_ISSUES`, issue reopen fields
4. `20260730220000_tenant_ownership_issue_detection` — durable per-run `TenantOwnershipIssueDetection` history

Do **not** modify `20260728000000_init_stocky_plus`.

A database is PR-1-ready only after:

1. `npx prisma migrate deploy`
2. `npm run tenant:indexes:apply -- --apply`
3. `npm run tenant:indexes:verify`
4. `npm run tenant:schema:drift` — **Prisma** `migrate diff --from-url … --to-schema-datamodel prisma/schema.prisma --exit-code` (independent of manifest verify)

## Index maintenance timeouts

| Variable | Default | Rules |
|---|---|---|
| `TENANT_INDEX_STATEMENT_TIMEOUT_MS` | `1800000` (30 min) | Positive bounded integer; `0` and invalid rejected |
| `TENANT_INDEX_LOCK_TIMEOUT_MS` | `5000` | Positive bounded integer; remains finite |

Timeout failure must leave data intact; recovery for invalid index remnants requires explicitly authorized `DROP INDEX CONCURRENTLY`. Production timeout values remain subject to a later deployment plan.

## Starting-snapshot timeout and evidence budget (F-F01 / F-F02 / F-F04)

The starting-evidence transaction is **REPEATABLE READ** and database-enforced **READ ONLY** (`SET TRANSACTION READ ONLY` as the first SQL statement). Observed `transaction_isolation`, `transaction_read_only`, and `pg_current_snapshot()` are persisted and fail-closed on mismatch.

| Variable | Default | Bounds | Rules |
|---|---|---|---|
| `TENANT_STARTING_SNAPSHOT_TIMEOUT_MS` | `180000` | `10000`–`1800000` | Strict integer; invalid fails before opening the transaction; value recorded in starting evidence; resume compatibility checked |
| `TENANT_EVIDENCE_MAX_NORMALIZED_DOMAINS` | `5000` | `1`–`100000` | Complete valid normalized-domain set ceiling; exceed → fail closed before mutation |
| `TENANT_EVIDENCE_MAX_SHOPS` | `10000` | `1`–`100000` | Supported Shop count for this Phase 1 maintenance operation |
| `TENANT_EVIDENCE_MAX_DISCOVERY_ISSUES` | `10000` | `10`–`100000` | Durable discovery-issue ceiling; overflow → evidence-capacity failure (cannot COMPLETED) |
| `TENANT_EVIDENCE_MAX_SAMPLES_PER_SOURCE` | `20` | `0`–`100` | Bounded redacted samples per source |
| `TENANT_EVIDENCE_MAX_SERIALIZED_BYTES` | `1000000` | `65536`–`16000000` | UTF-8 serialized `startingEvidence` ceiling; enforced before run-record persist |

Budget version: **`phase1-evidence-budget-v1`**. Do not raise defaults drastically to “fix” timeouts; diagnose via phase telemetry instead.

### Capture phase telemetry

On timeout/failure the tool emits a safe diagnostic with: phase name, elapsed ms, configured timeout, evidence version, table name where applicable. It never includes raw merchant domains, database URLs, or credentials.

Phases: `transaction_init`, `before_counts`, `shop_evidence`, `session_evidence`, `table_subject_evidence`, `domain_discovery`, `final_serialization`.

### Operating envelope (representative fixtures — not universal scalability)

Purpose: establish an operating envelope for disposable PostgreSQL 16. These are local/CI fixture observations, not a production capacity claim.

| Fixture | Approximate size | Observation |
|---|---|---|
| Empty / tiny merchant seed | ≤10 rows/table | Capture completes well under default timeout; serialized evidence ≪ 1 MiB |
| Constrained-memory subject digest | 25k rows, batch 250, Node heap cap 256 MiB | Streaming digest stays within heap; used by `npm run test:subject-memory` |
| High-cardinality corrupt domains | Distinct corrupt `shop` values approaching row count | Aggregation remains bounded; raw domains absent from `resumeMetadata` |
| Concurrent-index overlap | 100k–400k Supplier rows | Old-snapshot-wait (≥10 iters) + active build/validation scan DML proofs |

Record exact tip measurements in the correction implementation report / CI logs when re-run.

## Ownership issue metrics

| Field | Authority |
|---|---|
| `currentRunDetectedIssueCount` | Count of `TenantOwnershipIssueDetection` rows for the run |
| `currentRunOpenIssueCount` | Detections for the run with `wasOpenAfterDetection = true` |
| `globalOpenIssueCount` | Current global `TenantOwnershipIssue` rows with `status = OPEN` |
| `blockingIssueCount` | Explicitly equal to `globalOpenIssueCount` (current open blockers; not historical) |
| `firstDetectedRunId` / `lastDetectedRunId` | Current-state pointers on the issue row (not historical metrics) |

Historical status for run A must remain stable after run B redetects or resolves the same fingerprint.

## Normalization

Version: **`phase1-shop-domain-v1`** (correction, not a new version)

1. Trim whitespace
2. Reject non-ASCII on raw trimmed input **before** lowercasing (`non_ascii`)
3. Reject schemes, ports, paths, query, fragment, credentials, controls
4. Lowercase ASCII letters
5. Require exactly one store label + `.myshopify.com`
6. Store label length 1–63; hostname length ≤ 253
7. Letters, digits, internal hyphens only; no leading/trailing hyphen

Invalid values are quarantined. No Shopify network calls.

## Ownership source

See `PR1_TENANT_OWNERSHIP_INVENTORY.md`.

Direct owners: own legacy `shop` → proposed/persisted `shopId`.
Children: verified parent persisted `shopId`, else proposed parent ownership from the same run.
Never guess. Never overwrite conflicting non-null `shopId`. Never modify legacy `shop`.

## Dry-run procedure

Dry-run does not mutate merchant ownership rows, but it writes backfill run, checkpoint, and issue diagnostic records.

```bash
cd stocky-plus
export DATABASE_URL="postgresql://…/disposable_db"
npm run tenant:diagnose
# or
npm run tenant:backfill -- --dry-run --batch-size 500
```

Exit codes: `COMPLETED` → 0; `COMPLETED_WITH_ISSUES` → 2; `FAILED` → 1.

## Apply procedure (disposable / authorized environments only)

Requires a **direct** (non-pooler) URL:

```bash
export TENANT_MAINTENANCE_DATABASE_URL="postgresql://…/disposable_db"
npm run tenant:backfill -- --apply --batch-size 500
```

**Do not run apply against production or merchant data in this PR.**

## Compatibility indexes

```bash
export TENANT_MAINTENANCE_DATABASE_URL="postgresql://…/disposable_db"
npm run tenant:indexes:plan
npm run tenant:indexes:apply -- --apply
npm run tenant:indexes:verify
npm run tenant:schema:drift
```

- Mutating apply **requires** explicit `TENANT_MAINTENANCE_DATABASE_URL` (no `DATABASE_URL` fallback).
- Pooler/PgBouncer URL string patterns are rejected as a guardrail only; operators remain responsible for a genuinely direct endpoint in a later deployment plan.
- Schema drift: `prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --exit-code` with `DATABASE_URL` in the child environment (URL not placed on argv).

## Dataset boundaries (R10)

Each run persists `phase1-tenant-subject-v2` starting evidence under one **REPEATABLE READ + database-enforced READ ONLY** transaction: per-table `highWaterMark`, `rowCount`, ordered evidence columns, and streaming subject digests (not ID-only). Session has a separate evidence boundary used only for domain discovery. Empty tables keep an empty boundary. Ownership checksums and diagnostics are bounded to that subject set. Subject drift inside the boundary fails closed. Resume must reuse the original persisted starting evidence and evidence-budget/timeout settings (fail closed if absent or incompatible). Durable evidence must not contain complete raw merchant-domain arrays.

**Superseded:** Prior R9 concurrent-index overlap evidence recorded at head `fb04345f129b8664566c5947f2ad75f57102269b` is **rejected**. Current proof requires REPEATABLE READ holders with non-null `backend_xmin`, target-relation progress in `waiting for old snapshots`, positive `ShareUpdateExclusiveLock`, and true promise-settlement timing across ≥10 iterations, plus active-phase DML during `building index: scanning table` and (where observable) `index validation: scanning table`.

## Prisma schema drift diagnostics (F-F05)

`npm run tenant:schema:drift` uses fail-closed diagnostics:

- Exit 0 → fixed success event only.
- Exit 2 → allowlisted bounded schema-diff statement classes only (object type, approved identifier, change category); unrecognized text discarded.
- Other exits → fixed command class / exit code / error category / optional recognized Prisma `P####` code only.

Raw stdout/stderr are never passed to operator-facing logs or thrown messages. Regex redaction is defence in depth only.


## Status / checkpoint / resume

```bash
npm run tenant:backfill:status -- --run-id <id>
npm run tenant:backfill -- --apply --batch-size 500 --resume-run-id <id>
```

Checkpoints advance only with durable issue persistence in the same transaction.
Diagnostic phases (`diagnostic:po_supplier`, `diagnostic:lead_time`, `diagnostic:duplicate_shop_settings`) are separately checkpointed.
Resume preserves original `beforeCounts`, normalization version, source SHA, and schema version.

## Concurrency protection

Apply mode uses `pg_try_advisory_lock` on a dedicated `pg.Client` for the full run lifetime.
Unlock must return true on the same backend PID.

## Blocking condition

A run is clean (`COMPLETED`) only when all checkpoints complete, all per-table unresolved counts are zero, and `blockingIssueCount` is zero.
Otherwise finished runs use `COMPLETED_WITH_ISSUES`. Cross-domain issues block.

## Issue reopen

Re-detected previously `RESOLVED` fingerprints reopen (`OPEN`, `reopenedAt`, `reopenCount++`).

## Rollback limitations

Rolling back application code does not remove nullable columns or control records. No destructive down migration. No operational history deleted.

## Explicit prohibitions

- No production migration/deployment without later authorization
- No RLS in PR 1
- No runtime access conversion
- No inventory-write flag enablement
- No PR 2 / PR 3 work from this runbook
