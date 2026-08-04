# PR 4 — Synchronization Control Plane — Independent Review Report

**Phase:** 1
**Work unit:** PR 4 — Synchronization control plane
**Pull request:** [#20](https://github.com/Vedang1998/Stocky/pull/20) — OPEN, DRAFT, UNMERGED
**Branch:** `phase-1/sync-control-plane`
**Reviewer:** Claude Code (independent review)
**Implementation owner:** Cursor
**Technical acceptance authority:** ChatGPT
**Merge authority:** User only
**Review date:** 2026-08-04

---

## 1. Verdict

```
NOT READY — CORRECTIONS REQUIRED
```

The synchronization control plane is a substantial and largely well-constructed
piece of work. Durable DB-first intake, envelope v2 authority binding, replay
lineage, additive migrations, and the tenant/control-plane role split are real
and independently verified. Every command in the required suite that this
environment could execute passed at the exact reviewed head.

However, the PR does **not** currently satisfy its own core durability and
uninstall-denial claims. Four P1 defects were independently reproduced on a
disposable environment:

- uninstall is **denied and rolled back** when any job is `DISPATCH_LEASED`,
  leaving the shop **processing-enabled** after an uninstall webhook;
- a worker crash after attempt claim leaves the job **permanently stuck in
  `RUNNING`** with no recovery, no dead letter, and no alert — durable event loss;
- retry re-dispatch **reuses the BullMQ job ID**, is silently deduplicated by
  Redis, and is then **acknowledged as `ENQUEUED`** although nothing was delivered;
- there is **no exactly-once business application** — no per-event application
  marker, and merchant-domain writes are not atomic with job completion, so any
  retry or replay of a partially applied event duplicates sales effects.

These are exactly the properties Section 25 requires before a ready verdict.

---

## 2. Finding counts

| Severity | Count |
|---|---|
| **P0** | 0 |
| **P1** | 4 |
| **P2** | 7 |
| **P3** | 4 |

No cross-tenant exposure, broken authentication, secret exposure, or destructive
migration was found.

---

## 3. Identity and Git chain of custody

Verified mechanically from Git and the GitHub API.

| Field | Value | Verified |
|---|---|---|
| Authorized base (`origin/main`) | `e69bc53d91db75472b0d0998bf1b74ee6246adb1` | ✅ |
| Reviewed head (`HEAD`) | `7c36bc1bf2a1d6ccbd0e9d7131ae2d692fefea7a` | ✅ |
| `origin/phase-1/sync-control-plane` | `7c36bc1bf2a1d6ccbd0e9d7131ae2d692fefea7a` | ✅ |
| Merge base | `e69bc53d91db75472b0d0998bf1b74ee6246adb1` | ✅ |
| Working tree | clean | ✅ |
| PR #20 state | OPEN / DRAFT / UNMERGED | ✅ |
| PR #20 base → head | `main` ← `phase-1/sync-control-plane` | ✅ |
| Changed files / commits | 61 files, 11 commits, +5916 / −417 | ✅ |

The branch head did not move during the review.

### Commit classification

| # | SHA | Subject | Class |
|---|---|---|---|
| 1 | `0db313f` | Implement Phase 1 PR 4 sync control-plane runtime | runtime + schema/migration + test + CI |
| 2 | `88ba3d5` | Fix control-plane role re-export style | enforcement/role tooling |
| 3 | `65cef1a` | Fix Prisma JSON casts and envelope narrowing | runtime |
| 4 | `c2870cc` | Harden tenant-access allowlist, RLS expect, queue v2 tests | test + tooling |
| 5 | `0111e4e` | Fix `updatedAt` defaults for Prisma schema drift | schema/migration |
| 6 | `588fe0a` | Provide control-plane DB URL to CI queue/Redis tests | CI |
| 7 | `8871175` | Refresh PR2 tenant-access inventory | generated inventory |
| 8 | `89aeea8` | Park post-init migrations in init-only deploy test | **test (last runtime/test change)** |
| 9 | `1a9a060` | Record PR4 exact-head CI evidence | documentation |
| 10 | `fc32066` | Document PR4 exact-head CI run | documentation |
| 11 | `7c36bc1` | Fill documentation tip SHA | documentation |

No prior independent review record was modified. Verified: the diff touches no
file matching `*REVIEW_REPORT*`, `*CORRECTION*`, `*CLOSURE*`, or `*RESIDUAL*`.

---

## 4. Actual last runtime/test-changing head

**Independently derived — not accepted on assertion.**

```
git diff --name-status 89aeea8..HEAD
M  stocky-plus/docs/PROJECT_STATUS.md
M  stocky-plus/docs/phases/phase-1/PR4_SYNC_CONTROL_PLANE_IMPLEMENTATION_REPORT.md
```

Per-commit inspection confirms `1a9a060`, `fc32066`, and `7c36bc1` each touch
only Markdown under `stocky-plus/docs/`. `89aeea8` is the last commit to modify
any runtime, schema, migration, test, or CI file
(`scripts/tenant-backfill/tests/tenant-expansion.migration.test.ts`).

**Conclusion:** Cursor's claim that `89aeea8` is the last runtime/test head is
**independently verified as correct**.

---

## 5. Documentation identity discrepancy — disposition

All four recorded discrepancies are **documentation-only**. No runtime, schema,
test, or CI file changed after `89aeea8`. Per instruction, none were repaired
during this review.

| Discrepancy | Finding | Severity |
|---|---|---|
| PR body / handoff state head `…d705fefea7a`; actual is `…d692fefea7a` | F-PR4-09 | P3 |
| Implementation report records "Documentation tip `fc320668…`" although `7c36bc1` exists | F-PR4-09 | P3 |
| Implementation report commit list ends at `fc320668`, omitting `7c36bc1` | F-PR4-09 | P3 |
| `PROJECT_STATUS.md` says "Active implementation PR: pending draft open" rather than naming PR #20 | F-PR4-10 | P3 |

**Required correction before acceptance:** update the PR body head SHA, the
implementation report's documentation tip and commit list, and `PROJECT_STATUS.md`
to name PR #20. These are evidence-hygiene corrections only and do not alter the
technical assessment.

---

## 6. Exact-tip CI verification

Independently inspected via the GitHub API.

| Field | Reported | Verified |
|---|---|---|
| Workflow | CI | ✅ `name: "CI"` |
| Run | `30944452132` | ✅ |
| `head_sha` | `7c36bc1bf2a1d6ccbd0e9d7131ae2d692fefea7a` | ✅ exact match |
| `head_branch` | `phase-1/sync-control-plane` | ✅ |
| Event | — | `pull_request` |
| Status / conclusion | success | ✅ `completed` / `success` |
| Run attempt | — | 1 |
| Associated PR | #20 | ✅ |
| `head_commit.id` | — | `7c36bc1…d692fefea7a` |

The exact-tip run's `head_sha` matches the reviewed head exactly, so run
`30944452132` **is** authoritative current-tip CI evidence.

Note: the PR body itself does **not** claim `7c36bc1` as the CI head — it
correctly presents `89aeea8` / run `30942153868` as the runtime/test acceptance
evidence and labels `7c36bc1` as docs-only. That framing is accurate and is a
point in the submission's favour.

**Workflow inspection** (`.github/workflows/ci.yml`): no `continue-on-error`,
no material skipped step, no test command that silently runs zero tests. Node is
pinned to `22.19.0` and npm to `11.5.2` with an explicit assertion
(`test "$(npm --version)" = "11.5.2"`). Superseded failed runs are recorded
accurately in the PR body; historical failure correction is **not** treated here
as proof that the final controls are non-vacuous — see F-PR4-06 and F-PR4-07,
where controls that pass CI were independently shown to be vacuous.

One environment-fallback flag warrants comment: CI sets
`STOCKY_ALLOW_CONTROL_PLANE_URL_FALLBACK: "1"` globally. This does **not** mask
the security model, because `resolveControlPlaneDatabaseUrl`
(`app/sync/control-plane-db.server.ts:16-23`) gives explicit
`DATABASE_CONTROL_PLANE_URL` precedence, and both control-plane steps set it to
the `stocky_control_plane` role URL. The fallback is therefore inert in CI.

---

## 7. Scope verification

**In scope and implemented:** persistent webhook inbox, DB-backed idempotency,
durable jobs/attempts, DB→BullMQ dispatch, dead letters, replay lineage,
validated durable job authority (envelope v2), sync runs and cursors,
reconciliation/data-issue scaffolding, deterministic sync health, uninstall
processing denial, Shopify API target `2026-07`.

**No scope leakage found.** Independently verified:

- no PR 5 catalog/product/variant/location/inventory-state fact tables;
- no PR 6 order/line/cancellation/adjustment/refund fact tables;
- no forecasting or ABC redesign (existing services are wrapped, not changed);
- no purchasing, receiving, stocktake, transfer, cost-ledger, billing,
  entitlement, or AI code;
- no privacy-redaction expansion beyond sanitized projections;
- **no Shopify inventory mutation** — `grep -riE "inventorySet|inventoryAdjust|inventoryActivate|productVariantUpdate"` over `app/sync/` and `scripts/sync-control-plane/` returns nothing;
- no inventory-write feature flag added or defaulted on;
- no dependency change — the `package.json` diff adds only npm scripts;
- no `.env`, Redis dump, database dump, key, or certificate committed;
- no direct commit or merge to `main`.

---

## 8. Disposable environment

Built independently. Cursor's database, Redis state, fixtures, and generated
reports were not reused.

| Item | Value |
|---|---|
| OS | Ubuntu 24.04.4 LTS, Linux 6.18.5 x86_64 |
| Node | v22.22.2 |
| npm | 11.5.2 (pinned to match `engines`) |
| PostgreSQL | 16.13 |
| Redis | 7.0.15 |
| Database | `stocky_pr4_review` (disposable, rebuilt from scratch) |
| Migration owner | `stocky` (table owner) |
| Restricted runtime role | `stocky_runtime` — `rolsuper=f`, `rolbypassrls=f`, `rolcreatedb=f`, `rolcreaterole=f`, `rolinherit=f`, `rolcanlogin=t` |
| Control-plane role | `stocky_control_plane` — `rolsuper=f`, `rolbypassrls=f`, `rolinherit=f` |
| Shopify credentials | none (test placeholders only) |
| Merchant data | none |
| Inventory-write flags | all `false` |
| Commit under test | `7c36bc1bf2a1d6ccbd0e9d7131ae2d692fefea7a` |

No passwords or connection strings are reproduced in this report.

---

## 9. Command evidence

All commands run at `7c36bc1…d692fefea7a` in the disposable environment above.

| Command | Exit | Result |
|---|---|---|
| `npm ci` | 0 | clean install (requires npm 11.5.2; npm 10.x fails `EBADENGINE`) |
| `npx prisma generate` | 0 | ✅ |
| `npx prisma validate` | 0 | schema valid |
| `npx prisma migrate deploy` (1st) | 0 | 7 migrations applied |
| `npx prisma migrate deploy` (2nd) | 0 | "No pending migrations" — **idempotent** |
| `npm run tenant:indexes:apply -- --apply` | 0 | 44 created |
| `npm run tenant:indexes:verify` | 0 | `ok:true, mismatches:[]` |
| `npm run tenant:schema:drift` | 0 | ✅ |
| `npm run tenant:access:audit` | 0 | `tenant_access_audit_ok`, 18 models |
| `npm run tenant:access:inventory:check` | 0 | fresh |
| `npm run tenant:enforcement:inventory:check` | 0 | fresh |
| `npm run tenant:roles:verify` | 0 | `ok:true, failures:[]` |
| `npm run tenant:rls:verify` | 0 | `ok:true, issues:[]` |
| `npm run tenant:immutability:verify` | 0 | `ok:true, issues:[]` |
| `npm run tenant:enforcement:verify` | 0 | `ok:true, issues:[]` |
| `npm run tenant:enforcement:drift` | 0 | `ok:true, issues:[]` |
| `npm run sync:inventory:check` | 0 | OK, `surfaces=34` |
| `npm run sync:roles:verify` | 0 | `ok:true, errors:[]` |
| `npm run test:sync-integration` | 0 | **29 passed** (3 files) |
| `npm run test:db-isolation` | 0 | **19 passed** (2 files) |
| `npm run test:tenant-access` | 0 | **288 passed** (34 files) |
| `npm test` | 0 | **82 passed** (8 files) |
| `npm run lint` | 0 | clean |
| `npm run typecheck` | 0 | clean |
| `npm run build` | 0 | server + client build succeeded |
| `npm run graphql-codegen` | 1 | **environment-blocked** — see below |
| `npm audit --omit=dev` | 1 | 7 high (react-router chain) — **pre-existing, unchanged by this PR** |
| `npm run test:migrations` | 0 | **216 passed** (47 files) — see §9.1 |

Test counts were confirmed non-zero in every suite; no suite silently ran zero tests.

### `graphql-codegen` — environment-blocked, not an implementation defect

The codegen step fails in this environment because outbound egress to
`shopify.dev` is blocked by the sandbox proxy:

```
POST https://shopify.dev/admin-graphql-direct-proxy/2026-07
403 Forbidden — "Host not in allowlist: shopify.dev"
```

This is **positive evidence** for the API-version review: the resolved
introspection endpoint is literally `/2026-07`. The step succeeds in CI, where
egress is permitted. Classified as an environment limitation, not a code failure.

### 9.1 `test:migrations` — verified on clean re-run

A first run of `test:migrations` was started in the background and later
terminated by the reviewer because it concurrently reset the schema and corrupted
other measurements in progress. Its reported summary (10 failed / 203 passed) is
**an artifact of that termination and must not be read as a result**.

A clean, serial re-run on the rebuilt disposable environment completed
successfully:

```
Test Files  47 passed (47)
     Tests  216 passed (216)
exit 0
```

`test:migrations` is therefore **independently verified as passing** at the
reviewed head.

---

## 10. Migration results

**File:** `prisma/migrations/20260804180000_sync_control_plane/migration.sql` (417 lines)

- **Additive only.** `grep -niE "DROP TABLE|DROP COLUMN|DROP CONSTRAINT|TRUNCATE|DELETE FROM|ALTER COLUMN .* TYPE|SET NOT NULL"` returns **no matches**. No unauthorized destructive operation.
- **Idempotent.** `prisma migrate deploy` run twice; second run applied nothing. All indexes use `CREATE UNIQUE INDEX IF NOT EXISTS`; all FKs are added inside guarded `DO` blocks.
- **Empty/init-only database:** applied cleanly from scratch (7 migrations, exit 0).
- **Current-schema database:** re-deploy is a no-op.
- **Prisma drift:** `tenant:schema:drift` and `prisma validate` both clean.

---

## 11. Database role privilege matrix

Observed in the provisioned baseline.

| Role | `rolsuper` | `rolbypassrls` | `rolcreaterole` | `rolcreatedb` | `rolinherit` | Owns objects |
|---|---|---|---|---|---|---|
| `stocky` (migration owner) | t | f | — | — | t | tables |
| `stocky_runtime` | f | f | f | f | f | none |
| `stocky_control_plane` | f | f | f | f | f | none |

**Runtime role vs. control plane** — verified by direct catalog query:

```sql
SELECT table_name, privilege_type FROM information_schema.role_table_grants
WHERE grantee='stocky_runtime' AND table_name IN (10 control-plane tables);
-- (0 rows)
```

`stocky_runtime` holds **no privilege of any kind** on `DurableJob`,
`WebhookDelivery`, `JobAttempt`, `DeadLetter`, `JobReplay`, `SyncRun`,
`SyncCursor`, `ReconciliationRun`, `DataIssue`, or `SyncHealth`. Neither role
holds `BYPASSRLS` or owns any object. The **provisioned state is correct.**

### Adversarial drift matrix

Each defect was planted against the clean baseline and every relevant verifier
was executed. This is where the control-plane isolation story breaks down.

| # | Planted defect | Detected by |
|---|---|---|
| 1 | `GRANT SELECT ON "PurchaseOrder" TO stocky_control_plane` | ❌ **none** |
| 2 | `GRANT INSERT ON "Supplier" TO stocky_control_plane` | ✅ `sync:roles:verify` |
| 3 | `GRANT INSERT,UPDATE,DELETE ON "DurableJob" TO stocky_runtime` | ❌ **none** |
| 4 | `ALTER ROLE stocky_control_plane BYPASSRLS` | ✅ `sync:roles:verify` |
| 5 | `GRANT stocky_migration TO stocky_control_plane` | ⚠️ not testable (role absent in rebuild) — **unverified** |
| 6 | `GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO stocky_control_plane` | ❌ **none** |
| 7 | `ALTER DEFAULT PRIVILEGES … GRANT ALL ON TABLES TO stocky_control_plane` | ❌ **none** |
| 8 | `ALTER TABLE "DurableJob" OWNER TO stocky_control_plane` | ✅ `tenant:roles:verify`, `tenant:enforcement:drift` |

Verifiers exercised: `sync:roles:verify`, `tenant:roles:verify`,
`tenant:enforcement:drift`. Four of eight defect classes are undetected; one is
unverified. See **F-PR4-06**.

### RLS posture on control-plane tables

```sql
SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname IN (…);
-- all 10 tables: relrowsecurity = false, relforcerowsecurity = false
```

Row-level security is **not enabled at all** on the ten control-plane tables —
this is broader than "no FORCE RLS". The architecture's sole compensating
controls are (a) the role grant matrix and (b) narrow module access. Finding
F-PR4-06 shows (a) is not drift-verified, and F-PR4-07 shows (b) is not enforced
by any scanner. **Assessment: the absence of FORCE RLS on these tables is not yet
sufficiently compensated.** This is a control weakness rather than a live
exposure — the provisioned baseline is correct and the 18 merchant-domain tables
retain their PR 3 RLS enforcement (`tenant:rls:verify` clean).

---

## 12. Table and constraint matrix

All ten models exist with `shopId NOT NULL` (verified via `information_schema`):
`DurableJob`, `WebhookDelivery`, `JobAttempt`, `DeadLetter`, `JobReplay`,
`SyncRun`, `SyncCursor`, `ReconciliationRun`, `DataIssue`, `SyncHealth`.
Shop lifecycle additions (`processingEnabled`, `processingDisabledReason`,
`processingDisabledAt`, `uninstalledAt`) are present.

| Invariant | DB-enforced? | Evidence |
|---|---|---|
| One logical job per idempotency key | ✅ | `DurableJob_shopId_idempotencyKey_key` |
| One delivery per Shopify webhook ID | ✅ | `WebhookDelivery_shopId_shopifyWebhookId_key` |
| One attempt number per job | ✅ | `JobAttempt_shopId_durableJobId_attemptNumber_key` |
| **One active attempt per job** | ❌ **no** | two rows with `finishedAt IS NULL` accepted — **F-PR4-04** |
| One active dead letter per terminal job | ✅ | `DeadLetter_one_open_per_job` partial unique `WHERE resolutionState='OPEN'` |
| One replay relation | ✅ | `JobReplay_shopId_newJobId_key` |
| Cursor uniqueness | ✅ | `SyncCursor_shopId_syncDomain_key` |
| Sync health uniqueness | ✅ | `SyncHealth_shopId_syncDomain_key` |
| Tenant-leading composite keys | ✅ | `<Table>_shopId_id_key` on all ten |
| Legal state transitions | ⚠️ application-only | `state-machine.server.ts`; TOCTOU — **F-PR4-05** |
| Monotonic cursor/watermark | ⚠️ application-only | no DB check constraint |

**Delete behaviour:** `DurableJob_shopId_fkey` is `RESTRICT` — independently
observed when a `Shop` delete was rejected with `P2003`. Control-plane evidence
cannot be silently destroyed by shop deletion. Correct and desirable.

**`updatedAt` on raw-SQL paths:** commit `0111e4e` added database-level defaults
for `updatedAt`, so the dispatcher's raw `SELECT … FOR UPDATE SKIP LOCKED` path
and any raw insert are safe. `tenant:schema:drift` confirms Prisma agreement.

---

## 13. Durable intake and idempotency results

Required ordering in `intake.server.ts` is correctly implemented: Shopify
authentication (route) → canonical Shop resolution → API-version validation →
sanitizer → deterministic digest → **single transaction** creating delivery +
job → durable commit before response → best-effort asynchronous dispatch.
Redis is genuinely not required for HTTP 200.

| Scenario | Result |
|---|---|
| First delivery | ✅ one delivery, one job |
| Duplicate delivery | ✅ `duplicate:true`, `duplicateCount` incremented, no second job |
| **Concurrent duplicate intake (×3)** | ✅ exactly 1 job, 1 delivery — DB unique constraint holds |
| Same webhook ID, **different payload** | ❌ silently treated as duplicate; digest unchanged; no mismatch recorded — **F-PR4-08** |
| Missing webhook ID | ❌ synthetic `missing-${Date.now()}` key defeats idempotency — **F-PR4-03** |
| Unsupported topic | ✅ fails closed (`topic_unsupported`) |
| Malformed projection | ✅ fails closed (`sanitize_failed`) |
| Redis unavailable | ✅ intake still commits and returns 200 |
| Shop processing disabled | ✅ denied (`shop_processing_disabled`) |
| Invalid/missing API version | ✅ fails closed |

Database — not Redis retention — is demonstrably the source of truth.

---

## 14. Dispatcher failure-boundary results

Implements `FOR UPDATE SKIP LOCKED`, finite leases (30 s default), bounded
batches (50 default), `nextEligibleAt` ordering, `jobId = durableJob.id`, and a
freshly signed envelope per dispatch attempt.

| Scenario | Result |
|---|---|
| Redis down before claim | ✅ enqueue throws; job left `DISPATCH_LEASED`; lease expiry recovers to `PENDING` |
| Redis down after claim | ✅ same recovery path |
| Two dispatchers | ✅ `SKIP LOCKED` prevents double claim |
| Lease expiry | ✅ `recoverExpiredLeases` returns `DISPATCH_LEASED` → `PENDING` |
| Shop disabled mid-dispatch | ✅ enqueue skipped, job left leased |
| **Retry re-dispatch after BullMQ retention** | ❌ **silently deduplicated, then acked `ENQUEUED`** — **F-PR4-02** |
| **Enqueue succeeds, ack fails** | ⚠️ job stays `DISPATCH_LEASED`; lease expiry re-dispatches while the worker may already be executing → duplicate execution — **F-PR4-01 amplifier** |
| Starvation / fairness | ❌ no per-shop fairness; one shop's backlog starves others — **F-PR4-13** |
| Large pending set | ❌ full sequential scan + on-disk sort — **F-PR4-11** |

Cross-shop claim is intentional and confined to the dispatcher module; there is
no unbounded cross-shop scan in any tenant-facing path.

---

## 15. Legacy processor partial-side-effect results

**This is the most consequential area of the review.**

`processWebhookJob` (`app/jobs/workers/webhook-processor.ts:381-424`) claims an
attempt, runs `runLegacyWebhookHandler`, then calls `completeAttemptSuccess`.
The merchant-domain writes and the durable completion are in **separate
transactions**.

The legacy handlers are **not idempotent**:

- `handleOrderCreate` (`:68-89`) — `salesDailyAggregate.upsert` with
  `unitsSold: { increment }` and `revenue: { increment }`, in a **loop over line
  items**, plus a second increment loop for BOM components (`:94-114`);
- `handleOrderCancelled` (`:152-161`) and `handleRefundCreate` (`:199-208`) —
  unconditional subtractions clamped at zero;
- `handleInventoryUpdate` (`:233-252`) — snapshot upsert is idempotent, but
  `lowStockAlert.create` (`:265-272`) appends a **new row every run**.

Independently confirmed: **no per-event application marker exists anywhere.**

```sql
SELECT count(*) FROM information_schema.tables WHERE table_schema='public'
  AND (table_name ILIKE '%applied%' OR '%application%' OR '%effect%' OR '%idempot%');
-- 0
```

Consequences, none of which require a crash:

1. A transient error on line item *N* triggers `completeAttemptRetry`; the retry
   re-runs the handler **from the first line item**, double-incrementing items
   `1..N-1`. Sales aggregates are silently inflated.
2. A crash between the last merchant write and `completeAttemptSuccess` produces
   the same duplication on redelivery.
3. Dead-letter replay creates a new job with the same payload and re-runs the
   handler, duplicating every previously successful line.

`BullMQ` job-ID deduplication does not help once execution has begun.

**Assessment:** the control plane provides durable *job* idempotency, which it
implements correctly. It does **not** provide exactly-once *business
application*, and the implementation report's durability framing does not
clearly limit its claim to the former. PR 4 is not required to redesign PR 5/6
facts, but it must not present durable idempotency as protecting non-idempotent
legacy effects. Recorded as **F-PR4-01**.

---

## 16. Job state-machine results

Legal transition graph (`state-machine.server.ts:14-28`) — 12 edges. Verified:

- ✅ terminal `SUCCEEDED` cannot return to `RUNNING`
- ✅ `CANCELLED` jobs cannot be claimed (`claimAttempt` rejects explicitly)
- ✅ dead-lettered jobs cannot be mutated back to `PENDING`
- ✅ replay creates a **new** job; original untouched
- ✅ attempt numbers monotonic and DB-unique
- ✅ retry count is database-authoritative (`attemptCount`)
- ✅ `maxAttempts` enforced; exceeding it dead-letters
- ✅ retry backoff bounded and deterministic (`1000 × 2^(n-1)`)
- ✅ exactly one open dead letter per job (partial unique index)
- ✅ prior attempts immutable after success
- ✅ no raw stack traces persisted — `failureSummary` truncated to 512 chars,
  `terminalReason` to 128; no tokens, headers, or PII written

**Defects:**

- `CANCELLABLE_DURABLE_JOB_STATES` includes `DISPATCH_LEASED`, but no
  `DISPATCH_LEASED → CANCELLED` edge exists → **F-PR4-03** (uninstall failure).
- Every lifecycle transaction reads with `findFirst` (no `FOR UPDATE`) then
  writes → **TOCTOU** at READ COMMITTED (**F-PR4-05**).
- "At most one active attempt per job" is asserted in a code comment
  (`lifecycle.server.ts:3`) but is **not** a database constraint (**F-PR4-04**).
- `assertTransition("FAILED", "DEAD_LETTERED")` at `lifecycle.server.ts:314` is a
  literal-argument no-op that always passes (**F-PR4-14**, P3).

---

## 17. Dead-letter and replay results

`replay.server.ts` is correct and well-scoped:

- ✅ creates a new `PENDING` `DurableJob`; original job never mutated
- ✅ payload copied by value (`structuredClone`)
- ✅ `JobReplay` lineage row with `originalJobId`, `newJobId`, `deadLetterId`, `replayReason`, `correlationId`, `causationId = originalJob.id`
- ✅ dead letter transitions `OPEN → REPLAYED` with `resolvedAt` and `replayId`
- ✅ replaying a non-`OPEN` dead letter is rejected
- ✅ replay for a disabled/uninstalled shop is rejected (`replay_denied_disabled_shop`)
- ✅ cross-shop replay rejected — `deadLetter` and `originalJob` both looked up with `shopId` scoping
- ✅ fresh signature obtained at dispatch (replay never carries an old signature)
- ✅ replay cannot bypass the source allowlist — source is copied and re-asserted

Minor gap: replay does not assert `originalJob.state === 'DEAD_LETTERED'`,
relying solely on dead-letter `OPEN` state (**F-PR4-15**, P3).

Replayed jobs re-execute non-idempotent legacy handlers — see F-PR4-01.

---

## 18. Envelope v2 results

`envelope-v2.server.ts` is the strongest module in the PR.

Binds: `durableJobId`, `shopId`, `myshopifyDomain`, `source`, `correlationId`,
`causationId`, `payloadDigest`, `schemaVersion`, `issuedAt`, HMAC-SHA256
`signature` over a canonical key-sorted serialization.

| Attack | Result |
|---|---|
| Missing envelope | ✅ rejected |
| Unknown version | ✅ rejected |
| Weak / wrong secret | ✅ rejected (PR 2 ≥32-byte requirement preserved) |
| Invalid signature | ✅ rejected, `timingSafeEqual` with length pre-check |
| Future timestamp | ✅ rejected beyond skew |
| Expired timestamp | ✅ rejected beyond max age |
| Extra/unexpected field | ✅ rejected — strict key allowlist |
| Source not in allowlist | ✅ rejected |
| Source/job mismatch | ✅ `assertSourceMatchesJob` |
| Shop ID / domain mismatch | ✅ `requireCanonicalShopMatch` |
| Payload digest mismatch | ✅ rejected against durable record |
| Durable-record mismatch | ✅ rejected |
| Changed durable payload after signing | ✅ digest mismatch |
| Queue `job.data.durableJobId` tampering | ✅ caught by `expectedDurableJobId` check |
| Disabled shop | ✅ `assertShopProcessingEnabled` before work |
| Replay of another shop's job | ✅ rejected |
| Forged correlation/causation | ✅ covered by signature |

**v1 compatibility is not a downgrade path**: the v2 branch is evaluated first
on `schemaVersion`, and the v1 branch requires an exact match to
`TENANT_JOB_ENVELOPE_VERSION`. A v2-shaped envelope cannot be downgraded to v1
handling. v1 jobs still enforce authority and `assertShopProcessingEnabled`.

Residual hardening gap: the worker never asserts
`durable.shopId === envelope.shopId` (**F-PR4-16**, P3). Both are signature-bound
so this is defence-in-depth, not a live vulnerability.

---

## 19. Uninstall race results

`stocky_shop_processing_enabled(text)` was inherited from PR 3 and remains
covered by `tenant:rls:verify` (clean) across all 18 merchant tables. The
required post-commit denial property holds at the SQL layer.

However, the application-level uninstall path **fails**:

**Reproduced (F-PR4-03).** With one job in `DISPATCH_LEASED`:

```
A_ERROR                = Illegal DurableJob transition: DISPATCH_LEASED → CANCELLED
A_PROCESSING_ENABLED   = true      ← shop NOT disabled
A_JOB_STATE            = DISPATCH_LEASED
A_UNINSTALL_DELIVERIES = 0         ← no durable record of the uninstall
```

`processUninstall` cancels jobs inside the same transaction that disables the
shop. `assertTransition` throws for `DISPATCH_LEASED`, aborting **the entire
transaction** — the shop stays processing-enabled, the uninstall delivery is
never recorded, and no job is cancelled. A dispatcher lease of up to 30 s (or an
indefinite one if the dispatcher died) is enough to trigger this on a real
uninstall, and every Shopify retry re-fails while the lease persists.

Other uninstall scenarios verified:

| Scenario | Result |
|---|---|
| First uninstall (no leased jobs) | ✅ disables shop, cancels `PENDING`/`ENQUEUED`/`RETRY_WAIT`, records delivery |
| Duplicate uninstall | ✅ idempotent on `shopifyWebhookId`; re-asserts disabled |
| Uninstall with no session | ✅ tolerated; `deleteSessionsForShop` failure is caught |
| Uninstall with no prior Shop row | ✅ Shop created, then disabled |
| **Uninstall while job is `DISPATCH_LEASED`** | ❌ **entire uninstall rolls back** |
| New intake after uninstall | ✅ denied |
| Worker after uninstall | ✅ `assertShopProcessingEnabled` fails closed |
| Reinstall after `UNINSTALLED` | ✅ supported (`reinstall.server.ts`) |
| Replay after uninstall | ✅ denied |
| Foreign-shop uninstall | ✅ scoped by verified domain |

**Session/token deletion ordering is correct:** durable disable + cancel commit
*before* `deleteSessionsForShop`, so retry authority is never lost to a session
delete.

**Long-running transaction caveat:** a transaction that began before the
uninstall commit continues to see `processingEnabled = true` under READ
COMMITTED for statements already planned in that snapshot. Per-statement
re-evaluation means new statements do observe the disable. This satisfies the
approved requirement for statement-level denial but should be documented
explicitly rather than left implicit (**F-PR4-17**, P3).

---

## 20. Sanitizer and privacy results

`sanitize.server.ts` uses **allowlist projections** per topic — the correct
design. Five versioned schemas; unknown topics fail closed.

Verified **not persisted**: customer object, name, email, phone, billing address,
shipping address, `note` (explicitly nulled for refunds), `note_attributes`,
`browser_ip`, `client_details`, access tokens, cookies, authorization headers,
raw request headers, raw stack traces.

- ✅ projection schemas versioned (`webhook-projection-*-v1`)
- ✅ unknown fields discarded deterministically (allowlist construction)
- ✅ canonical serialization stable; digest deterministic (verified — identical payloads produce identical digests)
- ✅ **money kept as exact strings** — `moneyString()` never applies float arithmetic; no `Number`/`parseFloat` on any newly persisted control-plane path
- ✅ error summaries bounded (512) and redacted
- ❌ **no size, node-count, or depth limit** on the persisted projection — **F-PR4-12**
- ❌ pass-through fields (`id`, `variant_id`, `product_id`, `location_id`, `admin_graphql_api_id`) use `raw.x ?? null` with **no type check**, so a nested object at those keys is persisted verbatim, bypassing the allowlist's flattening intent — **F-PR4-12**

Note: `parseFloat` on money **does** remain in the legacy merchant-domain
handlers (`webhook-processor.ts:83, 87, 158, 205`). Those lines are pre-existing
and unchanged by this PR; they are recorded here as context for PR 5/6, not as a
PR 4 finding.

**Retention:** the PR correctly retains sanitized durable records pending PR 7
and does **not** claim final legal retention approval. Appropriate.

---

## 21. Shopify API `2026-07` results

| Check | Result |
|---|---|
| `shopify.app.toml` pins `2026-07` | ✅ (`2025-10` → `2026-07`) |
| `app/shopify.server.ts` uses `ApiVersion.July26` | ✅ lines 14, 40 |
| Installed package supports the enum | ✅ `@shopify/shopify-api` declares `July26 = "2026-07"` |
| GraphQL codegen targets `2026-07` | ✅ `.graphqlrc.ts` uses `ApiVersion.July26`; resolved endpoint observed as `/admin-graphql-direct-proxy/2026-07` |
| Existing GraphQL documents validate | ⚠️ **not verified here** — egress blocked; green in CI |
| Webhook fixtures match `2026-07` | ✅ test fixtures send `2026-07` |
| `X-Shopify-API-Version` captured | ✅ persisted as `WebhookDelivery.apiVersionReceived` |
| Mismatched/unsupported version behaviour | ⚠️ **fails closed by rejecting the webhook** — see F-PR4-18 |
| No inventory mutation introduced or enabled | ✅ |
| No unrelated dependency upgrade | ✅ `package.json` diff adds only scripts |
| Advisory count did not worsen | ✅ 7 high, all pre-existing react-router chain |

**Q-003 is NOT closed by this review.** What was validated: the version pin is
consistent across the manifest, server config, and codegen configuration, and the
enum exists in the installed package. What was **not** validated independently:
GraphQL document validation against the live `2026-07` schema (network-blocked),
and behaviour against real `2026-07` webhook traffic.

---

## 22. Inventory and CI negative-fixture results

**The PR 4 control-plane inventory is not a scanner.** `scripts/sync-control-plane/inventory.ts`
reads a hand-maintained list (`SYNC_SURFACES` in `manifest.ts`), verifies each
listed path exists on disk, and renders Markdown. `sync:inventory:check` verifies
only that the rendered document matches the list. **It performs no analysis of
the codebase and cannot detect additions.**

Planted negative fixtures and results:

| Fixture | `sync:inventory:check` | `tenant:access:audit` |
|---|---|---|
| Unlisted webhook route (`webhooks.orders.updated.tsx`) with direct `new Queue(...)` | ❌ **OK (exit 0)** | ✅ detected — `[arbitrary_envelope_enqueue] new Queue` |
| Shadow module: aliased re-export (`createDurableJob as enqueueAnything`), computed job name, direct `getControlPlanePrisma()` DML | ❌ **OK (exit 0)** | ❌ **0 violations (exit 0)** |
| Unlisted test files under `app/sync/__tests__/` | ❌ **OK (exit 0)** | — (`tenant:access:inventory:check` flagged staleness only) |

The PR 2 scanner provides a genuine safety net for direct `Queue` construction.
It does **not** catch a module that performs arbitrary control-plane DML via
`getControlPlanePrisma()` under an aliased export — precisely the "narrow module"
boundary the architecture relies on in place of RLS. Recorded as **F-PR4-07**.

No exact-file allowlist abuse, stale exception, wildcard exception, or scanner
bypass was found in the PR 2/PR 3 allowlists; `tenant:access:audit` reports 18
models covered with an enumerated exception list.

---

## 23. Performance evidence

Disposable environment `stocky_pr4_review` (PostgreSQL 16.13, single node,
shared container). **These are not production numbers.**

### Durable webhook intake

n = 200 sequential `ingestAuthenticatedWebhook` calls, `orders/create` with 10
line items:

| Metric | Value |
|---|---|
| p50 | **13.0 ms** |
| p95 | **16.4 ms** |
| p99 | 21.9 ms |
| max | 131.8 ms |

**The required p95 < 1 s target is met with ~60× headroom.**

### Dispatch claim query at scale

At 200 pending jobs: 1.5 ms. At **50,200** pending jobs:

```
Limit  (actual time=42.384..42.418 rows=50)
  ->  LockRows
        ->  Sort  Sort Method: external merge  Disk: 2360kB
              ->  Seq Scan on "DurableJob"  (actual rows=50200)
Execution Time: 42.849 ms
```

**Full sequential scan plus an on-disk merge sort to return 50 rows.** The index
`DurableJob_state_nextEligibleAt_createdAt_idx` exists but the planner cannot use
it because `state IN ('PENDING','RETRY_WAIT')` prevents an ordered index scan.

The same query restricted to a single state uses the index:

```
Index Scan using "DurableJob_state_nextEligibleAt_createdAt_idx"
Execution Time: 0.148 ms          ← ~290× faster
```

This work is repeated on **every** dispatcher tick, and each inbound webhook
fires a dispatcher kick (`dispatchPendingJobs({ batchSize: 10 })`) from the
request path — so cost scales with table size × request rate. Recorded as
**F-PR4-11**. Duplicate intake under concurrency remained correct (1 job) and
memory behaviour for bounded batches was otherwise sound.

---

## 24. Findings

---

### F-PR4-01 — P1 — Durable idempotency does not provide exactly-once business application

**Files:** `app/jobs/workers/webhook-processor.ts:68-89, 94-114, 152-161, 199-208, 265-272, 381-424`

**Evidence.** Merchant-domain writes execute in `runLegacyWebhookHandler` and job
completion executes afterwards in a separate transaction via
`completeAttemptSuccess`. The handlers use `{ increment }` / decrement semantics
inside loops. No per-event application marker exists — confirmed by catalog query
returning **0** candidate tables.

**Reproduction.** Ingest an `orders/create` with two line items. Fail on the
second (transient error). `completeAttemptRetry` sets `RETRY_WAIT`. On retry the
handler restarts at line item 1, applying `unitsSold: { increment: q }` a second
time for the first item.

**Expected.** Either merchant mutations and job completion share one transaction,
or a durable per-event application marker makes re-application a no-op, or the
implementation explicitly limits its claim to durable *job* idempotency and
documents that legacy effects are at-least-once.

**Merchant impact.** Silently inflated `SalesDailyAggregate` units and revenue;
duplicate `LowStockAlert` rows. These feed forecasting and ABC classification,
so the error propagates into purchasing recommendations.

**Correction.** Recommended minimum for PR 4: add a durable
`(shopId, durableJobId)` application-marker table written in the *same*
transaction as the merchant mutations, and make handlers check it; or restrict
retry/replay to handlers proven idempotent. At minimum, correct the durability
claims in the architecture and implementation reports.

**Missing test.** Crash-after-partial-mutation and retry-after-partial-mutation
tests asserting merchant aggregates are unchanged after the second attempt.

**Conflict with Cursor's claim.** The PR body states "DB is durable SoT"; the
architecture presents durable jobs and attempts as the reliability guarantee
without limiting the claim to job-level idempotency.

---

### F-PR4-02 — P1 — Retry re-dispatch is silently deduplicated by BullMQ but acknowledged as ENQUEUED

**Files:** `app/sync/dispatcher.server.ts:146-172` (`jobId: job.id`), `:176-193` (`ackEnqueued`)

**Evidence (reproduced).**

```
F_DISPATCH1               = {"claimed":1,"enqueued":1,"failed":0}
F_STATE_BEFORE_REDISPATCH = RETRY_WAIT
F_DISPATCH2               = {"claimed":1,"enqueued":1,"failed":0}
F_DB_STATE_AFTER          = ENQUEUED
F_QUEUE_COUNTS            = {"waiting":1, ...}      ← still ONE job
F_QUEUE_JOB_TIMESTAMP_SAME= true                    ← the ORIGINAL job
```

The dispatcher re-adds with the same deterministic `jobId`. BullMQ treats an
existing job ID as a no-op and returns the existing job; `Queue.add` does not
throw. `ackEnqueued` then transitions the durable job to `ENQUEUED` as though
delivery succeeded. The freshly signed envelope is discarded — the queue retains
the original payload, contradicting the "fresh envelope per dispatch" claim.

**Reproduction.** Ingest → dispatch → `claimAttempt` → `completeAttemptRetry`
→ dispatch again while the prior BullMQ job is still retained.

**Expected.** Re-dispatch must produce a genuinely new delivery — e.g.
`jobId = ${durableJob.id}:${attemptCount}` — or the dispatcher must detect that
`add` returned a pre-existing job and refuse to ack.

**Merchant impact.** Durable event loss. Every retry path is affected: the job
sits in `ENQUEUED` forever, is never executed, never dead-lettered, and never
alerts. Sync health reports it as in-flight.

**Correction.** Include the attempt number in the BullMQ job ID and verify the
returned job is new before `ackEnqueued`.

**Missing test.** Retry-after-failure integration test asserting the BullMQ job
count increases and the handler runs a second time.

---

### F-PR4-03 — P1 — Uninstall is denied and fully rolled back when any job is DISPATCH_LEASED

**Files:** `app/sync/uninstall.server.ts:131-151`; `app/sync/state-machine.server.ts:14-28, 66-71`

**Evidence (reproduced).**

```
A_ERROR                = Illegal DurableJob transition: DISPATCH_LEASED → CANCELLED
A_PROCESSING_ENABLED   = true
A_JOB_STATE            = DISPATCH_LEASED
A_UNINSTALL_DELIVERIES = 0
```

`CANCELLABLE_DURABLE_JOB_STATES` lists `DISPATCH_LEASED`, but
`DURABLE_JOB_TRANSITIONS` contains no `DISPATCH_LEASED → CANCELLED` edge. The
`assertTransition` call at `uninstall.server.ts:139` throws inside the
transaction, aborting the shop disable, the uninstall delivery insert, and all
cancellations.

**Reproduction.** Ingest a webhook, set the job to `DISPATCH_LEASED` with a live
lease, then call `processUninstall`.

**Expected.** Uninstall must always disable the shop and record the delivery.
Add the missing `DISPATCH_LEASED → CANCELLED` edge (and `RUNNING → CANCELLED` if
running jobs should be cancellable), or cancel with `updateMany` outside the
strict transition assertion.

**Merchant impact.** After a merchant uninstalls, the app keeps
`processingEnabled = true` and continues processing that shop's data. This is a
direct failure of the approved uninstall-denial requirement and an App Store
compliance risk. A 30 s dispatcher lease — or an indefinite one from a crashed
dispatcher — is sufficient to trigger it, and Shopify's retries keep failing
while the lease persists.

**Correction.** Add the missing transition edge and add a regression test for
each state in `CANCELLABLE_DURABLE_JOB_STATES`.

**Missing test.** A test asserting that every state listed in
`CANCELLABLE_DURABLE_JOB_STATES` has a legal `→ CANCELLED` edge, plus an
uninstall-while-leased integration test.

---

### F-PR4-04 — P1 — Worker crash after attempt claim strands the job permanently

**Files:** `app/sync/lifecycle.server.ts:42-62`; `app/sync/dispatcher.server.ts:37-64`

**Evidence (reproduced).**

```
B_REDELIVER_ERROR = DurableJob already has an active attempt
B_RECOVERED = 0   CLAIMED = 0
B_STATE_AFTER = RUNNING
B_OPEN_ATTEMPTS = 1
B_DEADLETTERS = 0
```

`recoverExpiredLeases` recovers only `DISPATCH_LEASED`. There is no lease,
heartbeat, or timeout on `RUNNING`. A crash after `claimAttempt` leaves an
attempt with `finishedAt = NULL` forever; every redelivery is rejected with
`attempt_conflict`, and the job is never retried, dead-lettered, or surfaced.

Separately, "at most one active attempt per job" (asserted at
`lifecycle.server.ts:3`) is **not** enforced by the database — two rows with
`finishedAt IS NULL` were inserted successfully (`E_SECOND_OPEN_ATTEMPT_ERROR = ACCEPTED`,
`E_OPEN_ATTEMPT_COUNT = 2`). Only the incidental
`(shopId, durableJobId, attemptNumber)` unique index serialises concurrent claims.

**Expected.** `RUNNING` needs a lease/heartbeat with recovery to `RETRY_WAIT`
(honouring `maxAttempts`), and a partial unique index
`ON "JobAttempt"("durableJobId") WHERE "finishedAt" IS NULL`.

**Merchant impact.** Silent, permanent loss of a durable event on any worker
crash, OOM, deploy-time SIGKILL, or pod eviction. No dead letter and no health
signal — the failure is invisible to support.

**Correction.** Add a `RUNNING` lease with expiry recovery plus the partial
unique index.

**Missing test.** Simulated worker crash asserting the job is eventually
recovered to `RETRY_WAIT` or dead-lettered.

---

### F-PR4-05 — P2 — Job state transitions are TOCTOU-prone (read without row lock)

**Files:** `app/sync/lifecycle.server.ts:28-30, 100-106, 147-152, 201-206, 254-259`; `app/sync/dispatcher.server.ts:41-48, 181-183`

**Evidence.** Every lifecycle transaction performs `findFirst`/`findUnique`
(no `FOR UPDATE`) and then `assertTransition` and `update`. At READ COMMITTED two
concurrent callers can both observe the same pre-state and both pass the
assertion. `recoverExpiredLeases` likewise reads then writes without locking.

**Expected.** Guard transitions with `SELECT … FOR UPDATE` on the durable job
row, or make each `update` conditional on the expected prior state
(`updateMany … where: { id, state: expected }`) and treat a zero-row result as a
lost race.

**Merchant impact.** Concurrent success/uninstall, retry/dead-letter, and
double-worker-completion races can produce inconsistent job state and, combined
with F-PR4-04, concurrent execution of the same event.

**Correction.** Add row locking or compare-and-set updates.

**Missing test.** Concurrent-transition races for success-vs-uninstall,
retry-vs-dead-letter, and two worker completions.

---

### F-PR4-06 — P2 — Control-plane role isolation is not drift-verified

**File:** `scripts/sync-control-plane/roles.ts`

**Evidence.** Adversarial drift matrix against a clean baseline (§11). Four of
eight planted defects were detected by no verifier:

- merchant `SELECT` granted to `stocky_control_plane`;
- **control-plane DML (`INSERT/UPDATE/DELETE` on `DurableJob`) granted to `stocky_runtime`**;
- `GRANT ALL ON ALL SEQUENCES` to `stocky_control_plane`;
- dangerous future `ALTER DEFAULT PRIVILEGES` to `stocky_control_plane`.

Role membership in the migration owner could not be tested in the rebuilt
environment and remains **unverified**.

**Expected.** `sync:roles:verify` should assert an exact allowlist for both roles
— including a negative assertion that `stocky_runtime` holds **no** privilege on
any control-plane table, plus sequence and default-privilege checks.

**Merchant impact.** The ten control-plane tables have RLS entirely disabled
(`relrowsecurity = false`), so the role grant matrix is the **only** tenancy
control on them. Undetected drift in that matrix would give the runtime role —
reachable from request-handling code — unmediated cross-shop write access to the
durable job ledger, with no verifier objecting.

**Correction.** Extend `sync:roles:verify` to an exact privilege matrix covering
tables, sequences, functions, default privileges, and role memberships for both
roles, mirroring the PR 3 `exact-privilege-complete-matrix` approach.

**Missing test.** Negative-fixture tests for each of the five undetected/unverified
drift classes.

---

### F-PR4-07 — P2 — Control-plane inventory cannot detect unauthorized control-plane surfaces

**Files:** `scripts/sync-control-plane/inventory.ts:26-34`; `scripts/sync-control-plane/manifest.ts`; `.github/workflows/ci.yml` ("Sync control-plane inventory freshness")

**Evidence (reproduced).** The generator only checks that hand-listed surfaces
exist on disk and renders them. A planted module performing direct
`getControlPlanePrisma().durableJob.create(...)` with an aliased enqueue
re-export and a computed job name passed **both** `sync:inventory:check`
(exit 0) and `tenant:access:audit` (0 violations). A planted unlisted webhook
route was caught only because it also used `new Queue` directly.

**Expected.** The inventory must be derived by scanning for control-plane
surfaces — webhook routes, producers, queue constructions, workers, dispatchers,
replay entry points, and `getControlPlanePrisma` importers — and must fail when
an unlisted surface appears.

**Merchant impact.** The architecture's second compensating control for absent
RLS on control-plane tables ("narrow modules") is unenforced. Any future module
can perform arbitrary cross-shop control-plane DML and pass CI. The CI step name
implies a completeness guarantee the implementation does not provide.

**Correction.** Make the inventory a real scanner (as `scripts/tenant-access/scan.ts`
already is), and add a check that `getControlPlanePrisma` is imported only by an
allowlisted module set.

**Missing test.** Negative fixtures for unlisted route, aliased producer,
computed job name, re-exported enqueue, direct `Queue` construction, alternate
worker, out-of-directory replay helper, and unauthorized control-plane import.

**Conflict with Cursor's claim.** The implementation report and PR describe the
inventory as "mechanically generated"; it is mechanically *rendered* from a
manual list, which is a materially weaker property.

---

### F-PR4-08 — P2 — Divergent payload for a known webhook ID is silently discarded

**File:** `app/sync/intake.server.ts:105-118`

**Evidence (reproduced).** Same `shopifyWebhookId`, materially different payload
(`quantity` 2 → 999, `price` "10.00" → "99.00"):

```
C_FIRST_DIGEST   = 49ec0a8a…d1d7
C_SECOND_DIGEST  = 49ec0a8a…d1d7        ← unchanged (first payload retained)
C_DUPLICATE_FLAG = true
C_MISMATCH_FIELDS= []                   ← no mismatch recorded anywhere
```

The duplicate branch increments `duplicateCount` and `lastSeenAt` without
comparing the incoming digest to the stored one.

**Expected.** Compute the digest of the incoming payload, compare it to the
stored digest, and on mismatch record the divergence (e.g. a `DataIssue` row or a
`payloadDigestMismatchCount` column) without applying a second logical event.

**Merchant impact.** Loss of forensic evidence. A Shopify-side anomaly, a replay
attack surface, or an upstream bug producing different payloads under one webhook
ID is invisible to support and reconciliation.

**Correction.** Add digest comparison and a durable mismatch record.

**Missing test.** Same-ID/different-payload intake asserting a mismatch is
recorded and no second job is created.

---

### F-PR4-09 — P3 — Implementation report and PR body record incorrect/stale identity

**File:** `docs/phases/phase-1/PR4_SYNC_CONTROL_PLANE_IMPLEMENTATION_REPORT.md:22, 26`; PR #20 body

**Evidence.** PR body states head `7c36bc1bf2a1d6ccbd0e9d7131ae2d705fefea7a`;
actual head is `7c36bc1bf2a1d6ccbd0e9d7131ae2d692fefea7a`. Report line 22 records
"Documentation tip `fc320668…`" although `7c36bc1` exists; line 26's commit list
ends at `fc320668`.

**Expected.** Identity records match the live head exactly.

**Impact.** Chain-of-custody ambiguity for the acceptance decision.
Documentation-only; no runtime, schema, test, or CI file changed after `89aeea8`.

**Correction.** Update the PR body head SHA, the documentation tip, and the
commit list. Not repaired during this review, per instruction.

**Missing test.** A CI check asserting the recorded documentation tip equals
`git rev-parse HEAD`.

---

### F-PR4-10 — P3 — PROJECT_STATUS.md does not name PR #20

**File:** `docs/PROJECT_STATUS.md:11`

**Evidence.** `**Active implementation PR:** pending draft open` — PR #20 is open
and was created before this line was last touched (commit `1a9a060`).

**Expected.** Name PR #20 explicitly.

**Impact.** Status tracking ambiguity. Documentation-only.

**Correction.** Replace with a reference to PR #20.

---

### F-PR4-11 — P2 — Dispatch claim query cannot use its index; full scan and disk sort at scale

**File:** `app/sync/dispatcher.server.ts:76-87`

**Evidence.** At 50,200 pending jobs: `Seq Scan` over the whole table plus
`Sort Method: external merge  Disk: 2360kB`, 42.8 ms to return 50 rows. The same
query with a single state uses `DurableJob_state_nextEligibleAt_createdAt_idx`
and runs in 0.148 ms (~290× faster). `state IN ('PENDING','RETRY_WAIT')` prevents
an ordered index scan.

**Reproduction.** Insert 50k `PENDING` jobs; `EXPLAIN (ANALYZE)` the claim query.

**Expected.** An index-satisfiable claim — e.g. two per-state queries merged in
application code, a `UNION ALL` of two ordered index scans, or a boolean
`isClaimable` column with a partial index.

**Merchant impact.** Every dispatcher tick scans the entire `DurableJob` table
and spills a sort to disk. Because each inbound webhook fires
`dispatchPendingJobs({ batchSize: 10 })` from the request path, cost scales with
table size × request rate. Under backlog this degrades sharply and can starve the
database.

**Correction.** Restructure the claim query to be index-satisfiable and consider
decoupling the dispatcher from the request path.

**Missing test.** A plan-shape assertion that the claim query uses an index scan
at realistic row counts.

---

### F-PR4-12 — P2 — No size, depth, or node limits on persisted projections; untyped pass-through fields

**File:** `app/sync/sanitize.server.ts:38-52, 62-89, 126-131`

**Evidence.** `line_items` is mapped with no cap on element count. `id`,
`variant_id`, `product_id`, `location_id`, and `admin_graphql_api_id` use
`raw.x ?? null` with no type validation, so an object or array at those keys is
persisted verbatim — defeating the allowlist's flattening intent and permitting
arbitrary nesting inside `sanitizedPayload`.

**Expected.** Enforce explicit caps (max line items, max serialized bytes, max
depth) and coerce scalar identifier fields to `string | number | null`, failing
closed or truncating deterministically on violation.

**Merchant impact.** An order with very many line items, or an unexpected nested
structure, produces an unbounded JSON document written to `WebhookDelivery` and
`DurableJob` on every delivery — a storage and memory amplification path, and a
residual privacy risk if nested PII appears under a pass-through key.

**Correction.** Add explicit bounds and scalar coercion.

**Missing test.** Oversized-projection and nested-object-at-scalar-key fixtures.

---

### F-PR4-13 — P2 — No per-shop fairness in dispatch; one shop can starve all others

**File:** `app/sync/dispatcher.server.ts:76-87`

**Evidence.** The claim query orders strictly by `nextEligibleAt, createdAt`
across all shops with `LIMIT 50`. A single shop with a large backlog occupies
every batch.

**Expected.** Round-robin or per-shop quota within each batch.

**Merchant impact.** One high-volume or backlogged merchant delays webhook
processing for every other merchant on the platform — a multi-tenant fairness and
supportability problem.

**Correction.** Add per-shop fairness to batch selection.

**Missing test.** Multi-shop backlog test asserting each shop makes progress.

---

### F-PR4-14 — P3 — `assertTransition("FAILED", "DEAD_LETTERED")` is a no-op

**File:** `app/sync/lifecycle.server.ts:314`

**Evidence.** Both arguments are string literals, so the call always passes
regardless of the job's actual state and provides no guard.

**Expected.** Assert against the job's real state, or remove the misleading call.

**Impact.** Maintainability; creates a false impression of a guard where none
exists.

**Correction.** Replace with `assertTransition(job.state, "DEAD_LETTERED")` or delete.

---

### F-PR4-15 — P3 — Replay does not assert the original job is DEAD_LETTERED

**File:** `app/sync/replay.server.ts:59-67`

**Evidence.** Only the dead letter's `OPEN` state is checked; `originalJob.state`
is not validated.

**Expected.** Assert `originalJob.state === 'DEAD_LETTERED'` as defence in depth.

**Impact.** Low — the `DeadLetter_one_open_per_job` partial unique index and the
`OPEN` check make an inconsistent pairing unlikely.

**Correction.** Add the assertion.

---

### F-PR4-16 — P3 — Worker does not assert `durable.shopId === envelope.shopId`

**File:** `app/jobs/workers/webhook-processor.ts:358-372`

**Evidence.** The durable job is fetched by ID and `assertShopProcessingEnabled(durable.shopId)`
is called, while the tenant DB is constructed from `envelope.shopId`. The two are
never compared directly.

**Expected.** An explicit equality assertion.

**Impact.** Defence in depth only — both values are signature-bound and the
`expectedDurableJobId` check already rejects the tampering path. No exploitable
route was found.

**Correction.** Add the assertion.

---

### F-PR4-17 — P3 — Long-running-transaction uninstall visibility is undocumented

**File:** `docs/phases/phase-1/PR4_SYNC_CONTROL_PLANE_ARCHITECTURE.md`

**Evidence.** Under READ COMMITTED, a transaction that began before the uninstall
commit continues to see `processingEnabled = true` for statements already planned
in that snapshot; new statements observe the disable.

**Expected.** State the statement-level denial guarantee explicitly, and bound
worker transaction duration.

**Impact.** Documentation clarity; the approved statement-level requirement is met.

**Correction.** Document the guarantee and its boundary.

---

### F-PR4-18 — P2 — Strict API-version rejection can drop webhooks during a version transition

**Files:** `app/sync/api-version.server.ts:29-47`; `app/sync/intake.server.ts:85`

**Evidence.** `requireTargetApiVersion` throws unless
`X-Shopify-API-Version` is exactly `2026-07`. The throw propagates out of the
route, producing a non-2xx response.

**Expected.** Record the received version, and for a non-target but recognised
version either accept into a quarantine/`DataIssue` path or fail with an explicit
operational alert — rather than rejecting silently via a generic error.

**Merchant impact.** Webhook subscriptions registered before the `2025-10 → 2026-07`
change continue delivering on the older version until re-registered. During that
window every affected webhook is rejected; once Shopify exhausts its retries the
events are permanently lost, with no dead letter and no durable record (the
throw occurs before any row is written).

**Correction.** Persist the delivery with its received version before validating,
so rejected versions leave an auditable trail and can be replayed after the
subscription is re-registered.

**Missing test.** Intake with `2025-10` asserting a durable record exists and an
operational signal is raised.

---

### F-PR4-19 — P2 — `REDIS_URL` default is the literal string `"[REDACTED]"`

**File:** `app/jobs/queue.server.ts:17`

**Evidence.**

```ts
const REDIS_URL = process.env.REDIS_URL ?? "[REDACTED]";
```

Confirmed in the committed source (not a display artifact). The diff shows this
replaced `"redis://localhost:6379"` in commit `0db313f` — a redaction tool
appears to have rewritten source code.

**Reproduction.** Unset `REDIS_URL` and construct the queue; `new IORedis("[REDACTED]")`
treats the literal as a hostname rather than failing with a clear configuration error.

**Expected.** Either a valid default or an explicit fail-closed error when
`REDIS_URL` is unset — never a placeholder string as a connection target.

**Merchant impact.** In any environment without `REDIS_URL`, the dispatcher fails
with an opaque DNS/connection error instead of a clear misconfiguration message.
CI always sets `REDIS_URL`, so this passes CI while remaining broken.

**Correction.** Restore a real default or throw a descriptive configuration error.

**Missing test.** Unit test asserting the queue module fails with a descriptive
error when `REDIS_URL` is unset.

---

### F-PR4-20 — P2 — Missing webhook ID produces a time-based key that defeats idempotency

**Files:** `app/routes/webhooks.orders.create.tsx:11`, `webhooks.orders.cancelled.tsx`, `webhooks.refunds.create.tsx`, `webhooks.inventory_levels.update.tsx`, `webhooks.app.uninstalled.tsx`

**Evidence.** `webhookId: webhookId ?? \`missing-${Date.now()}\`` — a synthetic
key derived from the current millisecond.

**Expected.** Fail closed, or derive a deterministic key from the sanitized
payload digest so redeliveries collapse to one logical event.

**Merchant impact.** If Shopify ever omits `X-Shopify-Webhook-Id`, every
redelivery of the same event yields a distinct idempotency key and therefore a
new `DurableJob` — guaranteed duplicate sales/inventory effects. This is a latent
duplication path that inverts the module's fail-closed posture. Shopify normally
sends the header, which is why it is P2 rather than P1.

**Correction.** Use `webhook:${payloadDigest}` as the fallback, or reject the request.

**Missing test.** Intake without a webhook ID, delivered twice, asserting one job.

---

## 25. Risk and question disposition

Dispositions are based on independent evidence only.

| ID | Disposition | Basis |
|---|---|---|
| **R-031** | **Partially mitigated** | Durable intake removes Redis from the 200 path; retry delivery is unreliable (F-PR4-02) |
| **R-032** | **Open** | Exactly-once business application not achieved (F-PR4-01) |
| **R-033** | **Partially mitigated** | Dead letters and replay lineage correct; `RUNNING` has no recovery (F-PR4-04) |
| **R-039** | **Independently closed** | Migration additive and idempotent; verified twice on empty and current-schema databases |
| **R-099** | **Partially mitigated** | Delivery/job uniqueness DB-enforced; divergent-payload evidence discarded (F-PR4-08) |
| **R-100** | **Open** | Uninstall denial fails when a job is leased (F-PR4-03) |
| **R-101** | **Independently closed** | Envelope v2 authority binding verified against the full forgery matrix (§18) |
| **R-102** | **Partially mitigated** | Provisioned role split correct; drift undetected in four classes (F-PR4-06) |
| **R-103** | **Open** | Control-plane surface completeness unenforced (F-PR4-07) |
| **R-104** | **Partially mitigated** | Sanitizers strip PII and preserve money as strings; no size/depth bounds (F-PR4-12) |
| **R-105** | **Open** | Dispatch does not scale; no per-shop fairness (F-PR4-11, F-PR4-13) |
| **R-106** | **Partially mitigated** | State machine defined and largely correct; TOCTOU-prone and missing an edge (F-PR4-05, F-PR4-03) |
| **R-107** | **Independently closed** | Replay lineage, immutability, and cross-shop denial verified (§17) |
| **R-108** | **Partially mitigated** | Intake p95 = 16.4 ms meets target; dispatch path does not (F-PR4-11) |
| **Q-003** | **Remains OPEN** | Version pin consistent and enum present; GraphQL document validation against the live `2026-07` schema not independently verified (egress blocked); strict rejection risk raised as F-PR4-18 |

**R-095, R-096, R-097, R-098** — accepted PR 3 residuals, outside PR 4 scope.
**Not modified, not reclassified, not re-examined.**

---

## 26. Explicit non-authorizations

This review authorizes nothing beyond ChatGPT's consideration of the findings
below. It does **not** authorize:

- marking PR #20 ready for review;
- merging PR #20;
- production deployment;
- production migration;
- production role changes;
- production queue execution;
- replaying real webhooks;
- accessing merchant data;
- inventory writes;
- enabling any inventory-write flag;
- starting PR 5;
- closing Phase 1.

**Confirmations:**

- No runtime code, schema, migration, test, CI, architecture, implementation
  report, decision, risk, or project-status file was modified by this review.
- All temporary adversarial fixtures were removed and the working tree restored
  before committing; the only committed change is this report.
- PR #20 remains **OPEN, DRAFT, and UNMERGED**.
- All inventory-write flags remain default OFF.
- No production execution, migration, or merchant-data access occurred.

---

## 27. Required next action

Return to ChatGPT for PR 4 finding disposition and the correction-or-acceptance
decision.

Blocking items for a `READY FOR CHATGPT PR 4 ACCEPTANCE` verdict:

1. **F-PR4-01** — guarantee exactly-once business application, or accurately and
   explicitly limit the durability claim and prevent unsafe retry/replay.
2. **F-PR4-02** — make retry re-dispatch produce a real delivery.
3. **F-PR4-03** — add the missing `DISPATCH_LEASED → CANCELLED` transition.
4. **F-PR4-04** — add `RUNNING` recovery and the one-active-attempt constraint.
5. **F-PR4-05 through F-PR4-08, F-PR4-11 through F-PR4-13, F-PR4-18 through F-PR4-20** — all P2 findings resolved or formally accepted.
6. **F-PR4-09, F-PR4-10** — documentation identity corrections.
7. In a network-enabled environment, `graphql-codegen` GraphQL document
   validation against the live `2026-07` schema (§21), which this environment
   could not perform.
