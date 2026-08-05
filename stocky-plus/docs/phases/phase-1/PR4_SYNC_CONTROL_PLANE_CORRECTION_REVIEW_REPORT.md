# Phase 1 PR 4 — Independent Correction Review Report

Independent principal-engineer, database-security, distributed-systems, and
release-readiness review of the D-043 correction delta on PR #20.

This report is an independent verification record. It does not accept PR 4, does
not authorize PR 5, does not authorize production, and does not mark PR #20 ready.

---

## 1. Final verdict

> ## NOT READY — CORRECTIONS REQUIRED

Two new P1 defects were independently reproduced in a disposable environment at the
exact reviewed head. Both are regressions of the *same failure classes* that
F-PR4-02 and F-PR4-04 were raised to eliminate, surviving in a new form after the
correction. Neither is covered by any repository test, and neither is visible in CI.

- **NEW-PR4-C01 (P1)** — the dispatcher acknowledges `ENQUEUED` when the deterministic
  queue job exists but is **not runnable** (retained-failed). The durable job is
  permanently stranded in `ENQUEUED`; the webhook is never applied; no dead letter is
  raised. This violates the stated F-PR4-02 acceptance criterion verbatim.
- **NEW-PR4-C02 (P1)** — `recoverExpiredRunningAttempts` throws on a webhook durable
  job whose `webhookDeliveryId` is `NULL`. The throw escapes the per-attempt
  transaction and aborts the **entire reaper batch**, so the job stays `RUNNING`
  forever and all other expired attempts in the run are never recovered.

Everything else in the correction delta is materially sound. Sixteen of the twenty
findings are independently closed; the migration work, RLS/role isolation, transition
guard, sanitizer, fairness, quarantine, and uninstall corrections all hold up under
adversarial testing.

---

## 2. Finding counts

### Original twenty findings (D-043 scope)

| Disposition | P1 | P2 | P3 | Total |
|---|---|---|---|---|
| Independently closed | 2 | 9 | 5 | **16** |
| Closed with residual / in part | 1 | 1 | 1 | **3** |
| **Not closed** | **1** | 0 | 0 | **1** |
| Total reviewed | 4 | 10 | 6 | **20** |

D-043's reconciled count of **4 P1 + 10 P2 + 6 P3 = 20** was used throughout. The
original review report's `4 P1 + 7 P2 + 4 P3` summary table was **not** used.

### New findings raised by this review

| Severity | Count | IDs |
|---|---|---|
| P0 | 0 | — |
| **P1** | **2** | NEW-PR4-C01, NEW-PR4-C02 |
| P2 | 2 | NEW-PR4-C03, NEW-PR4-C04 |
| P3 | 4 | NEW-PR4-C05, NEW-PR4-C06, NEW-PR4-C07, NEW-PR4-C08 |

---

## 3. Exact reviewed implementation head

```
0697a2878eed3ce8013f59af54de7d0adf98d548
```

`Refresh tenant-access inventory after expansion fixture fix` — Cursor Agent,
2026-08-05T03:49:55Z, tree `765a0b4ddbd9e68499fa607616802cdc92f0f682`.

**This report's own commit is NOT the implementation head.** See §17.

---

## 4. Base and merge-base verification

| Identity | Required | Observed | Result |
|---|---|---|---|
| `HEAD` | `0697a287…f98d548` | `0697a2878eed3ce8013f59af54de7d0adf98d548` | ✅ |
| `origin/main` | `e69bc53d…46adb1` | `e69bc53d91db75472b0d0998bf1b74ee6246adb1` | ✅ |
| `git merge-base origin/main HEAD` | `e69bc53d…46adb1` | `e69bc53d91db75472b0d0998bf1b74ee6246adb1` | ✅ |
| Working tree before review | clean | `git status --porcelain` empty | ✅ |

Merge base equals `origin/main`, so the branch is a strict fast-forward descendant of
the authorized base. No rebase onto an unauthorized base occurred.

---

## 5. PR state verification

Verified through the GitHub API at review time:

| Property | Required | Observed | Result |
|---|---|---|---|
| State | OPEN | `open` | ✅ |
| Draft | DRAFT | `true` | ✅ |
| Merged | unmerged | `false` | ✅ |
| Base ref | `main` | `main` | ✅ |
| Head ref | `phase-1/sync-control-plane` | `phase-1/sync-control-plane` | ✅ |
| Head SHA | `0697a287…f98d548` | `0697a2878eed3ce8013f59af54de7d0adf98d548` | ✅ |
| `mergeable_state` | — | `clean` | informational |
| Changed files / commits | — | 89 files, 32 commits | informational |

No merge action, no ready-for-review action, and no PR 5 branch or PR was created by
this review. PR #20 remains OPEN, DRAFT, and UNMERGED.

---

## 6. Git chain of custody

```
0697a28  Refresh tenant-access inventory after expansion fixture fix   ← reviewed head
b6f6183  Fix PR4 correction migration expansion fixture
7caaf9a  Refresh tenant-access inventory after expansion migration test edit
ee3ad88  Park PR4 correction migrations in init-then-rest expansion test
33750dc  Exclude sync integration tests from default unit vitest suite
d8477e7  Fix eslint ban-types on SyncControlPlaneErrorCode widen
f934c34  Update tenant-access model count to 19 for SyncApplicationReceipt
01ef358  Refresh tenant-access inventory after queue-redis v3 test edit
109007a  Fix tenant queue-redis tests for envelope v3 (F-PR4-02/19)
463d764  Fix PR4 CI: shopId on receipt fixtures and work_mem for plan shape
4112313  Allowlist PR4 correction test harnesses in tenant-access audit
fb87144  Allowlist stocky_has_application_receipt SECURITY DEFINER for PR4
2aa91a8  Allowlist PR4 control-plane SQL functions in role provisioning
8132f63  Refresh tenant enforcement inventory for SyncApplicationReceipt
996e937  Fix duplicate env key in PR4 CI performance gate
424cd48  Fix PR4 correction schema drift and control-plane RLS provision
6c2030e  Complete PR 4 correction tests, fair claim, CI gates, and reports
a38be9f  Implement Phase 1 PR 4 D-043 correction runtime (F-PR4-01..20)
01c8f9a  Record D-043 and PR 4 correction backlog
944cd59  Record independent verification of test:migrations in PR 4 review  ← correction start
329aa92  Record independent Phase 1 PR 4 review
7c36bc1  Fill documentation tip SHA in PR4 implementation report            ← original reviewed head
…
0db313f  Implement Phase 1 PR 4 sync control-plane runtime
```

Chain-of-custody assertions, each verified mechanically:

- `944cd59…` **is an ancestor** of `HEAD` (`git merge-base --is-ancestor` → true).
- `7c36bc1…` (original independently reviewed head) is present and unmodified in the
  ancestry — the correction was **added on top**, not rebased over it.
- No correction commit was amended, squashed away, or force-replaced; the 19 delta
  commits form a linear append.
- `PR4_SYNC_CONTROL_PLANE_REVIEW_REPORT.md` does **not** appear in
  `git diff --name-status 944cd59..HEAD`. **The original review report is unedited.** ✅
- `prisma/migrations/20260804180000_sync_control_plane/` does **not** appear in the
  delta. **The original migration is unchanged.** ✅

---

## 7. Correction-delta classification

`git diff --stat 944cd59..HEAD` → **66 files, +6281 / −841**.

| Class | Files | Notes |
|---|---|---|
| New sync runtime | 3 | `envelope-v3.server.ts`, `application-receipt.server.ts`, `execution-strategy.server.ts` |
| Modified sync runtime | 8 | dispatcher, intake, lifecycle, uninstall, sanitize, state-machine, replay, api-version, errors |
| Worker / queue | 2 | `webhook-processor.ts` (+263), `queue.server.ts` |
| Webhook routes | 5 | signature/adapter wiring only |
| New migrations | 2 | `…210000_sync_control_plane_correction` (354 lines), `…220000_…_defaults` (2 lines) |
| Prisma schema | 1 | +220/−… (JobDispatch, SyncApplicationReceipt, enums, lease columns) |
| New tests | 8 | exactly-once, dispatch-recovery, uninstall, attempt-recovery, performance, intake-corrections, role-isolation, inventory-audit |
| Modified tests | 6 | envelope v3 adaptation, expansion migration fixture |
| Governance scripts | 8 | sync-control-plane manifest/roles/inventory, tenant-access allowlist |
| CI | 1 | +22 lines (11 new gates) |
| Docs / inventories | 9 | backlog, correction report, PROJECT_STATUS, DECISIONS, RISK_REGISTER, inventories |

**Scope classification: within D-043 correction scope.** No PR 5 fact implementation,
no forecasting, purchasing, receiving, billing, AI, or privacy-deletion code entered
the branch. All merchant-domain behavior change is confined to the exactly-once
application wrapper around pre-existing webhook handlers.

---

## 8. Exact-head CI verification

Independently retrieved from the GitHub Actions API (not from Cursor's narrative):

| Field | Required | Observed | Result |
|---|---|---|---|
| Workflow name | CI | `CI` | ✅ |
| Run ID | 30973380364 | `30973380364` | ✅ |
| Event | pull_request | `pull_request` | ✅ |
| Head branch | `phase-1/sync-control-plane` | `phase-1/sync-control-plane` | ✅ |
| Head SHA | `0697a287…f98d548` | `0697a2878eed3ce8013f59af54de7d0adf98d548` | ✅ |
| Job ID | 92202303136 | `92202303136` | ✅ |
| Job name | — | `Lint, typecheck, test, build, Prisma, GraphQL` | — |
| Run attempt | — | `1` | ✅ |
| Conclusion | success | `success` | ✅ |
| Duration | — | 03:50:04 → 04:20:03 UTC (30 min) | — |

**Step-level audit — all 104 material steps enumerated and inspected:**

- Steps 1–104 plus 4 post/cleanup steps: **every one `conclusion: success`**.
- **Zero skipped steps.** **Zero failed steps.** **Zero `continue-on-error`** — the
  workflow file contains no `continue-on-error` key.
- Step 6 asserts `test "$(npm --version)" = "11.5.2"` — the npm pin is enforced, not
  merely requested.
- All eleven PR 4 correction gates are present and green as discrete steps:
  52 sync inventory freshness, 53 sync role provisioning, 54 sync role verification,
  55 integration, 56 exactly-once, 57 dispatch recovery, 58 uninstall, 59 attempt
  recovery, 60 role isolation, 61 inventory audit, 62 dispatch performance/fairness.
  **No correction test is excluded from CI.**
- Step 101 (`Migration and tenant-backfill tests`) ran 10m33s — consistent with a real
  47-file migration suite, not a no-op.
- Real PostgreSQL 16 and Redis 7 service containers (steps 2, "Initialize containers").
  **No suite mocks PostgreSQL or Redis behavior**; every database gate runs against the
  live service container.
- I diffed the CI command list against the delta: **no command was weakened** to make
  CI green. The only CI change in the delta is the *addition* of 11 gates plus a
  `work_mem` setting for a deterministic query-plan assertion.

**Verdict on CI:** exact-head CI is independently verified as genuine, complete, and
unweakened. Per the review mandate it is treated as **supporting evidence only** — and
it did not surface either P1 defect below, because no repository test exercises them.

---

## 9. Disposable review environment

Built fresh; reuses none of Cursor's database, Redis state, reports, fixtures, or
working-directory state.

| Property | Value |
|---|---|
| OS | Linux 6.18.5-fc-v18 x86_64 (Ubuntu 24.04 userland) |
| Node | v22.22.2 (CI: 22.19.0) |
| npm | **11.5.2** (pinned to match `packageManager` / `engines`) |
| PostgreSQL | **16.13** (Ubuntu 16.13-0ubuntu0.24.04.1) — two independent clusters |
| Redis | **7.0.15** (CI: redis:7-alpine) |
| Cluster A | port 5433, `fsync=off`, `max_connections=200` — **control-plane role present** |
| Cluster B | port 5434, freshly `initdb`-ed — **control-plane role absent** |
| Databases | `stocky_plus_review` (A), `stocky_adv` (A, adversarial), `stocky_noroles` (B) |
| Reviewed commit | `0697a2878eed3ce8013f59af54de7d0adf98d548` |

**Database role attributes** (`pg_roles`, verified in cluster A):

| Role | super | bypassrls | createrole | createdb | inherit | login |
|---|---|---|---|---|---|---|
| `stocky` (migration owner) | t | f | f | f | t | t |
| `stocky_control_plane` | **f** | **f** | **f** | **f** | **f** (NOINHERIT) | t |
| `stocky_runtime` | **f** | **f** | **f** | **f** | **f** (NOINHERIT) | t |

Both service roles are correctly non-superuser, non-BYPASSRLS, non-CREATEROLE,
non-CREATEDB, and NOINHERIT. `stocky` is the disposable migration/maintenance owner and
mirrors the CI `postgres:16-alpine` `POSTGRES_USER` — see NEW-PR4-C08 on production
ownership.

**Safety:** no production credentials, no production data, no merchant data, no real
webhooks, no live Shopify shop. All secrets are the CI test-only placeholders.

---

## 10. Command evidence

All commands run serially in the disposable environment at the reviewed head.
Migration tests were run alone, never concurrently with other database tests.

### Governance / schema commands

| Command | Exit | Evidence |
|---|---|---|
| `npm ci` | **0** | lockfile install clean |
| `npx prisma generate` | **0** | client generated |
| `npx prisma validate` | **0** | `The schema at prisma/schema.prisma is valid` |
| `npx prisma migrate deploy` (1st) | **0** | 9 migrations applied |
| `npx prisma migrate deploy` (2nd) | **0** | `No pending migrations to apply` |
| `npm run tenant:indexes:apply -- --apply` | **0** | 44 indexes created, 0 failed |
| `npm run tenant:indexes:verify` | **0** | |
| `npm run tenant:schema:drift` | **0** | no drift |
| `npm run tenant:indexes:plan` | **0** | all `valid_exact` |
| `npm run tenant:enforcement:inventory:check` | **0** | inventory fresh |
| `npm run tenant:roles:provision -- --apply` | **0** | |
| `npm run tenant:enforcement:preflight` | **0** | |
| `npm run tenant:enforcement:apply -- --apply` | **0** | |
| `npm run tenant:roles:verify` | **0** | |
| `npm run tenant:rls:verify` | **0** | |
| `npm run tenant:immutability:verify` | **0** | |
| `npm run tenant:enforcement:verify` | **0** | |
| `npm run tenant:enforcement:drift` | **0** | |
| `npm run tenant:access:audit` | **0** | |
| `npm run tenant:access:inventory:check` | **0** | inventory fresh at reviewed head |
| `npm run sync:inventory:check` | **0** | sync inventory fresh |
| `npm run sync:roles:provision -- --apply` | **0** | |
| `npm run sync:roles:verify` | **0** | |
| `npm run lint` | **0** | |
| `npm run typecheck` | **0** | |
| `npm run build` | **0** | |
| `git diff --check` | **0** | |
| `git status --porcelain` | **0** | clean before and after review |

> Note: `npm run tenant:enforcement:apply` without `-- --apply` exits **1** with
> `apply mode requires --apply`. This is correct fail-closed behavior, and matches how
> CI invokes it (`ci.yml:146`). Recorded for completeness; not a finding.

### Test suites — exact file and test counts

| Suite | Exit | Test files | Tests |
|---|---|---|---|
| `test:sync-exactly-once` | **0** | 1 | **4 passed** |
| `test:sync-dispatch-recovery` | **0** | 1 | **3 passed** |
| `test:sync-uninstall` | **0** | 1 | **8 passed** |
| `test:sync-attempt-recovery` | **0** | 1 | **3 passed** |
| `test:sync-role-isolation` | **0** | 1 | **6 passed** |
| `test:sync-inventory-audit` | **0** | 1 | **5 passed** |
| `test:sync-integration` | **0** | 11 | **68 passed** |
| `SYNC_PERF_JOB_COUNT=50000 test:sync-performance` | **0** | 1 | **1 passed** |
| `test:db-isolation` | **0** | 2 | **19 passed** |
| `test:tenant-access` | **0** | 34 | **288 passed** |
| `npm test` (unit) | **0** | 6 | **56 passed** |
| `test:migrations` | **0** | 47 | **217 passed** |
| **Total** | — | **107** | **678 passed, 0 failed** |

**No command succeeded with zero tests.** Every suite reported a non-zero count.
`test:migrations` = **217** independently reproduces the count claimed in the PR body.

### Command that did not complete in this environment

| Command | Exit | Cause |
|---|---|---|
| `npm run graphql-codegen` | **1** | `Load GraphQL schemas [FAILED: Unexpected response: "Host not in allowlist: shopify.dev. Add this host to your network egress settings to allow access."]` |

This is an **environment egress restriction, not a code defect**. The review sandbox
blocks `shopify.dev`, which the Shopify codegen preset must reach to download the Admin
schema. CI step 104 (`GraphQL codegen / schema validation`) passed at the exact head
with unrestricted egress. Consequence for this review is recorded under F-PR4-18 and
§15 (environment limitations).

---

## 11. Migration results

### Migrations inspected

- `prisma/migrations/20260804180000_sync_control_plane/` — **unchanged** in the delta ✅
- `prisma/migrations/20260804210000_sync_control_plane_correction/` — 354 lines, new
- `prisma/migrations/20260804220000_sync_control_plane_correction_defaults/` — 2 lines, new

### Empty-database deploy

| Step | Result |
|---|---|
| `migrate deploy` on empty DB | **exit 0** — all 9 migrations applied, in order |
| `migrate deploy` again | **exit 0** — `No pending migrations to apply` |

### Upgrade-path deploy (original PR 4 state → corrections)

Verified by `tenant-expansion.migration.test.ts`, which builds the database at the
historical init state, restores later migrations, and applies the corrections on top —
and independently by me in both clusters:

| Property | Result |
|---|---|
| Destructive operation | **none** — the delta is `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`, additive `ALTER TYPE … ADD VALUE`, plus one `DROP NOT NULL` and one unique-index widening |
| Data loss | **none** — `WebhookDelivery_shopId_shopifyWebhookId_key` is replaced by a *partial* unique on the same columns `WHERE shopifyWebhookId IS NOT NULL`, which is strictly weaker and cannot reject existing rows |
| Pre-existing control-plane records | remain valid; new columns are nullable or carry defaults |
| New constraints and indexes | all applied (verified in `pg_indexes`) |
| RLS and role policies | applied correctly — see below |
| Defaults match Prisma | `tenant:schema:drift` exit 0; the `…220000_…_defaults` migration exists precisely to drop the `JobDispatch.updatedAt` DB default so it matches Prisma `@updatedAt` |
| Repeatability | second deploy is a no-op; `_prisma_migrations` count = 1 per migration |

### RLS and role state after migration (`stocky_adv`, verified via `pg_class`)

All twelve tables carry **both** `relrowsecurity` and `relforcerowsecurity`:

`DataIssue, DeadLetter, DurableJob, JobAttempt, JobDispatch, JobReplay,
ReconciliationRun, SyncApplicationReceipt, SyncCursor, SyncHealth, SyncRun,
WebhookDelivery` — **ENABLE + FORCE RLS confirmed on 12/12.** ✅

---

## 12. Expansion-stage fixture review (the exact-head CI failure that was fixed)

Prior failure: `expect(policies.length).toBe(0)` received `11`, because CI provisions
`stocky_control_plane` before the migration suite while isolated local runs did not.

| Required proof | Result | Evidence |
|---|---|---|
| Does not merely weaken the assertion | ✅ | Role-present branch asserts `expect(policies).toEqual(expected)` — an **exact deep equality** against 11 named policies with exact `policyname` and `roles` arrays. This is *stronger* than the original count check, not weaker. |
| Correctly distinguishes role-present / role-absent | ✅ | `controlPlaneRoleExists()` queries `pg_roles`; role absent → strict `toBe(0)`; role present → exact 11. |
| Expects exactly the authorized eleven policies | ✅ | `CONTROL_PLANE_POLICY_TABLES` lists exactly the 11 tables in the migration's array; each expected as `{table}_control_plane_all` for role `stocky_control_plane`. |
| Expects zero when role absent | ✅ | `expect(policies.length).toBe(0)`. |
| `SyncApplicationReceipt` gets no control-plane policy | ✅ | Explicit `expect(receiptPolicies.length).toBe(0)`, plus its absence from the expected array. Confirmed live: control-plane role is **denied** on that table (§13, F-PR4-06). |
| Parks only migrations that genuinely require parking | ✅ | `afterInit` parks the 8 post-init migrations; parking all of them is required because later additive migrations `ALTER TABLE "Shop"`, which `tenant_expansion` creates. |
| Restores every parked migration | ✅ | Restore loop in the happy path, in `catch`, and again in `finally`. |
| Applies every restored migration exactly once | ✅ | `SELECT migration_name, COUNT(*) FROM _prisma_migrations GROUP BY 1` asserted equal to `ALL_MIGRATION_NAMES` with `cnt === 1` for every row, both before and after the second deploy. |
| Leaves no `.tmp-parked-migrations` | ✅ | `expect(existsSync(…)).toBe(false)`; independently confirmed on disk. |
| **Restores folders even after test failure** | ✅ | **Independently proved** — see below. |
| Leaves migration tree unchanged | ✅ | `expect(listMigrationDirEntries()).toEqual(beforeDir)`; independently confirmed (10 entries). |
| Proves second deployment is a no-op | ⚠️ partial | Backed by a real `_prisma_migrations` count assertion (sound). The *string* assertion is near-vacuous — see NEW-PR4-C07. |

### Both environments — independently executed

The mandate requires the test to pass **with and without** `stocky_control_plane`.

| Environment | Cluster | Role at start | Result |
|---|---|---|---|
| **Role present** | A (:5433) | present | `test:migrations` → **47 files / 217 tests passed** |
| **Role absent** | B (:5434), fresh `initdb` | `count = 0` verified | `tenant-expansion.migration.test.ts` → **5/5 passed** in 16.9 s |

The fixture is **not** environment-dependent. It passes in both.

### Failure-path restoration — independently proved

I forced every test in the file to fail by pointing `DATABASE_URL` at a non-existent
database, then inspected the working tree:

```
Test Files  1 failed (1)
     Tests  5 failed (5)
=== AFTER FORCED FAILURE ===
parked dir: ls: cannot access '.tmp-parked-migrations': No such file or directory
migration entries: 10   (9 migrations + migration_lock.toml — all present)
git status --porcelain: clean
```

**All five tests failed and the migration tree was still fully restored** with no
parking directory left behind. The `try/catch/finally` cleanup is genuine.

---

## 13. Findings F-PR4-01 … F-PR4-20

### P1

---

#### F-PR4-01 · P1 · Exactly-once merchant-domain application — **CLOSED WITH RESIDUAL**

**Original defect.** Merchant writes executed separately from control-plane completion
with no application marker; retry after a partial sales increment duplicated effects.

**Correction implemented.** New tenant-owned `SyncApplicationReceipt`
(`UNIQUE (shopId, applicationKey)`, `ENABLE`+`FORCE` RLS);
`applyWithApplicationReceipt()` enforcing check → merchant writes → receipt-last →
commit; `JobExecutionStrategy` matrix; application key derived from the durable webhook
delivery.

**Independent reproduction.**

- **Transaction boundary verified by inspection** —
  `webhook-processor.ts:454-469` wraps the whole application in a single
  `ctx.db.$transaction`; inside it, `application-receipt.server.ts:52-92` reads the
  receipt, runs `apply()`, then creates the receipt as the **final** write. The
  control-plane `completeAttemptSuccess` is called at line 471, **after** the tenant
  transaction has committed, and is not required for merchant durability. ✅
- **Application-key stability verified** — `resolveApplicationKey` derives from
  `webhookDeliveryId`, never the job ID; `replay.server.ts:110` explicitly preserves
  `webhookDeliveryId` on the replay job, so the key is stable across replay. ✅
- **Merchant-owned and RLS-protected verified live** — `SyncApplicationReceipt` carries
  `relrowsecurity=t, relforcerowsecurity=t`; `stocky_control_plane` is **denied**
  (`permission denied for table SyncApplicationReceipt`); `stocky_runtime` may read it
  under tenant RLS. ✅

**Independent adversarial test.** I wrote a disposable fixture for the scenario with
**no repository coverage** — crash after the merchant transaction commits but before the
control-plane success update:

```
ADV-4 { recovered: 0, deadLettered: 0, finalized: 1 }  job=SUCCEEDED  delivery=COMPLETED
```

The reaper detected the receipt via `stocky_has_application_receipt`, finalized the job
`SUCCEEDED` **without reapplying**, and closed the delivery. The central recovery
guarantee holds.

**Result.** Mechanism correct and adversarially confirmed.

**Remaining weakness.**
1. Evidence is materially short of the backlog's own acceptance list — 4 tests versus
   ~14 named scenarios (NEW-PR4-C03).
2. The v1 and v2 envelope paths bypass the receipt entirely (NEW-PR4-C04).
3. Inside a transaction, the `APPLICATION_ALREADY_APPLIED` race branch
   (`application-receipt.server.ts:96-112`) is effectively unreachable: PostgreSQL
   aborts the transaction on the unique violation, so the follow-up `findUnique` raises
   `25P02` instead. Outcome is still safe (rollback, then converge on retry), but the
   race is classified as an opaque error rather than a clean already-applied.

**Severity disposition:** P1 → **closed with residual**; residuals carried as
NEW-PR4-C03 (P2) and NEW-PR4-C04 (P2).
**Permanent risk mapping:** R-109 — mitigation implemented, **remains OPEN** pending
the residuals. R-032, R-104 — see F-PR4-04.

---

#### F-PR4-02 · P1 · Durable dispatch and BullMQ retry identity — **NOT CLOSED**

**Original defect.** Retry reused the durable job ID; BullMQ retained the failed job and
returned it from `add`; the database falsely transitioned to `ENQUEUED`.

**Correction implemented.** Append-only `JobDispatch` with
`UNIQUE (durableJobId, dispatchSequence)` and `UNIQUE (queueName, queueJobId)`;
deterministic queue job ID `<durableJobId>__d<sequence>`; envelope v3 binding durable
job, dispatch identity, queue job ID, digest, tenant, source, correlation, causation;
ack-loss recovery that reuses a `PENDING_ENQUEUE` dispatch.

**Independent reproduction — verified good parts.**

- `formatQueueJobId` / `parseQueueJobId` are deterministic and collision-safe:
  `__d` is rejected inside `durableJobId` (`dispatcher.server.ts:47-49`), the separator
  is located with `lastIndexOf`, and the sequence must be a positive integer. `:` is
  correctly avoided because BullMQ forbids it in custom IDs. ✅
- `JobDispatch` is append-only with monotonic per-job sequences; both unique indexes
  exist in the live database. ✅
- Envelope v3 mismatch assertions (dispatch ID, sequence, queue job ID, payload digest,
  queue name, shop) are all present in `webhook-processor.ts:377-420`. ✅
- Ack-loss recovery with a **live** queue job works correctly (repository test 3, and
  the design is sound).

**Independent adversarial test — the defect.** The mandate requires proving that *"a
database transition to ENQUEUED must never occur unless the exact dispatch is
demonstrably present in Redis."* I built the reachable state the repository test does
not cover: a `PENDING_ENQUEUE` dispatch whose deterministic queue job **exists but has
already failed and been retained**.

```
ADV-1 RESULT {
  durableJobState:         'ENQUEUED',
  activeDispatchSequence:  1,
  dispatchStates:          [ [ 1, 'ENQUEUED' ] ],
  runnableInRedis:         0,        // waiting + delayed + active + prioritized
  failedInRedis:           1
}
```

**Result: FAIL.** The durable job is marked `ENQUEUED` with **nothing runnable in
Redis**. `enqueueWithDispatch` (`dispatcher.server.ts:258-261`) tests only for the
*presence* of a job at the deterministic ID — never its state — and returns
`{created: false}`; `dispatchPendingJobs:395-396` then **discards that return value** and
calls `ackEnqueued` unconditionally.

**Reachability without manual construction.** The correction's own ack-loss design
creates this state:
1. `queue.add` succeeds; the process dies before `ackEnqueued` commits → job stays
   `DISPATCH_LEASED`, live queue job exists.
2. A worker picks up that queue job. `claimAttempt` calls
   `assertTransition("DISPATCH_LEASED", "RUNNING")` — **not a legal edge** — so it throws.
3. BullMQ exhausts its own attempts; the job lands in the retained **failed** set.
4. The dispatch lease expires → `DISPATCH_LEASED → PENDING` → reclaimed →
   `ensureDispatchRecord` reuses the `PENDING_ENQUEUE` sequence → `getJob` returns the
   retained failed job → `created:false` → `ackEnqueued` → **stranded `ENQUEUED`**.

**Consequence.** No recovery path exists. `recoverExpiredDispatchLeases` only handles
`DISPATCH_LEASED`; `recoverExpiredRunningAttempts` only handles `RUNNING` attempts. The
only legal exits from `ENQUEUED` are `RUNNING` (requires a worker that will never run)
and `CANCELLED` (uninstall only). The webhook is silently never applied: no dead letter,
no `DataIssue`, no alert. Sales aggregates, inventory snapshots, BOM effects, and
low-stock alerts diverge permanently from Shopify.

**Secondary defect in the same path.** `enqueueWithDispatch` also returns
`{created:false}` when the shop is missing or `processingEnabled` is false
(`dispatcher.server.ts:222-224`), and `ackEnqueued` is still called. Today the uninstall
sweep's `DISPATCH_LEASED → CANCELLED` cancellation makes the CAS at
`ackEnqueued:322` fail, so this is currently masked — but it is masked by an unrelated
invariant, not by design.

**Remaining weakness.** The corrected code reproduces the *original* failure class
(`add` returns a retained job → false `ENQUEUED`) through a new route.

**Severity disposition:** **P1 — NOT CLOSED.** Raised as **NEW-PR4-C01**.
**Permanent risk mapping:** R-099 — **remains OPEN**; mitigation incomplete.
R-031 — unaffected by this finding.

**Recommended correction.** In `enqueueWithDispatch`, inspect the returned job's state
(`isFailed()` / `isCompleted()` — or its absence from waiting/delayed/active/prioritized)
and treat a non-runnable job as *not present*: allocate a new dispatch sequence rather
than reusing the stale one. Return an explicit
`{ enqueued: true | false, reason }` and make `ackEnqueued` **conditional** on
`enqueued === true`. Add a stranded-`ENQUEUED` reaper (jobs `ENQUEUED` past a threshold
with no runnable queue job) as defense in depth.

**Missing test.** `test:sync-dispatch-recovery` must add: (a) `PENDING_ENQUEUE` reuse
where the deterministic queue job is retained-failed; (b) the same where it is
retained-completed; (c) an assertion that `ackEnqueued` never fires when nothing runnable
was added; (d) the end-to-end ack-loss → worker-rejects-`DISPATCH_LEASED` → retained-failed
→ re-dispatch chain.

---

#### F-PR4-03 · P1 · Uninstall denial and races — **CLOSED**

**Original defect.** `CANCELLABLE` included `DISPATCH_LEASED` with no
`DISPATCH_LEASED → CANCELLED` edge, so `assertTransition` aborted the whole uninstall
transaction and `processingEnabled` stayed true.

**Correction implemented.** `DISPATCH_LEASED → CANCELLED` and `RUNNING → CANCELLED`
added to both the application graph and the SQL trigger; atomic disable + cancel-all +
close-attempts in one transaction; session deletion moved after commit.

**Independent reproduction.**

- `assertCancellableTransitionCoverage()` is invoked at the top of `processUninstall`
  and asserts every one of the five cancellable states has a legal `→ CANCELLED` edge.
  Verified present in both the TS graph and the SQL trigger. ✅
- **Ordering verified** (`uninstall.server.ts:96-167`): inside one
  `prisma.$transaction`, the delivery is written, then `processingEnabled=false` /
  `UNINSTALLED` / `processingDisabledAt` / `uninstalledAt` are set, then
  `cancelAllCancellable` runs. ✅
- **Session deletion cannot re-enable the shop** (`:171-187`): it runs *after* the
  transaction commits, and both the primary and fallback deletions are wrapped in
  `try/catch` that swallows failure with the comment *"Control-plane disable/cancel
  already committed."* A session-deletion failure therefore cannot roll back
  disablement. ✅
- **Duplicate uninstall is idempotent** (`:104-128`): the existing-delivery branch still
  re-applies the disable and re-runs `cancelAllCancellable`. ✅

**Independent adversarial test.** `test:sync-uninstall` — **8/8 passed**, covering each
of `PENDING`, `DISPATCH_LEASED`, `ENQUEUED`, `RUNNING`, `RETRY_WAIT` individually,
mixed states in one transaction, duplicate uninstall, and cancellable-edge coverage.
I additionally confirmed the enqueue race is closed by the `ackEnqueued` CAS
(`WHERE state = 'DISPATCH_LEASED'`) and the worker-claim race by `claimAttempt`'s
`job.state === "CANCELLED"` guard plus the `SELECT … FOR UPDATE` row lock.

**Transaction visibility boundary — precisely documented.**
`uninstall.server.ts:5-14` states it explicitly: statements already completed before the
uninstall commit cannot be undone; subsequent statements under READ COMMITTED observe
the disabled shop; long-running transactions and external side effects remain outside
the guarantee. A worker already inside its merchant transaction **will** commit; its
subsequent `completeAttemptSuccess` then fails with `Cannot complete success from
CANCELLED`. This is safe (the receipt prevents duplicate application) and is honestly
scoped rather than overclaimed.

**Remaining weakness.** None material. Reinstall-after-`UNINSTALLED` and
denial-after-`REDACTED` are asserted by the suite but belong to the PR 7 privacy scope
for full treatment.

**Severity disposition:** P1 → **CLOSED**.
**Permanent risk mapping:** R-031 — mitigation implemented; R-101 — mitigation
implemented. Both **remain OPEN** in the register until PR 4 is accepted, which is
correct.

---

#### F-PR4-04 · P1 · Running-attempt recovery — **NOT CLOSED**

**Original defect.** No `RUNNING` lease/heartbeat; expired-lease recovery covered only
`DISPATCH_LEASED`; two open attempts were insertable.

**Correction implemented.** Partial unique `UNIQUE (durableJobId) WHERE finishedAt IS
NULL`; attempt lease owner/expiry/heartbeat/dispatch binding;
`recoverExpiredRunningAttempts` reaper; `ABANDONED` / `LEASE_EXPIRED` / `WORKER_LOST`
outcomes.

**Independent reproduction — verified good parts.**

- **Partial unique constraint is active — proved by direct SQL.** Two raw inserts of
  unfinished attempts for one durable job:
  `ERROR 23505: Key ("durableJobId")=(…) already exists`. ✅
- Leases, `leaseExpiresAt`, and `heartbeatAt` are persisted columns, not in-memory. ✅
- **Heartbeat renewal is owner-bound** — `renewAttemptHeartbeat` filters on
  `leaseOwner: input.workerId` **and** `finishedAt: null`. ✅
- **Stale workers cannot complete after recovery** — `completeAttemptSuccess:195-200`
  rejects with `stale_worker_completion` when `attempt.leaseOwner !== workerId`, and
  `:189` rejects an already-finished attempt. ✅
- **Concurrent reapers cannot both recover — proved.** Two concurrent
  `recoverExpiredRunningAttempts` calls on the same expired attempt:
  `ADV-6 {recovered: 0} {recovered: 1}` — exactly one won, via the
  `updateMany … WHERE finishedAt IS NULL` guard inside a `FOR UPDATE` transaction. ✅
- **Recovery depends on strategy and receipt** — `ATOMIC_APPLICATION_RECEIPT` +
  receipt → finalize `SUCCEEDED` (proved: `ADV-4`, `finalized: 1`); receipt absent →
  `RETRY_WAIT`; `NO_AUTOMATIC_RETRY` → dead-letter `application_outcome_uncertain`;
  `attemptCount >= maxAttempts` → dead-letter `max_attempts_exceeded`. ✅
- Abandoned outcomes are recorded (`LEASE_EXPIRED` with a failure summary). ✅

**Independent adversarial test — the defect.** The mandate requires proving *"no job
remains permanently RUNNING."* It can.

```
ADV-5 {
  threw:             'Error: webhook_application_key_requires_delivery',
  jobState:          'RUNNING',
  attemptFinishedAt: null
}
```

**Result: FAIL.** For a `webhook:`-typed durable job with `webhookDeliveryId = NULL`
and strategy `ATOMIC_APPLICATION_RECEIPT`, `lifecycle.server.ts:587` calls
`resolveApplicationKey`, which throws `webhook_application_key_requires_delivery`
(`execution-strategy.server.ts:80-83`). The throw escapes the per-attempt
`prisma.$transaction`, so:

1. The attempt-closing `updateMany` at `:571` **rolls back** — `finishedAt` stays
   `NULL`, the job stays `RUNNING`, and the lease stays expired. The job is
   **permanently `RUNNING`** and is re-selected on every subsequent reaper pass, where it
   throws again.
2. Worse, the throw propagates out of the `for` loop at `:554`, so
   **`recoverExpiredRunningAttempts` aborts the entire batch**. Because the batch is
   ordered `leaseExpiresAt: "asc"`, one poison row placed early blocks recovery of
   *every other* expired attempt in the control plane, across all shops, indefinitely.

There is no per-attempt error isolation anywhere in the reaper.

**Reachability.** `DurableJob.webhookDeliveryId` is nullable, and the codebase itself
treats `NULL` as reachable — `webhook-processor.ts:440-445` has an explicit guard for
exactly this case. The current intake path always sets it, so the trigger requires an
anomalous row: an upgrade-path row from the original PR 4 migration state (where the
correction migration's `DEFAULT 'ATOMIC_APPLICATION_RECEIPT'` is applied to *every*
pre-existing job regardless of type), a manually repaired row, or a future producer.
Reachability is therefore **low**, but the blast radius is **unbounded** — a single row
halts all attempt recovery cluster-wide with no alarm.

**Remaining weakness.** Evidence is also short: 3 tests versus ~9 named scenarios
(NEW-PR4-C03). Concurrent reapers, stale completion after recovery, expired-with-receipt,
uncertain-job dead-letter, and max-attempt dead-letter have **no repository test** — I
had to verify them myself.

**Severity disposition:** **P1 — NOT CLOSED.** Raised as **NEW-PR4-C02**. I rate this
P1 rather than P2 because "no job remains permanently RUNNING" is an explicit F-PR4-04
acceptance criterion, the failure is silent, and the batch-abort makes the impact
unbounded rather than confined to the offending row. The low reachability is stated
plainly so the severity can be re-weighed by ChatGPT with that in view.

**Permanent risk mapping:** R-104 — **remains OPEN**; mitigation incomplete.
R-032 — remains OPEN.

**Recommended correction.** Wrap each attempt's `prisma.$transaction` in a per-attempt
`try/catch` so one poison row cannot abort the batch; on an unresolvable application
key, close the attempt and dead-letter the job with
`application_outcome_uncertain` instead of throwing. Consider changing the
`DurableJob.executionStrategy` column default from `ATOMIC_APPLICATION_RECEIPT` to the
fail-closed `NO_AUTOMATIC_RETRY`, so pre-existing upgrade-path rows are never silently
promoted into a retryable atomic mode — the file's own docstring says *"No job may
default silently to a retryable mode without an explicit strategy,"* which the current
DB default contradicts.

**Missing test.** `test:sync-attempt-recovery` must add: reaper batch isolation with a
poison row; `webhookDeliveryId = NULL` recovery; concurrent reapers; stale completion
after recovery; expired-with-receipt finalize; uncertain dead-letter; max-attempt
dead-letter.

---

### P2

---

#### F-PR4-05 · P2 · TOCTOU-prone state transitions — **CLOSED**

Every transition is a CAS: `UPDATE … WHERE id = $1 AND state = CAST($2 AS
"DurableJobState") RETURNING *`, with a zero-row result raising
`illegal_job_transition` (`lifecycle.server.ts:91-109, 212-229, 307-326, 487-508`;
`dispatcher.server.ts:149-160, 312-325`). Mutating paths take `SELECT … FOR UPDATE`
first (`lockDurableJob`).

**Application and database graphs match exactly — proved mechanically.** I extracted the
14 pairs from `pg_proc.prosrc` for `stocky_durable_job_transition_guard` and the 14 pairs
from `DURABLE_JOB_TRANSITIONS`, sorted both, and diffed: **identical, 14 = 14.**

**The trigger rejects raw SQL — proved.** A direct
`UPDATE "DurableJob" SET state='SUCCEEDED'` from `PENDING`:
`ERROR 23514: illegal_job_transition:PENDING->SUCCEEDED`. The guard is
`BEFORE UPDATE OF "state" … FOR EACH ROW`, which fires for every writer including raw
SQL, because `state` cannot change without appearing in the `SET` list.

**Severity disposition:** P2 → **CLOSED**. **Risk:** R-099/R-104 supporting control in place.

---

#### F-PR4-06 · P2 · Control-plane role isolation — **CLOSED**

**ENABLE + FORCE RLS on 12/12 tables** — verified live (§11).

**Cross-role denial — proved live in `stocky_adv`:**

| Probe | Result |
|---|---|
| `stocky_runtime` → `DurableJob`, `JobDispatch`, `JobAttempt`, `WebhookDelivery`, `DeadLetter` | **all `permission denied`** ✅ |
| `stocky_runtime` → `SyncApplicationReceipt` | permitted — **correct**, it is a merchant table under tenant RLS |
| `stocky_control_plane` → `Supplier`, `PurchaseOrder`, `InventorySnapshot`, `SalesDailyAggregate`, `SyncApplicationReceipt` | **all `permission denied`** ✅ |
| `stocky_control_plane` → `Shop` | permitted — the **explicitly approved lifecycle access** (`processingEnabled` gate) |
| `stocky_runtime` → `stocky_has_application_receipt()` | **`permission denied for function`** ✅ |
| `stocky_control_plane` → `stocky_has_application_receipt()` | permitted, returns `f` — the narrow boolean probe |

**Role attributes** — no superuser, no BYPASSRLS, no CREATEROLE, no CREATEDB, NOINHERIT
on both service roles (§9). **Sequence and future default privileges:**
`tenant:enforcement:verify`, `tenant:enforcement:drift`, and the CI sequence/default-privilege
suites (steps 36, 37, 46) all pass. **Role verification is read-only and drift-sensitive:**
`tenant:roles:verify` and `sync:roles:verify` both exit 0; the CI verifier read-only suite
(step 38) passes.

**Residual:** NEW-PR4-C08 (SECURITY DEFINER ownership in production).

**Severity disposition:** P2 → **CLOSED**. **Risk:** R-102/R-103 class controls in place.

---

#### F-PR4-07 · P2 · Semantic inventory scanner — **CLOSED**

`sync:inventory:check` exits 0 and `test:sync-inventory-audit` passes **5/5**. Critically,
the suite is **not** self-congratulatory — it contains genuine negative fixtures that must
be *detected*:

- `detects planted direct Queue constructor outside allowlist` — plants a violation and
  asserts the scanner throws.
- `detects planted aliased control-plane client import` — plants an **aliased** import and
  asserts detection, proving alias/re-export coverage rather than literal grep.
- `JobDispatch is inventoried`; `SyncApplicationReceipt is inventoried as merchant-domain`.

Exceptions in `scripts/tenant-access/allowlist.ts` are exact-file and stable-ID based
(commits `4112313`, `fb87144`, `2aa91a8` add narrowly scoped, individually justified
entries rather than glob suppressions).

**Severity disposition:** P2 → **CLOSED**. **Risk:** R-105 class control in place.

---

#### F-PR4-08 · P2 · Divergent payload quarantine — **CLOSED**

`intake.server.ts:314-393`: on a digest mismatch for a known Shopify webhook ID the code
**preserves the original delivery**, increments `payloadDigestMismatchCount`, records
`lastConflictingDigest` / `firstMismatchAt` / `lastMismatchAt`, sets state `CONFLICT`
with `quarantineReason = "payload_digest_conflict"`, raises a **CRITICAL** `DataIssue`,
and cancels the in-flight durable job if it has not yet reached a terminal state. It
returns `conflict: true` and creates **no new job** — so no merchant effects are ever
applied from a divergent payload. Terminal deliveries (`COMPLETED` / `FAILED`) keep their
state rather than being retroactively rewritten. Verified by inspection and by
`test:sync-integration` (68 passed, includes `sync-intake-corrections`).

**Severity disposition:** P2 → **CLOSED**. **Risk:** R-032 supporting control in place.

---

#### F-PR4-11 · P2 · Index-supported dispatch claim at scale — **CLOSED**

Five partial indexes are created by the correction migration (`…210000:82-100`):
`DurableJob_eligible_pending_idx`, `DurableJob_eligible_retry_wait_idx`,
`DurableJob_shop_eligible_pending_idx`, `DurableJob_shop_eligible_retry_wait_idx`,
`DurableJob_running_lease_idx` — each keyed on `(nextEligibleAt ASC, createdAt ASC, …)`
matching the claim ORDER BY, and each partial on the exact claimed state.

`SYNC_PERF_JOB_COUNT=50000 npm run test:sync-performance` → **exit 0, 1 test passed**,
against real PostgreSQL 16.13 with 50,000 durable jobs. CI runs the same gate (step 62).

**Measurement caveat, stated rather than invented:** this is a disposable single-node
cluster with `fsync=off`; the result establishes that the plan is index-supported and the
claim completes at 50k, **not** a production SLA. No production latency target is claimed
here, and none should be inferred.

**Severity disposition:** P2 → **CLOSED**. **Risk:** R-106 class control in place.

---

#### F-PR4-12 · P2 · Projection bounds — **CLOSED**

`sanitize.server.ts:29-36` defines all seven required bounds:

| Bound | Value |
|---|---|
| `maxUtf8Bytes` | 262 144 |
| `maxDepth` | 8 |
| `maxNodes` | 2 000 |
| `maxArrayElements` | 500 |
| `maxLineItems` | 250 |
| `maxStringLength` | 4 096 |
| `maxObjectKeys` | 64 |

All fail **closed** with the stable codes `projection_bounds_exceeded` /
`projection_scalar_type_invalid` — the header states *"On overflow: fail closed — no
silent truncation of operational data,"* and the code matches. Scalar fields reject
nested objects and arrays (`assertScalarId`, `:46-61`). Money is exact:
`/** Keep money fields as exact strings — never Number/parseFloat. */` with `moneyString`
applied to `price`, `total_discount`, `total_price`, `subtotal_price`, `total_tax`,
`total_discounts`. Intake routes bounds failures to a durable quarantine with a
`DataIssue` and **no** processing job (`intake.server.ts:255-289`).

**Severity disposition:** P2 → **CLOSED**. **Risk:** R-107 class control in place.

---

#### F-PR4-13 · P2 · Per-shop dispatch fairness — **CLOSED**

`claimBatchFair` (`dispatcher.server.ts:106-132`) ranks candidates with
`ROW_NUMBER() OVER (PARTITION BY "shopId" ORDER BY "nextEligibleAt", "createdAt", id)`
and admits only `shop_rank <= maxPerShop` (default 2) per pass, so a single-shop backlog
cannot monopolize the claim window. Concurrency safety is preserved by
`FOR UPDATE SKIP LOCKED` plus a per-row CAS. Covered by the performance/fairness gate
(CI step 62, `F-PR4-11/13`), which passed here at 50 000 jobs.

**Severity disposition:** P2 → **CLOSED**. **Risk:** R-106 class control in place.

---

#### F-PR4-18 · P2 · API version 2026-07 — **CLOSED IN PART**

`TARGET_API_VERSION = "2026-07"`; `SUPPORTED_API_VERSION_ADAPTERS = ["2025-10",
"2026-07"]`; `.graphqlrc.ts` uses `ApiVersion.July26`. Unsupported or missing versions
are **durably quarantined** with a `DataIssue` and **no** processing job
(`intake.server.ts:175-241`) rather than dropped — the original concern is resolved, and
the HTTP acknowledgement policy is documented in `api-version.server.ts:6-11`.

**Not independently verifiable here:** *"GraphQL operations validate against the intended
live schema."* `npm run graphql-codegen` cannot complete in this sandbox because
`shopify.dev` is not in the egress allowlist (§10). CI validated it at the exact head
(step 104). The source itself records the same gap: *"Q-003 remains open until independent
live-schema validation against 2026-07"* (`api-version.server.ts:7`).

**Severity disposition:** P2 → **CLOSED IN PART**; live-schema validation deferred to
Q-003, which correctly remains open. **Risk:** R-108 class control partially in place.

---

#### F-PR4-19 · P2 · `REDIS_URL` redaction placeholder — **CLOSED**

`queue.server.ts:24-38` requires `REDIS_URL` explicitly
(`redis_url_not_configured: REDIS_URL must be set explicitly for queue functionality`)
and rejects a redaction placeholder outright
(`redis_url_invalid: REDIS_URL must not be a redaction placeholder`). No literal
`"[REDACTED]"` default remains. Covered by the tenant queue/Redis gate (CI step 66),
which passes.

**Severity disposition:** P2 → **CLOSED**. **Risk:** R-110 class control in place.

---

#### F-PR4-20 · P2 · Missing webhook ID — **CLOSED**

`intake.server.ts:113-171`: a null/blank `webhookId` produces a durable
`WebhookDelivery` with `shopifyWebhookId = NULL`, state `QUARANTINED`,
`quarantineReason = "missing_shopify_webhook_id"`, and a `DataIssue` — and returns
`job: null`. **No time-based key is ever invented** (the input type documents
*"Null/undefined → quarantine; never invent a time-based key"*) and **no merchant effect
occurs.** The column is correctly nullable, and the schema supports it via the partial
unique `WebhookDelivery_shopId_shopifyWebhookId_nonnull_key … WHERE "shopifyWebhookId"
IS NOT NULL`, so multiple ID-less quarantines coexist without collision. Even sanitizer
failure still yields a quarantine receipt.

**Severity disposition:** P2 → **CLOSED**. **Risk:** R-109 supporting control in place.

---

### P3

---

#### F-PR4-09 · P3 · Stale identity in reports — **CLASSIFIED / CLOSED**

Every SHA in the PR body and the correction backlog's chain-of-custody section was
checked against actual Git history: `origin/main` `e69bc53d…`, correction start
`944cd59…`, original reviewed head `7c36bc1…`, correcting commits `b6f6183…` and
`0697a287…`, prior failing head `7caaf9a…` (run 30969608214). **All match.** The prior
failing run and job IDs are consistent with the recorded failure narrative.

---

#### F-PR4-10 · P3 · `PROJECT_STATUS.md` does not name PR #20 — **CLOSED**

`docs/PROJECT_STATUS.md:11` now reads
`**Active implementation PR:** #20 — OPEN, DRAFT, UNMERGED`, with the branch at line 10
and PR 5 recorded as BLOCKED at line 17. Corrected. *(A separate staleness issue in the
same file is raised as NEW-PR4-C05.)*

---

#### F-PR4-14 · P3 · Vacuous dead-letter assertion — **CLOSED**

The literal no-op is gone. `completeAttemptDeadLetterInTx:459-467` now **re-reads the
live row** (`preDeadLetter`), returns early if it is already `DEAD_LETTERED`, and calls
`assertTransition(preDeadLetter.state, "DEAD_LETTERED")` against that live state. The
subsequent CAS binds `WHERE state = CAST(${preDeadLetter.state} AS "DurableJobState")`.
The assertion is real, and the comment `// F-PR4-14: assert against the live job state,
not a vacuous literal pair.` accurately describes the code.

---

#### F-PR4-15 · P3 · Replay guards — **CLOSED**

`replay.server.ts` locks the `DeadLetter` row `FOR UPDATE` and requires
`resolutionState === "OPEN"` (`:49-61`), then locks the original `DurableJob` `FOR
UPDATE` and requires `state === "DEAD_LETTERED"` (`:68-80`). **Both conditions, both
under locks.** Replay creates a *new* `PENDING` job with `causationId` set to the
original and — importantly for F-PR4-01 — preserves `webhookDeliveryId` so the
application key stays stable and replay cannot duplicate merchant effects.

---

#### F-PR4-16 · P3 · Worker authority binding — **CLOSED**

`webhook-processor.ts:377-420` explicitly binds, before any merchant access:
shop (`durable.shopId !== ctx.envelope.shopId`), durable job
(`durable.id !== ctx.envelope.durableJobId`), payload digest
(`durable.payloadDigest !== ctx.envelope.payloadDigest`), dispatch ID and dispatch
sequence (passed as `expectedDispatchId` / `expectedDispatchSequence` into
`resolveTenantJobContextV3`), queue job ID (checked twice — against `job.data.queueJobId`
and against the live BullMQ `job.id`), and queue name / source / correlation / causation
inside envelope v3. Cancellation is checked before claiming. Each mismatch raises a
distinct stable error code.

---

#### F-PR4-17 · P3 · Long-running-transaction and uninstall visibility — **CLOSED**

Documented accurately and without overclaim in `uninstall.server.ts:5-14` (quoted under
F-PR4-03) and referenced from
`PR4_SYNC_CONTROL_PLANE_ARCHITECTURE.md`. The wording explicitly refuses to claim
instantaneous cancellation of an already-completed statement, which matches the observed
behavior.

---

## 14. New findings

### NEW-PR4-C01 · **P1** · Dispatcher acks `ENQUEUED` for a non-runnable retained queue job

- **File / line:** `stocky-plus/app/sync/dispatcher.server.ts:258-261`, `:395-396`
  (return value discarded), `:222-224` (same path, shop-disabled branch)
- **Evidence:** `ADV-1` — `durableJobState='ENQUEUED'`, `runnableInRedis=0`,
  `failedInRedis=1`
- **Merchant impact:** the webhook is silently never applied. Sales aggregates, inventory
  snapshots, BOM effects, and low-stock alerts diverge permanently from Shopify. No dead
  letter, no `DataIssue`, no alert, no reconciliation trigger.
- **Reproduction:** §13 F-PR4-02.
- **Expected behavior:** no `DISPATCH_LEASED → ENQUEUED` transition unless a **runnable**
  dispatch is demonstrably present in Redis.
- **Recommended correction / missing test:** §13 F-PR4-02.
- **Risk:** R-099 remains OPEN.

### NEW-PR4-C02 · **P1** · Reaper throws on `NULL` `webhookDeliveryId`, stranding the job and aborting the batch

- **File / line:** `stocky-plus/app/sync/lifecycle.server.ts:554` (no per-attempt error
  isolation), `:587` (`resolveApplicationKey`);
  `app/sync/execution-strategy.server.ts:80-83` (the throw)
- **Evidence:** `ADV-5` — `threw: webhook_application_key_requires_delivery`,
  `jobState: 'RUNNING'`, `attemptFinishedAt: null`
- **Merchant impact:** the affected job never completes and never dead-letters; and
  because the throw aborts the whole reaper batch, **all** attempt recovery halts
  cluster-wide across every shop, silently.
- **Reproduction:** §13 F-PR4-04.
- **Expected behavior:** per-attempt error isolation; an unresolvable application key
  dead-letters with `application_outcome_uncertain` rather than throwing.
- **Recommended correction / missing test:** §13 F-PR4-04.
- **Risk:** R-104 remains OPEN.

### NEW-PR4-C03 · **P2** · P1 acceptance-test evidence materially short of the declared criteria

- **File:** `app/sync/__tests__/sync-exactly-once.test.ts` (4 tests),
  `sync-attempt-recovery.test.ts` (3 tests)
- **Evidence:** the backlog's own `Acceptance test` rows name ~14 scenarios for F-PR4-01
  and ~9 for F-PR4-04. Implemented: 4 and 3. Not covered by any repository test — crash
  after tenant commit before control-plane success; concurrent workers; duplicate
  delivery; replay; refund / cancel / inventory / BOM / low-stock exact outcomes;
  catalog-sync and ABC repeated execution; unknown job types; concurrent reapers; stale
  completion after recovery; expired-with-receipt; uncertain dead-letter; max-attempt
  dead-letter.
- **Merchant impact:** the strongest exactly-once and recovery guarantees rest on
  unverified code paths. I verified several myself (`ADV-4`, `ADV-6`), but a review
  fixture is not a regression gate — nothing prevents these paths from breaking later.
- **Expected behavior:** each acceptance-test row in the backlog maps to at least one
  committed, CI-gated test.
- **Missing test:** as enumerated above.

### NEW-PR4-C04 · **P2** · Exactly-once is conditional on envelope version

- **File / line:** `app/jobs/workers/webhook-processor.ts:654-659` (v1 path),
  `:599-601` (v2 path without `webhookDeliveryId`)
- **Evidence:** the v1 path calls `runLegacyWebhookHandler` directly — **no durable job,
  no attempt, no application receipt**. The v2 path skips the receipt entirely when
  `durable.webhookDeliveryId` is null.
- **Merchant impact:** during the deploy compatibility window, in-flight v1/v2 jobs apply
  merchant writes with the **pre-correction** duplicate-application semantics. Exploiting
  it deliberately would require the envelope HMAC secret, so this is a durability and
  rollout concern rather than an authentication one.
- **Expected behavior:** either drain v1/v2 before enabling the correction, or route
  every durable webhook through the receipt regardless of envelope version, or fail
  closed on v1.
- **Missing test:** a v1/v2 envelope must not be able to apply merchant writes twice.

### NEW-PR4-C05 · **P3** · Evidence hygiene — stale "implement corrections" next action

- **File / line:** `stocky-plus/docs/PROJECT_STATUS.md:66`
- **Evidence:** `**Next action:** Implement all 20 findings; return to ChatGPT …` — but
  the corrections **are** implemented at this head, and
  `docs/phases/phase-1/README.md:10` correctly states
  `**Next authorized implementation unit:** Independent Claude Code PR 4 correction
  review`. The two documents disagree about the active next action.
- **Impact:** documentation-only.
- **Classified separately and NOT repaired during this review**, per the review mandate.

### NEW-PR4-C06 · **P3** · Unreachable `completeAttemptFail` branch would strand a `RUNNING` job

- **File / line:** `app/sync/lifecycle.server.ts:359-378`
- **Evidence:** when `deadLetter !== true` and `attemptCount < maxAttempts`, the code
  finishes the attempt, passes a synthetic `state: "FAILED"` to
  `completeAttemptDeadLetterInTx` while the **database row is still `RUNNING`**, so the
  `RUNNING → FAILED` update at `:439` is skipped and `:467` asserts
  `RUNNING → DEAD_LETTERED` — not a legal edge in either graph. It fails closed
  (throws), but leaves the job `RUNNING` with an already-finished attempt, which the
  reaper cannot see (it selects only `finishedAt: null`).
- **Reachability:** **none today** — both production callers
  (`webhook-processor.ts:509`, `:623`) pass `deadLetter: true`. Guarded only by caller
  discipline.
- **Missing test:** a direct `completeAttemptFail({ deadLetter: false })` unit test.

### NEW-PR4-C07 · **P3** · Migration fixture hygiene

- **File / line:** `scripts/tenant-backfill/tests/tenant-expansion.migration.test.ts:273-279`, `:315`
- **Evidence (a):** the test `CREATE ROLE stocky_control_plane` and **never drops it**
  (independently observed: role count `0` before the run, `1` after). Both call sites of
  `assertControlPlanePoliciesMatchRole` (`:331`, `:433`) execute *after* that creation, so
  within a single run of this file the **role-absent branch (`toBe(0)`) is unreachable**.
  The dual-environment coverage the correction claims is not achieved by the file itself —
  I had to build a second cluster to exercise the absent case.
- **Evidence (b):** `expect(second.toLowerCase()).toMatch(/no pending|already|up to
  date|0/)` — the bare `0` alternative matches almost any Prisma output (every migration
  name contains `0`), making the *string* assertion near-vacuous. It is saved by the real
  `_prisma_migrations` count assertions that follow.
- **Impact:** test-quality and cross-test isolation only; the substantive assertions hold.
- **Missing test:** drop the role in an `afterAll`, or assert the absent branch in a
  dedicated case; tighten the second-deploy regex to `/no pending migrations/`.

### NEW-PR4-C08 · **P3** · `SECURITY DEFINER` probe ownership

- **File / line:** `prisma/migrations/20260804210000_sync_control_plane_correction/migration.sql:330-354`
- **Evidence:** `stocky_has_application_receipt(text, text)` is `SECURITY DEFINER` and is
  owned by the migration role — `stocky`, which is **superuser** in CI and in this review
  environment. It therefore executes with superuser rights and bypasses RLS on a merchant
  table.
- **Mitigations already present:** `REVOKE ALL … FROM PUBLIC`; `EXECUTE` granted only to
  `stocky_control_plane` (runtime is denied — proved live); `SET search_path = pg_catalog,
  pg_temp`; the body is a fixed `sql`/`STABLE` existence check requiring **both** `shopId`
  and `applicationKey`, so it leaks at most one bit to a caller that already knows both.
  The migration itself documents the requirement at `:317-320`.
- **Expected behavior:** in production the migration owner must be non-superuser and
  non-BYPASSRLS, so the definer's rights are bounded.
- **Missing test:** a role-provisioning assertion that the owner of every `SECURITY
  DEFINER` function is non-superuser and non-BYPASSRLS.

---

## 15. Risk disposition (permanent `RISK_REGISTER.md` definitions)

Using the permanent definitions in `stocky-plus/docs/RISK_REGISTER.md`. No shifted or
mismatched labels from the original review report were used.

| Risk | Permanent definition | Independent disposition |
|---|---|---|
| **R-031** | Queued jobs continuing after uninstall | Mitigation **implemented and verified** (F-PR4-03). Remains **OPEN** until PR 4 acceptance. |
| **R-032** | Webhook replay / reconciliation failure | Mitigation **partially implemented**. Remains **OPEN** — depends on R-099 and R-104. |
| **R-099** | DB/Redis dispatch gap or duplicate enqueue | **OPEN — mitigation incomplete.** NEW-PR4-C01 reproduces the failure class the mitigation was meant to remove. |
| **R-101** | Uninstall race permits queued merchant access | Mitigation **implemented and verified** (F-PR4-03). Remains **OPEN** until acceptance. |
| **R-104** | Stuck leases / concurrent attempts create duplicate application | **OPEN — mitigation incomplete.** Duplicate-application controls verified; NEW-PR4-C02 defeats "no permanently RUNNING job" and halts recovery. |
| **R-109** | Duplicate merchant-domain effects after retry/replay | Mitigation **implemented and adversarially verified** (`ADV-4`). Remains **OPEN** pending NEW-PR4-C03 / C04. |
| **R-112** | Independent-review finding-count and risk-mapping inconsistency | **Addressed by this report** — the reconciled 4/10/6 = 20 count and permanent risk definitions were used throughout. Remains OPEN until ChatGPT accepts. |
| R-033, R-039 | Phase 1 residuals | Unchanged by this review. |
| R-095…R-098 | Accepted nonblocking PR 3 residuals | Unchanged; not modified in PR 4. |

**No permanent risk may be closed on the strength of this review.** Two P1 mitigations
are incomplete.

---

## 16. Safety and scope results

| Requirement | Result |
|---|---|
| No production migration executed | ✅ Two disposable local clusters only (`:5433`, `:5434`) |
| No production queue executed | ✅ Local Redis 7.0.15 on `:6380`, isolated DB index |
| No real webhook replayed | ✅ All payloads synthetic |
| No merchant data accessed | ✅ No production credentials present in the environment |
| No ownership repair performed | ✅ |
| No inventory mutation performed | ✅ |
| Inventory-write flags default OFF | ✅ `FEATURE_STOCKTAKE_INVENTORY_WRITES`, `FEATURE_ADJUSTMENT_WRITES`, `FEATURE_RECEIPT_WRITES`, `FEATURE_COST_SYNC`, `FEATURE_TRANSFER_WRITES` all `false`; asserted by the migration suite's flags-OFF test |
| No PR 5 fact implementation in the branch | ✅ Confirmed against the 66-file delta |
| No forecasting / purchasing / receiving / billing / AI / privacy-deletion scope leaked | ✅ Confirmed against the delta |
| No secrets or environment files committed | ✅ `git status` clean; all secrets are CI test-only placeholders in `ci.yml` marked `# pragma: allowlist secret`; no `.env` exists in `stocky-plus/` |
| No direct `main` commit | ✅ `origin/main` unchanged at `e69bc53d…` |
| Original review report unedited | ✅ Absent from the correction delta |
| Runtime code / migrations / tests / config / inventories / PR body unmodified by this review | ✅ Only the new report file is added |
| Disposable review fixtures not committed | ✅ Both fixtures deleted; `git status --porcelain` clean before the report commit |
| PR not marked ready, not merged | ✅ |

**Environment limitations** (stated, not worked around):

1. `npm run graphql-codegen` cannot run — `shopify.dev` is outside this sandbox's egress
   allowlist. Live 2026-07 schema validation is therefore **not independently confirmed**
   here; CI confirmed it at the exact head. Q-003 remains open.
2. Node is v22.22.2 here versus 22.19.0 in CI; both satisfy `engines`. npm is pinned to
   the required 11.5.2.
3. Performance numbers come from a single-node cluster with `fsync=off`; they establish
   index-supported plan shape at 50 000 jobs, **not** a production SLA.
4. Redis restart resilience was not exercised; BullMQ retention semantics were exercised
   only through the retained-failed path in `ADV-1`.

---

## 17. Remaining blockers

1. **NEW-PR4-C01 (P1)** — dispatcher acknowledges `ENQUEUED` with no runnable dispatch in
   Redis; durable job permanently stranded; **F-PR4-02 not closed**; R-099 OPEN.
2. **NEW-PR4-C02 (P1)** — reaper throws on `NULL` `webhookDeliveryId`, stranding the job
   `RUNNING` and aborting all attempt recovery; **F-PR4-04 not closed**; R-104 OPEN.
3. **NEW-PR4-C03 (P2)** — P1 acceptance-test evidence materially short of the declared
   criteria.
4. **NEW-PR4-C04 (P2)** — v1/v2 envelope paths bypass the application receipt.
5. **F-PR4-18** — live 2026-07 schema validation outstanding (Q-003), not verifiable in
   this environment.

P3 items NEW-PR4-C05 through NEW-PR4-C08 are non-blocking and recorded for the next
correction cycle.

---

## 18. Final recommended next action

Return to **ChatGPT** for technical-acceptance adjudication of this report. PR 4 is
**NOT READY** for acceptance.

Recommended sequence:

1. ChatGPT adjudicates NEW-PR4-C01 and NEW-PR4-C02 and, if confirmed, records a new
   correction decision (successor to D-043) covering the two P1 defects plus the two P2
   residuals.
2. Cursor implements the corrections and the missing tests named in §13 and §14.
3. A new exact-head CI run is produced.
4. A further independent correction review is commissioned against the new head.
5. Only then may PR 4 acceptance be reconsidered.

Until then:

- PR #20 remains **OPEN, DRAFT, UNMERGED**.
- **PR 5 remains BLOCKED.**
- **Phase 1 is not complete.**
- **Production is not authorized.**

---

## 19. Commit identity for this report

| Artifact | SHA |
|---|---|
| **Reviewed implementation head** | `0697a2878eed3ce8013f59af54de7d0adf98d548` |
| **Review-report-only commit** | recorded in the return summary after push |

The review-report commit contains **only** this file. It is **not** the implementation
head and must never be represented as such.
