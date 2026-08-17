# Phase 1 PR5-F2B — Canonical Fact Applicator Implementation Report

**Slice:** PR5-F2B canonical merchant-fact applicator
**Branch:** `cursor/pr5-f2b-canonical-applicator-055c`
**Authority:** D-054 **EFFECTIVE**; PR5-F1 foundation **FROZEN**
**Status:** Implementation complete — pending independent verification
**Production:** NOT AUTHORIZED
**Inventory-write flags:** DEFAULT OFF
**Shopify network I/O in this lane:** NONE

This report records the PR5-F2B applicator implementation. It does **not** claim PR 5 is complete. It does **not** start webhook, bulk/JSONL, compatibility-projection, or PR 6 work. ChatGPT has not accepted this slice.

---

## 1. Verified main / exact base SHA

`origin/main` = `5129707ee684e66cadcf96b976e16eb57385a7cb`

Authorized exact base for this lane: `5129707ee684e66cadcf96b976e16eb57385a7cb`.

## 2. Starting branch SHA

Branch `cursor/pr5-f2b-canonical-applicator-055c` was created from that exact base. Pre-edit worktree was clean on that SHA.

## 3. Runtime / test implementation head

`19a97af201aaa4a7a0459cc1302485cb2371a33a` — `Phase 1 PR5-F2B — canonical merchant-fact applicator`

This is the last runtime/test implementation commit. A later documentation commit on the same branch may exist; it must not be treated as a runtime change.

## 4. Files changed

Allowed-path implementation:

- `stocky-plus/app/lib/catalog-facts/apply/**` (new apply module)
- `stocky-plus/app/lib/catalog-facts/index.ts` (exports)
- `stocky-plus/app/lib/catalog-facts/lock-capacity.ts` (R-162 safe-integer fail-closed)
- `stocky-plus/app/lib/catalog-facts/lock-capacity.test.ts`
- `stocky-plus/app/lib/catalog-facts/foundation-safety.test.ts` (recursive production-module scan)
- `stocky-plus/scripts/tenant-enforcement/tests/pr5-f2b-canonical-applicator.test.ts`
- `stocky-plus/docs/phases/phase-1/PR5_F2B_CANONICAL_APPLICATOR_IMPLEMENTATION_REPORT.md` (this report)

**Not changed:** Prisma schema, foundation migration, feature flags, webhook handlers, GraphQL, JSONL, SyncRun checkpoints, compatibility projection, legacy caches, forecast/ABC, inventory-write flags.

## 5. What the applicator does

`applyCanonicalFacts(db, input)` applies already-authoritative observations inside an open tenant transaction. The caller owns COMMIT/ROLLBACK. There is no Shopify network I/O.

Supported identities: Product, ProductVariant, InventoryItem, Location, InventoryLevel.

Universal serialization: every writer acquires `pg_advisory_xact_lock(key1, key2)` via the frozen `acquireCanonicalIdentityAdvisoryLock` primitive, in deterministic ascending `(key1, key2)` order, before first insert, update, tombstone, revival, InventoryLevel pair writes, diagnostic writes, or batch apply. `SELECT FOR UPDATE` is secondary when the row exists. Unique conflict despite the anchor retries the full apply algorithm (no `ON CONFLICT DO UPDATE` correctness shortcut).

## 6. Primary gates

| Gate | Implementation |
|---|---|
| R-157 | Applicator does not call `setval`. Direct observations persist caller-allocated `nextval` generations. Apply-module source scan forbids `setval(`. |
| R-158 | Clock B uses closed observation intervals, not response-gen LWW. Overlapping LIVE vs ABSENT preserves last unambiguous existence and records `CONCURRENT_EXISTENCE_OBSERVATION_CONFLICT`. |
| R-159 | Direct apply requires a token. Final fence uses PostgreSQL `clock_timestamp()`. Expired observations cannot apply and are durably `ACTIVE → ABANDONED` in the same tenant transaction. `ABANDONED` never returns to `ACTIVE`. Missing token fails closed. Earlier-or-equal ACTIVE resultless rows block existence mutation. |
| R-160 | Advisory identity lock is acquired for every identity in the batch before any fact write, including first insert. |
| R-161 | Batch size is capped by `evaluateCanonicalLockCapacity` against live PostgreSQL settings. Default envelope remains 32; this lane does not raise PostgreSQL settings. Deployment/concurrency capacity evidence remains OPEN. |
| R-162 | **Resolved in this lane.** Direct evaluator inputs require `Number.isSafeInteger`. Derived `sharedLockObjectBudget` fail-closes if the product is not a safe integer. |
| R-164 | **Mandatory lane gate.** Ordinary apply APIs export no physical-delete operation. Writers are INSERT/UPDATE only. Source scan forbids `deleteMany` and `DELETE FROM` canonical fact tables. RLS is unchanged. |

## 7. Clock / existence / money

- Clock A: Shopify `updatedAt` wins when both sides are versioned.
- Nullable-version fallback implements §6.F.9 interval overlap / non-overlapping-later rules. No arrival-order last-writer-wins.
- Existence kinds: `LIVE_FULL_SYNC_PRESENT`, `LIVE_REFETCH`, `ABSENT_CONFIRMED_QUERY`. `ABSENT_FULL_SYNC_SWEEP` is rejected. Full-sync presence may advance `lastSeenFullSyncRunId` when attributes no-op. `LIVE_FULL_SYNC_PRESENT` stores NULL/NULL existence gens.
- Tombstones require `ABSENT_CONFIRMED_QUERY`. No physical delete of canonical facts.
- Terminal Product / ProductVariant / InventoryItem / Location revival requires two independent non-overlapping LIVE confirmations (`second.requestGen > first.responseGen`) and matching `createdAt` when both are present. InventoryLevel is reconnectable (exemption).
- Eight inventory quantity names apply independently with per-name `updatedAt` / null-version generation fallback.
- `priceAmount`, `compareAtPriceAmount`, `unitCostAmount` stay exact decimal text / Decimal-like. `Number` / `parseFloat` are rejected.

## 8. Local validation (executed)

Environment: disposable PostgreSQL **16.14** (`stocky` / `stocky_plus` on localhost:5432), Redis 7, Node for this agent. Inventory-write flags were not changed.

| Command | Exit | Result |
|---|---|---|
| `npx tsc --noEmit` | 0 | executed and passed |
| `npx eslint --ignore-path .gitignore app/lib/catalog-facts scripts/tenant-enforcement/tests/pr5-f2b-canonical-applicator.test.ts` | 0 | executed and passed |
| `git diff --check` | 0 | executed and passed |
| `npm test -- app/lib/catalog-facts` | 0 | **34** passed / 5 files |
| `npm test` | 0 | **90** passed / 11 files |
| `npm run test:migrations -- scripts/tenant-enforcement/tests/pr5-f2b-canonical-applicator.test.ts` | 0 | **19** passed / 1 file |
| `npm run build` | 0 | executed and passed (`react-router build`) |
| Full `npm run test:migrations` (entire tenant-enforcement corpus) | — | **not executed locally**; required on exact-head full CI |
| `npm run lint` (repo-wide) | — | **not executed**; focused eslint on changed paths passed |
| `npm run typecheck` (`react-router typegen && tsc`) | — | `tsc --noEmit` executed and passed; typegen **not executed** locally |

### PostgreSQL applicator races executed (19)

first insert; overlapping agreeing; overlapping conflicting attributes; overlapping LIVE vs ABSENT existence; concurrent first insert; stale bulk vs newer direct + presence; missing token; lease expiry + durable abandonment; ABANDONED token after clock-rollback-class (Race AS); multiple blockers (Race AQ); terminal revival one / overlapping / valid second; InventoryLevel reconnect; per-name quantity ordering + money text; null `updatedAt`; capacity fail-closed (Race AW); rollback; cross-shop tenant mismatch + R-164 surface; deterministic multi-lock order; waiter vs holder advisory lock.

## 9. Risk status after this slice

| Risk | Status |
|---|---|
| R-157 | **OPEN** — applicator does not reset the sequence; remain OPEN until ChatGPT closes the PR5 allocation-path set |
| R-158 | **OPEN** — engine implemented; remain OPEN until independent review / ChatGPT close |
| R-159 | **OPEN** — fencing implemented; remain OPEN until independent review / ChatGPT close |
| R-160 | **OPEN** — every writer in this lane uses the advisory anchor; remain OPEN until independent review / ChatGPT close |
| R-161 | **OPEN** — evaluator consumed; PostgreSQL settings not increased; deployment capacity evidence still required |
| R-162 | **Implemented in this lane** — pending independent verification / ChatGPT close |
| R-164 | **Implemented in this lane as a mandatory acceptance gate** — pending independent verification / ChatGPT close |

## 10. Explicit non-authorization

- Production remains **NOT AUTHORIZED**.
- Merchant production data remains **NOT AUTHORIZED**.
- Shopify inventory mutations remain **NOT AUTHORIZED**.
- Every inventory-write flag remains **DEFAULT OFF**.
- No D-055.
- No PR 6.
- No webhook / bulk JSONL / compatibility-projection lane started.

## 11. Exact-head CI

Pending after the draft PR is opened. This report will be updated with the exact-head `pull_request` run id, `head_sha`, classify / heavy / CI Gate conclusions, and any superseded failed/cancelled runs.

## 12. Next action

Return to ChatGPT for PR5-F2B technical review after exact-head full CI is green. Do **not** merge. Do **not** mark the PR ready. Do **not** start webhook or bulk integration.
