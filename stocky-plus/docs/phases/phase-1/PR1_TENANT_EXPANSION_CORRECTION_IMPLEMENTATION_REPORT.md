# Phase 1 Correction Implementation Report — PR 1 Tenant Expansion

**Status:** FOLLOW-UP CORRECTIONS IMPLEMENTED — AWAITING INDEPENDENT VERIFICATION
**Implementer:** Cursor

## Identity (immutable heads vs live tip)

| Item | Value |
|---|---|
| Base main SHA | `8ccc8d29a78e05615b31324b38df17f4f1d1296e` |
| Branch | `phase-1/tenant-expand` |
| Pull request | [#11](https://github.com/Vedang1998/Stocky/pull/11) (draft, OPEN, unmerged) |
| Original Claude-reviewed head | `7aabb095806716697bfea2783379351b15e1cda2` |
| Correction-review Claude head | `fb04345f129b8664566c5947f2ad75f57102269b` |
| Follow-up reviewed head (immutable) | `aa5f425f446d79ff1bc24ac17a5944cdb8072159` |
| Follow-up verdict | `NOT READY` (preserved verbatim in `PR1_TENANT_EXPANSION_CORRECTION_FOLLOWUP_REVIEW_REPORT.md`) |
| Follow-up review-record commit | `948fef9` (docs only; before F-F code) |
| Current live PR tip + exact-head CI | Recorded in PR description after push — **mutable** |

## Summary

Addressed Claude follow-up findings **F-F00 through F-F07** (product-owner accepted) on draft PR #11 without merging, without starting PR 2/3, without RLS/runtime conversion, and without enabling inventory writes. F-N01–F-N09 corrections remain in place. No finding is independently closed. F-F00 remains an external review-environment gate.

## F-F01 / F-F07 — database-enforced READ ONLY starting snapshot

1. First SQL in the capture interactive transaction: `SET TRANSACTION READ ONLY`.
2. Immediately observe and persist `transaction_isolation`, `transaction_read_only`, and `pg_current_snapshot()`.
3. Fail closed unless isolation is `repeatable read` and `transaction_read_only` is `on`.
4. Test-only `onSnapshotEstablished` hook proves SQLSTATE `25006` rejects writes; operational entry points never pass the hook.
5. Comments describe the enforced guarantee precisely.

## F-F02 — bounded / redacted domain-discovery evidence

- Budget version: **`phase1-evidence-budget-v1`** (`scripts/tenant-backfill/evidence-budget.ts`).
- Durable `resumeMetadata` / `startingEvidence` no longer stores complete raw-domain arrays (`directOwnerRawShops` removed).
- Valid normalized domains: count + SHA-256 digest + full operational set within an explicit ceiling (fail closed before mutation if exceeded).
- Per-source evidence: counts, digests, bounded redacted samples (length, hash prefix, normalization reason — not complete raw merchant domains).
- Invalid domains: aggregate counts/digest + durable issue drafts under an explicit issue ceiling; overflow fails closed before mutation.
- Shop snapshot: `domainToShopId` map within supported Shop ceiling; row count + checksum; no duplicate full `rows`/`domains` arrays.
- Serialized UTF-8 byte budget enforced before creating/updating `TenantBackfillRun`.

## F-F03 — active build / validation scan DML overlap

- Retained ≥10-iteration old-snapshot-wait proof.
- Added active-phase proof during PostgreSQL 16 phases `building index: scanning table` and `index validation: scanning table` with builder-PID-constrained observation, `ShareUpdateExclusiveLock` (no `AccessExclusiveLock`), settlement-before-build-complete, and `valid_exact`.
- Production claim is limited to the phases empirically tested.

## F-F04 — configurable starting-snapshot timeout + phase telemetry

- `TENANT_STARTING_SNAPSHOT_TIMEOUT_MS` (default 180000; bounds 10000–1800000); invalid values fail before the transaction opens.
- Phase timings recorded for transaction init, counts, Shop, Session, table subjects, domain discovery, and serialization.
- Safe failure diagnostics omit raw merchant domains, URLs, and credentials.

## F-F05 — fail-closed drift diagnostics

- Exit 0 → fixed success event only.
- Exit 2 → allowlisted, bounded schema-diff statement classes only; unrecognized text discarded; truncation flagged.
- Other exits → fixed command class / exit / category / optional `P####`; no raw stdout/stderr.
- Regex redaction retained as defence in depth only.
- Architecture test asserts error paths do not log raw streams.

## F-F06 — dependency advisory investigation

| Compare | Value |
|---|---|
| Base main (`8ccc8d29…`) `npm audit --package-lock-only` | 32 high, 0 critical/moderate/low |
| PR head (this tip) `npm audit --package-lock-only` | 32 high, 0 critical/moderate/low |
| Advisory count delta | **unchanged** |
| PR #11 package.json changes | Added runtime `pg@^8.16.3`; dev `@types/pg@^8.15.4`; maintenance scripts only |
| New `pg` chain advisories | **none** (pg and transitive packages clean in audit) |
| `npm audit fix` / broad upgrades | **not performed** |

Pre-existing advisories remain tracked under **R-013** (and follow-up **R-062**). They are not resolved by PR #11. No product-owner decision required for a newly introduced vulnerable dependency.

## Local validation (tip `dfe05865fc8ee2b51fa15e3bc16241b9221e1087`)

Environment: disposable PostgreSQL 16 at `localhost:5432` / `stocky_plus_migrations`; inventory-write flags false.

| Command | Exit |
|---|---|
| `git diff --check` | 0 |
| `npm ci` | 0 (32 high advisories reported; unchanged vs main) |
| `npx prisma generate` | 0 |
| `npx prisma validate` | 0 |
| `npx prisma migrate deploy` | 0 |
| `npm run tenant:indexes:plan` (pre-apply) | **1** (expected: 28 missing) |
| `npm run tenant:indexes:apply -- --apply` | 0 |
| `npm run tenant:indexes:verify` | 0 |
| `npm run tenant:schema:drift` | 0 (`tenant_prisma_schema_drift_ok`) |
| `npm run tenant:indexes:plan` (post-apply) | 0 (`valid_exact: 28`) |
| `npm run test:migrations` | 0 (106 tests / 24 files) |
| `npm run test:subject-memory` | 0 (2 tests) |
| `npm run lint` | 0 |
| `npm run typecheck` | 0 |
| `npm test` | 0 (56 tests) |
| `npm run build` | 0 |
| `npm run graphql-codegen` | 0 |

Exact-head CI run/job IDs recorded in the PR description after push.

## Explicit non-claims

- No production or merchant data accessed.
- No deployment.
- No RLS / non-null tenant enforcement / composite child FKs / Shop ownership FKs / runtime conversion.
- PR 2 and PR 3 not started.
- Inventory writes UNAPPROVED; every inventory-write flag DEFAULT OFF.
- Findings F-F00–F-F07 and earlier waves are **not** independently closed.

## Next action

Return to ChatGPT for exact-head verification and a capable local Claude Code correction review.
