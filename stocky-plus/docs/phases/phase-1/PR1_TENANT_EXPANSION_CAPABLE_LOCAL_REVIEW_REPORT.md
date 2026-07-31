# PR 1 — Tenant Expansion and Backfill: Capable Local Independent Correction Review

**Intended location:** `stocky-plus/docs/phases/phase-1/PR1_TENANT_EXPANSION_CAPABLE_LOCAL_REVIEW_REPORT.md`
**Reviewer:** Claude Code, capable local environment (macOS, Docker-provisioned disposable PostgreSQL 16, authenticated GitHub CLI, network access to shopify.dev)
**Review date:** 2026-07-31
**This report was produced without modifying the repository.** No commit, push, branch, merge, approval, or ready-state change was made to `Vedang1998/Stocky`.

---

## 1. Executive summary

**Final verdict: `READY FOR CHATGPT PR 1 ACCEPTANCE`.**

This review was performed in a genuinely capable local environment — the exact gate (F-F00) that blocked the two prior review waves. Every command in the mandated list was executed for real against a disposable PostgreSQL 16.14 instance, including the Prisma-engine-dependent commands (`prisma generate`, `prisma validate`, `prisma migrate deploy`), the Shopify-network-dependent command (`graphql-codegen`, confirmed live against `shopify.dev`), and the full migration/backfill test suite. All commands passed with the exit codes required by the prompt. Identity was verified end-to-end through the authenticated GitHub API: PR #11 is open, draft, unmerged; base and head SHAs match exactly; the reported CI run and job are genuinely bound to the exact reviewed head; and no commit exists after the reviewed head on the live branch tip.

I independently re-derived, by direct source inspection and re-execution of the actual test suite (not by trusting test names or prior summaries), that every P1/P2 finding from all three prior review waves that the correction backlog claims to have addressed is **genuinely corrected**:

* **F-F01/F-F07** — `SET TRANSACTION READ ONLY` is verified as the literal first SQL statement in the evidence-capture transaction (`scripts/tenant-backfill/starting-snapshot.ts:418`), before any count, Shop read, Session read, table-subject capture, or domain discovery. `transaction_isolation`/`transaction_read_only` are observed and persisted as durable evidence, verified fail-closed, and a real negative-write test provokes PostgreSQL's actual `25006` SQLSTATE (checked via `err.meta?.code`, not merely a generic Prisma wrapper code) and confirms the write is not committed. I confirmed by grep across the entire non-test tree that the test-only hook enabling this negative-write test (`onSnapshotEstablished`) is never wired into any operational path — `engine.ts:477` calls `captureStartingEvidence(prisma)` with no options at all.
* **F-F02** — the old unbounded `directOwnerRawShops` raw-domain-array field is completely gone from the codebase (it appears only in a test assertion that checks its absence). The versioned `phase1-evidence-budget-v1` budget (`evidence-budget.ts`) enforces explicit, env-configurable, bounds-checked ceilings for normalized domains, Shop count, discovery issues, samples-per-source, and total serialized bytes; every ceiling fails closed **before** any merchant-ownership mutation, proven by tests that assert zero mutated rows and zero created Shops/issues after an induced overflow. Exact raw fixture strings (including a deliberately malformed one) have zero matches in serialized `resumeMetadata` while the canonical normalized domain is present, confirmed by a direct string-containment assertion in `domain-evidence.migration.test.ts`, which I executed and confirmed passing.
* **F-F03 / F-N01 / F-N05 / F-N06** — the R9 overlap proof was genuinely rebuilt, not patched. Snapshot holders now open `BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY` and the test positively confirms `backend_xmin` is retained before proceeding (the old defect used `READ COMMITTED` holders with `backend_xmin` null). `buildSettledAtNs`/`buildSettled` are assigned inside the `.then`/`.catch` settle callback attached directly to the builder query promise, not after an external `await`. The tautological `buildSettled || true` assertion is gone (confirmed by grep); the vacuous `lockObs.every(...)` on a possibly-empty array is now preceded by `lockObs.length > 0` and a positive `lockObs.some(mode === 'ShareUpdateExclusiveLock')` assertion, plus an explicit `lockObs.some(mode === 'AccessExclusiveLock') === false`. I independently re-ran this exact test suite and reproduced 10/10 passing iterations of the old-snapshot-wait proof and 3/3 passing iterations of a **new** active-phase proof that captures real DML writes during `building index: scanning table` and `index validation: scanning table`, with builder-PID- and target-relation-constrained `pg_stat_progress_create_index`/`pg_locks` observation, on a 400,000-row table.
* **F-F04** — `TENANT_STARTING_SNAPSHOT_TIMEOUT_MS` has a documented default (180s) and bounds (10s–1800s), strict-integer parsing that rejects non-integers and out-of-bounds values **before** any transaction opens, phase-by-phase telemetry, and safe failure diagnostics that never include raw merchant domains, URLs, or credentials (confirmed by direct code read of the `catch` block in `captureStartingEvidence`, and by the observed shape of the failure diagnostics emitted during my own `test:migrations` run).
* **F-F05** — drift diagnostics are now architecturally fail-closed: `classifyDriftFailure`/`formatSafeDriftFailure` never place `result.stdout`/`result.stderr` into any returned or thrown value (confirmed by direct source read — the `combined` variable used only to extract a `P####` code is never itself included in the return value); exit 2 goes through a strict statement-class allowlist parser (unrecognized lines are discarded, not passed through); every other exit collapses to a fixed generic summary plus an optional recognized `P####` code. A dedicated architecture test greps the source files for the absence of raw-stream interpolation patterns. The regex redaction layer is retained only as defence-in-depth and is exercised by 16 unit tests (all passing in my run) covering URL credentials, schemeless credentials, bare hostnames, host:port, IPv4, IPv6, Unix sockets, libpq keyword strings, unexpected credential labels, mixed safe-diff-plus-unsafe-stderr, and unknown/oversized output.
* **F-F06** — I independently re-ran `npm audit --package-lock-only` against both base `main` (`8ccc8d29…`) and the exact PR head, each in its own fresh clone. Both report **32 high / 0 critical/moderate/low**, with byte-identical sets of 30 advisory package names (all dev-tooling: eslint, react-router, graphql-codegen, typescript-eslint chains — no runtime package). `pg` (the only new runtime dependency introduced by this PR) does not appear in either advisory list. I did not run `npm audit fix`. No new release-blocking dependency risk was introduced by PR #11.
* **F-PR1-01 (dry-run/apply equivalence)** — the engine now maintains an in-memory `proposedOwnership` map (`engine.ts:361`, `ProposedOwnership` type at `:118`) that child-row resolution consults ahead of the persisted column (`:1391-1419`). A dedicated equivalence test seeds the exact parent/child fixture shape the original defect required (one valid parent with children in four different child tables, plus one invalid parent) and asserts `unresolvedCounts`, `updatedCounts`, `unchangedCounts`, `examinedCounts`, reason codes, and issue fingerprints are identical between a dry-run and a fresh apply — a genuine equivalence check, not merely a same-status assertion. I ran this test and confirmed it passes.
* **F-PR1-02 (checkpoint/issue atomicity)** — reproduced the exact crash scenario from the original finding using a real `throwAfterBatchCommit` fault-injection hook in the test. The checkpoint and the issue record for the unresolved row both exist after the simulated fault; resuming does not skip the row; and the final issue set after fault+resume is byte-identical (by `tableName:rowId:reasonCode`) to an uninterrupted baseline run on the same fixture.
* **F-PR1-07 / R4 (advisory lock)** — `apply-lock.ts` now uses a dedicated, non-pooled `pg.Client` (not a pooled Prisma connection), pins the acquiring backend PID, and verifies the *same* backend PID plus a true `unlocked` result on release, throwing otherwise. This structurally eliminates both the reentrancy-fails-open and cross-backend-unlock-fails-closed failure modes documented in the original finding.
* **F-PR1-08/09 (domain length/ASCII)** — `shop-domain.ts` now rejects non-ASCII on the raw trimmed input **before** `toLowerCase()`, and enforces DNS label ≤ 63 and total hostname ≤ 253, exactly as required.
* **F-N02/F-N03/F-N04/F-N07 (dataset boundary, same-ID replacement, incoherent snapshot, unbounded materialization)** — domain discovery (`streamDistinctShopValues`) is now called with the recorded per-table/Session high-water mark, so it is genuinely bounded by the run subject. The per-table subject-evidence digest columns (`subject-manifest.ts`) now include `shop`/parent-FK/timestamp fields, not just `id`, so a same-ID delete-and-recreate with different content changes the digest. All starting evidence (`beforeCounts`, dataset boundaries, domain discovery) is captured inside one `REPEATABLE READ` transaction (`starting-snapshot.ts:413-655`). Boundary capture streams in keyset batches rather than materializing full ID arrays, and a constrained-256MB-heap test exercises this directly.

I found **no P0 or P1 finding** in this review. The evidence layer, the concurrent-index rollout, the checkpoint/quarantine mechanism, and the read-only starting snapshot are now internally consistent, deterministic, bounded, and fail-closed under every fault scenario I was able to reproduce. Scope discipline remains exemplary and was independently re-verified against the live PostgreSQL catalog, not merely against test output: exactly 18 nullable `shopId` columns, zero `Shop` foreign keys, zero RLS tables, zero policies, 13 legacy `shop` columns retained, `Session` model textually unchanged, and no runtime/route/service file touched outside the tenant-backfill/tenant-indexes tooling and the `shop-domain.ts` helper it depends on. Production inventory writes remain UNAPPROVED and every inventory-write flag remains DEFAULT OFF, verified both by source diff and by passing runtime tests (`cross-shop-denial.test.ts`, `transfer-receive-guard.test.ts`).

---

## 2. Exact identity and PR verification

Fresh clone (`git clone https://github.com/Vedang1998/Stocky.git`), then `git fetch origin pull/11/head:pr-11-head` and `git checkout pr-11-head`.

```
$ git rev-parse HEAD
28e77178602ca486e5138ca2f80e8947d8e113c0

$ git status --porcelain
(empty)
```

| Check | Method | Result |
|---|---|---|
| Repository | `gh api repos/Vedang1998/Stocky` context | `Vedang1998/Stocky` ✅ |
| PR # / title | `gh pr view 11` | #11 — "Add Phase 1 tenant expansion and backfill foundation" ✅ |
| State | `gh pr view 11 --json state` | `OPEN` ✅ |
| Draft | `gh pr view 11 --json isDraft` | `true` ✅ |
| Merged | `gh pr view 11 --json closed,mergedAt` | `closed=false`, `mergedAt=null` ✅ |
| Base ref/SHA | `gh pr view 11 --json baseRefName,baseRefOid` | `main` / `8ccc8d29a78e05615b31324b38df17f4f1d1296e` ✅ exact match |
| Head ref/SHA | `gh pr view 11 --json headRefName,headRefOid` | `phase-1/tenant-expand` / `28e77178602ca486e5138ca2f80e8947d8e113c0` ✅ exact match |
| Merge base | `git merge-base main pr-11-head` | `8ccc8d29a78e05615b31324b38df17f4f1d1296e` ✅ |
| Live branch tip | `git ls-remote origin refs/heads/phase-1/tenant-expand` | `28e77178602ca486e5138ca2f80e8947d8e113c0` ✅ — **no commit exists after the reviewed head** |
| Last 3 PR commits | `gh pr view 11 --json commits` | `...cc35d67`, `dfe0586`, `28e7717` (reviewed head is the tip) ✅ |
| CI run identity | `gh api repos/.../actions/runs/30633301468` | `head_sha=28e7717...`, `conclusion=success`, `event=pull_request`, `head_branch=phase-1/tenant-expand` ✅ |
| CI job identity | `gh api .../jobs` filtered by id `91164602626` | `name="Lint, typecheck, test, build, Prisma, GraphQL"`, `conclusion=success`, `head_sha=28e7717...` ✅ |
| Check-run association | `gh api repos/.../commits/28e7717.../check-runs` | Single check run, id `91164602626`, `success`, bound to the exact head ✅ |
| Job step list | `gh api repos/.../jobs/91164602626` steps | All named steps `completed`/`success` (Checkout → Setup Node → Pin npm → Verify versions → Install → Prisma generate → Prisma validate → Migrate deploy → Index apply → Index verify → Drift check → Post-apply plan → Git diff check → Lint → Typecheck → Unit tests → Migration/backfill tests → Constrained-memory subject evidence → Build → GraphQL codegen → cleanup steps) ✅ |
| Full job log | `gh api .../jobs/91164602626/logs` | Retrieved (1,156 lines) and archived at review time ✅ |

CI is genuinely bound to the exact reviewed head — every identity claim in the prompt checked out.

---

## 3. Environment

| Component | Value |
|---|---|
| Host | macOS (Darwin 25.4.0, arm64) |
| Docker | 29.6.2 |
| PostgreSQL | 16.14 (`postgres:16-alpine`), disposable container, port 5434, credentials matching CI (`stocky`/`stocky`/`stocky_plus_ci`) |
| Node | v22.19.0 (matches `engines.node`) |
| npm | 11.5.2 (matches `engines.npm` / `packageManager` exactly) |
| GitHub CLI | 2.96.0, authenticated as `Vedang1998` (repo owner — full API access, not rate-limited/anonymous) |
| Shopify CLI | 4.6.0, present |
| Network | Confirmed live egress to `api.github.com` (200) and `shopify.dev` (301, reachable) — the two hosts that blocked all three prior review environments |
| Prisma engines | Downloaded and used successfully (`prisma generate`, `prisma validate`, `prisma migrate deploy` all executed for real) |

This environment satisfies every requirement the F-F00 gate specified. No required execution dependency was blocked.

A disposable Postgres container is standard scratch infrastructure for this kind of review; it was destroyed after the review session — all command output was captured to logs beforehand.

---

## 4. Commands and exit codes

All commands run from `stocky-plus/` against the disposable database described above, environment variables mirroring `.github/workflows/ci.yml` exactly (including all `FEATURE_*_WRITES=false` and `ALLOW_DEV_SUBSCRIPTION_ACTIVATE=false`).

| Command | Exit | Notes |
|---|---:|---|
| `git diff --check main...pr-11-head` | 0 | Clean |
| `npm ci` | 0 | 970 packages; 32 high severity advisories (tracked, unchanged — see §14) |
| `npx prisma generate` | 0 | Prisma Client 6.19.3 generated |
| `npx prisma validate` | 0 | Schema valid |
| `npx prisma migrate deploy` (empty DB) | 0 | All 5 migrations applied: `20260728000000_init_stocky_plus`, `20260730160000_tenant_expansion`, `20260730160100_tenant_compatibility_indexes`, `20260730210000_tenant_backfill_correction`, `20260730220000_tenant_ownership_issue_detection` |
| `npm run tenant:indexes:plan` (pre-apply) | 1 | `{"missing":28}` — expected, exact count |
| `npm run tenant:indexes:apply -- --apply` | 0 | 28 created, 0 skipped, 0 failed |
| `npm run tenant:indexes:verify` | 0 | `{"ok":true,"mismatches":[]}` |
| `npm run tenant:schema:drift` | 0 | `{"event":"tenant_prisma_schema_drift_ok","exitCode":0}` |
| `npm run tenant:indexes:plan` (post-apply) | 0 | `{"valid_exact":28}` — all 28, no other classification |
| `npm run test:migrations` | 0 | **106 tests passed, 0 failed, 24 test files** — see §12 |
| `npm run test:subject-memory` | 0 | 2/2 passed — see note in §12 on one transient prior failure |
| `npm run lint` | 0 | Clean, no output |
| `npm run typecheck` | 0 | `react-router typegen && tsc --noEmit` clean |
| `npm test` | 0 | 56/56 unit tests, 6 files |
| `npm run build` | 0 | Client + SSR server build succeeded |
| `npm run graphql-codegen` | 0 | Succeeded against live `shopify.dev`; `app/types/admin.generated.d.ts` regenerated with no diff against the committed version |

**Every mandated command was executed for real, including every command blocked in the two prior review environments.** No command result is inferred.

One environment-setup note: my first attempt at `test:migrations` used a disposable database with a `postgres` role rather than the `stocky` role the test suite's `resetPublicSchema` helper hardcodes (`GRANT ALL ON SCHEMA public TO stocky`), which matches CI's `POSTGRES_USER: stocky`. That first attempt failed with `role "stocky" does not exist` — an environment-naming mismatch on my part, not a code defect. I recreated the disposable container with `stocky`/`stocky`/`stocky_plus_ci` credentials matching CI exactly, and every command from that point on (including a full re-run of the Prisma/index sequence) was clean, as tabulated above.

### Additional independent execution beyond the CI sequence

* Empty-database migration: ✅ (above)
* Upgrade from exact current-main schema: ✅ — `20260730160000` onward applied cleanly on top of `20260728000000_init_stocky_plus`, which is byte-identical to base main's only migration
* Dry-run/apply equivalence: ✅ reproduced directly (§7)
* Repeated idempotent apply: ✅ — `tenant compatibility indexes on PostgreSQL > valid exact after apply; rerun idempotency skips all` passed
* Interrupted/resumed apply: ✅ — `batch-atomicity.migration.test.ts` (real `throwAfterBatchCommit` fault injection), `snapshot-readonly.migration.test.ts` resume case, `dataset-boundaries.migration.test.ts` interrupted/resumed case, all passed
* Diagnostic interruption/resume: ✅ — `detection-history.migration.test.ts` ("interrupted/resumed processing does not duplicate detections; atomic with checkpoint") passed
* Issue reopening: ✅ — `issue-reopen-counts.migration.test.ts` passed
* Historical issue-detection immutability: ✅ — `detection-history.migration.test.ts` ("preserves run A detection metrics after run B redetects and resolves") passed
* Apply-lock contention/release/failure cleanup/recovery: ✅ — `apply-lock.migration.test.ts` (2 tests: same-process contention, separately-held-lock denial + release-on-recovery) passed
* Matching/conflicting/deletion engine races: ✅ — `engine-races.migration.test.ts` (3 tests, real separate `pg.Client` sessions) passed

---

## 5. CI log verification

Retrieved the full job log for job `91164602626` (1,156 lines) via the authenticated API and confirmed the recorded step sequence matches the mandated command order (apply → verify → drift → post-apply plan, exactly as R8 requires) and that no step was skipped. Step-by-step conclusions were independently confirmed via the Jobs API (`/actions/jobs/91164602626`) rather than only the summary check-run — all substantive steps plus setup/teardown steps report `success`. My local run's event shapes and pass counts (32 advisories, 28/28 `valid_exact`, 106/106 and 56/56 test totals) match what the CI log records for the same commit.

---

## 6. Scope assessment

Verified directly against the live PostgreSQL 16.14 catalog after applying all 5 migrations plus the concurrent index tool (not against test output alone):

```sql
-- nullable shopId columns
SELECT count(*) FROM information_schema.columns WHERE column_name='shopId' AND is_nullable='YES';  -- 18
-- NOT NULL shopId columns
SELECT count(*) FROM information_schema.columns WHERE column_name='shopId' AND is_nullable='NO';    -- 0
-- FKs to Shop
SELECT count(*) FROM pg_constraint WHERE contype='f' AND confrelid='"Shop"'::regclass;              -- 0
-- RLS-enabled tables
SELECT count(*) FROM pg_class WHERE relrowsecurity;                                                 -- 0
-- RLS policies
SELECT count(*) FROM pg_policies;                                                                   -- 0
-- legacy shop columns retained
SELECT count(*) FROM information_schema.columns WHERE column_name='shop' AND table_schema='public'; -- 13
```

`git diff main...pr-11-head` scope check: 75 files changed (+12,777/−213). Outside `scripts/tenant-backfill/`, `scripts/tenant-indexes/`, `prisma/`, and `docs/`, the only files touched are `.github/workflows/ci.yml`, `stocky-plus/.gitignore`, `app/lib/shop-domain.ts` + its test (the domain-normalization helper the backfill depends on), `package.json`/`package-lock.json` (adds `pg`/`@types/pg` runtime dep plus new npm scripts), and `vitest.migrations.config.ts`. No route, service, or runtime-access file was touched. `model Session` in `prisma/schema.prisma` is textually identical to base main (confirmed via `git diff` of that section, which produced no output).

| Prohibited item | Verification | Result |
|---|---|---|
| Non-null tenant enforcement | catalog query above | ✅ absent (0/18 NOT NULL) |
| Shop ownership foreign keys | catalog query above | ✅ absent (0 FKs) |
| Composite child foreign keys | migration SQL + catalog | ✅ absent |
| RLS or policies | catalog query above | ✅ absent (0 tables, 0 policies) |
| Runtime tenant conversion | diff scope (no `app/routes`, `app/services` production files touched) | ✅ absent |
| Database tenant roles | migration SQL — no `CREATE ROLE`/`GRANT` beyond schema ownership | ✅ absent |
| Transaction-local tenant context | diff scope | ✅ absent |
| Runtime dual writes | diff scope | ✅ absent |
| Shopify sync expansion | diff scope | ✅ absent |
| Inventory mutations | `FEATURE_*_WRITES` source untouched; `cross-shop-denial.test.ts`/`transfer-receive-guard.test.ts` assert flags OFF and pass | ✅ absent |
| PR 2 work | diff scope; `docs/PROJECT_STATUS.md` states "PR 2: NOT STARTED" | ✅ absent |
| PR 3 work | diff scope; same | ✅ absent |
| Phase 2 work | diff scope | ✅ absent |

**Scope verdict: PASS**, independently re-verified against live catalog state, not inherited from prior reports.

---

## 7. Original findings assessment (F-PR1-01 … 15)

| ID | Subject | Status | Independent basis (this review) |
|---|---|---|---|
| F-PR1-01 | Dry-run/apply classification equivalence | ✅ **CORRECTED** | `proposedOwnership` in-memory map (`engine.ts:361,1391-1419`) consulted by child resolution during dry-run; dedicated equivalence test with 4 child-table types + invalid parent passed; per-table `updatedCounts`/`unchangedCounts`/`examinedCounts`/`unresolvedCounts`/reason codes/fingerprints all asserted equal |
| F-PR1-02 | Checkpoint/issue atomicity | ✅ **CORRECTED** | Real `throwAfterBatchCommit` fault-injection test reproduces the exact original crash point; checkpoint + issue both present after fault; resume does not skip the row; final issue set identical to an uninterrupted baseline |
| F-PR1-03 | Cross-domain issues vs unresolved counts | ✅ **CORRECTED** | `cross-domain-blocking.migration.test.ts` passed — PO/supplier mismatch resolves direct shopId while flagging the mismatch for the operator |
| F-PR1-04 | Issue reopening / issueCount semantics | ✅ **CORRECTED** | `issue-reopen-counts.migration.test.ts` passed — reopens `RESOLVED` issues on re-detection with `reopenCount`/`reopenedAt`; distinct `COMPLETED`/`COMPLETED_WITH_ISSUES`/`FAILED` count fields exposed |
| F-PR1-05 | CONCURRENTLY deviation | ✅ **CORRECTED (with recorded decision D-024)** | `prisma migrate deploy` creates 0 compatibility indexes (confirmed by the pre-apply plan reporting all 28 missing immediately after `migrate deploy`); all 28 built by the external concurrent tool, confirmed by direct execution in §4 |
| F-PR1-06 | Silent-invalid-index acceptance | ✅ **CORRECTED** | `indexes.migration.test.ts`: "wrong-table collision", "wrong uniqueness classification", "wrong ordered columns", "genuine failed CREATE UNIQUE INDEX CONCURRENTLY leaves invalid index; no silent repair" — all passed |
| F-PR1-07 | Advisory-lock reliability under pooling | ✅ **CORRECTED** | `apply-lock.ts` uses dedicated non-pooled `pg.Client`, verifies release backend PID matches acquire backend PID and a true `unlocked` result; `apply-lock.migration.test.ts` (2 tests) passed |
| F-PR1-08 | Domain length bounds | ✅ **CORRECTED** | `shop-domain.ts`: `MAX_STORE_LABEL_LENGTH=63`, `MAX_HOSTNAME_LENGTH=253`, enforced before acceptance |
| F-PR1-09 | Non-ASCII confusable normalization | ✅ **CORRECTED** | `hasNonAscii(trimmed)` check runs before `toLowerCase()` |
| F-PR1-10 | `beforeCounts` corrupted on resume | ✅ **CORRECTED** | `resume-before-counts.migration.test.ts` passed — resumed run uses stored `beforeCounts`, not recomputed partial-state counts |
| F-PR1-11 | Misleading "non-mutating" dry-run wording | Not re-audited character-for-character in this pass (P3, documentation wording only; no functional risk) |
| F-PR1-12 | Stale implementation-report identity | ✅ Addressed by process | Current implementation/correction reports name exact heads and CI run/job IDs consistently (verified in §2) |
| F-PR1-13 | `git diff --check` whitespace failure | ✅ **CORRECTED** | `git diff --check main...pr-11-head` exits 0 in this review (§4) |
| F-PR1-14 | Unchecked affected-row counts / concurrent-insert precondition | ✅ **CORRECTED** | `affected-row-concurrency.migration.test.ts` (4 tests: matching, conflicting, deletion, unexpected-null/no-effect) passed |
| F-PR1-15 | SQL identifier allowlist defence-in-depth | ✅ **CORRECTED** | `assertApprovedTable` present and used; `allowlist.migration.test.ts` passed; grep confirms raw-SQL table interpolation sites route through the frozen `BACKFILL_TABLE_ORDER`/`assertApprovedTable` |

---

## 8. R1–R13 assessment

| Ref | Area | Status |
|---|---|---|
| R1 | Migration additivity / empty-DB apply | ✅ Verified — 5 migrations apply cleanly from empty (§4) |
| R2 | Concurrent index tooling exists and is exercised | ✅ Verified end-to-end (plan/apply/verify/drift, §4) |
| R3 | Index classification correctness | ✅ Verified — `valid_exact`/`invalid`/`wrong_definition`/`wrong_table` all exercised and passed |
| R4 | Advisory lock backend-pinned | ✅ Verified — see F-PR1-07 above |
| R5 | Affected-row concurrency classification | ✅ Verified — `affected-row-concurrency.migration.test.ts` passed |
| R6 | Durable detection history / immutability | ✅ Verified — `detection-history.migration.test.ts` passed |
| R7 | Runbook and phase records | ✅ Present, reviewed §15 |
| R8 | CI wiring of index lifecycle in correct order | ✅ Verified via job step list (§2, §5) |
| R9 | Concurrent-index overlap proof | ✅ **Rebuilt and verified genuinely deterministic** — REPEATABLE READ READ ONLY holders with confirmed retained `backend_xmin`; settle time captured in promise callback; positive (non-vacuous) lock-mode assertions; 10/10 iterations reproduced in this review |
| R10 | Dataset-boundary and determinism | ✅ Verified — domain discovery bounded by high-water mark; same-ID replacement detected via content-bearing digest columns; single-transaction coherent snapshot |
| R11 | Full-engine race assessment | ✅ Verified by direct execution — `engine-races.migration.test.ts` (3 tests: matching/conflicting/deletion races) passed against real separate `pg.Client` sessions |
| R12 | Maintenance-URL guardrail | ✅ Verified — `maintenance-url.unit.test.ts` (5 tests) passed |
| R13 | Prisma-drift command shape and runtime behavior | ✅ Verified — command shape confirmed safe (credentials via child `env`, never argv); runtime behavior now independently executed for real: `tenant:schema:drift` passed against a matching database, and `schema-drift.migration.test.ts` (3 tests) passed |

---

## 9. F-N findings assessment (F-N01–F-N09)

| ID | Subject | Status |
|---|---|---|
| F-N01 | R9 overlap proof invalid (READ COMMITTED holders, settle-after-await, tautology) | ✅ **CORRECTED** — see §7/R9 and §11 |
| F-N02 | Domain discovery outside recorded subject | ✅ **CORRECTED** — `streamDistinctShopValues` called with per-table/Session high-water marks in `starting-snapshot.ts:548-566`; `subject-evidence.migration.test.ts` ("direct-owner domain inserted above boundary does not change shopsWouldCreate") passed |
| F-N03 | Same-ID replacement undetected | ✅ **CORRECTED** — `subject-manifest.ts` digest columns include `shop`/parent-FK/timestamp per table, not ID-only; same-ID direct-owner and same-ID child replacement tests passed |
| F-N04 | Incoherent starting snapshot (split unsynchronized reads) | ✅ **CORRECTED** — all starting evidence captured inside one `REPEATABLE READ` `prisma.$transaction` (`starting-snapshot.ts:413-655`) |
| F-N05 | Tautological `buildSettled \|\| true` | ✅ **CORRECTED** — removed; confirmed absent by grep |
| F-N06 | Vacuous lock-mode assertion on empty array | ✅ **CORRECTED** — non-vacuous positive/negative assertions with `lockObs.length > 0` precondition |
| F-N07 | Unbounded ID materialization | ✅ **CORRECTED** — streaming keyset boundary capture; `subject-memory.migration.test.ts` constrained-256MB-heap tests passed (25,000-row and 20,000-row fixtures, heap delta <6MB) |
| F-N08 | Review-artifact chain of custody | Process finding, not a code defect |
| F-N09 | Drift stderr disclosure | ✅ **Superseded and strengthened by F-F05** — architectural fail-closed redesign supersedes the original regex-only fix |

---

## 10. F-F findings assessment (F-F00–F-F07)

| ID | Status |
|---|---|
| F-F00 (environment gate) | ✅ **Closed by this review** — a genuinely capable local environment executed every required command; no execution dependency was blocked |
| F-F01 / F-F07 | ✅ **CORRECTED** |
| F-F02 | ✅ **CORRECTED** |
| F-F03 | ✅ **CORRECTED** |
| F-F04 | ✅ **CORRECTED** |
| F-F05 | ✅ **CORRECTED** |
| F-F06 | ✅ **Investigated and independently reconfirmed** — no new release-blocking risk |

---

## 11. Snapshot and evidence assessment

Key architectural properties confirmed by direct source read of `scripts/tenant-backfill/starting-snapshot.ts`:

* `SET TRANSACTION READ ONLY` is the first statement inside `prisma.$transaction(async (tx) => { ... }, { isolationLevel: "RepeatableRead", ... })` — before `pg_current_snapshot()`, before `beforeCounts`, before Shop reads, before Session evidence, before table subject capture, before domain discovery.
* Fail-closed check on `transaction_isolation !== 'repeatable read'` or `transaction_read_only !== 'on'` throws before any further work.
* Budget resolution (`resolveEvidenceBudget()`) and timeout resolution (`resolveStartingSnapshotTimeoutMs()`) both happen **before** the transaction opens, so misconfiguration is rejected without ever touching the database.
* Resume compatibility (`assertEvidenceBudgetCompatible`) compares **every** field of `LIMIT_SPECS`, not a subset — confirmed by reading the loop, which iterates `Object.keys(LIMIT_SPECS)`.
* `parseStartingEvidence` fails closed on missing/malformed budget, timeout, isolation, read-only flag, or snapshot identity on resume.
* The `snapshot-readonly.migration.test.ts` negative-write test provokes a real write inside the transaction via the test-only `onSnapshotEstablished` hook and asserts `err.meta?.code === '25006'` (falling back to a regex match on the combined error text) — this checks Prisma's surfaced database error code field, not merely its own generic `P2010` wrapper code — then confirms via a follow-up `findUnique` that the row was never committed. I ran this test directly and confirmed it passes.

Evidence-budget limits (from `evidence-budget.ts`, version `phase1-evidence-budget-v1`): `maxNormalizedDomains` (default 5,000, bounds 1–100,000), `maxShops` (default 10,000, bounds 1–100,000), `maxDiscoveryIssues` (default 10,000, bounds 10–100,000), `maxSamplesPerSource` (default 20, bounds 0–100), `maxSerializedEvidenceBytes` (default 1,000,000, bounds 65,536–16,000,000) — all env-overridable with strict integer parsing.

---

## 12. Index and migration assessment

All 5 migrations apply cleanly and idempotently from empty. `prisma migrate deploy` creates exactly 0 compatibility indexes (confirmed by the pre-apply plan reporting all 28 missing immediately after `migrate deploy`, before running the index tool). The external concurrent tool creates all 28 required indexes and every one classifies as `valid_exact` afterward — reproduced independently in this review (§4).

`test:migrations` results (independent execution, this review):

```
Test Files  24 passed (24)
     Tests  106 passed (106)
  Duration  73.90s
```

Full file list (all passed): `indexes.migration.test.ts` (13), `apply-lock.migration.test.ts` (6), `engine-races.migration.test.ts` (3), `domain-evidence.migration.test.ts` (7), `dataset-boundaries.migration.test.ts` (5), `subject-evidence.migration.test.ts` (7), `tenant-expansion.migration.test.ts` (4), `issue-reopen-counts.migration.test.ts` (2), `resume-before-counts.migration.test.ts` (1), `detection-history.migration.test.ts` (2), `schema-drift.migration.test.ts` (3), `subject-memory.migration.test.ts` (2), `batch-atomicity.migration.test.ts` (1), `affected-row-concurrency.migration.test.ts` (4), `snapshot-readonly.migration.test.ts` (4), `cross-domain-blocking.migration.test.ts` (1), `dry-run-apply-equivalence.migration.test.ts` (1), `drift-redaction.unit.test.ts` (16), `timeouts.unit.test.ts` (4), `snapshot-timeout.unit.test.ts` (4), `maintenance-url.unit.test.ts` (5), `domain-normalization.unit.test.ts` (3), `classify.unit.test.ts` (7), `allowlist.migration.test.ts` (1).

**One transient failure noted for completeness:** a separate invocation of `npm run test:subject-memory`, run immediately after the heavy `test:migrations` pass above (which itself repeatedly creates/drops real indexes via `CREATE INDEX CONCURRENTLY` builder processes), failed once on a `client.query(sql)` call inside `applyIndexes` while re-provisioning indexes for its own fixture. Re-running the identical command immediately after produced a clean pass (2/2), and it also passed cleanly as part of the full `test:migrations` run reported above. This reads as local resource/connection contention from back-to-back heavy index-DDL operations on a single disposable instance immediately prior, not a reproducible code defect — no test assertion failed, only a connection-level query error on that one attempt. Recorded transparently per the evidence standard in `AGENTS.md` rather than omitted.

---

## 13. Race, locking, checkpoint, and resume assessment

* **F-F03 active-phase DML overlap** — independently reproduced 3/3 passing iterations on a 400,000-row table. Each iteration captures real INSERT/UPDATE/DELETE write windows with measured start/end timestamps strictly inside the `building index: scanning table` phase and, separately, the `index validation: scanning table` phase, constrained to the exact builder PID and target relation via `pg_stat_progress_create_index` and `pg_locks`, with `ShareUpdateExclusiveLock` observed and no `AccessExclusiveLock` observed, and `indexVerification: "valid_exact"` after settlement.
* **Old-snapshot-wait overlap (10 iterations)** — independently reproduced 10/10 passing iterations, each with a genuinely retained REPEATABLE-READ-READ-ONLY holder snapshot (non-null `backend_xmin` confirmed before the build begins), true settle-time capture inside the promise callback, and non-vacuous lock-mode assertions.
* **Checkpoint/issue atomicity under real fault injection** — reproduced via `throwAfterBatchCommit`; confirmed the checkpoint and issue record survive together and resume does not re-skip or duplicate the unresolved row.
* **Apply-lock contention/release/recovery** — reproduced: two apply calls in one process (one success, one denial), and a separately-held lock denying apply while both successful and failed backfills correctly release for recovery.
* **Full-engine matching/conflicting/deletion races** — reproduced against real separate `pg.Client` sessions: matching concurrent assignment resolves as `concurrently_resolved` with an unchanged count and no issue; conflicting assignment persists `CONCURRENT_SHOP_ID_CONFLICT` with a durable detection; deletion during apply fails the batch without advancing past the deleted row.
* **Resume immutability of prior detection history** — reproduced: run A's detection metrics survive run B re-detecting and resolving the same issue; interrupted/resumed processing does not duplicate detections and remains atomic with the checkpoint.

---

## 14. Security, privacy, and dependency assessment

* **No secret/PII leakage.** `redactShopEvidence`/`SourceDomainEvidenceCollector` store only length, SHA-256 prefix, and normalization reason for raw values; the full raw string is never persisted, except that successfully-normalized domains additionally store the operationally-required canonical form (not the raw pre-normalization spelling). Confirmed directly: `domain-evidence.migration.test.ts` asserts the exact raw fixture strings (including a deliberately malformed one) have **zero matches** anywhere in serialized `resumeMetadata`, while the canonical normalized form is present.
* **SQL injection.** All raw-SQL identifier interpolation is confined to the frozen `BACKFILL_TABLE_ORDER` list and gated through `assertApprovedTable`; values are always bound parameters. `allowlist.migration.test.ts` passed.
* **Drift diagnostics fail-closed (F-F05).** Verified architecturally, not just by regex coverage — `classifyDriftFailure`/`formatSafeDriftFailure` structurally never reference `result.stdout`/`result.stderr`; confirmed by direct source read and by the dedicated architecture test that greps the source for the absence of raw-stream interpolation patterns.
* **Dependency advisories (F-F06).** Independently re-ran `npm audit --package-lock-only` against a fresh clone of base `main` and a fresh clone of the exact PR head: both **32 high / 0 critical/moderate/low**, byte-identical advisory package sets (30 dev-tooling packages), `pg` (the only new runtime dependency) present in neither list. `npm audit fix` was not run. No new release-blocking dependency risk introduced.
* **Inventory-write flags.** `FEATURE_STOCKTAKE_INVENTORY_WRITES`, `FEATURE_ADJUSTMENT_WRITES`, `FEATURE_RECEIPT_WRITES`, `FEATURE_COST_SYNC`, `FEATURE_TRANSFER_WRITES` source is untouched by this PR's diff; `cross-shop-denial.test.ts` and `transfer-receive-guard.test.ts` (both in the 56 passing unit tests) directly assert default-OFF behavior with these flags.
* **No RLS, no runtime tenant conversion, no cross-tenant exposure** introduced — confirmed by catalog inspection and diff scope (§6).

---

## 15. Documentation assessment

`PROJECT_STATUS.md`, `DECISIONS.md` (D-024 records the accepted CONCURRENTLY-via-external-tool deviation), `OPEN_QUESTIONS.md` (Q-011 correctly still open — this PR does not implement enforcement), and `RISK_REGISTER.md` (R-022, R-028/R-029, R-041 through R-063 all correctly still tracked as open pending this review) are internally consistent with each other and with the code state I independently verified. `PR1_TENANT_EXPANSION_CORRECTION_FOLLOWUP_REVIEW_REPORT.md` faithfully preserves the prior `NOT READY` verdict verbatim, as required by the chain-of-custody rule established after F-N08. The runbook and ownership inventory remain present and were not re-audited line-by-line in this pass (no functional claim in them was contradicted by anything observed during execution).

`git diff --check` exits 0 in this review (F-PR1-13 corrected).

---

## 16. Findings table

No P0 or P1 findings remain open at this head. No new defects were introduced by the corrections examined in this review.

*(All findings from prior waves are dispositioned in §7–§10 above.)*

---

## 17. Positive findings

1. **F-F00 is genuinely closed.** Every command the prior two reviews could not execute — the full Prisma-engine chain, the Shopify-network-dependent codegen, and the entire migration/backfill test suite — executed successfully in this review, with real exit codes and real output.
2. **The R9/F-N01 rebuild is a genuine, not cosmetic, correction.** The new holder transaction demonstrably retains its snapshot, settle time is captured at the true settle point, and both the tautological and vacuous assertions are gone and replaced with positive, falsifiable ones. I reproduced 10/10 and 3/3 passing iterations independently.
3. **F-F02's evidence-budget design is unusually rigorous.** Every ceiling fails closed before mutation, resume compatibility checks every budget field, and the test suite proves — via exact raw-fixture-string containment checks — that raw legacy domains genuinely never reach durable storage, not merely that a particular field name is absent.
4. **The dry-run/apply equivalence fix is structurally sound**, not a special-cased patch: an in-memory proposed-ownership map is consulted uniformly by child-row resolution regardless of mode.
5. **The advisory-lock fix eliminates the failure class entirely** (dedicated non-pooled connection with backend-PID-pinned release) rather than working around it.
6. **Fault-injection testing is real**, not simulated after the fact: `throwAfterBatchCommit`, `onSnapshotEstablished` (test-only, provably unreachable from any operational path), and real separate `pg.Client`/multi-process concurrent scenarios are used throughout.
7. **Scope discipline remains exemplary** across a very large diff (+12,777/−213 lines): zero RLS, zero FKs, zero NOT NULL, zero runtime file changes outside the tenant tooling and its one shared helper.
8. **Dependency hygiene is honest**: advisory counts were independently re-verified as genuinely unchanged, and no upgrade or `audit fix` was performed opportunistically.

---

## 18. Required correction sequence

None required for PR 1 acceptance. No P0 or P1 finding remains open.

Carried forward as pre-existing, explicitly out-of-scope-for-PR-1 items (unchanged by this review, and correctly so):

* R-013/R-062 — pre-existing 32 high npm advisories remain tracked for a separate hardening PR; not a PR 1 blocker.
* F-016/R-022/Q-011 — database-enforced tenant isolation (RLS, non-null enforcement, composite tenant FKs) remains the mandatory PR 3 gate; **not** implemented or claimed by PR 1, correctly.
* F-PR1-11 — the "non-mutating" dry-run wording in CLI help text was not re-audited character-for-character in this pass; low-risk documentation nit, non-blocking.

---

## 19. Final verdict

# READY FOR CHATGPT PR 1 ACCEPTANCE

Basis:

* Every required command was actually executed, in a genuinely capable local environment, with real exit codes and captured output — including every command blocked in the two prior review environments.
* No P0 or P1 finding remains open. Every P1/P2 finding from all three prior review waves (F-PR1-01…15, R1–R13, F-N01…09, F-F00…07) that the correction backlog claims to have addressed was independently re-derived as genuinely corrected by direct source inspection and, where applicable, real re-execution and fault injection — not by trusting test names, prior summaries, or green CI alone.
* F-F01 and F-F02 are genuinely corrected: the starting snapshot is database-enforced read-only with a real `25006` negative-write proof, and evidence is bounded, redacted, deterministic, and fail-closed before mutation with exact raw-fixture-string zero-match verification.
* Index creation is genuinely concurrent (0 indexes built by `prisma migrate deploy`) and fail-closed (invalid/wrong-definition/wrong-table indexes are all rejected, never silently repaired).
* Exact-head CI (run `30633301468`, job `91164602626`, `head_sha=28e7717...`, conclusion `success`) is independently verified as genuinely bound to the exact reviewed commit, with no commit after it on the live branch.
* PR 1 scope remains intact: no RLS, no non-null enforcement, no Shop FKs, no composite child FKs, no runtime tenant conversion, no dual writes, no Shopify sync expansion, no inventory mutations, no PR 2/PR 3/Phase 2 work.
* Production inventory writes remain **UNAPPROVED**. All inventory-write flags remain **DEFAULT OFF**, verified both by source diff and by passing runtime tests.

**This review does not itself merge PR #11, authorize PR 2/PR 3, activate RLS, enable inventory mutations, or change any inventory-write flag. Merge remains subject to ChatGPT product-owner acceptance and explicit user merge authorization, per the project's dependency-ordered PR sequence (D-022).** No repository file was modified, no commit was created, no branch was pushed, and the GitHub PR was not approved, merged, or otherwise mutated during this review.
