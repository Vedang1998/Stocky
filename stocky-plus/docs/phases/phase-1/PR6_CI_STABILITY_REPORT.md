# Phase 1 PR6 CI stability — implementation report

Status: **TOOLING IMPLEMENTED / EXACT-HEAD CI AND INDEPENDENT REVIEW PENDING**.
This report does not claim ChatGPT acceptance, independent review, READY-FOR-MERGE,
or merge authorization. It does not invent this commit’s SHA or a GitHub PR number.

Authority: ChatGPT disposition on PR #40 comment
[5649645610](https://github.com/Vedang1998/Stocky/pull/40#issuecomment-5649645610)
(2026-09-13). One new Cursor tooling lane, separate from B/C.

## 1. Frozen identities

| Item | Value |
| --- | --- |
| Role | Cursor — tooling/pr6-ci-stability only |
| Branch | `tooling/pr6-ci-stability` (created from exact M; not from B or C) |
| Exact M / `origin/main` at start | `bdbb5bba91ac8af82e49a99e36cce5db8b401c68` |
| C PR | #40 remains OPEN / DRAFT / UNMERGED — **not edited** |
| C live head named in the disposition | `4a5fc80417f90c80f6e310428a6ce0d0036f9d93` |
| C in-progress exact-head run | `34726234237` — **left alone** (not cancelled, not retriggered) |
| B PR | #39 — **not edited** |
| B pin (read-only) | `610ed0503a3aa2998aca7228f4fca9617bed23a3` |
| B later review head (read-only) | `57bebc6b141e1f5290bbeee6fa75557238cc96f4` |
| D-054 | remains authority |
| D-055 | **not created** |
| R-176 | remains OPEN/P0 |
| R-164 | unchanged |
| R-124 | **not reopened** (F-CLAUDE-D051-03 / F-CLAUDE-PR4ACC-04 is distinct F-F03 tooling debt) |

Production, merchant data, deployment, Shopify writes, inventory writes, scope/flag
changes, and D runtime remain unauthorized. This patch is **not** cherry-picked into
PR #39 or PR #40.

## 2. Shared Heavy 70-minute cancellation (not an applicator defect)

Exact-head `gh run view` metadata, fetched 2026-09-13:

| Run | Head | Event | Heavy job | Heavy wall | Conclusion |
| --- | --- | --- | --- | --- | --- |
| `34714619941` | C `e5af049459992f3c6a5c32b799dca00d1279020e` | `pull_request` | `103609595251` started `2026-09-12T22:19:23Z` completed `2026-09-12T23:29:45Z` | **70m22s** | Heavy `cancelled`; Classify `103609574612` SUCCESS; CI Gate `103638944625` FAIL (`validate_result=cancelled`) |
| `34722422036` | B `57bebc6b141e1f5290bbeee6fa75557238cc96f4` | `pull_request` | `103630630199` started `2026-09-12T22:19:31Z` completed `2026-09-12T23:29:58Z` | **70m27s** | Heavy `cancelled`; Classify SUCCESS; CI Gate FAIL |
| `34670954315` | C `b0b7f5825601e7f66e2547739cb0ff304697b83e` | `pull_request` | `103492147143` started `2026-09-12T03:39:58Z` completed `2026-09-12T04:36:12Z` | **56m14s** | Heavy SUCCESS; full run SUCCESS |

`.github/workflows/ci.yml` already documented the earlier 45→70 raise (cancel during
`test:migrations` on tip `314981e`). The 2026-09-12 cancellations hit the 70-minute
job cap with `test:migrations` still incomplete. Last complete comparable Heavy was
~56m14s, so 90 minutes is about 20 minutes of slack versus 70 and about 34 minutes
versus that last complete Heavy.

**90 minutes is a bounded cancellation guard, not a changed application performance
SLA, and does not dispose F-F03.**

Classify remains `timeout-minutes: 10`. CI Gate remains `timeout-minutes: 5`.
No classifier, trigger, concurrency, continue-on-error, sharding, or CI Gate logic
changes.

## 3. F-F03 root cause (demonstrated; not excused by the timeout)

Canonical requirements (unchanged):

- D-024: compatibility indexes via `CREATE INDEX CONCURRENTLY` in external tooling,
  not ordinary `CREATE INDEX` inside Prisma migrate.
- F-F03 (`PR1_TENANT_EXPANSION_CORRECTION_IMPLEMENTATION_REPORT.md`): DML during
  PostgreSQL 16 phases `building index: scanning table` and
  `index validation: scanning table`, with builder-PID observation,
  `ShareUpdateExclusiveLock`, no `AccessExclusiveLock`, settlement-before-complete,
  and `valid_exact`. Old-snapshot-wait ≥10 iterations retained.
- F-CLAUDE-D051-03 / F-CLAUDE-PR4ACC-04: harness observability race
  (`expect(buildSettled).toBe(false)` received `true` when the scan finished before
  the observer sampled the active phase). Recommended retry of phase observation or
  deterministic wait-for-writers **without dropping active-phase coverage**.

Exact failing evidence from cancelled run `34714619941` job `103609595251` step
`Migration and tenant-backfill tests` at `2026-09-12T23:15:23Z` (not inferred):

- Iteration 1 logged `tenant_index_active_phase_write_evidence` with
  `buildDurationMs: 184.368583` and both required phase names.
- Iteration 2 failed `expected true to be false // Object.is equality`
  (`expect(buildSettled).toBe(false)`).
- File result: `13 tests | 1 failed` on F-F03.

### 3.1 Fixture defect (all-NULL `shopId`)

`clientPopulateSuppliers` on M omitted `"shopId"`, so `Supplier_shopId_idx` was an
all-NULL btree. Scratch table `ff03_repro` (400,000 rows, disposable local
PostgreSQL 16, `max_parallel_maintenance_workers=0`, `maintenance_work_mem='1MB'`),
measured 2026-09-13 in this environment:

| Fixture | CIC wall | `nulls` | `distinct_ids` |
| --- | --- | --- | --- |
| all-NULL `shop_id` | **116.760 ms** | 400000 | 0 |
| distinct `shop_id` | **219.585 ms** | 0 | 400000 |
| collapsed identical key | **147.563 ms** | 0 | 1 |

Distinct non-null `shopId` is necessary (stops the all-NULL trivial btree that
matched the 184 ms CI iteration) and is now fail-closed in the harness
(`n === 400000`, `nulls === 0`, `distinct_ids === 400000`). It is **not** sufficient
to make the scan last seconds on SSD. Active-phase proof still depends on writer
gates plus a bounded observer-miss retry.

### 3.2 Observability race (D051-compatible)

`buildSettled === true` during DML still means the concurrent build completed
before the poll loop sampled the target **active** phase. That remains an
observer miss, not proof that DML blocked or that `AccessExclusiveLock` was taken.

This lane:

- Retries **only** `ActivePhaseMissedError` (settled before/during the required
  active phase).
- Does **not** retry wait timeouts, `AccessExclusiveLock` presence, write-threshold
  violations, or `valid_exact` failures.
- Does **not** skip, delete, or weaken F-F03.
- Does **not** replace active-phase proof with only `waiting for writers`.
- Does **not** change `scripts/tenant-indexes/apply.ts` or any production index tool.

`CONCURRENT_WRITE_THRESHOLD_MS` remains **15_000**.
`FF03_REQUIRED_ITERATIONS` remains **3**.
Old-snapshot-wait remains **10** iterations.

Miss budget: `FF03_MAX_ATTEMPTS = 12` (observer misses only). Exhausting 12 attempts
without 3 successful active-phase iterations still fails the test.

## 4. Allowed-scope changes

| Path | Change |
| --- | --- |
| `.github/workflows/ci.yml` | Validate job `timeout-minutes` 70 → **90**, with measured-run comments. |
| `stocky-plus/scripts/tenant-indexes/tests/indexes.migration.test.ts` | Distinct non-null populate; fixture contract tests; observer-miss retry; attempt-unique probe IDs; cancel leftover CIC on miss. |
| `stocky-plus/docs/phases/phase-1/PR2_TENANT_ACCESS_INVENTORY.md` | Mechanical line-number / content-digest refresh for the test file only (`npm run tenant:access:inventory`). |
| `stocky-plus/docs/phases/phase-1/PR6_CI_STABILITY_REPORT.md` | This report. |

## 5. Explicitly not changed

- PR #39 / PR #40 source, tests, or reports
- `scripts/tenant-indexes/apply.ts` and other production index tools
- Prisma schema / migrations
- CI classifier, triggers, Gate script, continue-on-error, sharding
- Dependencies, feature flags, Shopify scopes
- Shared control docs (`PROJECT_STATUS.md`, `DECISIONS.md`, `RISK_REGISTER.md`)
- D runtime

## 6. Local evidence (disposable PostgreSQL 16, localhost, user `stocky`)

Environment: Node `v22.14.0`. `DATABASE_URL` / `TENANT_MAINTENANCE_DATABASE_URL` set
to local `stocky_plus` (credentials not recorded).

### 6.1 Positive — F-F03 overlap (required 3 iterations)

Command (exact, five serial invocations after one warmup run):

```
npm run test:migrations -- scripts/tenant-indexes/tests/indexes.migration.test.ts -t "DML overlaps active build-scan"
```

| Run | Exit | Tests | Successful iterations | Missed attempts | Wall |
| --- | --- | --- | --- | --- | --- |
| 1 | 0 | 1 passed / 14 skipped (15) | 3/3 | [] | 7.33s file / 5.605s test |
| 2 | 0 | 1 passed / 14 skipped (15) | 3/3 | [] | 7.48s / 5.811s |
| 3 | 0 | 1 passed / 14 skipped (15) | 3/3 | [] | (serial; EXIT=0) |
| 4 | 0 | 1 passed / 14 skipped (15) | 3/3 | [] | 7.61s / 5.901s |
| 5 | 0 | 1 passed / 14 skipped (15) | 3/3 | [] | 7.52s / 5.827s |

Every successful iteration logged both `building index: scanning table` and
`index validation: scanning table`, `ShareUpdateExclusiveLock` only (no
`AccessExclusiveLock`), three insert/update/delete windows per phase, all
`durationMs` well under 15_000 (observed 0.5–3.4 ms), and `indexVerification:
valid_exact`. `writeThresholdMs` in evidence remains 15000.

### 6.2 Positive / negative / bypass — fixture contract

Command:

```
npm run test:migrations -- scripts/tenant-indexes/tests/indexes.migration.test.ts -t "F-F03 observer-miss|F-F03 fixture contract"
```

Exit 0. **2 passed / 13 skipped (15)** in 3.70s.

- Positive: 50-row distinct populate → `n=50`, `nulls=0`, `distinct_ids=50`.
- Negative: all-NULL populate → `nulls=50`, `distinct_ids=0`; the F-F03 predicates
  `nulls === 0 && distinct_ids === n` are false.
- Bypass: collapsed identical `shopId` → `nulls=0`, `distinct_ids=1`, which is not
  equal to `n`.
- Discriminator: `ActivePhaseMissedError` is distinct from a wait-timeout `Error`
  so timeouts are not retried.

### 6.3 Drift — full tenant-index migration file (old-snapshot-wait retained)

Command:

```
npm run test:migrations -- scripts/tenant-indexes/tests/indexes.migration.test.ts
```

Exit 0. **15 passed (15)** in 30.45s. Includes 10/10 REPEATABLE READ old-snapshot-wait
iterations (`waiting for old snapshots`, `ShareUpdateExclusiveLock`, no
`AccessExclusiveLock`, `valid_exact`) plus F-F03 3/3 and the fixture contract.

### 6.4 Other local checks

| Check | Result |
| --- | --- |
| `npx eslint scripts/tenant-indexes/tests/indexes.migration.test.ts` | exit 0 |
| `npm run tenant:access:inventory:check` | exit 0 after mechanical regen |
| `git diff --check` | exit 0 |
| Scratch CIC timing | `/opt/cursor/artifacts/ff03_scratch_cic_timing.json` |
| Full file log | `/opt/cursor/artifacts/indexes-migration-full.log` |

A name filter that matches nothing was not used. Focused commands executed nonzero
tests (2, then 1×5, then 15).

## 7. What this does **not** prove

- Exact-head GitHub Actions on this tooling branch (not yet run at report write time).
- That B or C would go green if this patch were cherry-picked (cherry-pick is
  **not authorized**).
- That 90 minutes is an application SLA.
- Independent Claude review.
- Merge authorization.

B’s technical acceptance of unchanged reader code remains as previously recorded;
B’s final exact-head CI is still not green. C’s in-progress run `34726234237` was
not touched.

## 8. Residual / follow-up

Final tooling merge consideration still requires:

1. Successful exact-head full CI on this branch.
2. Independent Claude review of the exact implementation head.
3. ChatGPT technical acceptance.
4. Explicit user merge authorization.

If a later exact-head run still cannot collect 3 real active-phase successes
without changing production index tooling, stop and report; do not weaken
assertions to obtain green.
