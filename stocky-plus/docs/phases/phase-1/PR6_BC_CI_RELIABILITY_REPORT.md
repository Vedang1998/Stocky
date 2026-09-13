# PR6 B/C — CI budget and F-F03 harness reliability

Status: **TOOLING IMPLEMENTATION COMPLETE / INDEPENDENT TOOLING REVIEW PENDING**.
This is a shared ancillary tooling correction. It is **not** PR6-B or PR6-C
product acceptance, not D-055, and not merge authority. Exact-head
`pull_request` Classify + full Heavy + CI Gate IDs are recorded on the tooling
PR after the review push; this file does not invent those IDs or this commit’s
own SHA.

Preserve **D-054**. Do **not** create **D-055**.

## 1. Authority

| Item | Value |
| --- | --- |
| Role | Cursor — dedicated shared CI/test-harness chat |
| Work order | ChatGPT PR6 B/C bounded Heavy budget + F-F03 harness repair |
| Required starting main | `bdbb5bba91ac8af82e49a99e36cce5db8b401c68` |
| Live `origin/main` at implementation | `bdbb5bba91ac8af82e49a99e36cce5db8b401c68` (equal) |
| Branch | `tooling/pr6-bc-ci-reliability` (created from that SHA; did not already exist) |
| Draft PR | Opened against `main` from this branch. GitHub assigns the number. |
| B / PR #39 pin (read-only) | `57bebc6b141e1f5290bbeee6fa75557238cc96f4` |
| C / PR #40 pin (read-only) | `4a5fc80417f90c80f6e310428a6ce0d0036f9d93` |
| C failed evidence head | `e5af049459992f3c6a5c32b799dca00d1279020e` |
| D-054 | **EFFECTIVE** — unchanged |
| D-055 | **NOT CREATED** |

This lane does **not** authorize B/C product edits, application/runtime code,
schema, migrations, roles/grants, Shopify calls, inventory-write flags,
`workflow_dispatch`, cancel/rerun of existing B/C jobs, sharding, test skip or
retry-to-green, mark-ready, or merge.

## 2. Peer movement (reported, not incorporated)

Live fetch of `origin/main`, `phase-1/pr6-b-order-admin-read`, and
`phase-1/pr6-c-order-fact-applicator` on 2026-09-13:

- PR #39 head still `57bebc6b141e1f5290bbeee6fa75557238cc96f4` (matches pin).
- PR #40 head still `4a5fc80417f90c80f6e310428a6ce0d0036f9d93` (matches pin).
- C commits after the failed evidence head, **not** taken into this branch:

  - `5e8fbd2` Fix PR6-C Heavy-budget leaks in skipped 1e6 setup and process-loss parks.
  - `bc149a0` Record exact-head CI run 34714619941 cancelled at the 70-minute Heavy cap.
  - `4a5fc80` Use arrow functions for 1e6 helpers nested inside the skipped envelope it.

`indexes.migration.test.ts` blob `db25d5556af25d3eb231587901f3753e0cfc0d98` is
**identical** on main, B pin, C pin, and C failed evidence head. `.github/workflows/ci.yml`
Heavy timeout is **70** on all three peer trees. This patch is therefore a
shared-main correction, not a silent B/C rewrite.

C subsequent exact-head PR CI on `4a5fc804…` run `34726234237` concluded
**SUCCESS** (Heavy `103640772167` ~60m51s). That later green is **not** an
F-F03 harness fix. The failed-head assertion on `e5af049…` remains a recorded
failure. Lucky later schedule ≠ repaired observation.

## 3. Gate 1 — two CI failures (distinct causes)

### 3.1 C run `34714619941` (assertion **and** budget)

| Field | Observed |
| --- | --- |
| URL | https://github.com/Vedang1998/Stocky/actions/runs/34714619941 |
| Event | `pull_request` |
| Attempt | 1 |
| Head | `e5af049459992f3c6a5c32b799dca00d1279020e` |
| Run created | `2026-09-12T19:35:36Z` |
| Run conclusion | `cancelled` |
| Classify `103609574612` | SUCCESS `19:36:01Z`–`19:36:07Z` |
| Heavy `103609595251` | started `22:19:23Z`, completed `23:29:45Z`, conclusion **cancelled** |
| Queue vs execute | ~2h44m queued; ~70m22s executing |
| CI Gate `103638944625` | FAIL (`validate_result=cancelled`) |

Heavy wall matches `timeout-minutes: 70`. Log line
`2026-09-12T23:29:36.0408218Z ##[error]The operation was canceled.`
while `test:migrations` was still running (subject-memory and detection-history
had just passed at `23:29:23Z` / `23:29:32Z`).

**Separate assertion failure (not erased by later cancellation):**

- Test: `DML overlaps active build-scan and validation-scan phases (F-F03), 3 iterations`
- File: `stocky-plus/scripts/tenant-indexes/tests/indexes.migration.test.ts`
- Compact Vitest line at `2026-09-12T23:15:25.6006824Z`:
  `expected true to be false // Object.is equality`
- Duration of that test: **8092ms**, then marked failed.
- Iteration 1 had already emitted
  `tenant_index_active_phase_write_evidence` at `23:15:23.1036604Z` with
  `buildDurationMs: 184.368583`, both scan phases, `ShareUpdateExclusiveLock`,
  INSERT/UPDATE/DELETE DML ~0.6–3.6ms, `indexVerification: valid_exact`.
- No iteration 2 or 3 evidence events. Failure is therefore **iteration 2+**.
- The only `expect(buildSettled).toBe(false)` sites in that blob are
  `timedWritesDuringPhase` at lines **807** (before each write) and **811**
  (after `await writer.query`). Combined with iter-1 success, the demonstrated
  failure is line **811**: Node processed CIC `.then` settlement during/after a
  later write `await`.
- Vitest continued the aggregate `test:migrations` file set after the failure.
  Gate cancel does **not** retract this assertion.

RR overlap (10 iterations) on the same C job **passed** immediately before
F-F03 (`waiting for old snapshots` + `ShareUpdateExclusiveLock`). That is a
different proof (R-059 retained old-snapshot-wait). It is not F-F03 coverage.

### 3.2 B run `34722422036` (budget only)

| Field | Observed |
| --- | --- |
| URL | https://github.com/Vedang1998/Stocky/actions/runs/34722422036 |
| Event | `pull_request` |
| Attempt | 1 |
| Head | `57bebc6b141e1f5290bbeee6fa75557238cc96f4` |
| Run created | `2026-09-12T22:19:20Z` |
| Run conclusion | `cancelled` |
| Classify `103630612412` | SUCCESS `22:19:23Z`–`22:19:29Z` |
| Heavy `103630630199` | started `22:19:31Z`, completed `23:29:58Z`, conclusion **cancelled** |
| Queue vs execute | essentially no queue; ~70m27s executing |
| CI Gate `103638964261` | FAIL (`validate_result=cancelled`) |

F-F03 on this job **passed** (`13/13` in `indexes.migration.test.ts`, F-F03
**9006ms** at `23:13:07Z`). Cancel at `23:29:44.6359479Z` still inside later
`test:migrations`. Root cause for B: **job budget only**.

### 3.3 Baseline timings (not substitutes for failed-head evidence)

| Run | Head | Heavy | Duration | Outcome |
| --- | --- | --- | --- | --- |
| `34642536795` `push` (exact main) | `bdbb5bba…` | `103405514450` | `20:07:43Z`–`21:07:55Z` (~60m12s) | SUCCESS |
| `34726234237` PR #40 later | `4a5fc804…` | `103640772167` | `23:45:49Z`–`00:46:40Z` (~60m51s) | SUCCESS |
| `34714619941` PR #40 failed evidence | `e5af049…` | `103609595251` | ~70m22s then cancel during migrations | cancelled + F-F03 fail |
| `34722422036` PR #39 | `57bebc6b…` | `103630630199` | ~70m27s then cancel during migrations | cancelled; F-F03 passed |

70 minutes is inside the observed successful Heavy band (~60–61m) with almost
no headroom once `test:migrations` is still running. Failed B/C jobs were
cancelled **while that corpus was incomplete**. Raising the cap does not prove
F-F03; it only stops a budget cancel from masquerading as suite completion.

## 4. Gate 2 — workflow before/after

Authorized scalar only:

```diff
-    timeout-minutes: 70
+    timeout-minutes: 120
```

Mechanical verification:

- Classify job remains `timeout-minutes: 10`.
- CI Gate remains `timeout-minutes: 5`.
- `git diff` on `.github/workflows/ci.yml` is **one line**.
- Unchanged: triggers (`push` main, `pull_request` main, `workflow_dispatch`
  escape hatch unused here), permissions, concurrency group,
  `cancel-in-progress`, classifier script, fail-closed docs-only allowlist,
  Heavy services (PostgreSQL 16 + Redis 7), every `run:` command, required
  jobs, and Gate evaluation (`cancelled` validate still FAIL when
  `full_ci=true`).
- Classifier self-test: **40 assertions, 0 fail**, including
  `gate fails when full CI required but validate cancelled`.
- This mixed `.github` + `scripts/` + docs diff is **full_ci**, never docs-only.

Do not increase beyond 120 without another decision. C’s opt-in million-line
workload stays out of the default suite.

## 5. Gate 3 — F-F03 root cause and assertion matrix

### 5.1 Classification

**Test observation / Node scheduling race**, not a product or migration defect.

Production CIC SQL exercised by the test remains:

`CREATE INDEX CONCURRENTLY "Supplier_shopId_idx" ON "Supplier" ("shopId")`

which matches `scripts/tenant-indexes/apply.ts` `buildCreateStatement`.

Historical F-CLAUDE-D051-03 / R-051 / R-052 / R-059 remain relevant as
invariants (no tautological `buildSettled || true`, no empty locks, active
build/validation scans rather than old-snapshot-wait as F-F03 coverage). The
**2026-09-12 C failure mechanism is more specific than “poll missed the
phase”**:

1. Writer gates make **phase entry** deterministic.
2. Old harness treated first `pg_stat_progress_create_index` phase-text match
   as coverage, then took an extra `grantedTargetLocks()` round-trip, then
   awaited three DML statements, asserting `expect(buildSettled).toBe(false)`
   **after each `await writer.query`**.
3. `buildSettled` is a Node `.then` on the CIC query. If PostgreSQL finishes
   CIC while Node is awaiting a write, the microtask can run before the
   post-`await` assertion. The DML may still have overlapped the scan in
   PostgreSQL; the Node flag is no longer a contemporaneous overlap proof.
4. Iteration 1 on the failed C job produced full evidence (`buildDurationMs`
   184ms). Iteration 2 never emitted evidence. Cached subsequent CIC is
   faster → the extra lock RTT + three write awaits are enough for settlement
   to win the race.
5. A gate before phase entry is **not** proof a later write completed inside
   the active scan.

This is **not** classified as an index-runtime defect. No production
index-management or historical migration edit was required or performed.

### 5.2 Repair (test-local only)

Helpers live in the already-excepted file
`stocky-plus/scripts/tenant-indexes/tests/indexes.migration.test.ts`
(EX-IDX-014). They are **not** a new exact-path tenant-access exception.

- One observer round-trip: `pg_stat_activity` + `pg_stat_progress_create_index`
  + granted `Supplier` relation locks.
- `isActiveScanSample` requires exact target phase, nonempty
  `ShareUpdateExclusiveLock`, no `AccessExclusiveLock`, builder query still
  `CREATE INDEX CONCURRENTLY`, and **remaining scan work** (blocks or tuples).
  Phase-text-only samples, completed scans, waiting-for-writers, and
  waiting-for-old-snapshots are rejected.
- Remaining-work floor: at least 10% of `blocks_total` remaining (minimum 32
  blocks) so DML is not started on the last sliver of a scan.
- `burstRepresentativeSupplierDml` runs INSERT/UPDATE/DELETE from that sample
  with **no extra lock query** before the first write.
- After the burst, the test re-samples and requires the **same scan phase**,
  SHARE UPDATE EXCLUSIVE, and **strictly increasing** `blocks_done` (scan
  advanced during the write window).

`expect(buildSettled).toBe(false)` is retained **before** the burst and
**after** the burst, now paired with PostgreSQL remaining-work evidence. It is
not deleted, inverted, or replaced with `buildSettled \|\| true`.

### 5.3 Assertion-preservation matrix

| Invariant | Before (failed C blob) | After (this tooling patch) |
| --- | --- | --- |
| 3 iterations | yes | **preserved** |
| `ACTIVE_PHASE_ROW_COUNT` 400_000 | yes | **preserved** |
| DML latency `< 15_000ms` | yes | **preserved** |
| Build scan phase string | `building index: scanning table` | **preserved** |
| Validation scan phase string | `index validation: scanning table` | **preserved** |
| Writer gates (build + validation) | yes | **preserved** |
| `max_parallel_maintenance_workers=0` | yes | **preserved** |
| `maintenance_work_mem=1MB` | yes | **preserved** |
| Nonempty locks + `ShareUpdateExclusiveLock` | yes | **preserved** (sampled in the trigger round-trip) |
| Reject `AccessExclusiveLock` | yes | **preserved** |
| INSERT + UPDATE + DELETE | yes | **preserved** |
| `valid_exact` / `indisvalid` / `indisready` | yes | **preserved** |
| `buildSettled === false` during overlap | after each write `await` (Node race) | before burst **and** after burst, plus PG remaining-work |
| Write timestamps `< buildSettledAtNs` | yes | **preserved** (`startNs` and `endNs`) |
| Old-snapshot-wait as F-F03 coverage | no | **still rejected** |
| Empty lock array | rejected | **still rejected** |
| Tautology `buildSettled or true` | absent | **still absent** |
| Reduce iterations / skip phase / relax 15s | no | **not done** |
| Extra lock RTT after phase text before DML | yes (race window) | **removed** (combined sample is the trigger) |
| Remaining-work counters / after-burst phase | no | **added** (stronger overlap proof) |

RR 10-iteration old-snapshot-wait proof in the same file is **untouched**.

## 6. Local reproduction and repaired-run evidence

Environment (isolated, no merchant data, no production, no Shopify):

- PostgreSQL 16.15, database `stocky_plus_pr6bc_tooling` only
- Redis `127.0.0.1:6379`
- `INVENTORY_WRITE_*` flags **false**
- Node v22.14.0, 4 CPUs
- Commands from `stocky-plus/` with `TENANT_MAINTENANCE_DATABASE_URL` and
  `DATABASE_URL` aimed at the isolated local database named
  `stocky_plus_pr6bc_tooling` (no credentials recorded here)

### 6.1 Historical failure (CI, not re-injected)

C Heavy job log for `103609595251` (downloaded 2026-09-13): iteration 1
evidence + compact `expected true to be false` at `23:15:25Z`. No diagnostic
sleep was committed. The CI log **is** the reproduction of the Node
settlement race.

### 6.2 Helper unit tests

Command:

`npm run test:migrations -- scripts/tenant-indexes/tests/indexes.migration.test.ts -t "F-F03 active-scan overlap helper"`

Result: **7 passed / 7**, exit **0**, ~175ms. Coverage:

- positive in-progress scan + SHARE UPDATE EXCLUSIVE
- completed scan (`blocksDone == blocksTotal`) rejected
- waiting-for-writers / old-snapshot rejected
- empty locks and AccessExclusiveLock rejected (R-051/R-052 bypass)
- non-CIC builder query rejected
- phase-text-only (no remaining-work counters) rejected
- late scan with almost no remaining blocks rejected

### 6.3 Independent F-F03 runs (every attempt recorded; no retry-to-green)

Command:

`npm run test:migrations -- scripts/tenant-indexes/tests/indexes.migration.test.ts -t "DML overlaps active build-scan and validation-scan phases"`

| Batch | Runs | Each result | Wall |
| --- | --- | --- | --- |
| Pre-remaining-floor helper (idle host) | 6 | 1 passed / 12 skipped, exit 0 | 7–8s each |
| Tenant-indexes suite (includes F-F03, after floor) | 1 | F-F03 5026ms, file 13/13 | see §6.4 |
| Post-floor independent | 3 | 1 passed / 12 skipped, exit 0 | 11s, 8s, 7s |

**Zero local F-F03 failures after the harness change.** Pre-change idle-host
passes are **not** treated as proof the CI race is gone; they are recorded as
idle-host non-reproductions of the Node flag race.

Parsed overlap evidence (18 pre-floor iteration events + suite/post-floor
events): every iteration held

- `lockModes = ["ShareUpdateExclusiveLock"]`
- trigger and after-burst phase equal to the target scan
- `blocksTotal = 5324`, `blocksDone` **increased** during the burst
  (example: 94→974, 119→1459, 91→871, 79→946)
- DML durations ~0.5–3.5ms ≪ 15000
- `builderQueryPreview` starts with
  `CREATE INDEX CONCURRENTLY "Supplier_shopId_idx" ON "Supplier" ("shopId")`
- `indexVerification = valid_exact`
- phasesSeen includes writer-wait gates **and** both scan phases

`tuples_total` is 0 on this PostgreSQL 16 heap scan; **`blocks_*` is the
remaining-work signal**, as designed.

### 6.4 Full tenant-indexes file / drift / RR overlap

Command:

`npm run test:migrations -- scripts/tenant-indexes/tests`

Result: **7 files, 55 passed / 55**, exit **0**, **44.17s**.

Including:

- `indexes.migration.test.ts` **13/13** (28157ms), RR overlap **10/10**
  iterations with `waitingForOlderSnapshots: true` and DML < 15s
  (**distinct** from F-F03; preserved)
- `schema-drift.migration.test.ts` **3/3**
- classify / timeouts / maintenance-url / drift-redaction unit tests
- F-F03 helper unit tests **7/7** (same `indexes.migration.test.ts` file; **20/20** in that file)

### 6.7 Superseded tooling-PR CI (not a timeout, not F-F03)

Exact-head `pull_request` run `34790452855` on `5ec61bd3eb024cfa1e8e98cfe043d4b7c133676b`:

- Classify `103813562888` SUCCESS
- Heavy `103813576174` FAIL at step **Tenant enforcement preflight** (~3m wall, not the 70/120 budget)
- CI Gate `103813994120` FAIL (`validate_result=failure`)
- Preflight JSON: all 35 merchant tables `ok:true`;
  `globalFailures: ["tenant:access:inventory:check_failed_exit_1"]`

Cause: an earlier revision added new files under `scripts/tenant-indexes/tests/`
that are **not** on the exact-path `EX-IDX-*` allowlist, and the F-F03 edit
shifted line numbers of existing EX-IDX-014 findings, so
`PR2_TENANT_ACCESS_INVENTORY.md` was stale. This is a mechanical inventory
freshness failure, not an F-F03 overlap-proof failure and not a Heavy-budget
failure.

Correction (this head):

- Inline helpers and helper unit tests into `indexes.migration.test.ts`
  (already EX-IDX-014). **No new exception ID. Allowlist not broadened.**
- Mechanically regenerate `PR2_TENANT_ACCESS_INVENTORY.md` via
  `npm run tenant:access:inventory` (digest
  `8e9b1ed937ec4b23db9c78616ca0498e8e557c61fa1367fa2830c019fd8c190a`).
  Findings remain **1741**, scanned files **372**, violations **0**.
  Only EX-IDX-014 line numbers moved (`$executeRawUnsafe` 49–52→50–53,
  `new PrismaClient` 88→506, populate `$executeRawUnsafe` 969→1387).
- `npm run tenant:access:inventory:check` exit 0
- `npm run tenant:enforcement:inventory:check` exit 0 (unchanged)
- `npm run tenant:access:audit` → `tenant_access_audit_ok`

Run `34790452855` is **superseded failed evidence**, not the review head.

### 6.5 Classifier, lint, typecheck, build

| Command | Exit | Notes |
| --- | --- | --- |
| `bash .github/scripts/classify-ci-change-set.test.sh` | 0 | 40/40 |
| `npm run lint` | 0 | 15s |
| `npm run typecheck` | 0 | 10s |
| `npm run build` | 0 | 3s; pre-existing empty-chunk / future-flag warnings only |

`npm test` (app unit suite): **387 passed, 5 failed / 392**. The 5 failures are
`app/lib/catalog-facts/admin-read/bulk-query-schema.test.ts` because
`app/types/admin-2026-07.schema.json` is absent locally. This lane is
forbidden from Shopify/`graphql-codegen` network fetch. CI Heavy runs
`npm run graphql-codegen` before unit tests. **Not a regression of this
diff** (no `app/` or GraphQL files changed). Recorded as
environment-blocked local evidence, not as a harness defect.

### 6.6 Unexecuted locally (explicit)

- Full serial CI Heavy corpus (`npm run test:migrations` with every
  enforcement/PR5-F3 file plus all prior Heavy steps). Timing for the
  **index** corpus is §6.4. Aggregate Heavy timing is the exact-head CI
  obligation on this PR.
- Disposable B/C worktree execution of the patch. Blob identity shows the
  F-F03 file is shared; live B/C integration with this base remains a later
  explicit delta review + new exact-head CI, not a silent merge into #39/#40.
- `workflow_dispatch`, cancel/rerun of B/C jobs, production, Shopify.

## 7. Changed paths and scope

Allowed and used:

- `.github/workflows/ci.yml` — Heavy `timeout-minutes` 70→120 only
- `stocky-plus/scripts/tenant-indexes/tests/indexes.migration.test.ts` — F-F03
  harness + inlined helper/unit tests (EX-IDX-014)
- `stocky-plus/docs/phases/phase-1/PR2_TENANT_ACCESS_INVENTORY.md` —
  mechanical freshness regenerate only (line numbers / digest)
- `stocky-plus/docs/phases/phase-1/PR6_BC_CI_RELIABILITY_REPORT.md` — this file

Not edited: B/C branches, application, Prisma schema/migrations, roles,
lockfiles, Vitest global config, CI classifier, CI Gate logic, immutable
reviews, `PROJECT_STATUS.md`, inventory-write flags, tenant-access
**allowlist**.

`git diff --check` on the implementation tree: clean.

## 8. Residuals and stop condition

- Independent Claude **tooling** review is **pending**.
- Exact-head Classify + full Heavy + CI Gate SUCCESS for this PR is required
  and is recorded on the PR after the review push, not in a second docs
  commit.
- F-F03 is **not** declared resolved merely because a longer job can finish.
  Local remaining-work + lock + after-burst phase evidence is the harness
  claim. CI must still execute the repaired test at the exact head.
- B PR #39 and C PR #40 are **unchanged** by this task. Applying this patch
  there requires a later authorized integration, not this PR.
- Production, Shopify, write flags, and merge authority remain unchanged.

End of implementation record. Independent tooling review follows.
