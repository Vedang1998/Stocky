# Phase 1 PR 4 — D-051 Correction Independent Review Report

**Immutable.** This document records one independent review of one exact head. It is never edited after incorporation. Later corrections are recorded in later review reports.

**Reviewer:** Claude Code, acting as independent principal engineer / architecture and security reviewer.
**Review type:** Focused D-051 correction review. **This is not a PR 4 merge or readiness review.**
**Date:** 2026-08-13.

---

## 1. Review identity

| Field | Value | Independently confirmed |
|---|---|---|
| Reviewed PR head | `938e9981dc5f4e551e0cebd37250ae7a40507575` | ✅ |
| Runtime/test implementation head | `05bcb88c213be8823e840c8233b98d46236ff644` | ✅ |
| Authorized main / merge base | `e69bc53d91db75472b0d0998bf1b74ee6246adb1` | ✅ `git merge-base origin/main origin/phase-1/sync-control-plane` |
| D-050 independently reviewed implementation | `62f4cff0ec2c0ec9542959fb65be29b26997e603` | ✅ |
| D-050 independent review commit | `2e1fc3995614baf28d3fba1be59163d0be95096c` | ✅ |
| Incorporated immutable D-050 review blob | `8247d8aea868818b8e904d196fee1a80fad283f5` | ✅ `git rev-parse 938e998:…D050_CORRECTION_REVIEW_REPORT.md` |
| PR #20 state | **OPEN, DRAFT, UNMERGED** (`mergeable_state: clean`) | ✅ |

### 1.1 Identity gate — all fifteen conditions

| # | Condition | Result |
|---|---|---|
| 1 | PR #20 OPEN | ✅ `state: open` |
| 2 | PR #20 DRAFT | ✅ `draft: true` |
| 3 | PR #20 UNMERGED | ✅ `merged: false` |
| 4 | Head is exactly `938e998…` | ✅ |
| 5 | Base / merge-base `e69bc53…` | ✅ both PR base and computed merge-base |
| 6 | PUSH run `31658195375` success on exact head | ✅ `head_sha=938e998…`, `event=push`, `conclusion=success` |
| 7 | PR run `31658197379` success on exact head | ✅ `head_sha=938e998…`, `event=pull_request`, `conclusion=success` |
| 8 | `938e998…` tree-identical to parent | ✅ both trees `bbae8f9ddac26bbd51e438daac750d70407a1270`; `git diff 9de05e9 938e998` empty |
| 9 | Runtime/test changes ended at `05bcb88…` | ✅ `git diff 05bcb88 9de05e9` = 3 documentation files only |
| 10 | D-050 review blob is `8247d8…` | ✅ |
| 11 | Inventory-write flags OFF | ✅ all five `FEATURE_*` flags `false` in `.env.example` and CI env |
| 12 | Q-003 OPEN | ✅ `OPEN_QUESTIONS.md` |
| 13 | F-PR4-18 OPEN | ✅ backlog + `PROJECT_STATUS.md` |
| 14 | PR 5 BLOCKED | ✅ `PROJECT_STATUS.md` |
| 15 | Production unauthorized | ✅ `PROJECT_STATUS.md` — `Production | NOT AUTHORIZED` |

**Identity gate: PASSED.** Review proceeded.

### 1.2 Commit chain from the D-050 reviewed head

```
938e998  ci: retrigger exact-head PR CI after F-F03 overlap flake     ← reviewed head (EMPTY, tree-identical)
9de05e9  docs(sync): record D-051 exact-head CI success evidence      ← documentation only (3 files)
05bcb88  fix(test): align D-049 multi-shop writers with D-051 lock order  ← runtime/test head
267bcab  docs(sync): record D-050 closure and D-051 correction records
d94f5d2  fix(sync): D-051 per-shop readiness lock scope               ← the D-051 implementation
747cf35  docs(review): add immutable D-050 correction independent review report
62f4cff  ← D-050 independently reviewed head
```

`9de05e9 → 938e998` diff is empty; both trees hash to `bbae8f9d…`. `05bcb88 → 9de05e9` touches only `PROJECT_STATUS.md`, the D-051 implementation report, and the phase-1 README. **Both exact-head green workflows therefore exercise the same runtime/test tree that ended at `05bcb88…`.** No hidden implementation delta exists after the reported runtime/test head.

---

## 2. Environment reconstructed

| Component | Version |
|---|---|
| PostgreSQL | 16.13 (disposable cluster, port 54329, `deadlock_timeout=200ms`, `log_lock_waits=on`) |
| Redis | 7.0.15 (disposable, port 63799) |
| Node.js | v22.22.2 |
| npm | 11.5.2 (pinned as CI does) |
| Prisma / @prisma/client | 6.19.3 (lockfile-resolved) |
| Database collation | `C.UTF-8` (provider `c`) |

Full CI environment variables reproduced from `.github/workflows/ci.yml`, including all five inventory-write flags `false`. Roles `stocky_runtime`, `stocky_control_plane`, `stocky_receipt_probe_owner` provisioned via `tenant:roles:provision`, `tenant:enforcement:apply`, `sync:roles:provision`.

No production database, queue, credential, merchant data, or webhook replay was used at any point.

---

## 3. Commands executed

| Command | Exit | Result |
|---|---|---|
| `npx prisma generate` | 0 | ok |
| `npx prisma validate` | 0 | schema valid |
| `npx prisma migrate deploy` (chain #1) | 0 | 17 migrations applied incl. D-051 |
| `npx prisma migrate deploy` (chain #2, second fresh DB) | 0 | applied; all three D-051 functions present with per-shop key + order guard |
| `npm run tenant:indexes:apply -- --apply` / `:verify` | 0 | ok |
| `npm run tenant:roles:provision -- --apply` | 0 | ok |
| `npm run tenant:enforcement:apply -- --apply` | 0 | ok |
| `npm run sync:roles:provision -- --apply` | 0 | ok |
| `npm run lint` | 0 | clean |
| `npm run typecheck` | 0 | clean |
| `npm run build` | 0 | built |
| `npm run graphql-codegen` | 0 | clean |
| `npm run sync:inventory:check` | 0 | `surfaces=38 digest=116fcb05bf16…` |
| `npm run tenant:access:inventory:check` | 0 | fresh |
| `npm run tenant:access:audit` | 0 | `tenant_access_audit_ok` |
| `npm run tenant:enforcement:inventory:check` | 0 | fresh |
| `npm run test:sync-performance` (×5) | 0 ×5 | **6 files / 64 tests passed** on every one of the five runs |
| `npm run test:sync-integration` | 0 | **20 files / 241 tests passed** |
| `npm run test:sync-exactly-once` | 1 → **0** | first standalone run hit the §22.1 grant-wipe artifact; after re-provision **42 / 42 passed** |
| `npm run test:sync-dispatch-recovery` | 1 → **0** | same artifact; after re-provision **29 / 29 passed** |
| `npm run test:vitest-reporters` | 0 | **4 tests passed** |
| `npm run test:migrations-name-filter-probes` | 0 | 1 skipped / 1 todo (by design) |
| `npm run test:migrations` (full) | **1** | 47/49 files, 224 passed / **2 failed** — both reviewer-environment, diagnosed and re-run to green in §22.2 |
| F-F03 exact failing command × 5 | 0 ×5 | 1 passed / 12 skipped each run |
| Full CI provisioning sequence on a clean DB (15 steps) | 0 ×15 | all pass end-to-end — see §22.3 |
| `git diff --check` | 0 | clean |

Independent reviewer probes (raw `pg` clients, not the project's own tests) were additionally executed for sections A–N below. Cursor's return packet was not accepted as proof for any conclusion in this report.

---

## 4. Global-mutex removal — **VERDICT: REMOVED (confirmed)**

D-050 acquired, for every readiness-changing statement of every merchant:

```sql
pg_advisory_xact_lock(hashtextextended('stocky_dispatch_ready_shop_maintain', 0))
```

D-051 replaces it in all three trigger families with a per-shop key:

```sql
pg_advisory_xact_lock(hashtextextended('stocky_dispatch_ready_shop_maintain:' || shop_id, 0))
```

Verified consistent across **all three** call sites — `stocky_dispatch_ready_shop_maintain_insert_stmt()`, `stocky_dispatch_ready_shop_maintain_update_stmt()`, `stocky_dispatch_ready_shop_sync_enabled_stmt()`. A repository-wide search for `pg_advisory_xact_lock` / `pg_advisory_lock` / `pg_try_advisory_*` in the readiness architecture found no remaining global readiness key. The only other runtime advisory lock is `dispatcher.server.ts:762`, a per-`(shop, job, dispatch, reason)` DataIssue cooldown key — unrelated and already per-shop scoped.

Empirical proof (planted shops, `pg_locks` inspection):

- Per-shop keys for two distinct shops are distinct (`4785798985553327474` vs `181527351797388044`).
- With shop A and shop B writing concurrently in two open transactions, **two distinct advisory locks are held simultaneously**.
- The D-050 global key (`8965703003412667028`) is **not held by anyone** at any point.

---

## 5. Cross-shop non-blocking — **VERDICT: CONFIRMED**

Deterministic gate (explicit synchronization, not elapsed-time thresholds): transaction T1 performs readiness-changing work for shop A and is deliberately held open (`idle in transaction`, verified via `pg_stat_activity`); unrelated shop B then performs readiness-changing work.

| Shape | Result |
|---|---|
| PENDING intake (shop B) | completes while T1 open |
| RETRY_WAIT transition (`ENQUEUED → RETRY_WAIT`) | completes while T1 open |
| Expired-lease recovery (`DISPATCH_LEASED → PENDING`) | completes while T1 open |
| `Shop.processingEnabled` change | completes while T1 open |

All four completed with T1 still open. **The primary proof is non-blocking semantics**: in the head-of-line probe the unrelated merchant's transaction was timestamped *inside* the racing task and finished **BEFORE** the holder committed (9 ms against a 1,000 ms hold).

### 5.1 D-050 defect independently reproduced

To establish contrast rather than assert it, the D-050 trigger bodies were re-applied to the same disposable database and the identical probe re-run:

| Head | Hold | Unrelated merchant latency | Finished |
|---|---|---|---|
| D-050 (global lock) | 200 ms | **229 ms** | AFTER holder commit |
| D-050 (global lock) | 1,000 ms | **1,068 ms** | AFTER holder commit |
| D-051 (per-shop) | 1,000 ms | **9 ms** | **BEFORE** holder commit |

This reproduces the F-CLAUDE-D050-01 head-of-line defect and demonstrates its removal on the same cluster, same fixtures, same probe.

---

## 6. Same-shop serialization — **VERDICT: CORRECT**

T1 holds readiness for shop A; T2 issues conflicting readiness-changing work for shop A.

- T2 **waits** — confirmed by an ungranted `locktype='advisory'` row in `pg_locks` for T2's backend, not by timing.
- T2 does **not** complete while T1 is open.
- After T1 commits, T2 proceeds and completes.
- Final readiness reflects authoritative `DurableJob` truth; monotonic `LEAST` earliest hint preserved.
- No permanent false negative; no duplicated readiness row (primary key on `shopId` plus verified row counts).

---

## 7. Runtime writer transaction-shape matrix — **VERDICT: INDEPENDENTLY VERIFIED**

I did not accept the implementation report's matrix. I re-derived it from `app/sync/intake.server.ts`, `replay.server.ts`, `lifecycle.server.ts`, `dispatcher.server.ts`, `uninstall.server.ts`, `reinstall.server.ts`, `fair-claim-query.server.ts`, `application-receipt.server.ts`, and `app/jobs/workers/webhook-processor.ts`.

| Writer | Transaction boundary | Readiness-changing statements | Shops / statement | Shops / transaction | Takes maintain advisory? |
|---|---|---|---|---|---|
| Webhook intake | `$transaction` (`intake.server.ts:296`) | 1× `DurableJob` INSERT PENDING | 1 | **1** (all writes bound to `shopRow.id`) | yes, 1 shop |
| Intake duplicate / conflict | same tx | CANCELLED / quarantine — filtered out | 1 | 1 | no |
| `createDurableJob` | autocommit | 1× INSERT PENDING | 1 | 1 | yes, 1 shop |
| Dead-letter replay | `$transaction` (`replay.server.ts:31`) | 1× INSERT PENDING | 1 | 1 | yes, 1 shop |
| Worker retry (`completeAttemptRetry`) | `$transaction` | 1× UPDATE → RETRY_WAIT | 1 | 1 | yes, 1 shop |
| Success / fail / dead-letter | `$transaction` per job | terminal states — filtered out | 1 | 1 | no |
| Attempt reaper (`recoverExpiredRunningAttempts`) | **one `$transaction` per attempt**, inside a JS `for` loop | RETRY_WAIT or terminal | 1 | **1 per tx** | only on retry arrival |
| Stranded ENQUEUED recovery | **one `$transaction` per job** (`dispatcher.server.ts:1068`, `:1216`) | RETRY_WAIT or terminal | 1 | **1 per tx** | only on retry arrival |
| Timeout recovery | per-job tx | as retry/fail | 1 | 1 | as above |
| Uninstall | `$transaction` (`uninstall.server.ts:102`) | 1× `Shop.processingEnabled=false`; jobs → CANCELLED (filtered) | 1 | 1 | yes, 1 shop |
| Reinstall | autocommit `shop.update` | 1× `processingEnabled=true` | 1 | 1 | yes, 1 shop |
| Expired dispatch-lease recovery | **one** `$queryRaw` UPDATE (`buildExpiredDispatchLeaseRecoverySql`) | 1 multi-row `DISPATCH_LEASED → PENDING` | many | **= the single statement** | yes, trigger `ORDER BY shopId ASC` |
| Bulk `Shop.processingEnabled` | one UPDATE | 1 statement | many | = statement | yes, trigger `ORDER BY id ASC` |
| Raw multi-row INSERT/UPDATE | one statement | 1 | many | = statement | yes, ASC |
| `claimBatchFair` (`dispatchPendingJobs` claim) | `$transaction` A/B/C/D, multi-round | lease CAS is `→ DISPATCH_LEASED`; step D writes `DispatchReadyShop` directly | many | many | **NO** |
| `enqueueWithDispatch` return-to-PENDING | separate tx, per job | 1× UPDATE → PENDING | 1 | 1 | yes, 1 shop |
| `dispatchPendingJobs` overall | recover **then** claim **then** per-job enqueue — three separate transactions | — | — | never >1 shop in a multi-statement advisory-taking tx | — |

### 7.1 The two structural facts that make this work

**(a) The claim path takes no readiness advisory lock.** The UPDATE trigger's `WHERE n.state IN ('PENDING','RETRY_WAIT')` filter excludes the `→ DISPATCH_LEASED` lease CAS. I confirmed this is why `claimBatchFair` — which *does* touch many shops across many separate statements in fairness order, **not** `shopId` order — never enters the lock-order register. Had the lease CAS been readiness-changing, the fair-claim ordering would collide with the ASC invariant on essentially every multi-shop batch.

**(b) The dispatcher never waits on a lock a writer holds.** Every dispatcher acquisition in `fair-claim-query.server.ts` is `FOR UPDATE … SKIP LOCKED` (scheduler lock line 175, job-candidate lock line 294, expired-lease recovery line 415). The writer order is `DurableJob` row → advisory(shop) → `DispatchReadyShop` row. The dispatcher order is `DispatchReadyShop` row → `DurableJob` rows, but it **never blocks** — it skips. The ABBA cycle is therefore structurally broken, not merely ordered.

**Conclusion:** the claimed invariant — *no supported runtime writer issues readiness-changing statements for different shops in separate statements of one transaction* — **holds**. Every multi-shop readiness writer is single-statement; every multi-statement readiness writer is single-shop. No production writer can produce `statement 1 → shop B; statement 2 → shop A`.

---

## 8. Transaction-wide lock-order — **VERDICT: SOUND, via the transaction-shape invariant (acceptance criterion 1), NOT via the register**

The task set two acceptable grounds. D-051 satisfies **ground 1** (supported runtime transactions structurally cannot acquire a descending multi-statement readiness lock order), established in §7. It does **not** satisfy ground 2: the register is not a reliable database-enforced mechanism, because the role that runs the application can modify it (§9).

I explicitly reject statement-level `ORDER BY shopId ASC` as a transaction-wide proof, and the implementation report correctly declines to claim it as one.

---

## 9. `stocky.ready_lock_max_shop` bypassability — **BYPASSABLE by the control-plane runtime role**

PostgreSQL custom placeholder GUCs in a user-defined class carry no privilege by default. Tested with the actual provisioned roles:

| Role | `SET LOCAL … = ''` | `set_config(…,'',true)` | `set_config(…,'arbitrary-shop',true)` | Descending acquisition after reset |
|---|---|---|---|---|
| migration / superuser (`stocky`) | ALLOWED | ALLOWED | ALLOWED | **SUCCEEDS** — holds 2 advisory locks in HIGH→LOW order |
| `stocky_control_plane` | ALLOWED | ALLOWED | ALLOWED | **SUCCEEDS** — holds 2 advisory locks in HIGH→LOW order |
| `stocky_runtime` | n/a | n/a | n/a | cannot reach the path — `permission denied for table DurableJob` |

`stocky_control_plane` is the role the sync control plane actually connects as (`DATABASE_CONTROL_PLANE_URL`). It can reset the register after acquiring a high-shop lock and then acquire a lower-shop lock, ending the transaction holding two per-shop locks in descending order with **no P0001 raised**. The guard is therefore a **convention enforced by cooperating code**, not a database-enforced correctness boundary.

Additional properties established:

- **Malformed/forged values fail safe.** Setting the register to a forged high value (`'ÿÿÿzzzz-not-a-shop'`) causes a fail-closed `P0001` rejection rather than a silent pass. An application bug or hostile SQL can therefore *manufacture a false failure* (a self-inflicted denial of readiness maintenance for that transaction), but cannot manufacture a false success that corrupts readiness — the transaction aborts and commits nothing (§10.4).
- **Application SQL outside the trigger can influence it**, by construction, since it is an ordinary session GUC.

### Correctness-critical or defense-in-depth? — **DEFENSE-IN-DEPTH**

Deadlock freedom for the current codebase rests entirely on the §7 transaction-shape invariant, which holds independently of the register. The register's only live function is to convert a hypothetical future or hand-written opposite-order multi-statement writer's `40P01` into a deterministic, earlier, fail-closed `P0001`. Its bypassability therefore does **not** create a present deadlock risk. It does mean the migration header's framing — *"each acquisition refuses to lock shop S when this transaction already holds a maintain lock for some shop T > S"* — overstates what is enforceable. Recorded as **F-CLAUDE-D051-01 (P3)**.

---

## 10. GUC lifecycle / pool behaviour — **VERDICT: CORRECT**

This was the area I expected to find a defect, on the hypothesis that `ROLLBACK TO SAVEPOINT` would revert the transaction-local register while leaving the advisory lock held — desynchronising the register from reality and silently disabling the guard. **That hypothesis is wrong.** PostgreSQL releases transaction-scoped advisory locks acquired inside a subtransaction when that subtransaction aborts, and `set_config(…, is_local := true)` reverts on the same boundary. The two move in lockstep.

| Case | Register | Advisory locks held | Verdict |
|---|---|---|---|
| Lock inside savepoint, `ROLLBACK TO SAVEPOINT` | reverts to `''` | 1 → **0** | consistent; subsequent lower-shop lock is genuinely safe |
| Lock **before** savepoint (MID), higher lock (HIGH) inside, rollback | reverts to `MID` | 2 → **1** | consistent; a later LOW acquisition is still refused with `P0001` |
| plpgsql `BEGIN … EXCEPTION WHEN OTHERS` swallowing an error (implicit subtransaction) | reverts to `''` | 1 → **0** | consistent |
| `RELEASE SAVEPOINT` | stays at `MID` | 2 held | consistent |
| Rollback to an *outer* savepoint | clears | 2 → **0** | consistent |
| Error after one shop lock, before completion | — | — | transaction aborts `25P02`; fails safe |
| `COMMIT`, then reuse same backend | does not leak | — | subsequent transaction accepts a lower shop |
| `ROLLBACK`, then reuse same backend | does not leak | — | no spurious rejection of later merchants |
| Repeated lock of the same shop | allowed (`<` is strict) | — | correct |

**Transaction-local state cannot leak across pooled-connection reuse and cannot spuriously reject later merchants.** This is a genuine strength of the design and I record it as verified rather than assumed.

---

## 11. Advisory-key collision — **VERDICT: NEGLIGIBLE; CONSERVATIVE-ONLY EFFECT; NOT MATERIAL**

- `hashtextextended(text, bigint)` returns `bigint`. `pg_advisory_xact_lock(bigint)` uses the **full 64-bit** key (confirmed: `pg_locks` splits it into `classid`/`objid` with `objsubid=1`, and recomposing `(classid::bigint<<32)|objid` reproduces the original value exactly).
- 200,000 synthetic shop IDs produced **200,000 distinct keys** — zero collisions.
- Birthday bound: for N shops, P(collision) ≈ N²/2⁶⁵. At one million shops this is ≈ 2.7 × 10⁻⁸.
- **Operational effect of a collision:** two unrelated shops would serialize on one advisory lock. Readiness correctness is unaffected — the upsert is keyed by `shopId` in `DispatchReadyShop`, so a shared lock only over-serializes; it cannot merge or corrupt two merchants' readiness rows. A colliding pair whose textual order is descending within one transaction would additionally raise a fail-closed `P0001` — again the safe direction.
- I decline to invent a security issue here. This is rare conservative cross-shop blocking with correctness preserved. **Not material enough to record as a finding.**

**Collation consistency (adjacent risk, checked):** the trigger's `ORDER BY n."shopId" ASC` and the register's `rec.shop_id < max_held` both derive the same collation from the column (no explicit `COLLATE` anywhere in the migration). Tested on adversarial pairs — punctuation (`a-b`/`ab`, `shop_1`/`shop-1`, `gid://x`/`gid:/x`), case (`A`/`a`, `Z`/`a`), accents (`é`/`e`), numerics (`10`/`9`), and leading/trailing whitespace — `ORDER BY` and `<` agreed in **9/9** cases. No ordering inconsistency exists between the sort that establishes the intended order and the comparison that enforces it.

---

## 12. Opposite-order / multi-statement adversarial testing — **VERDICT: ZERO UNEXPECTED `40P01`**

Direct PostgreSQL probes, raw `pg` clients, `deadlock_timeout=200ms`:

| Probe | Transactions | `40P01` | Fail-closed `P0001` | Other errors |
|---|---|---|---|---|
| H1 ascending vs ascending (A→B / A→B) | 120 | **0** | 0 | 0 |
| H2 opposite order (B→A vs A→B) | 160 | **0** | 80 (the descending side, every time) | 0 |
| H3 3-shop random permutations, 6 concurrent writers | 720 | **0** | 452 | 0 |
| H3 10-shop random permutations, 6 concurrent writers | 360 | **0** | 359 | 0 |
| H4 savepoint-wrapped opposite-order | 240 | **0** | 200 | 0 |
| H5 single-statement 10-shop INSERT, random `VALUES` order | 240 | **0** | 0 | 0 (all 240 succeeded) |
| **Total** | **~1,840** | **0** | — | **0** |

Key results:

- **P0001 fires before any deadlock wait.** Descending multi-statement acquisition never reaches `40P01`.
- **Single-statement multi-shop writes succeed regardless of `VALUES` order** (240/240) — the trigger's internal `ORDER BY shopId ASC` makes the caller's row order irrelevant. This is the property that keeps expired-lease recovery and bulk `processingEnabled` legal.
- **Resetting the register does change this** — see §9; with the register cleared, the descending acquisition proceeds and the transaction holds locks out of order.
- **Under restricted production roles** the same fail-closed behaviour holds for `stocky_control_plane` when the register is left alone.
- **No readiness state is partially committed after a lock-order failure** (H6): the descending transaction failed closed and left **zero** `DispatchReadyShop` rows and **zero** `DurableJob` rows.

**Observed cost of the design (not a defect, but a real constraint):** a 10-shop *multi-statement* writer in random order succeeded only 1 time in 360. Any future writer touching more than one shop across more than one statement must sort ascending or it will abort. This is intended and documented in the migration header, and commit `05bcb88` adjusted the D-049 test writers accordingly — but it is enforced only at runtime, with no static guard. Recorded as **F-CLAUDE-D051-02 (P3)**.

---

## 13. Distinct-shop benchmark — **VERDICT: CONVOY REMOVED**

Disposable PostgreSQL 16.13, 900 ms bursts, one dedicated shop and connection per concurrency slot.

**Throughput (tps):**

| Workload | c1 | c2 | c4 | c10 | c25 | c50 | c100 | peak / c1 |
|---|---|---|---|---|---|---|---|---|
| control (no readiness) | 2,940 | 6,997 | 8,327 | 9,232 | 9,469 | 9,059 | 8,976 | 3.2× |
| PENDING intake | 1,022 | 2,086 | 3,157 | 4,481 | 4,512 | 4,120 | 3,266 | **4.4×** |
| RETRY_WAIT transition | 469 | 946 | 1,500 | 1,833 | 1,785 | 1,595 | 1,178 | **3.9×** |
| Expired-lease recovery | 478 | 977 | 1,434 | 1,799 | 1,833 | 1,551 | 1,183 | **3.8×** |

**Latency (ms):**

| Workload | c1 p50/p95/p99 | c10 p50/p95/p99 | c100 p50/p95/p99/max |
|---|---|---|---|
| control | 0.3 / 0.5 / 0.7 | 0.9 / 1.9 / 2.4 | 10.0 / 12.3 / 19.9 / 50.1 |
| intake | 0.9 / 1.2 / 1.4 | 2.1 / 3.2 / 4.0 | 23.1 / 50.3 / 91.4 / 125.9 |
| RETRY_WAIT | 2.0 / 2.6 / 3.3 | 5.2 / 7.6 / 10.6 | 61.5 / 138.2 / 191.4 / 256.0 |
| recovery | 2.0 / 2.4 / 2.7 | 5.2 / 7.9 / 9.8 | 65.7 / 117.3 / 166.5 / 199.7 |

**Advisory waits: 0. Deadlocks: 0. Errors: 0** across all workloads and concurrencies.

The required property is met. The decisive comparison is against D-050's independently measured plateau recorded in R-127: expired-lease recovery went **373 → 320 tps** from concurrency 1 → 100 (negative scaling — the signature of a global mutex). Under D-051 the same workload scales **478 → 1,833 tps** peak. Intake likewise scales 4.4× rather than collapsing after an early peak. D-051 does not equal the no-readiness control — nor is it required to; per-shop locking plus the readiness upsert has real cost — but **unrelated merchants are no longer globally single-file serialized.**

The tail degradation from c25 → c100 is ordinary connection/CPU saturation on a single disposable cluster (the *control* workload degrades over the same range), not readiness convoy: advisory wait samples were zero throughout.

---

## 14. Head-of-line blocking — **VERDICT: ELIMINATED**

See §5.1. Under D-050, holding a readiness transaction for 1,000 ms delayed an unrelated merchant by 1,068 ms (finishing after the holder committed). Under D-051 the unrelated merchant finished in **9 ms, before the holder committed**, against the same 1,000 ms hold.

---

## 15. Large multi-shop transaction isolation — **VERDICT: CORRECT, NO HIDDEN GLOBAL COUPLING**

A single-statement INSERT spanning **100 shops** was held open. `pg_locks` confirmed the holder backend held exactly **100** granted advisory locks until COMMIT.

| Concurrent merchant | Expected | Observed |
|---|---|---|
| Shop **not** in the holder's 100-shop set | proceeds | **proceeds — 8 ms**, holder still open |
| Shop **in** the holder's set | serializes | **blocks** (ungranted advisory row in `pg_locks`), then completes after holder COMMIT |

The cost is exactly and only proportional to set membership. No global coupling remains.

---

## 16. False-negative readiness regression (D-050 P1 properties) — **VERDICT: NO REGRESSION**

**1,000 claim-vs-writer races**, each on a fresh shop, writer committing concurrently with a dispatcher-style `FOR UPDATE SKIP LOCKED` readiness read:

| Property | Requirement | Result |
|---|---|---|
| Permanent missing readiness | zero | **0 / 1,000** |
| Duplicated readiness rows | zero | **0** |
| Late earliest hint beyond approved contract | zero | **0** |
| Unexpected errors | zero | **0** |

Additional D-050 correctness shapes re-verified under the new lock mechanism:

- **Writer commits before readiness lock** — reconciliation sees it (covered by `d050-corrections.test.ts`, passing).
- **Writer blocked behind readiness lock** — §6.
- **Rollback** — rolled-back writer leaves no readiness row.
- **Cancellation** — `PENDING → CANCELLED` does not delete readiness (fail-safe false positive retained, per the approved "false positives acceptable, false negatives not" contract).
- **Deletion** — no false negative produced.
- **RETRY_WAIT** — arrival creates/pulls readiness correctly.
- **`processingEnabled` race** — §18.

The full `d050-corrections.test.ts` (11 tests) and `d049-readiness-corrections.test.ts` (7 tests) pass on the reviewed head. **Any permanent false-negative readiness would be P1; none was found.**

---

## 17. Expired-lease recovery — **VERDICT: CORRECT**

| Scenario | 2 concurrent callers | 4 concurrent callers | Readiness recreated |
|---|---|---|---|
| 1 shop | ok / ok | ok ×4 | **1 / 1**, no duplicates |
| 2 shops | ok / ok | ok ×4 | **2 / 2**, no duplicates |
| 100 shops | ok / ok | ok ×4 | **100 / 100**, no duplicates |

Zero deadlocks, zero aborts, zero duplicates, **no global dispatch abort** in any configuration. Recovery limit (`FOR UPDATE SKIP LOCKED` + `LIMIT`) respected; concurrent callers do not duplicate work. Race with normal dispatch and rollback/retry covered by `sync-dispatch-recovery` and the D-051 recovery matrix test, both passing.

**Cross-shop isolation of recovery:** a recovery transaction holding shops A and B open did **not** block unrelated shop C — C committed in 8 ms while the recovery transaction was still open.

---

## 18. `processingEnabled` / cross-table lock ordering — **VERDICT: NO ABBA, ZERO DEADLOCKS**

480 transactions across 80 rounds of six concurrent shapes: single-shop job intake, single-shop `processingEnabled` toggle (same shop), `processingEnabled` toggle (different shop), bulk A/B/C `processingEnabled` update, single-statement multi-shop job INSERT, and a dispatcher-style `DispatchReadyShop … FOR UPDATE SKIP LOCKED` scan.

**Result: `{"ok": 480}` — zero deadlocks, zero lock-order failures, zero unexpected errors.**

On the specific ABBA question — `DispatchReadyShop` row lock → advisory versus advisory → `DispatchReadyShop` row lock:

- Both trigger families (`DurableJob` maintain, `Shop.processingEnabled` sync) take the advisory lock **first**, then touch `DispatchReadyShop`. The order is consistent across both families and both use the identical per-shop key derivation.
- The only path that takes a `DispatchReadyShop` row lock *first* is the dispatcher, and it uses `SKIP LOCKED` exclusively — it never waits, so it cannot be the blocking edge of a cycle.
- Critically, the advisory lock is acquired **inside the work loop**, so lease-CAS and non-eligible `DurableJob` UPDATEs never acquire it while the dispatcher holds `DispatchReadyShop` row locks. This is the exact deadlock D-050's comments record as observed under `processingEnabled` bulk + dispatch stress, and D-051 preserves the fix.

---

## 19. D-051 migration under traffic — **VERDICT: SAFE**

Populated D-050 state reconstructed, then `20260812230000_sync_control_plane_d051_readiness_lock_scope` applied while 8 concurrent workers ran representative traffic (intake, retry, expired-lease recovery, `processingEnabled` changes).

| Property | Result |
|---|---|
| Traffic committed across the boundary | 750 intake, 394 retry, 408 recovery, 787 `processingEnabled` |
| Migration duration under traffic | **11 ms** |
| Unexpected errors during migration | **0** |
| Lock-order failures from legitimate single-shop traffic | **0** |
| Readiness gap across the boundary | **0** — every shop with committed eligible work has a readiness row |
| Late earliest hint across the boundary | **0** |
| Additive? | **yes** — no `DROP` / `ALTER TABLE` / `DELETE` / `TRUNCATE`; exactly 3 `CREATE OR REPLACE FUNCTION` + `COMMENT` + `REVOKE` |
| Reviewed D-050 migration unchanged | **yes** — `20260811190000_…` untouched by `d94f5d2` |
| Trigger replacement atomic | **yes** — `CREATE OR REPLACE FUNCTION` swaps bodies transactionally; trigger definitions themselves are not re-created, so no window exists in which a trigger is absent |
| Interruption / retry semantics | re-running the migration is idempotent (`CREATE OR REPLACE` + `REVOKE`); a failed apply leaves the prior bodies intact |

Lock duration is negligible (`ACCESS EXCLUSIVE` on three pg_proc entries for 11 ms). Verified on two independent fresh migration chains.

---

## 20. D-050 P3 contract-test repairs — **VERDICT: BOTH GENUINELY REPAIRED (mutation-proven)**

I did not accept "the test passes" as evidence that the test can detect drift. Each contract was mutation-tested, and the production source restored afterwards (`git diff` clean, verified).

### 20.1 Stale fairness contract (F-CLAUDE-D050-03A)

The test now computes the expected bound from **independent literals** (`INDEPENDENT_REFILL_ROUNDS = 8`, independent `shopCap`, independent `Math.ceil` repair/service arithmetic) and asserts the production helper equals it — rather than asking `fairClaimDegradedStaleRepairBoundCycles` for its own expected result.

**Mutation:** `fairClaimDegradedStaleRepairBoundCycles` altered to return `… + 1`.
**Outcome:** test **FAILED** — `AssertionError: expected 3 to be 2`. Exit 1. ✅ Drift detected.

### 20.2 Anti-reset contract (F-CLAUDE-D050-03B)

Three cases now run on **three distinct shops** (`anti-reset-500`, `anti-reset-2s`, `anti-reset-1000`), so no setup is overwritten before it is exercised — the original defect. Expected constants are independent literals (`APPROVED_MAX_DELAY_MS = 1000`, `APPROVED_FAIRNESS_FLOOR_MS = 1`).

| Case | Requirement | Present |
|---|---|---|
| ≈ +500 ms | must **not** reset improperly; residual delay ≤ 1,000 ms and > 0 | ✅ asserts `after === before` |
| +2,000 ms | due arrival **must** pull earlier | ✅ asserts `≤ now + 50 ms` |
| exactly +1,000 ms boundary | must not exceed approved max; exact 1 s not pulled (`>` not `>=`) | ✅ asserts `after === before` |

**Mutation 1 (constant):** `URGENT_ARRIVAL_ANTI_RESET_MAX_DELAY_MS` widened 1,000 → 5,000 ms.
**Outcome:** test **FAILED** — `expected 5000 to be 1000`. Exit 1. ✅

**Mutation 2 (behavioural, deeper):** the trigger's own SQL window widened `interval '1 second'` → `interval '3 seconds'` in the database, leaving the TypeScript constant untouched.
**Outcome:** test **FAILED**. Exit 1. Restoring the real migration returned it to passing. ✅ The test detects **behavioural** drift in the trigger, not merely a changed TypeScript literal.

**F-CLAUDE-D050-03 / R-128 are genuinely closed.**

---

## 21. Superseded F-F03 PR CI failure — **CLASSIFICATION: `NON-BLOCKING PRE-EXISTING OVERLAP/HARNESS FLAKE`**

I did not accept Cursor's "out-of-scope flake" label on assertion. Facts independently established:

| Fact | Verified |
|---|---|
| PR run `31654676214` / job `94306395279` failed on head `9de05e9…` in `indexes.migration.test.ts` (F-F03), `expect(buildSettled).toBe(false)` received `true` | ✅ per the review brief and job log retrieved |
| The corresponding **PUSH** workflow on the same `9de05e9…` **succeeded** | ✅ |
| `938e998…` is tree-identical to `9de05e9…` | ✅ both trees `bbae8f9d…`; diff empty |
| Subsequent PUSH `31658195375` **and** PR `31658197379` both succeeded on `938e998…` | ✅ |
| D-051 modified no implementation or shared-DB timing surface relevant to F-F03 | ✅ — see below |

**Mechanism (not "it passed later").** The F-F03 test deliberately parks a `CREATE INDEX CONCURRENTLY` on `Supplier` behind open writer-gate transactions and then **polls `pg_stat_progress_create_index`** to observe an *active* build/validation scan phase. It lengthens those phases artificially (`max_parallel_maintenance_workers = 0`, `maintenance_work_mem = '1MB'`). `buildSettled === true` means the concurrent build **completed before the observing poll loop sampled the target phase**. On a shared GitHub-hosted runner, either the Node observer being descheduled under CPU/IO contention or the scan completing faster than the poll interval produces exactly this symptom. It is an observability race in the harness, whose outcome is determined by runner scheduling.

**Why it cannot be a D-051 regression.** D-051's runtime surface is three `CREATE OR REPLACE FUNCTION` statements on `DurableJob` and `Shop` readiness triggers. Its remaining changes are: two test files, one `package.json` test-script entry, one `ACCESS_EXCEPTIONS` allowlist row (`EX-SYNC-TEST-017`), and four migration-name entries added to `tenant-expansion.migration.test.ts`'s manifest lists. **None of these touch `Supplier`, `CREATE INDEX CONCURRENTLY`, the maintenance client, or any lock the index build takes.** I inspected each diff hunk directly. Furthermore, a genuine code-caused failure would be deterministic across event types — yet the PUSH workflow on the *identical tree* passed, and an **empty** commit carrying no code fix turned the PR workflow green. A real regression cannot be fixed by a commit with an empty diff.

**Local reproduction.** The exact failing command was re-run **5 times** under the CI-equivalent environment:

```
FF03_RUN_1_EXIT=0   Tests  1 passed | 12 skipped (13)
FF03_RUN_2_EXIT=0   Tests  1 passed | 12 skipped (13)
FF03_RUN_3_EXIT=0   Tests  1 passed | 12 skipped (13)
FF03_RUN_4_EXIT=0   Tests  1 passed | 12 skipped (13)
FF03_RUN_5_EXIT=0   Tests  1 passed | 12 skipped (13)
```

5/5 passed. **Classification: `NON-BLOCKING PRE-EXISTING OVERLAP/HARNESS FLAKE`.**

This is not a D-051 blocker and is out of D-051's scope to fix. It is nonetheless a real CI-reliability exposure in a pre-existing, timing-observability-dependent test, and is recorded as **F-CLAUDE-D051-03 (P3)** so it is not silently forgotten.

---

## 22. D-045 / D-046 regression — **VERDICT: GREEN**

`npm run test:sync-integration` — **20 files / 241 tests passed**, exit 0. This covers the required surfaces:

| Surface | Suite | Result |
|---|---|---|
| Exactly-once | `sync-exactly-once.test.ts` | pass |
| Final correction | `sync-final-correction.test.ts` | pass |
| Worker finalize | `sync-d046-worker-finalize.test.ts` | pass |
| Dispatch recovery | `sync-dispatch-recovery.test.ts` | pass |
| Envelope fail-closed | `sync-envelope-fail-closed.test.ts` | pass |
| Role isolation | `sync-role-isolation.test.ts` | pass |
| Uninstall / attempt recovery / inventory audit | respective suites | pass |
| Full sync integration | all 20 files | pass |

No accepted finding is reopened. No regression evidence was found in any D-045/D-046 surface.

### 22.1 Supplementary suite execution

| Suite | Result |
|---|---|
| `test:vitest-reporters` | **4 tests passed**, exit 0 |
| `test:migrations-name-filter-probes` | 1 skipped / 1 todo (by design), exit 0 |
| `test:migrations` (full) | 47 / 49 files, **224 passed / 2 failed** — both failures reviewer-environment artifacts, proven in §22.2 |
| `test:sync-exactly-once` (standalone, after re-provision) | **42 / 42 passed**, exit 0 |
| `test:sync-dispatch-recovery` (standalone, after re-provision) | **29 / 29 passed**, exit 0 |
| `test:sync-performance` ×5 | **64 / 64 passed on all five runs**, exit 0 each |

**Run-order artifact (reviewer environment, not a product defect).** On their first standalone invocation, `test:sync-exactly-once` and `test:sync-dispatch-recovery` failed with 58 × `permission denied for table Shop`. Cause: the F-F03 test (§21) calls `resetPublicSchema` and re-runs `prisma migrate deploy`, which drops the schema and with it the grants created by `tenant:roles:provision` / `tenant:enforcement:apply` / `sync:roles:provision`. Both suites had already passed inside the full `test:sync-integration` run (§22) performed before F-F03. The roles were re-provisioned and both suites re-run; results in §22.2. This is an ordering artifact of running a schema-resetting migration test ahead of role-dependent suites in one database, and CI does not exhibit it because it provisions roles before the test phases and runs `test:migrations` last.

### 22.2 The two `test:migrations` failures — both reviewer-environment, both proven

`test:migrations` reported 224 passed / 2 failed. I did not accept either as environmental on inspection alone; each was diagnosed to a mechanism and then re-run to green.

**(1) `tenant-expansion.migration.test.ts > NEW-PR4-C07 role-absent`**

Failure: `2BP01 — role "stocky_control_plane" cannot be dropped because some objects depend on it. DETAIL: 24 objects in database stocky_fresh2`.

The test exercises the role-absent path by dropping `stocky_control_plane`. PostgreSQL roles are **cluster-wide**, so the drop fails while any database in the cluster holds dependent objects. `stocky_fresh2` is the *second fresh database this reviewer created* to satisfy the "second fresh migration chain" evidence requirement (§3); it had 24 dependent objects. Its companion case, `NEW-PR4-C07 role-present`, passed in the same run.

**Proof:** after `DROP DATABASE stocky_fresh2`, the test group re-ran **3 passed / 4 skipped, exit 0**, including `NEW-PR4-C07 role-absent`. CI is unaffected because it provisions exactly one database.

**(2) `connected-identity.test.ts > rejects semantically equivalent privileged URLs`**

Failure: `expected [Function] to throw an error`.

The test constructs variants of the privileged URL that should each normalize to the same semantic identity, including `migration.replace(":5432", "")` guarded by `migration.includes("5432")`. This reviewer's disposable cluster runs on port **54329** to avoid colliding with any system PostgreSQL. `"54329".includes("5432")` is **true**, so the guard fires and the replacement produces `postgresql://stocky:stocky@127.0.0.19/stocky_plus_ci` — host `127.0.0.19`, a genuinely *different* endpoint. `resolveRuntimeDatabaseUrl` correctly does **not** reject it, and the assertion fails. Under CI's port 5432 the same replacement yields `postgresql://stocky:stocky@localhost/stocky_plus_ci` — same host and database, correctly rejected.

**Proof:** re-run with a CI-shaped port, `rejects semantically equivalent privileged URLs` **passes**.

Neither failure touches `DurableJob`, `DispatchReadyShop`, the readiness triggers, or any surface D-051 modifies. Both are artifacts of this reviewer's cluster topology, not of the reviewed head.

### 22.3 Full CI provisioning sequence on a clean database

During the re-provisioning described in §22.1, `tenant:enforcement:apply` returned exit 1 with `preflight_failed: … missing_pr1_composite_index: Supplier_shopId_id_key`. Rather than assume this was environmental, the complete CI provisioning and verification sequence was executed in CI order against a **freshly created database**:

| Step | Exit | Step | Exit |
|---|---|---|---|
| `prisma migrate deploy` | 0 | `tenant:enforcement:apply --apply` | **0** |
| `tenant:indexes:apply --apply` | 0 | `tenant:roles:verify` | **0** |
| `tenant:indexes:verify` | 0 | `tenant:rls:verify` | **0** |
| `tenant:schema:drift` | 0 | `tenant:immutability:verify` | **0** |
| `tenant:enforcement:inventory:check` | 0 | `tenant:enforcement:verify` | **0** |
| `tenant:roles:provision --apply` | 0 | `tenant:enforcement:drift` | **0** |
| `tenant:enforcement:preflight` | 0 | `sync:roles:provision` / `sync:roles:verify` | **0** / **0** |

**All fifteen steps pass end-to-end.** The earlier exit 1 was caused by this session having run three schema-resetting migration suites (F-F03, `test:migrations`, and the `NEW-PR4-C07` re-run) against the same database; each performs `resetPublicSchema` + `prisma migrate deploy`, which drops the PR 1 compatibility indexes, RLS policies, and grants that `tenant:enforcement:apply`'s preflight requires. Partial re-provisioning followed by a further schema-resetting test cannot restore that state. This is a reviewer sequencing artifact with **no bearing on the reviewed head**; PR 3 enforcement machinery is outside D-051's diff entirely.

---

## 23. Documentation / risk / identity verification — **VERDICT: ACCURATE**

| Record | Required state | Actual |
|---|---|---|
| R-119, R-120, R-121, R-124, R-125, R-126 | CLOSED on D-050 evidence, regression gates retained | ✅ each marked *CLOSED on D-050 independent evidence*, historical evidence preserved, gates "remain mandatory during D-051" |
| R-122, R-123 | OPEN | ✅ |
| R-127 (F-CLAUDE-D050-01) | OPEN pending independent verification | ✅ |
| R-128 (F-CLAUDE-D050-03) | OPEN pending independent verification | ✅ |
| R-115–R-118, R-031/R-032/R-033 | OPEN until PR 4 closure | ✅ |
| Q-003 | OPEN | ✅ |
| F-PR4-18 | OPEN | ✅ |
| D-050 disposition | correction closure approved only, **not** PR 4 acceptance | ✅ `PROJECT_STATUS.md`: "D-050 CORRECTION CLOSURE — APPROVED … Not PR 4 acceptance" |

No record falsely claims PR 4 accepted, PR 5 authorized, production authorized, or inventory writes enabled. `PROJECT_STATUS.md` states PR 4 "not accepted", PR 5 "BLOCKED", Production "NOT AUTHORIZED", production inventory writes "UNAPPROVED".

**F-CLAUDE-D050-02 (stale D-050 identity/CI) is closed.** The D-050 implementation report now records the independently reviewed head `62f4cff…` with exact-head PUSH `31542495663` / job `93947852307` and PR `31542499135` / job `93947862976`, explicitly marks the superseded `50dcac90…` row as the stale entry corrected in this cycle, and states plainly that those runs *do not* cover D-051. I independently confirmed run `31542495663` has `head_sha = 62f4cff0ec2c0ec9542959fb65be29b26997e603`, `event = push`, `conclusion = success`.

---

## 24. Safety / scope — **VERDICT: COMPLIANT**

- No production migration, deployment, queue execution, webhook replay, merchant-data access, or ownership repair was performed.
- All five inventory-write flags remained `false` throughout.
- No implementation code was changed. Two temporary mutations (§20) were applied to a working-tree copy solely to prove test sensitivity and were restored immediately; `git diff` and `git status --porcelain` are clean and `git diff --check` exits 0.
- The reviewed D-050 migration was not edited. No earlier immutable review was edited.
- PR #20 was not merged, not marked ready, and received no commits. Nothing was pushed to `phase-1/sync-control-plane`.
- No history was amended, rebased, squashed, or force-pushed.

---

## 25. Findings

### F-CLAUDE-D051-01 · **P3** · `stocky.ready_lock_max_shop` is presented as an enforcement mechanism but is modifiable by the control-plane runtime role

- **File / line:** `stocky-plus/prisma/migrations/20260812230000_sync_control_plane_d051_readiness_lock_scope/migration.sql:26-31` (header claim), and the three guard blocks at `:64-81`, `:168-185`, `:258-275`. Related narrative: `PR4_SYNC_CONTROL_PLANE_D051_CORRECTION_IMPLEMENTATION_REPORT.md:61,91`.
- **Evidence:** connected as `stocky_control_plane`, `SET LOCAL stocky.ready_lock_max_shop = ''` and `SELECT set_config('stocky.ready_lock_max_shop','',true)` both succeed. After acquiring the advisory lock for a high shop and clearing the register, a subsequent lower-shop readiness statement acquires its lock with **no `P0001`**, leaving the transaction holding two per-shop advisory locks in descending order. PostgreSQL custom placeholder GUCs carry no privilege by default.
- **Merchant impact:** **none today.** Deadlock freedom rests on the transaction-shape invariant (§7), which holds independently. The register is defense-in-depth. Impact would become real only if a future writer were introduced that relies on the register instead of the invariant.
- **Reproduction:** `BEGIN; <insert PENDING job for shop 'zzz…'>; SELECT set_config('stocky.ready_lock_max_shop','',true); <insert PENDING job for shop 'aaa…'>;` as `stocky_control_plane` → both succeed; `pg_locks` shows two granted advisory locks.
- **Expected behaviour:** the documentation should describe the register as *defense-in-depth that detects the disallowed shape in cooperating code*, not as a boundary the runtime role cannot cross. A convention must not be called database enforcement.
- **Recommended correction:** (a) reword the migration header and implementation report to state the invariant is the correctness boundary and the register is a fail-closed detector; (b) add a regression test that asserts the *invariant itself* — e.g. a source-level or runtime assertion that no readiness-taking transaction spans more than one shop across more than one statement — so the guarantee does not silently depend on an overridable GUC.
- **Missing test:** a test proving the register can be cleared by the control-plane role (documenting the limitation), plus an invariant-level regression gate over runtime writers.

### F-CLAUDE-D051-02 · **P3** · Multi-shop multi-statement writers fail closed at runtime only, with no static guard

- **File / line:** same three guard blocks; constraint documented at `migration.sql:16-35`.
- **Evidence:** in a 10-shop random-permutation stress, **359 of 360** multi-statement transactions aborted with `stocky_dispatch_ready_lock_order` (§12). Commit `05bcb88` had to retrofit the D-049 multi-shop test writers to the new invariant, demonstrating the trap is easy to hit in practice.
- **Merchant impact:** none today — no runtime writer has this shape (§7). The risk is forward-looking: a future writer added innocently (for example a batch operation looping over shops inside one `$transaction`) will abort at runtime, and only under multi-shop conditions that may not appear in unit tests.
- **Reproduction:** any transaction issuing readiness-changing statements for shop B then shop A.
- **Expected behaviour:** the constraint should be discoverable before runtime.
- **Recommended correction:** document the invariant in `AGENTS.md` / the PR 4 architecture document as a writer rule, and add a lint or review checklist item for new `$transaction` blocks that write `DurableJob` or `Shop.processingEnabled`.
- **Missing test:** a guard test enumerating readiness-writing transactions and asserting each is single-shop or single-statement.

### F-CLAUDE-D051-03 · **P3** · Pre-existing F-F03 index-build observability race is CI-flaky (out of D-051 scope)

- **File / line:** `stocky-plus/scripts/tenant-indexes/tests/indexes.migration.test.ts:625` (F-F03), assertions at `:487`, `:511`, `:516`.
- **Evidence:** PR run `31654676214` / job `94306395279` on `9de05e9…` failed `expect(buildSettled).toBe(false)`; the PUSH workflow on the identical tree passed; 5/5 local reruns passed.
- **Merchant impact:** none — test-harness only. Impact is developer/CI trust: a non-deterministic gate can mask or manufacture failures on unrelated pull requests.
- **Reproduction:** run the F-F03 test on a contended runner; the poll loop may miss the active phase window.
- **Expected behaviour:** phase observation should be deterministic, or the assertion should tolerate a missed sample without failing.
- **Recommended correction:** gate on a deterministic signal (for example, hold the build in `waiting for writers` and assert on the lock/wait state rather than racing `pg_stat_progress_create_index` sampling), or retry the phase observation. **This is pre-existing and belongs to the tenant-index surface, not D-051.**
- **Missing test:** a determinism check for the phase-observation harness itself.

### No P0, P1, or P2 findings

No cross-tenant exposure, no destructive inventory or financial behaviour, no broken authentication, no data loss, no production-secret exposure. No incorrect readiness, recovery, or fairness behaviour, no core-workflow failure, and no App Store blocker was found in D-051's scope. No significant reliability, performance, or migration problem was found: the change **removes** a P2-severity performance defect and introduces none.

---

## 26. Disposition of the reviewed findings

| Finding | Risk | Verdict |
|---|---|---|
| **F-CLAUDE-D050-01** — global readiness advisory lock serialized unrelated merchants | **R-127** | **CLOSED.** Global key removed and replaced with a per-shop key used consistently by all three trigger families. Cross-shop non-blocking proven deterministically; head-of-line blocking eliminated (1,068 ms → 9 ms); throughput scales 3.8–4.4× where D-050 measured 373 → 320 tps. D-050 defect independently reproduced on the same cluster for contrast. |
| **F-CLAUDE-D050-02** — stale D-050 implementation-report identity/CI | — | **CLOSED.** Reviewed head `62f4cff…` and its exact-head PUSH/PR CI now recorded; the superseded `50dcac90…` row is explicitly marked corrected; the report states those runs do not cover D-051. Run `31542495663` independently confirmed success on `62f4cff…`. |
| **F-CLAUDE-D050-03A/B** — non-independent contract tests | **R-128** | **CLOSED.** Both contracts mutation-proven to detect drift, including a behavioural mutation of the trigger's own SQL window. Three distinct shops eliminate the overwritten-setup defect. |

**R-127 and R-128 may be closed** on this independent evidence, with regression gates retained.

**R-123** (multi-shop readiness maintain lock-order / deadlock) — the deadlock behaviour is now well evidenced (zero `40P01` across ~1,840 adversarial transactions plus 480 cross-table combinations), but its closure is governed by normal PR 4 closure and depends on accepting the transaction-shape invariant as the correctness boundary. Recommend it remain **OPEN** until PR 4 acceptance, with F-CLAUDE-D051-01/02 tracked against it.

---

## 27. Verdict

### `APPROVE D-051 CORRECTION CLOSURE`

D-051 does what it set out to do. The global readiness mutex is genuinely gone; the replacement is per-shop, consistently keyed across all three trigger families, and the convoy and head-of-line defects that motivated R-127 are demonstrably removed — measured against a reproduction of the D-050 behaviour on the same cluster rather than against a claim. The D-050 P1 correctness guarantees survive the mechanism change: 1,000 races produced zero permanent missing readiness, zero duplicates, and zero late hints. The two P3 contract tests are repaired in a way that provably detects drift, including behavioural drift in the trigger SQL. The superseded F-F03 CI failure is a pre-existing harness observability race, established by mechanism and by tree-identity reasoning, not by "it passed later."

The architecture is sound, but **for a different reason than the migration header claims**. Deadlock freedom comes from the transaction-shape invariant — every multi-shop readiness writer is single-statement, every multi-statement readiness writer is single-shop, and the dispatcher never waits because it only ever uses `SKIP LOCKED`. It does **not** come from `stocky.ready_lock_max_shop`, which the control-plane role can clear at will. That register is a useful fail-closed detector and it behaves correctly under savepoints, subtransaction aborts, rollback, and pooled-connection reuse — a property I tested specifically because I expected it to be broken, and it is not. But it is a convention, not database enforcement, and the documentation should say so. That gap is the substance of F-CLAUDE-D051-01 and is P3 because nothing in the current codebase depends on the register for correctness.

This verdict closes the three D-050 findings and authorizes closing R-127 and R-128. It is **not** PR 4 acceptance, not a merge or readiness verdict, and not authorization for PR 5, production, or inventory writes.

**Unchanged and still in force:** PR #20 remains OPEN, DRAFT, UNMERGED. PR 4 is **not accepted**. PR 5 remains **BLOCKED**. Production remains **NOT AUTHORIZED**. All inventory-write flags remain **OFF**. Q-003 and F-PR4-18 remain **OPEN**. R-115–R-118, R-122, R-123, and R-031/R-032/R-033 remain **OPEN** under normal PR 4 closure.
