# Phase 1 Correction Implementation Report — PR 1 Tenant Expansion

**Status:** ACCEPTED, SQUASH-MERGED, AND CLOSED (D-025 / D-026)
**Implementer:** Cursor

## Identity (immutable heads vs live tip)

| Item | Value |
|---|---|
| Base main SHA (pre-merge) | `8ccc8d29a78e05615b31324b38df17f4f1d1296e` |
| Branch | `phase-1/tenant-expand` |
| Pull request | [#11](https://github.com/Vedang1998/Stocky/pull/11) — **CLOSED AND SQUASH-MERGED** |
| Original Claude-reviewed head | `7aabb095806716697bfea2783379351b15e1cda2` — `NOT READY` |
| Correction-review Claude head | `fb04345f129b8664566c5947f2ad75f57102269b` — `NOT READY` |
| Follow-up reviewed head (immutable) | `aa5f425f446d79ff1bc24ac17a5944cdb8072159` — `NOT READY` |
| Follow-up verdict | `NOT READY` (preserved verbatim in `PR1_TENANT_EXPANSION_CORRECTION_FOLLOWUP_REVIEW_REPORT.md`) |
| Follow-up review-record commit | `948fef9` (docs only; before F-F code) |
| Capable-local reviewed head (immutable) | `28e77178602ca486e5138ca2f80e8947d8e113c0` |
| Capable-local verdict | `READY FOR CHATGPT PR 1 ACCEPTANCE` (preserved verbatim in `PR1_TENANT_EXPANSION_CAPABLE_LOCAL_REVIEW_REPORT.md`) |
| Capable-local review date | 2026-07-31 |
| Exact-head CI at reviewed head | run `30633301468`, job `91164602626`, conclusion `success` |
| ChatGPT technical acceptance | `PR 1 ACCEPTED` (D-025) |
| Documentation finalization / authorized merge head | `6e5b024254615f3259aeb8d8252305d86bd63777` |
| Pre-merge exact-head CI at authorized head | run `30643441951`, job `91198830409`, conclusion `success` |
| Merge closure | D-026 |

## Immutable merge evidence

| Field | Value |
|---|---|
| PR number | [#11](https://github.com/Vedang1998/Stocky/pull/11) |
| Authorized head | `6e5b024254615f3259aeb8d8252305d86bd63777` |
| Merge method | SQUASH |
| Squash merge SHA | `44a24f3387c1dae0351490367c06bef10f333425` |
| Merge timestamp | `2026-07-31T22:19:49Z` |
| Pre-merge exact-head CI | workflow `CI`; run `30643441951`; job `91198830409` (`Lint, typecheck, test, build, Prisma, GraphQL`); conclusion `success`; `head_sha` = authorized head |
| Production / merchant data | **No production or merchant data was accessed** |
| Deployment | **No deployment occurred** |
| RLS / runtime conversion | **No RLS or runtime tenant conversion was activated** |
| PR 2 / PR 3 | **Not started** |
| Inventory writes | **UNAPPROVED**; every inventory-write flag remains **DEFAULT OFF** |

## Summary

Addressed Claude follow-up findings **F-F00 through F-F07** on draft PR #11 without starting PR 2/3, without RLS/runtime conversion, and without enabling inventory writes. F-N01–F-N09 corrections remain in place. Capable-local independent review at `28e77178602ca486e5138ca2f80e8947d8e113c0` returned **`READY FOR CHATGPT PR 1 ACCEPTANCE`**. ChatGPT accepted PR 1 technically (D-025). PR #11 was then squash-merged at authorized head `6e5b024254615f3259aeb8d8252305d86bd63777` as `44a24f3387c1dae0351490367c06bef10f333425` (D-026). **No P0 or P1 correction remains for PR 1 scope.** Phase 1 itself remains in progress.

Historical failure states and rejected evidence (including prior R9 at `fb04345f…`) are preserved and not erased.

## F-F01 / F-F07 — database-enforced READ ONLY starting snapshot

1. First SQL in the capture interactive transaction: `SET TRANSACTION READ ONLY`.
2. Immediately observe and persist `transaction_isolation`, `transaction_read_only`, and `pg_current_snapshot()`.
3. Fail closed unless isolation is `repeatable read` and `transaction_read_only` is `on`.
4. Test-only `onSnapshotEstablished` hook proves SQLSTATE `25006` rejects writes; operational entry points never pass the hook.
5. Comments describe the enforced guarantee precisely.

**Status:** independently verified and accepted for PR 1.

## F-F02 — bounded / redacted domain-discovery evidence

- Budget version: **`phase1-evidence-budget-v1`** (`scripts/tenant-backfill/evidence-budget.ts`).
- Durable `resumeMetadata` / `startingEvidence` no longer stores complete raw-domain arrays (`directOwnerRawShops` removed).
- Valid normalized domains: count + SHA-256 digest + full operational set within an explicit ceiling (fail closed before mutation if exceeded).
- Per-source evidence: counts, digests, bounded redacted samples (length, hash prefix, normalization reason — not complete raw merchant domains).
- Invalid domains: aggregate counts/digest + durable issue drafts under an explicit issue ceiling; overflow fails closed before mutation.
- Shop snapshot: `domainToShopId` map within supported Shop ceiling; row count + checksum; no duplicate full `rows`/`domains` arrays.
- Serialized UTF-8 byte budget enforced before creating/updating `TenantBackfillRun`.

**Status:** independently verified and accepted for PR 1.

## F-F03 — active build / validation scan DML overlap

- Retained ≥10-iteration old-snapshot-wait proof.
- Added active-phase proof during PostgreSQL 16 phases `building index: scanning table` and `index validation: scanning table` with builder-PID-constrained observation, `ShareUpdateExclusiveLock` (no `AccessExclusiveLock`), settlement-before-build-complete, and `valid_exact`.
- Production claim is limited to the phases empirically tested.

**Status:** independently verified and accepted for PR 1.

## F-F04 — configurable starting-snapshot timeout + phase telemetry

- `TENANT_STARTING_SNAPSHOT_TIMEOUT_MS` (default 180000; bounds 10000–1800000); invalid values fail before the transaction opens.
- Phase timings recorded for transaction init, counts, Shop, Session, table subjects, domain discovery, and serialization.
- Safe failure diagnostics omit raw merchant domains, URLs, and credentials.

**Status:** independently verified and accepted for PR 1.

## F-F05 — fail-closed drift diagnostics

- Exit 0 → fixed success event only.
- Exit 2 → allowlisted, bounded schema-diff statement classes only; unrecognized text discarded; truncation flagged.
- Other exits → fixed command class / exit / category / optional `P####`; no raw stdout/stderr.
- Regex redaction retained as defence in depth only.
- Architecture test asserts error paths do not log raw streams.

**Status:** independently verified and accepted for PR 1.

## F-F06 — dependency advisory investigation

| Compare | Value |
|---|---|
| Base main (`8ccc8d29…`) `npm audit --package-lock-only` | 32 high, 0 critical/moderate/low |
| Reviewed PR head (`28e7717…`) `npm audit --package-lock-only` | 32 high, 0 critical/moderate/low |
| Advisory count delta | **unchanged** |
| PR #11 package.json changes | Added runtime `pg@^8.16.3`; dev `@types/pg@^8.15.4`; maintenance scripts only |
| New `pg` chain advisories | **none** (pg and transitive packages clean in audit) |
| `npm audit fix` / broad upgrades | **not performed** |

Pre-existing advisories remain tracked under **R-013** and **R-062**. They are **not** resolved by PR #11 acceptance or merge.

## F-PR1-11 (non-blocking)

Capable-local review recorded F-PR1-11 as a non-blocking P3 wording item (dry-run “non-mutating” CLI help text). Explicitly deferred to a future focused documentation/help-text cleanup. Application and CLI source were **not** changed in this acceptance finalization.

## Local validation (tip preceding docs-only finalization; reviewed head `28e77178602ca486e5138ca2f80e8947d8e113c0`)

Environment: disposable PostgreSQL 16; inventory-write flags false. Capable-local review independently re-executed the required suite; see the preserved capable-local report for full command evidence, including the disclosed transient `test:subject-memory` connection contention note.

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
| `npm run test:migrations` | 0 |
| `npm run test:subject-memory` | 0 |
| `npm run lint` | 0 |
| `npm run typecheck` | 0 |
| `npm test` | 0 |
| `npm run build` | 0 |
| `npm run graphql-codegen` | 0 |

Exact-head CI at reviewed head: run `30633301468`, job `91164602626`, conclusion `success`.
Pre-merge exact-head CI at authorized head: run `30643441951`, job `91198830409`, conclusion `success`.

## Explicit non-claims

- No production or merchant data accessed.
- No deployment.
- No RLS / non-null tenant enforcement / composite child FKs / Shop ownership FKs / runtime conversion.
- PR 2 and PR 3 not started.
- Inventory writes UNAPPROVED; every inventory-write flag DEFAULT OFF.
- PR 1 merge does **not** complete Phase 1 and does **not** authorize production backfill, RLS activation, inventory mutations, PR 2, or PR 3.
- Residual gates remain: F-016 / R-022 / Q-011, R-014, operational backfill / zero-unresolved evidence, dependency hardening, inventory-write release.

## Next action

Return to ChatGPT for PR 2 tenant-bound access conversion authorization and the exact Cursor implementation prompt.
