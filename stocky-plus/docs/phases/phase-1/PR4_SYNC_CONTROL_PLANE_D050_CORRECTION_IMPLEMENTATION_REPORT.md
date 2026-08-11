# Phase 1 PR 4 — D-050 Correction Implementation Report

**Decision:** D-050 — Phase 1 PR 4 split claim/reconcile snapshots + statement-level readiness  
**Starting live / reviewed D-049 head (before D-050 work):** `2b177152ed06c01a36025fbfc4f6a1f1eaa30969`  
**Authorized main / merge base:** `e69bc53d91db75472b0d0998bf1b74ee6246adb1`  
**Immutable D-049 review incorporation:** cherry-pick `30955f844967e79523d543d245a4b58b70cbdc66` → blob `aa713ad37147e8b9ca1eadfdc60c1c0f50a7ec8f` / SHA256 `5fd063181dde9e87b32f39f621813045827df905806309e61c393bc96e446bd0` — immutable; never edited  
**Status:** `D-050 CORRECTIONS IMPLEMENTED — PENDING INDEPENDENT VERIFICATION`

Do **not** mark findings closed on Cursor evidence. Independent verification is required before any finding or risk closure claim.

## Accidental `__nonexistent__` metadata incident

After D-049 review of `2b17715…`, five transparent commits (`b725435`…`1c49081`) added only the root file `__nonexistent__` (3 lines). Diff verification:

`git diff --name-status 2b17715…1c49081` → `A __nonexistent__` only.

Cleanup commit `b81c2497ed1d705d690814324f05bf1b0019d5b2` deleted that file. Zero application/runtime delta. No history rewrite. Recorded as repository-control metadata only.

## D-049 review incorporation

The independent D-049 correction review was incorporated via cherry-pick of `30955f844967e79523d543d245a4b58b70cbdc66`. The report blob remains `aa713ad37147e8b9ca1eadfdc60c1c0f50a7ec8f` (SHA256 `5fd063181dde9e87b32f39f621813045827df905806309e61c393bc96e446bd0`). The review report is immutable and was never edited after incorporation.

## Architecture implemented

D-050 splits the former single claim+reconcile statement into:

1. **A — Scheduler lock** — due `DispatchReadyShop` `FOR UPDATE SKIP LOCKED` `LIMIT shopCap` (no reconcile).
2. **B — Job candidates** — `PENDING` / `RETRY_WAIT` candidates for locked shops (VALUES ordinals).
3. **C — Lease CAS** — dispatcher lease acquisition (`DISPATCH_LEASED`).
4. **D — Fresh-snapshot readiness reconcile** — only non-monotonic correction (delete / reschedule / advance) on a later statement snapshot while A locks are held.

Additional platform changes:

- Statement-level transition-table triggers; readiness upserts run **inline** in
  trigger bodies (shopId ASC). No nested helper callable from trigger context —
  `REVOKE ALL … FROM PUBLIC` plus `stocky_control_plane` / `stocky_runtime`
  writers must not require EXECUTE on a separate upsert function (CI tip
  `ecf4d1a…` failed with `42501 permission denied for function
  stocky_dispatch_ready_shop_monotonic_upsert`; corrected by inlining).
- Transaction-scoped advisory lock (`pg_advisory_xact_lock`) serializes readiness
  upserts **only when readiness work exists** (inside statement-trigger loops).
  Non-eligible DurableJob UPDATEs such as lease CAS must not acquire the lock
  while the dispatcher already holds `DispatchReadyShop` row locks.
- Custom GUC single-shop correctness boundary **removed**.
- Bounded expired-lease recovery with `FOR UPDATE SKIP LOCKED` (no GUC abort path).

**PostgreSQL transition-table note:** PostgreSQL forbids transition tables on triggers with column lists (`ERROR 0A000`). D-050 uses `AFTER UPDATE` **without** a column list and filters relevant rows inside the trigger function.

**Privilege note:** PostgreSQL does not require EXECUTE to *fire* a trigger
function, but does require EXECUTE for functions the trigger body calls.
Inlining matches the D-049 privilege model without expanding SECURITY DEFINER
or granting runtime EXECUTE on readiness helpers.

## Scheduling / fairness contracts

- Approved urgent-arrival anti-reset maximum: **1 second**.
- Fairness floor after service opportunity: **+1 ms**.
- Healthy fairness / starvation bound (F-PR4-13) **preserved:** `ceil(activeEligibleShops / shopCap)`.
- Degraded stale-contaminated bound:  
  `ceil(staleDueRows / (R × shopCap)) + ceil(activeEligibleShops / shopCap)`  
  where `R = FAIR_CLAIM_MAX_REFILL_ROUNDS`.
- Truthful SKIP LOCKED accounting: rows **returned/locked ≤ shopCap**; rows **examined** may be `lockedPrefix + shopCap`.

## Migration

`20260811190000_sync_control_plane_d050_split_claim_statement_triggers` — additive; does not edit D-047 / D-048 / D-049 migrations. No production execution.

## Risks (remain OPEN)

| ID | Disposition |
|---|---|
| R-119…R-124 | **OPEN** |
| R-121 | **OPEN — MATERIALIZED** (false-negative readiness; D-050 addresses claim/reconcile race pending independent verification) |
| R-125 | **OPEN** — F-CLAUDE-D049-01 claim/reconcile same-statement snapshot FN (pending independent verification) |
| R-126 | **OPEN** — F-CLAUDE-D049-02 expired-lease / GUC platform abort (pending independent verification) |

## Safety

- **Q-003:** OPEN
- **F-PR4-18:** OPEN
- **PR 5:** BLOCKED
- Inventory-write flags: **OFF** / DEFAULT OFF
- No production deployment, backfill, ownership repair, or inventory mutation

## CI / test evidence (Cursor — pending independent verification)

Do **not** treat Cursor evidence as finding closure.

### Local (disposable PostgreSQL 16.14 + Redis 7)

| Check | Result |
|---|---|
| `prisma validate` / `prisma generate` | passed |
| `prisma migrate deploy` (twice, tip includes D-050) | passed — 16 migrations; second apply no-op |
| `test:sync-performance` (includes d049 + d050 + dispatch-ready + eligible-plan + sync-performance) | **53 passed** |
| `d050-corrections.test.ts` | **11 passed** (incl. ≥1000 claim-vs-insert races; 25s multi-shop deadlock; expired-lease 1/2/100 shops; stale fairness matrix) |
| `d049-readiness-corrections.test.ts` | **7 passed** |
| `test:sync-dispatch-recovery` | **29 passed** |
| `lint` | passed |
| `tsc --noEmit` | passed |
| `build` | passed |
| `graphql-codegen` | passed |
| `sync:inventory:check` | passed |
| `tenant:access:inventory:check` | passed |
| `tenant:access:audit` | passed (`tenant_access_audit_ok`, 0 violations after EX-SYNC-TEST-016) |
| `tenant:enforcement:inventory:check` | passed |
| `git diff --check` | clean |

### Exact-head CI

| Field | Value |
|---|---|
| Tip SHA | `50dcac90a3e5ea14070be544bb489204c5fe9b76` |
| PUSH run | `31538650458` — job `93935723648` — **success** — skipped steps **0** |
| PR run | `31538654788` — job `93935742400` — **success** — skipped steps **0** |
| Superseded failed/cancelled on earlier D-050 tips | PUSH `31528361295` (42501 nested upsert), `31531416199` (typecheck), `31534235713` (inventory stale), `31534591645` (45m timeout cancel); matching PR runs likewise superseded |

CI job timeout raised to 70m on this tip so the expanded D-050 adversarial + full migration chain can finish without material skips.

## Final status

`D-050 CORRECTIONS IMPLEMENTED — PENDING INDEPENDENT VERIFICATION`

PR #20 remains **OPEN, DRAFT, UNMERGED**. Status after Cursor work: `D-050 CORRECTIONS IMPLEMENTED — PENDING INDEPENDENT VERIFICATION`.
