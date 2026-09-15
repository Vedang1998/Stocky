# PR #40 / PR6-C — independent correction/evidence review on the updated head

**Reviewer:** Claude Code (independent adversarial reviewer; not an implementation owner)
**Review date:** 2026-09-13
**Scope:** continuation of the review recorded at blob `a90ae442a80ee593bb43bee3b15c2228f32d6e15`. This pass verifies the **delta from `e5af049…`**, not a restart of already-supported runtime analysis.
**Verdict:** `CORRECTIONS REQUIRED` — new findings **P0 0 / P1 0 / P2 1 / P3 4**, plus one standing external blocker (F-F03) that this head does not dispose.

This artifact is immutable and additive. The first-pass artifact was **not** edited — its blob is byte-identical on this head.

---

## 1. Reviewed identities

| Item | Value | Verified |
|---|---|---|
| Subject PR | #40 | OPEN / DRAFT / UNMERGED, `mergeable_state: clean` |
| Updated exact subject | `4a5fc80417f90c80f6e310428a6ce0d0036f9d93` | matches the pinned head; equals live PR head; no later push |
| Base **M** | `bdbb5bba91ac8af82e49a99e36cce5db8b401c68` | unchanged |
| Scope vs M | **21 ahead / 0 behind, 34 changed paths** | 18126 additions / 2 deletions |
| Prior review head | `04a3e276…` (first pass) | my artifact merged at `1f61e33`, unedited since |
| Delta baseline | `e5af049459992f3c6a5c32b799dca00d1279020e` | 3 commits, 4 files, +76 / −33 |

### 1.1 Delta under review (`e5af049..4a5fc80`)

| Commit | Subject |
|---|---|
| `5e8fbd2` | Fix PR6-C Heavy-budget leaks in skipped 1e6 setup and process-loss parks |
| `bc149a0` | Record exact-head CI run 34714619941 cancelled at the 70-minute Heavy cap |
| `4a5fc80` | Use arrow functions for 1e6 helpers nested inside the skipped envelope it |

Files touched: `pr6-c-scale-envelope.test.ts`, `pr6-c-process-loss.test.ts`, `pr6-c-process-loss-child.ts`, `PR6_C_APPLICATOR_IMPLEMENTATION_REPORT.md`. No application code under `app/lib/order-facts/apply/**` changed in this delta — confirmed by `git diff --name-only`.

---

## 2. Exact-head CI — now SUCCESS (executed, not pending)

Run **[34726234237](https://github.com/Vedang1998/Stocky/actions/runs/34726234237)** `event=pull_request` `head_sha=4a5fc80417f90c80f6e310428a6ce0d0036f9d93`.

| Check | Job | Result |
|---|---|---|
| Classify change set | `103640753944` | SUCCESS |
| Lint, typecheck, test, build, Prisma, GraphQL | `103640772167` | **SUCCESS** — 146 steps executed, not SKIPPED |
| CI Gate | `103647784676` | SUCCESS |

Aggregate `test:migrations` in that job: **66 files, 603 passed / 1 skipped (604)**, 1167.78 s.

This supersedes the cancelled run on `e5af049…` that the report and PR body still cite. **No approval is issued against `e5af049…`,** and this result is recorded as a completed fact, not an assumed pass.

### 2.1 Superseded run `34714619941` (`e5af049…`) — attribution confirmed accurate

| Check | Job | Result |
|---|---|---|
| Classify | `103609574612` | SUCCESS |
| Heavy | `103609595251` | **CANCELLED** at `timeout-minutes: 70` (~70m22s) |
| CI Gate | `103638944625` | **FAIL** (`validate_result=cancelled`) |

The report's characterisation of this run is accurate. One nuance it understates: F-F03 had **already failed** inside that job before the cancellation, so even without the timeout that corpus would have exited non-zero. "Not the Gate cause" is literally true for that run; "would not have been green anyway" is also true.

---

## 3. The four specific verification items

### 3.1 Skipped scale testing performs no database setup — **VERIFIED PASS**

Structurally, `resetSchemaAndApplyEnforcement()` moved out of a `describe.skipIf` `beforeAll` and into the body of `it.skipIf(!runEnvelope)`. A skipped `it` body never executes, so the guarantee no longer depends on Vitest's suite-skip hook semantics.

**Independent proof.** I ran the file with **no PostgreSQL process in existence** and `DATABASE_URL` pointed at a dead port (`127.0.0.1:59999`):

```
✓ scripts/tenant-enforcement/tests/pr6-c-scale-envelope.test.ts (3 tests | 1 skipped) 4ms
  Test Files  1 passed (1)   Tests  2 passed | 1 skipped (3)
```

A `resetSchemaAndApplyEnforcement()` would have thrown `ECONNREFUSED`. It passed. Confirmed again against a live database (3 ms) and in green CI (3 ms).

**However — the premise of the fix is not supported.** I ran the **pre-fix** (`e5af049`) version of the same file under the identical no-database conditions:

```
Test Files  1 passed (1)   Tests  1 passed | 1 skipped (2)   Duration 965ms (tests 4ms)
```

The old form also performed no database setup: Vitest does not run `beforeAll` hooks of a skipped `describe.skipIf` suite. The cancelled run's own log corroborates this — it recorded the pre-fix file at **2 ms**. See F-CR-01.

### 3.2 Bounded process-loss park preserves the required schedules — **VERIFIED PASS**

The child park after `applied`/`committed` went 120 s → 30 s; `waitExit` went 8 s → 2 s.

Schedule analysis against the parent:

| Property | Value | Consequence |
|---|---|---|
| Parent `waitForStage(statusPath, ["applied"], 20_000)` | 20 s ceiling, 25 ms poll | detection is effectively immediate; **20 s < 30 s park**, 10 s margin at the worst case |
| `waitForStage` on timeout | **throws** | a missed kill fails the test loudly; it cannot pass for the wrong reason |
| Steps between detection and `killChild` | two `expect` calls | sub-millisecond |
| `waitExit` 2 s | not the lock-release guarantee | `reapAbandonedBackend` (`pg_terminate_backend` + 5 s poll) is, and is **unchanged** |

**Independently executed** on disposable PostgreSQL 16.13 as `stocky_runtime` with full enforcement applied:

```
✓ scripts/tenant-enforcement/tests/pr6-c-process-loss.test.ts (8 tests) 10187ms
  ✓ process SIGKILL before COMMIT leaves 0 facts; retry then applies once   759ms
  ✓ process SIGKILL after COMMIT before app ack keeps facts+receipt         646ms
  ✓ uncertain COMMIT retries safely to exactly one fact+receipt             619ms
  Test Files  1 passed (1)   Tests  8 passed (8)
```

The kill-before-commit case completes in **759 ms** against a 30 s park — roughly a 40× margin. The schedules are preserved. Green CI agrees (8 tests, 11 253 ms).

### 3.3 Previous million-line evidence remains accurately attributed — **MOSTLY; one stale figure**

The narrative attribution is accurate and properly caveated. §6.2 is headed "**executed locally**", states the envelope is skipped unless `PR6_C_SCALE_1E6=1`, that the default corpus records **1 skipped**, and that it "must not be labelled as a 1e6 pass". It is not presented as CI evidence, and it is explicitly distinguished from Gate E's 1,400-line smoke. Green CI confirms the envelope is skipped (`3 tests | 1 skipped`).

One figure is now stale — see F-CR-03: the table records `Collected / passed | 2 / 2`, but the delta added a second policy test, so the file now collects **3**. The 912.06 s / `lineFacts=1000000` measurement was taken against the pre-delta structure and has not been re-executed since the restructure.

### 3.4 F-F03 remains unresolved — **CONFIRMED UNRESOLVED; the green run does not dispose it**

| Evidence | Finding |
|---|---|
| Blob of `scripts/tenant-indexes/tests/indexes.migration.test.ts` | `db25d5556af25d3eb231587901f3753e0cfc0d98` at **M**, at `e5af049`, and at `4a5fc80` — byte-identical |
| C's touch of `scripts/tenant-indexes/` | none, across all 21 commits (`git diff --stat` empty) |
| Run `34714619941` (`e5af049`) | `× DML overlaps active build-scan and validation-scan phases (F-F03), 3 iterations` — `expected true to be false` |
| Run `34726234237` (`4a5fc80`) | `✓ scripts/tenant-indexes/tests/indexes.migration.test.ts (13 tests) 36777ms` |

Identical code produced a failure and a pass. **F-F03 is intermittent, not fixed.** The failure evidence shows why: `buildDurationMs: 184.368583` against `writeThresholdMs: 15000` — the `CREATE INDEX CONCURRENTLY` settles before `pg_stat_progress_create_index` can observe an active phase.

The correction is owned elsewhere and is **not merged**: branch `tooling/pr6-ci-stability` (`78fa81b02c41237352a45f7df283f959e254a857`) adds `ActivePhaseMissedError` and `FF03_MAX_ATTEMPTS = 12` retry-on-observer-miss, and separately raises Heavy `timeout-minutes` 70 → 90 with the in-file note "**Does not dispose F-F03**". That branch is not an ancestor of the C subject.

**Adjudication: a single green run is not supporting evidence that disposes of F-F03.** It shows the flake did not fire. The C lane correctly did not touch it.

---

## 4. Findings

### F-CR-01 — P2 — The "Heavy-budget leak" attribution is unsupported, and the cancellation cause is not addressed by this delta

**Claim under review.** Commit `5e8fbd2` — "Fix PR6-C Heavy-budget **leaks** in skipped 1e6 setup and process-loss parks" — and the report's framing of the delta as "C-owned Heavy-budget fixes" for the 70-minute cancellation.

**Evidence from the cancelled run's own log** (`103609595251`, the pre-fix code):

| File | Duration in the cancelled run |
|---|---|
| `pr6-c-scale-envelope.test.ts` (2 tests \| 1 skipped) | **2 ms** |
| `pr6-c-process-loss.test.ts` (7 tests) | **8 213 ms** |

The two constructs alleged to leak budget consumed **~8.2 seconds combined** in a ~70-minute job. Neither the skipped envelope nor the 120 s parks were ever entered: the envelope was skipped without opening PostgreSQL (2 ms, and I reproduced the same with the pre-fix file against no database at all), and the parks are only reached if a SIGKILL is missed, which did not happen.

Post-fix the same files measure 3 ms and 11 253 ms — the process-loss file is **3 seconds slower**, not faster.

**What actually differed.** The report's own figures locate it: pre-migration wall was **53m33s** on the cancelled run versus **40m30s** on the green run — a **13m03s** swing that fully accounts for the outcome. The tooling branch independently records PR #39 run `34722422036` hitting the same 70-minute cap with ~49 m pre-migration. This is shared runner/queue variance, not C's test files.

**Why it matters.** The record invites the reader to conclude the cancellation cause is now fixed on the C side. It is not. Green Heavy on this head used **60m51s of the 70m cap — 9m09s (13%) of headroom**, which is *less* than the 13m03s variance already observed between two runs of the same branch. A re-run of this exact head can cancel again for the same reason, and nothing in C can prevent it.

**Merchant/process impact.** None to merchants. The risk is decision quality: an acceptance decision could be taken believing exact-head CI is durably green when the margin is thinner than observed variance and the real mitigation (Heavy 70 → 90) sits on an unmerged branch.

**Correction.** Reword the delta as defensive hardening rather than a budget-leak fix, and state plainly that the cancellation cause was pre-migration wall-clock variance owned by `tooling/pr6-ci-stability`, not C's suites. No code change is required.

### F-CR-02 — P3 — Two tautological assertions give false assurance in the new/edited policy tests

`pr6-c-scale-envelope.test.ts:62`:

```ts
const runEnvelope = process.env.PR6_C_SCALE_1E6 === "1";   // line 29
// ...
it("does not put schema reset in a skipped describe beforeAll", () => {
  expect(runEnvelope).toBe(process.env.PR6_C_SCALE_1E6 === "1");
});
```

This is `x === x`. It cannot fail under any code change, and it asserts nothing about where the schema reset lives — despite a name that claims exactly that structural guarantee. Had the setup been moved back into a `beforeAll`, this test would still pass.

`pr6-c-scale-envelope.test.ts:56`: `expect(HEAVY_TIMEOUT_MINUTES).toBe(70)` where `const HEAVY_TIMEOUT_MINUTES = 70` (line 27) — literal compared to literal. It does not read `.github/workflows/ci.yml`, so it provides no protection and will silently misdocument the cap once the tooling branch raises it to 90.

The meaningful assertions in that file are `expect(GATE_E_SMOKE_LINES).toBeLessThan(PR6_C_LINE_ENVELOPE)` and the `GITHUB_ACTIONS` guard `expect(runEnvelope).toBe(false)`; both are sound.

**Correction.** Either assert the structural property for real (e.g. parse the file and assert no `beforeAll` in the envelope describe, as the sibling park test does with a source read) or rename the test to what it checks. The guarantee itself is already sound — this is about not recording unearned assurance.

### F-CR-03 — P3 — §6.2 records `Collected / passed 2 / 2`, but the file now collects 3

The delta added a second policy test. Green CI and both of my runs report `3 tests | 1 skipped`. With `PR6_C_SCALE_1E6=1` the file would collect **3**, not 2. The recorded 1e6 run also predates the `beforeAll` → `it.skipIf` restructure and the arrow-function conversion, so the whole §6.2 row set is attributable to the pre-delta harness.

The restructure is behaviour-preserving for the executed path, so the substantive measurement (`lineFacts=1000000`, `applyMs=904601`) is not invalidated. **Correction:** update the count and note the harness revision the measurement belongs to, or re-run once.

### F-CR-04 — P3 — The park-bound source assertion is weaker than its name

```ts
expect(src).not.toMatch(/sleep\(120_000\)/);
expect(src).toMatch(/await sleep\(30_000\)/);
```

This passes if **any one** park is 30 s. A future edit changing one of the two parks to, say, `60_000` would still satisfy both assertions. It is a directionally useful guard, not a bound. **Correction:** assert the count of parks, or assert no `sleep(` above a threshold.

### F-CR-05 — P3 — Report and PR body now understate the CI state

Both still read "**PR6-C EVIDENCE GATE BLOCKED — NOT READY FOR ACCEPTANCE**" citing the cancelled `e5af049…` run, while exact-head CI on `4a5fc80…` is fully green. This is expected staleness: the author's stated policy is not to later-push solely to embed a future run ID, and they followed it. Recorded so the next reader does not mistake the stale banner for the current gate state. No correction required in-lane; the next documentation commit will carry it.

---

## 5. Regression check on the corrected module

The delta touches no file under `app/lib/order-facts/apply/**`. I did not re-derive the F-01–F-08 analysis (out of scope per the work order), but I re-executed the C suites at this head on disposable PostgreSQL 16.13 to confirm nothing regressed:

Run 1 — three files in one invocation:

```
✓ pr6-c-canonical-applicator.test.ts (82 tests) 11039ms
✓ pr6-c-evidence-gates.test.ts       ( 9 tests) 16837ms
✓ pr6-c-scale-envelope.test.ts       ( 3 tests | 1 skipped) 3ms
  Test Files  3 passed (3)   Tests  93 passed | 1 skipped (94)
```

Run 2 — process-loss, executed separately (it spawns detached children):

```
✓ pr6-c-process-loss.test.ts          ( 8 tests) 10187ms
  Test Files  1 passed (1)   Tests  8 passed (8)
```

Across both invocations: 101 passed, 1 skipped, 0 failed.

These match the green CI job exactly (82 / 9 / 3-with-1-skipped / 8), and the pinned-B overlay (18) and mapper probe (17) passed in CI.

---

## 6. Executed evidence for this pass

| Property | Value |
|---|---|
| PostgreSQL | 16.13 (Ubuntu 16.13-0ubuntu0.24.04.1), disposable cluster, port 55433, `max_connections=100` / `max_locks_per_transaction=64` / `max_prepared_transactions=0`, `read committed` |
| Enforcement | `migrate deploy`, `tenant:indexes:apply --apply`, `tenant:roles:provision --apply`, `tenant:enforcement:apply --apply`, `tenant:enforcement:verify` — all exit 0 |
| No-database probe | no PostgreSQL process running; `DATABASE_URL` on dead port `59999` |
| Worktree | disposable, detached at `4a5fc80…`, left clean; no subject file modified |

Commands executed: the four suites above; the scale-envelope file at both the head and the `e5af049` revision under the no-database environment; full job logs for `103640772167` (67.5 MB) and `103609595251` (35.8 MB) downloaded and inspected directly rather than summarised from the report.

---

## 7. Remaining blockers and gates

1. **F-F03 (external, unresolved).** Intermittent; correction sits on unmerged `tooling/pr6-ci-stability`. Any Heavy re-run on this head can fail on it. Not C-owned; C must not edit `scripts/tenant-indexes/`.
2. **Heavy timeout headroom (external).** 9m09s of 70m on the green run, against 13m03s observed pre-migration variance and two 70-minute cancellations across PR #40 and PR #39 on 2026-09-12. Mitigation (70 → 90) is on the same unmerged branch.
3. **F-CR-01 (P2, in-lane).** Documentation correction only.
4. Carried from the first pass and unchanged: **R-176 OPEN / P0** (D owns fetch/window/scope integration, webhook/import, reconciliation); **R-164** accepted residual.
5. Not re-executed this pass (unchanged since the first-pass artifact, which lists them): interruption/crash matrices beyond the process-loss suite, lock-order deadlock to a real `40P01`, same-key/different-identity double-commit window, scale beyond the recorded local 1e6 run.
6. **PR2 inventory divergence.** C records `scannedFiles` 403; `tooling/pr6-ci-stability` also modifies that file. Regeneration is an integration requirement when the branches meet; neither count is authoritative for a combined tree.

---

## 8. Safety state

- PR #40 was **not** modified, rebased, marked ready, or merged. Head remains `4a5fc80417f90c80f6e310428a6ce0d0036f9d93`.
- `main` (`bdbb5bba…`), PR #39 / `phase-1/pr6-b-order-admin-read` (`d9717f68…`) and `tooling/pr6-ci-stability` (`78fa81b0…`) were **not** modified.
- The first-pass immutable artifact was **not** edited — blob `a90ae442a80ee593bb43bee3b15c2228f32d6e15` on this head.
- No implementation, workflow, schema, or peer-branch edit. No production action, Shopify call, or mutation; flags remain default off. All database work ran on a disposable local cluster.

---

## 9. Verdict

The three delta commits are **correct and safe**. Both fixes do what they claim structurally, I verified each independently, and nothing regressed: the skipped envelope provably performs no database setup (proven against a machine with no PostgreSQL at all), and the 30-second park preserves the required schedules with a ~40× margin.

Approval is withheld for two reasons, neither of which is a correctness defect in the applicator:

- **F-F03 is not disposed.** It failed and passed on byte-identical code; a single green run is not evidence of resolution, and the fix is on an unmerged branch.
- **F-CR-01 (P2).** The record attributes the 70-minute cancellation to C-owned test-budget leaks that the cancelled run's own timings refute (2 ms and 8.2 s). The real cause — pre-migration wall variance — remains unmitigated in C's reach, with 13% headroom against a larger observed swing.

Exact-head CI on `4a5fc80…` is genuinely SUCCESS and is recorded as such. That is necessary but not sufficient while F-F03 stands.

`CORRECTIONS REQUIRED`
