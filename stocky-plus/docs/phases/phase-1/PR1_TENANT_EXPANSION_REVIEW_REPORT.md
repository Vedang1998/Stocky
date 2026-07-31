# PR 1 — Tenant Expansion and Backfill — Independent Review Report

**Phase:** 1
**Work unit:** PR 1 — Tenant expansion and backfill foundation
**Reviewer:** Claude (independent review)
**Repository:** `Vedang1998/Stocky`
**Pull request:** #11 — *Add Phase 1 tenant expansion and backfill foundation*
**Base main SHA:** `8ccc8d29a78e05615b31324b38df17f4f1d1296e`
**Exact review head:** `7aabb095806716697bfea2783379351b15e1cda2`
**Destination:** `stocky-plus/docs/phases/phase-1/PR1_TENANT_EXPANSION_REVIEW_REPORT.md`

---

## 1. Executive summary

**Final verdict: `NOT READY`.**

PR 1 is well-structured work with correct scope discipline. The schema surface is exactly what PR 1 authorises — 18 nullable `shopId` columns, canonical `Shop`, backfill control tables, no RLS, no Shop foreign keys, no `NOT NULL`, `Session` untouched, all 13 legacy `shop` columns preserved. I verified this by applying the migrations to a disposable PostgreSQL 16.14 instance and inspecting the catalog directly. PR identity and exact-head CI were confirmed against the GitHub API, not the PR description.

However, the backfill engine does not yet satisfy the approved PR 1 contract, and five separate defects would each independently corrupt or conceal the ownership evidence that PR 3 enforcement is supposed to depend on. The most serious:

* **Dry-run and apply do not produce equivalent classification.** In dry-run no parent `shopId` is ever written, and child classification reads the parent's *persisted* `shopId`. Every child row in every child table is therefore classified `PARENT_SHOP_UNRESOLVED` in dry-run and `updated` in apply, on identical data. The approved requirement is explicitly violated, and the existing test does not check for it.
* **Unresolved evidence can be permanently lost.** Checkpoint advancement commits inside the batch transaction; issue rows are only written in an in-memory array flushed at end-of-run. A crash between those two points advances the cursor past rows whose quarantine evidence was never persisted, and the resumed run skips them forever.
* **Cross-domain issues are invisible to the operational gate.** PO/supplier and lead-time tenant mismatches create `TenantOwnershipIssue` rows but never increment `unresolvedCount`. The CLI's blocking warning is keyed on `unresolvedCounts`, so a dataset with only cross-domain inconsistency completes silently with an all-zero unresolved report.
* **A re-detected `RESOLVED` issue stays `RESOLVED`**, so genuinely unresolved ownership is under-reported by the very counter an enforcement gate would consult.
* **`CREATE INDEX IF NOT EXISTS` silently accepts a pre-existing `INVALID` index.** I proved this on PostgreSQL 16: the statement emits a notice, reports success, and leaves the index invalid — including a *unique* index that is therefore not enforcing uniqueness. This is exactly the state the runbook's own CONCURRENTLY recovery path can produce.

I could not execute the Prisma-dependent commands: the egress proxy blocks `binaries.prisma.sh`, so no Prisma engine could be downloaded and `prisma generate`, `prisma validate`, `prisma migrate deploy`, and `npm run test:migrations` could not run in my environment. I have said so plainly rather than inferring their result. I compensated where possible by applying the migration SQL directly through `psql` and by reproducing the PostgreSQL-level behaviours empirically.

Nothing here suggests bad faith. The scope control, the redaction of shop strings to length + SHA-256, and the decision to build real PostgreSQL migration tests are all genuinely good. The defects are concentrated in the diagnostic/evidence layer, which is precisely the layer PR 3 will be asked to trust.

---

## 2. Review identity

| Item | Value |
|---|---|
| Reviewed head | `7aabb095806716697bfea2783379351b15e1cda2` |
| Base | `8ccc8d29a78e05615b31324b38df17f4f1d1296e` (`main`) |
| Method | Fresh clone, `git fetch origin refs/pull/11/head`, detached review checkout |
| Repository modified | No. No commits, no pushes, no branches, no merges, no PR state changes |
| Production/merchant data | None accessed |
| Migrations run against | Disposable local PostgreSQL 16.14 only (`/tmp/pgdata`, port 5433, destroyed after review) |
| Inventory-write flags | Not changed; PR touches no feature-flag source |

---

## 3. Repository, PR, and CI verification

Verified through the authenticated-free GitHub REST API at review time.

| Check | Result |
|---|---|
| Repository | `Vedang1998/Stocky` ✅ |
| PR number / title | #11 — "Add Phase 1 tenant expansion and backfill foundation" ✅ |
| State | `open` ✅ |
| Draft | `true` ✅ |
| Merged | `false` ✅ |
| Base ref / SHA | `main` / `8ccc8d29a78e05615b31324b38df17f4f1d1296e` ✅ |
| Head ref / SHA | `phase-1/tenant-expand` / `7aabb095806716697bfea2783379351b15e1cda2` ✅ |
| Commits | 3 — `854a3d5`, `0d836e1`, `7aabb09` ✅ |
| Commits after `7aabb09…` | None ✅ |
| Changed files | 25 (+2969 / −72) ✅ |
| Check run at exact head | "Lint, typecheck, test, build, Prisma, GraphQL" — `completed` / `success` ✅ |
| Run ID / Job ID | `30578683952` / `90993206934` — matches the reported values ✅ |
| Check associated with exact head | Yes — retrieved via `/commits/7aabb095…/check-runs` ✅ |
| Skipped required steps | None observed in the check-run set |
| Blocking review threads | None found |

CI association was confirmed against the head SHA directly, not taken from the PR body. Note that the CI evidence *recorded inside the implementation report* does not cover this head — see F-PR1-12.

---

## 4. Commands executed

Environment: Ubuntu 24.04 container, Node v22.22.2, npm 11.5.2 (installed to match the pinned `packageManager`), PostgreSQL 16.14 (disposable, `-A trust`, port 5433).

| Command | Exit | Result |
|---|---|---|
| `git clone` + `git fetch origin refs/pull/11/head` | 0 | Head resolved to `7aabb095…` |
| `npm ci` | 1 → 0 | Initially `EBADENGINE` (npm 10.9.7 vs required 11.5.2); passed after installing npm 11.5.2 |
| `npx prisma generate` | 1 | **BLOCKED** — `binaries.prisma.sh` 403 Forbidden (egress allowlist) |
| `npx prisma validate` | 1 | **BLOCKED** — same cause; `PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1` also fails (engine file itself blocked) |
| `npx prisma migrate deploy` | 1 | **BLOCKED** — same cause |
| `npm run test:migrations` | — | **NOT RUN** — depends on Prisma engine + `migrate deploy` |
| `npm run lint` | 0 | Clean |
| `npm run typecheck` | — | **NOT RUN** — requires generated Prisma client |
| `npm test` | 1 | 22 tests passed, 3 test files failed **solely** with `@prisma/client did not initialize yet`; the 3 non-Prisma files passed. Failure is environmental, not a code defect |
| `npm run build` | — | **NOT RUN** — requires generated Prisma client |
| `npm run graphql-codegen` | — | **NOT RUN** — same |
| `git diff --check 8ccc8d2 pr11` | 2 | Trailing whitespace in four Markdown docs (see F-PR1-13) |

Substitute execution performed to compensate for the Prisma block:

| Action | Exit | Result |
|---|---|---|
| Apply `20260728000000_init_stocky_plus` via `psql -v ON_ERROR_STOP=1` | 0 | Clean |
| Apply `20260730160000_tenant_expansion` | 0 | Clean |
| Apply `20260730160100_tenant_compatibility_indexes` | 0 | Clean |
| Catalog inspection (nullability, RLS, FKs, legacy columns) | 0 | See §6 |
| Index lock-mode / write-blocking probe | 0 | See §8.5 |
| `IF NOT EXISTS` vs `INVALID` index probe | 0 | See §8.5 |
| Advisory-lock reentrancy and cross-backend unlock probe | 0 | See §8.4 |
| Domain-validator boundary probe (`tsx`) | 0 | See §8.6 |

**I did not run, and do not claim results for, `prisma generate`, `prisma validate`, `prisma migrate deploy`, `test:migrations`, `typecheck`, `build`, or `graphql-codegen`.** Exact-head CI reports success for all of these, which is meaningful but is not a substitute for the independent execution the prompt requires. This gap should be closed by a reviewer with unrestricted egress before acceptance.

---

## 5. Scope verification

**Implemented, and correctly limited to PR 1:**

| Requirement | Verified | Evidence |
|---|---|---|
| Canonical `Shop` model | ✅ | `schema.prisma`; `Shop` table created by tenant-expansion migration |
| Nullable `shopId` on exactly 18 merchant-owned models | ✅ | `information_schema`: exactly 18 columns named `shopId`, all `is_nullable='YES'` |
| `Session` unchanged | ✅ | Diff touches only surrounding context lines |
| Legacy `shop` columns preserved | ✅ | 13 `shop` columns present after all migrations |
| Backfill run / checkpoint / issue tables | ✅ | `TenantBackfillRun`, `TenantBackfillCheckpoint`, `TenantOwnershipIssue` |
| Deterministic normalization (versioned) | ⚠️ | `phase1-shop-domain-v1` present and deterministic, but incomplete — F-PR1-08, F-PR1-09 |
| Resumable / idempotent / batched backfill | ⚠️ | Present, but resume loses issue evidence — F-PR1-02 |
| Ownership quarantine | ⚠️ | Present, but under-counted and under-reported — F-PR1-03, F-PR1-04 |
| Compatibility indexes | ⚠️ | Present; rollout method deviates — F-PR1-05, F-PR1-06 |
| Real PostgreSQL migration tests | ⚠️ | Present, but shallow on the critical guarantees — §9 |
| Runbook + permanent phase records | ✅ | Runbook, ownership inventory, implementation report all present |

**Correctly NOT implemented** — each independently verified against the live schema:

| Exclusion | Verified |
|---|---|
| Non-null `shopId` | ✅ 0 of 18 are `NOT NULL` |
| Shop ownership foreign keys | ✅ `SELECT count(*) FROM pg_constraint WHERE contype='f' AND confrelid='"Shop"'::regclass` → **0** |
| Composite child foreign keys | ✅ None |
| RLS / forced RLS | ✅ `count(*) … WHERE c.relrowsecurity` → **0** |
| Runtime/migration DB-role separation | ✅ Absent |
| Transaction-local tenant context | ✅ Absent |
| Tenant-bound runtime access conversion | ✅ No `app/` runtime files changed except the new `shop-domain.ts` helper |
| Runtime dual writes | ✅ Absent |
| Shopify sync expansion | ✅ Absent |
| Inventory mutations | ✅ Absent |
| PR 2 / PR 3 / later Phase 1 / Phase 2 work | ✅ Absent |

**Scope discipline is correct.** This is a real strength of the submission.

---

## 6. Schema and migration findings

Applied to an empty PostgreSQL 16.14 database in sequence; all three migrations applied cleanly with `ON_ERROR_STOP=1`.

Post-migration catalog state:

* 18 nullable `shopId` columns — matches the approved ownership inventory exactly.
* 13 legacy `shop` columns retained; no drops, renames, or type changes. Byte preservation is structurally guaranteed because nothing writes to `shop`.
* 0 tables with row-level security.
* 0 foreign keys referencing `Shop`.
* Index set matches the migration file: 18 `shopId` btree indexes, 4 parent composite unique indexes `(shopId, id)`, 6 child `(shopId, parentId)` indexes.

The `(shopId, id)` unique indexes on `Supplier`, `PurchaseOrder`, `TransferOrder`, and `Stocktake` are safe: `id` is already the primary key, so the composite can never produce a conflict. They are correctly forward-looking for PR 3 composite FKs.

`SET lock_timeout` / `SET statement_timeout` inside the Prisma-wrapped migration transaction is correctly scoped and does not leak on failure. The `RESET` at the end is harmless.

Migration from the exact pre-PR main schema was exercised implicitly (the init migration is the pre-PR schema, and the two new migrations applied on top of it cleanly). The repository's own test file also contains a dedicated case for this path, though I could not execute it.

Prisma schema/migration drift could not be checked independently (`prisma migrate diff` requires the blocked engine). Exact-head CI includes a Prisma step reporting success.

---

## 7. Backfill and quarantine findings

Structural summary of `scripts/tenant-backfill/engine.ts`:

* Shop discovery gathers candidates from `Session` and each direct-owner table's legacy `shop`, normalizes, and either reuses an existing `Shop` or mints one. **Persistence happens only under `apply`** (`engine.ts:251–267`).
* Direct rows resolve `shopId` from their own normalized `shop`; the `UPDATE` is guarded with `AND "shopId" IS NULL` (good) and executes only under `apply` (`engine.ts:731`).
* Child rows resolve strictly from the parent's **persisted** `shopId`, read live from the database inside the batch transaction (`engine.ts:754–793`).
* Batches run in a transaction that commits row updates **and** checkpoint advancement together; issues are returned and appended to an in-process array (`engine.ts:340–375`).
* Issues are flushed to the database only at end-of-run, at interruption, or at the `stopAfterBatches` hook (`engine.ts:390`, `engine.ts:465`).
* Cross-domain diagnostics run after a table's batches complete (`engine.ts:426–429`) and push into the same in-memory array.
* Per-table checksums are SHA-256 over canonical `{id, shopId}` ordered by `id` — deterministic and appropriate.

Positive: shop strings are never stored raw in evidence. `redactShopEvidence` records only length and SHA-256 (`engine.ts:100–105`), and no access token, session secret, or merchant PII is written into any evidence field. The test even asserts an access token does not appear in issues. This is careful work.

The defects below are all in how ownership *evidence* is classified, counted, persisted, and surfaced.

---

## 8. Targeted defect reproductions

### 8.1 Dry-run / apply classification equivalence — **VIOLATED (P1)**

The approved requirement is that dry-run and apply produce the same diagnostic classification for the same starting dataset. They do not.

Mechanism, established by direct code reading:

1. In dry-run, a newly discovered `Shop` is assigned an **in-memory only** id; the `upsert` is inside `if (apply)` (`engine.ts:251–266`). Nothing is persisted.
2. In dry-run, `processDirectRow` computes the correct `expectedShopId` and returns `kind: "updated"` — but the `UPDATE` is inside `if (apply)` (`engine.ts:731–738`). The parent's `shopId` column stays `NULL`.
3. `processChildRow` then re-reads the parent **from the database** (`engine.ts:754–760`) and branches on `if (!parent.shopId)` → `PARENT_SHOP_UNRESOLVED`, `kind: "unresolved"` (`engine.ts:781–795`).

Because `BACKFILL_TABLE_ORDER` processes parents before children but dry-run never persists the parent's `shopId`, **every child row whose parent is otherwise perfectly valid is classified `unresolved` in dry-run and `updated` in apply.** This affects all six child tables: `SupplierSkuMapping`, `VolumePriceTier`, `LeadTimeSnapshot`, `POLineItem`, `TransferLineItem`, `StocktakeLineItem`.

The scenario matrix requested in the review prompt therefore diverges as follows on identical starting data:

| Fixture | Dry-run | Apply |
|---|---|---|
| Valid Supplier + SupplierSkuMapping | parent `updated`, child **`unresolved` / `PARENT_SHOP_UNRESOLVED`** | parent `updated`, child `updated` |
| Valid PurchaseOrder + POLineItem | same divergence | resolved |
| Valid TransferOrder + TransferLineItem | same divergence | resolved |
| Valid Stocktake + StocktakeLineItem | same divergence | resolved |
| Invalid parent domain | `INVALID_SHOP_DOMAIN` (agrees) | `INVALID_SHOP_DOMAIN` |
| Conflicting existing parent ownership | agrees | agrees |

A secondary divergence: `updatedCounts.Shop` is incremented only under `apply` (`engine.ts:267`), so dry-run always reports zero new canonical shops even when it proposes many.

**Merchant/operational impact:** dry-run is the mechanism by which an operator decides whether an apply is safe. As written, dry-run over-reports unresolved ownership by roughly the entire child-row population, making a healthy dataset look badly broken and destroying the operator's ability to distinguish a real problem from an artefact. It also makes the dry-run checksum and the dry-run `unresolvedCounts` unusable as a pre-apply gate.

**Reproduction:** two identical fresh databases; run dry-run on A and apply on B from identical state; compare per-table `unresolvedCounts` and the `reasonCode` distribution in `TenantOwnershipIssue`. A will show `PARENT_SHOP_UNRESOLVED` for every child row; B will show none.

**Expected behaviour:** dry-run must diagnose against the *proposed* ownership map, not the persisted one — i.e. maintain an in-memory `rowId → proposedShopId` map for direct owners during dry-run and have `processChildRow` consult it before falling back to the persisted column.

**Note on the existing test:** the current test runs dry-run and then apply against the *same* database and asserts only `dry.status === "COMPLETED"` and that one supplier's `shopId` remains null (test file lines 372–382). It never compares classifications. The prompt anticipated exactly this, and the concern is confirmed.

### 8.2 Checkpoint / issue atomicity — **UNSAFE (P1)**

The batch transaction commits row updates and the checkpoint's `lastProcessedId` together (`engine.ts:340–372`). The batch's issues are *returned* from the transaction and appended to a plain in-process array (`engine.ts:375`). They reach the database only via `persistIssues` at end-of-run (`engine.ts:465`), at the `stopAfterBatches` interrupt (`engine.ts:390`), or not at all.

Consequence of a crash — process kill, OOM, connection loss — after a batch commits but before `persistIssues`:

* Run status: remains `RUNNING` (the `catch` block never executes on a hard kill, so not even `FAILED` is recorded).
* Checkpoint `lastProcessedId`: **advanced past the affected rows.**
* Issue rows: **never written.**
* Resume behaviour: `fetchBatch` selects `WHERE id > $1` (`engine.ts:604–618`), so the resumed run **never re-examines those rows**.
* Net result: rows with unresolved ownership are silently skipped, their quarantine evidence is unrecoverable, and the run's `unresolvedCount` under-reports reality. The only recovery is discarding the run and starting a fresh one from scratch.

A closely related instance of the same flaw: on resume, tables whose checkpoint is `COMPLETED` are skipped by `continue` (`engine.ts:282–289`). Their cross-domain diagnostics (`engine.ts:426–429`) never re-run, and their in-memory issues from the original process are gone. **A resumed run's final `persistIssues` therefore omits every issue discovered in every previously completed table.**

**Merchant impact:** the quarantine table is the artefact PR 3 enforcement depends on. A checkpoint must never make unresolved evidence unrecoverable. This is a data-integrity defect, not a robustness nicety.

**Required correction:** persist issues inside the same batch transaction that advances the checkpoint (upsert on `fingerprint`), so evidence and cursor advance atomically. Cross-domain diagnostics should either be checkpointed independently or re-run on resume.

**Reproduction:** fixture with an unresolved row in batch 1; throw from the `onBatchCommitted` hook after commit; then inspect `TenantBackfillCheckpoint.lastProcessedId` (advanced) and `TenantOwnershipIssue` (empty); resume and confirm the row is never re-examined.

### 8.3 Cross-domain issues vs unresolved counts — **INCONSISTENT (P1)**

`diagnosePurchaseOrderSupplierMismatch` and `diagnoseLeadTimeSnapshots` push into the `issues` array only (`engine.ts:426–429`, `engine.ts:857–...`). Neither touches `unresolvedCounts` nor the checkpoint's `unresolvedCount`.

The CLI's blocking warning is gated exclusively on unresolved counts (`cli.ts:79–90`):

```
result.status === "COMPLETED" &&
Object.values(result.unresolvedCounts).some((n) => n > 0)
```

So for a dataset where every row's own ownership resolves but a `PurchaseOrder` belongs to a different tenant than its `Supplier` (or a `LeadTimeSnapshot`'s supplier and PO disagree):

* `TenantOwnershipIssue` rows **are** created ✅
* run and checkpoint `unresolvedCount` **remain 0** ❌
* top-level `unresolvedCounts` **all zero** ❌
* CLI emits **no** `tenant_backfill_unresolved_warning` ❌
* exit code 0, run reports `COMPLETED` cleanly ❌

`issueCount` on the `COMPLETED` path does reflect them (it queries global open issues, `engine.ts:467`), but it is printed inside the result payload, not surfaced as a blocking condition, and it is not what the warning branch tests.

**Merchant impact:** a PR 3 enforcement gate keyed on "unresolved count is zero" — which the runbook and CLI message both point operators toward — would pass while genuine cross-tenant inconsistency is open. That is precisely the failure mode this control exists to prevent.

**Required correction:** cross-domain diagnostics must increment the owning table's `unresolvedCount`, or the gate must be redefined and documented as "zero unresolved **and** zero open issues", with the CLI warning testing both.

### 8.4 Advisory-lock correctness under Prisma pooling — **UNRELIABLE (P2)**

`pg_try_advisory_lock` / `pg_advisory_unlock` are session-level and are issued through `prisma.$queryRawUnsafe` on a pooled `PrismaClient` (`engine.ts:90–99`, acquired at `engine.ts:132`, released in `finally` at `engine.ts:534`). Prisma does not pin a connection across separate raw queries.

Empirically confirmed on PostgreSQL 16.14:

**Reentrancy (fails open):**
```
pg_backend_pid  = 4654
pg_try_advisory_lock(918273645) → t     (first)
pg_try_advisory_lock(918273645) → t     (second, SAME session)
pg_advisory_unlock(918273645)   → t
advisory locks still held        = 1
```
A second acquisition on a connection that already owns the lock **succeeds**. If two concurrent apply runs share a `PrismaClient`, or the pool hands the second run the same backend, the "concurrent apply is denied" guarantee **does not hold**. A single unlock also leaves the lock held, because the lock is reference-counted.

**Cross-backend unlock (fails closed):**
```
backend 4657: pg_try_advisory_lock(918273645) → t
backend 4659: pg_advisory_unlock(918273645)   → f
              WARNING: you don't own a lock of type ExclusiveLock
```
If the release query lands on a different pooled backend than the acquire, the unlock **returns false and does nothing**; the lock persists on the original backend for the life of that pooled connection. A later legitimate run is then **falsely denied** — including a recovery run during an incident.

The implementation therefore relies on process exit and pool luck rather than guaranteeing single-run execution, and can fail in both directions. Notably, the repository's own test acknowledges reentrancy in a comment (test file line 463–464) and works around it by taking the lock from a *different* `PrismaClient` — so the test is constructed to pass rather than to prove the production guarantee.

**Required correction:** acquire and release on a pinned connection (a single `$transaction` using `pg_advisory_xact_lock`, which releases automatically at transaction end), or replace with an application-level run-lock row carrying owner identity, acquisition time, and a heartbeat. Given that this lock guards a mutating ownership backfill, it must be corrected before any production apply is authorized.

### 8.5 Index rollout deviation — **DEVIATION + SILENT-FAILURE RISK (P2 / P1)**

The approved brief requires `CREATE INDEX CONCURRENTLY` where PostgreSQL permits. The committed migration uses ordinary `CREATE INDEX IF NOT EXISTS` / `CREATE UNIQUE INDEX IF NOT EXISTS` with `lock_timeout = 5s` and `statement_timeout = 30min`. The stated justification (Prisma Migrate wraps migrations in a transaction; `CONCURRENTLY` fails with `25001` / `P3018`) is technically accurate.

**Lock mode and write blocking — confirmed empirically.** On a 50,000-row table:

```
Session 1: BEGIN; CREATE INDEX probe_idx ON probe("shopId"); …
  pg_locks → mode = ShareLock, granted = t
Session 2: SET lock_timeout='3s'; INSERT INTO probe …
  → ERROR: canceling statement due to lock timeout
```

Plain `CREATE INDEX` takes `ShareLock` and **blocks all concurrent writes** on the table for the full duration of the build. `lock_timeout = 5s` only bounds how long the migration waits to *acquire*; once acquired, application writes are blocked for the whole build, bounded only by `statement_timeout = 30min`. On populated production tables this is a write outage across 18 tables. The migration is safe on an empty or small database (as in CI), which is why CI is green and tells us nothing about production.

**`IF NOT EXISTS` silently accepts an INVALID index — confirmed empirically.** This is the more serious half:

```
-- interrupted/failed CONCURRENTLY build leaves an invalid index
CREATE UNIQUE INDEX CONCURRENTLY "probe2_bad_key" ON probe2("shopId");
  → ERROR: could not create unique index … Key ("shopId")=(1) is duplicated.
SELECT relname, indisvalid → probe2_bad_key | f     (INVALID)

-- now the migration-style statement:
CREATE UNIQUE INDEX IF NOT EXISTS "probe2_bad_key" ON probe2("shopId");
  → NOTICE: relation "probe2_bad_key" already exists, skipping
  → CREATE INDEX          (reports success)
SELECT relname, indisvalid → probe2_bad_key | f     (STILL INVALID)
```

The statement succeeds, Prisma marks the migration applied, and the index remains unusable by the planner — and, for the `(shopId, id)` unique indexes, **not enforcing uniqueness**. This is exactly the state the runbook's own recovery section says a production operator may encounter. `IF NOT EXISTS` also matches on **name only**: an index of the same name with a *different definition* is silently accepted, and the migration performs no definition or validity verification before completing.

Answers to the specific questions posed:

* Lock modes on populated tables: `ShareLock`, blocking concurrent writes — confirmed.
* Is `prisma migrate deploy` safe when executed normally? On small/empty databases yes; on populated production tables **no**, absent a maintenance window.
* Is the runbook's external pre-creation procedure mandatory or optional? The runbook frames it as "for large production tables … build the same index names outside Migrate" — **advisory phrasing, not a mandatory gate.** Nothing enforces it, and the migration will happily take the blocking path if run normally.
* How is Prisma migration state recorded after external creation? Not addressed. The migration would still run and skip via `IF NOT EXISTS`, but no verification step confirms the pre-created indexes are `VALID` or correctly defined.
* Are index names/definitions verified before the migration is marked applied? **No.**
* Behaviour with a pre-existing invalid index? Silently accepted — proven above.
* Rollback/forward recovery? Runbook documents `DROP INDEX CONCURRENTLY IF EXISTS` + recreate. Reasonable, but only if the operator knows an index is invalid, and nothing in the tooling tells them.

**Assessment:** the deviation is a genuine, merchant-visible departure from an approved requirement, not a cosmetic one. Documenting it does not authorize it. It requires an explicit product-owner deviation decision recorded in `DECISIONS.md`, and the silent-invalid-index acceptance requires correction regardless of whether the deviation is approved.

Production execution remains unauthorized; I did not run this against anything but a disposable database.

### 8.6 Domain validity boundaries — **INCOMPLETE (P2)**

Empirical results from `normalizeShopDomain` at the exact head:

| Input | Result | Expected |
|---|---|---|
| 63-char label + `.myshopify.com` | ACCEPT | accept |
| **64-char label** | **ACCEPT** | **reject — exceeds max DNS label length (63)** |
| **300-char label** | **ACCEPT** (normalized length 314) | **reject — exceeds max hostname length (253)** |
| `shop.myshopify.com` | ACCEPT | accept |
| `SHOP.myshopify.com` | ACCEPT | accept |
| **`\u212Ashop.myshopify.com`** (Kelvin sign) | **ACCEPT** → `kshop.myshopify.com` | **reject — non-ASCII** |
| `-shop.myshopify.com` | reject (`label_hyphen_boundary`) | reject |
| `a.b.myshopify.com` | reject (`extra_hostname_labels`) | reject |
| `https://shop.myshopify.com` | reject (`scheme_present`) | reject |
| `shop.myshopify.com:443` | reject (`port_or_colon`) | reject |

Scheme, port, path, query, fragment, credential, extra-label, hyphen-boundary, and blank handling are all correct and conservative — good work. Two gaps:

* **No length bounds at all.** `STORE_LABEL = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/` is unbounded. The brief explicitly requires maximum DNS label length and maximum hostname length. An overlong value is accepted and materialises a canonical `Shop` row with a structurally invalid `myshopifyDomain`.
* **Non-ASCII can survive `toLowerCase()`.** U+212A (Kelvin sign) lowercases to ASCII `k`, so the ASCII-only regex check is applied *after* the input has already been transformed into ASCII. Two distinct legacy `shop` byte strings therefore normalize to the same canonical domain — a tenant-merge vector. Low likelihood given `shop` originates from Shopify OAuth, but the failure mode is merging two tenants into one `Shop`, and the brief requires ASCII-only enforcement.

**Required correction:** reject any non-ASCII codepoint on the *raw trimmed* input before lowercasing; enforce label length ≤ 63 and total hostname length ≤ 253; add explicit boundary tests at 63/64 and for a non-ASCII confusable.

### 8.7 Issue reopening and `issueCount` semantics — **UNSAFE (P1)**

`persistIssues` (`engine.ts:569`):

```
status: existing.status === "RESOLVED" ? "RESOLVED" : "OPEN",
```

An issue previously marked `RESOLVED` that is **detected again** is left `RESOLVED`. The comment says "Never silently delete; keep OPEN unless previously resolved" — but the effect is that recurring or re-introduced unresolved ownership is invisible to every `status='OPEN'` query, including:

* `openIssues` used as the completed run's `issueCount` (`engine.ts:467`)
* `openIssueCount` in `getBackfillStatus` (`engine.ts:1023`)
* the runbook's own verification query (`SELECT "reasonCode", COUNT(*) … WHERE status='OPEN'`)

So an operator who resolves an issue, and whose data then regresses, sees a clean board.

`issueCount` semantics are also **inconsistent across exit paths**:

| Path | `issueCount` meaning |
|---|---|
| `COMPLETED` (`engine.ts:497`) | **global** count of all historically `OPEN` issues, across every run |
| `INTERRUPTED` (`engine.ts:419`) | length of the **current run's in-memory** array |
| `FAILED` (`engine.ts:529`) | length of the **current run's in-memory** array |

Neither is run-scoped in a documented, stable way, and the completed-run value silently includes issues from unrelated prior runs. Neither is safe as an enforcement-gate input as documented.

**Required correction:** re-detection must reopen — set `status = 'OPEN'` and record a `reopenedAt` / `reopenCount`; a resolution should be invalidated when the underlying condition recurs. Define `issueCount` unambiguously (recommend: run-scoped open count, with global open count reported as a separate, explicitly named field) and document which one PR 3 enforcement consumes.

### 8.8 Dry-run mutation claims — **INACCURATE (P3)**

`cli.ts` header and `printHelp` both state dry-run is "non-mutating", and the runbook repeats "Mutation requires explicit `--apply`". Dry-run in fact writes:

* `TenantBackfillRun` (created at `engine.ts:176`)
* `TenantBackfillCheckpoint` (upserted per table, updated per batch)
* `TenantOwnershipIssue` (via `persistIssues` at `engine.ts:465`)

The intended guarantee — which the code does honour — is that dry-run does not mutate **merchant ownership rows**. The wording should say exactly that. This matters operationally: an operator told "non-mutating" may run dry-run against a database where any write is disallowed, or may not expect run/issue records to accumulate.

### 8.9 Implementation-report identity — **STALE (P3)**

`PR1_TENANT_EXPANSION_IMPLEMENTATION_REPORT.md` records:

* line 14: `Final commit SHA | 0d836e1b71b0fd213781d08228b13c8df8e9c1ad`
* line 15: two commits listed — `854a3d5…` and `0d836e1…`

The actual PR head is `7aabb095806716697bfea2783379351b15e1cda2`, and the report-finalization commit is omitted (understandably — the report cannot contain its own hash, but it can name the head after the fact or the PR body can carry it, as it does).

More materially, the report's CI evidence table (lines 124–125) cites runs `30578113974` (for `854a3d5…`) and `30578403947` (for `0d836e1…`). **Neither is the exact-head run.** The head run is `30578683952` / job `90993206934`. So the report contains no CI evidence for the commit actually under review. I verified the head run independently and it is green, so the substance is fine — but the permanent record does not support the claim on its own.

**Classification:** evidence hygiene, P3. **Correction:** update the identity section to name `7aabb095…` as the final head and record run `30578683952` / job `90993206934` as the exact-head CI evidence.

---

## 9. Test-quality assessment

Four tests exist in `scripts/tenant-backfill/tests/tenant-expansion.migration.test.ts`, plus `app/lib/shop-domain.test.ts`. Building real PostgreSQL migration tests rather than mocks is the right call and deserves credit.

The coverage does not, however, exercise the guarantees that matter most:

| Approved guarantee | Covered? |
|---|---|
| Migration from empty DB | ✅ |
| Migration from current-main schema | ✅ |
| Legacy `shop` preserved, `Session` shape, nullable `shopId`, no RLS/composite FK, flags OFF | ✅ (good, thorough) |
| Backfill + quarantine + resume + idempotency, happy path | ✅ |
| **Dry-run/apply classification equivalence** | ❌ Not tested. The test asserts only `status === COMPLETED` and one null `shopId`. Sequencing dry-run then apply on the same DB proves nothing about equivalence |
| **Crash between batch commit and issue persistence** | ❌ Not tested, despite the `onBatchCommitted` hook existing for exactly this purpose |
| **Cross-domain issue → unresolved count** | ❌ Not tested |
| **Overlong / non-ASCII domain labels** | ❌ Not tested |
| **`RESOLVED` issue re-detection** | ❌ Not tested |
| **Concurrent apply through a shared pool** | ⚠️ Tested only via a deliberately *separate* session. The test comment shows the author knew about reentrancy; the test avoids the production configuration rather than validating it |
| Invalid/pre-existing index handling | ❌ Not tested |

The backfill behaviour is also compressed into a single ~250-line mega-test, which makes failures hard to localise and makes it easy for a regression in one guarantee to hide behind another assertion.

`app/lib/shop-domain.test.ts` covers scheme, port, path, hyphen-boundary, and extra-label rejection well; it has no length or non-ASCII boundary case, which is why F-PR1-08 and F-PR1-09 shipped green.

Filesystem/CI concerns (parking migration directories, parallel-test safety, cleanup after failed migration tests, Windows path portability) could not be exercised because `test:migrations` was blocked. `vitest.migrations.config.ts` is a separate config with its own file scope, which at least isolates it from the default unit run. This area warrants verification by a reviewer who can execute it.

---

## 10. Security, tenancy, and data-integrity assessment

**Positive:**

* **No secret or PII leakage.** Evidence fields store only `{length, sha256}` of shop strings (`engine.ts:100–105`). No access tokens, session secrets, or merchant identifiers are written to `TenantOwnershipIssue`. The test explicitly asserts an access token does not surface.
* **SQL injection:** all table/column names interpolated into `$queryRawUnsafe` come from the frozen constant lists in `tables.ts`; all row values are passed as bound parameters (`$1`, `$2`). Not exploitable as written. It is still an unparameterised-identifier pattern with no allowlist assertion at the call site — worth hardening for defence in depth (F-PR1-15).
* **Update guard:** `UPDATE … WHERE id = $1 AND "shopId" IS NULL` prevents overwriting existing ownership. Correct and important.
* **No cross-tenant exposure introduced.** No runtime access path changed; no RLS claimed or implied; no FK enforcement that could fail open.
* **Deterministic checksums** over canonical `{id, shopId}` ordered by `id`.
* **Inventory-write flags untouched.** The PR changes no feature-flag source; existing tests continue to assert `stocktakeInventoryWrites() === false`. Production inventory writes remain UNAPPROVED and flags remain default OFF.

**Concerns:**

* Ownership **evidence integrity** is the weak point (§8.2, §8.3, §8.7). Every one of these makes the quarantine record less trustworthy than it appears, and PR 3 is designed to trust it.
* **Canonical Shop creation race:** handled correctly via `upsert` on `myshopifyDomain` followed by a re-read (`engine.ts:251–262`). Good.
* **Normalization collision:** duplicate `ShopSettings` after normalization is detected and quarantined (`detectDuplicateShopSettings`). Good. But the non-ASCII collision in §8.6 is not detected as a collision — it silently merges.
* **`beforeCounts` on resume:** recomputed at the start of the resumed run and written over the original values in the final run update (`engine.ts:150–155`, `engine.ts:474`). A resumed run's `beforeCounts` therefore reflect the *partially applied* state, not the true starting state, corrupting the run's before/after evidence (F-PR1-10).
* **Cursor semantics:** `WHERE id > $1 ORDER BY id ASC` is deterministic and stable, but rows inserted mid-run with an `id` lexically below the cursor are skipped without any record. Acceptable for a maintenance-window backfill; should be stated as a documented precondition.
* **Update counting:** `processDirectRow` / `processChildRow` return `updated` without checking the affected-row count from the guarded `UPDATE`. Under concurrent writes the reported `updatedCount` can overstate actual changes.
* **Integer/count overflow:** counts are JS numbers accumulated per table; `COUNT(*)::bigint` is narrowed via `Number()`. Safe well beyond realistic row counts.
* **Orphaned rows / non-null conflicting `shopId`:** both handled and quarantined (`MISSING_PARENT`, `EXISTING_SHOP_ID_MISMATCH`, `CONFLICTING_NORMALIZED_DOMAIN`, `PARENT_CHILD_SHOP_MISMATCH`). Reason-code coverage is good.
* **`cuidLike()`** produces `c` + 24 hex chars — not a real CUID and not monotonic. Functionally fine (uniqueness is adequate, ordering is not relied upon for these tables), but it is a different id shape from the rest of the schema.
* **Error exit codes:** `FAILED` → exit 1 ✅; `COMPLETED` with unresolved → exit 0 with a warning line. Given §8.3, an operator scripting on exit code gets no signal at all for cross-domain problems.

---

## 11. Documentation and evidence assessment

The runbook is genuinely good: normalization rules, ownership derivation, checksum interpretation, quarantine reason codes, rollback limitations, verification queries, and explicit prohibitions are all present and clear. The ownership inventory is precise. The prohibitions section correctly restates that production inventory writes remain unapproved and no flags may be enabled.

Problems:

* Report identity and CI evidence are stale relative to the reviewed head (§8.9).
* "Non-mutating" dry-run wording is inaccurate (§8.8).
* The index deviation is documented but presented as settled; it is recorded in the report's "decisions requested" list, which is the right instinct, but the migration was written as though approval had already been granted.
* The runbook's production CONCURRENTLY path reads as optional guidance rather than a mandatory precondition, and includes no verification step for index validity.
* `git diff --check` exits 2 on trailing whitespace in four Markdown files. These are intentional Markdown hard line breaks, but the prompt lists this command as a required check and it does not pass cleanly.

`F-016` / `R-022` are correctly recorded as remaining OPEN and explicitly not resolved by PR 1. `Q-011` remains open. `R-028` / `R-029` are correctly noted as pending review and later zero-unresolved evidence. This is correct and I found no attempt to close them prematurely.

---

## 12. Findings table

| ID | Sev | File / line | Evidence | Merchant impact | Required correction | Missing test |
|---|---|---|---|---|---|---|
| **F-PR1-01** | **P1** | `engine.ts:251–267`, `731–738`, `781–795` | Dry-run never persists parent `shopId`; child classification reads persisted `parent.shopId` → every valid child classified `PARENT_SHOP_UNRESOLVED` in dry-run, `updated` in apply | Dry-run massively over-reports unresolved ownership; operators cannot distinguish real problems from artefacts; dry-run unusable as a pre-apply gate. Violates approved equivalence requirement | Maintain an in-memory proposed-ownership map in dry-run; child resolution must consult it before the persisted column | Dry-run vs apply classification-equivalence test across all four parent/child pairs |
| **F-PR1-02** | **P1** | `engine.ts:340–375`, `390`, `465`; resume path `282–289`, `426–429` | Checkpoint advances inside the batch tx; issues held in memory until end-of-run. Crash between the two loses evidence; resumed run skips rows via `id > lastProcessedId`. Resume also skips COMPLETED tables, dropping their cross-domain issues entirely | Unresolved ownership silently skipped and unrecoverable; quarantine record understates reality; only recovery is a full fresh run | Persist issues (upsert on `fingerprint`) inside the same transaction that advances the checkpoint; re-run or separately checkpoint cross-domain diagnostics on resume | Crash-after-commit test using `onBatchCommitted`; resume-preserves-issues test |
| **F-PR1-03** | **P1** | `engine.ts:426–429`, `857+`; `cli.ts:79–90` | Cross-domain diagnostics create issues but never increment `unresolvedCount`; CLI blocking warning tests only `unresolvedCounts` | A run with real cross-tenant PO/supplier or lead-time mismatch completes clean, exit 0, no warning. An enforcement gate keyed on zero unresolved passes while inconsistency is open | Increment the owning table's `unresolvedCount` for cross-domain issues, or redefine the gate as zero-unresolved AND zero-open-issues and make the CLI test both | Cross-domain-only fixture asserting non-zero unresolved count and emitted warning |
| **F-PR1-04** | **P1** | `engine.ts:569`; `467`, `497`, `419`, `529`, `1023` | Re-detected `RESOLVED` issue stays `RESOLVED`; `issueCount` means global-open on COMPLETED but run-local array length on FAILED/INTERRUPTED | Recurring unresolved ownership invisible to every `status='OPEN'` query including the runbook's verification query; gate input ambiguous and unsafe | Reopen on re-detection (`status='OPEN'` + `reopenedAt`/`reopenCount`); define `issueCount` unambiguously and document which value PR 3 consumes | Resolve-then-redetect test; issueCount semantics test across all three exit paths |
| **F-PR1-05** | **P2** | `20260730160100_tenant_compatibility_indexes/migration.sql` | Plain `CREATE INDEX` takes `ShareLock`; concurrent `INSERT` failed with lock timeout (reproduced on 50k rows). Brief requires `CONCURRENTLY` | Write outage across 18 tables on populated production databases if `migrate deploy` is run normally; runbook's external path is advisory, not enforced | Explicit product-owner deviation decision in `DECISIONS.md`, **and** make the external CONCURRENTLY path a mandatory, verified precondition for populated databases | Populated-table lock/blocking test or documented maintenance-window precondition |
| **F-PR1-06** | **P1** | same migration; all `IF NOT EXISTS` statements | Reproduced: a pre-existing **INVALID** unique index causes `CREATE UNIQUE INDEX IF NOT EXISTS` to emit a notice, report success, and leave the index invalid. Name-only match; no definition or validity check | Migration marked applied while indexes are unusable and unique indexes are not enforcing uniqueness — exactly the state the runbook's own recovery path produces | Add a post-creation verification step asserting every expected index exists, is `indisvalid`, and matches its expected definition; fail the migration otherwise | Invalid-index-present migration test |
| **F-PR1-07** | **P2** | `engine.ts:90–99`, `132`, `534` | Reproduced: reentrant acquire returns `t` twice on one backend (fails open); cross-backend unlock returns `f` with `WARNING: you don't own a lock` and leaves the lock held (fails closed) | Concurrent apply not reliably prevented; a leaked lock can falsely deny a legitimate recovery run | Use `pg_advisory_xact_lock` inside a single `$transaction`, or an application-level run-lock row with owner and heartbeat | Concurrent-apply test through a shared `PrismaClient`; unlock-verification test asserting the returned value |
| **F-PR1-08** | **P2** | `app/lib/shop-domain.ts:10`, `78–86` | Reproduced: 64-char and 300-char labels ACCEPTED. No DNS label (63) or hostname (253) length bound anywhere | Canonical `Shop` rows created with structurally invalid `myshopifyDomain`; brief requirement not met | Enforce label ≤ 63 and total hostname ≤ 253; reject with distinct reason codes | Boundary tests at 63 / 64 and at hostname max |
| **F-PR1-09** | **P2** | `app/lib/shop-domain.ts:65` | Reproduced: `\u212A` (Kelvin sign) survives `toLowerCase()` as ASCII `k` → `kshop.myshopify.com` ACCEPTED. ASCII check runs after transformation | Two distinct legacy `shop` values normalize to one canonical `Shop` — a tenant-merge vector; brief requires ASCII-only | Reject any non-ASCII codepoint on the raw trimmed input **before** lowercasing | Non-ASCII confusable test |
| **F-PR1-10** | **P2** | `engine.ts:150–155`, `474` | `beforeCounts` recomputed on resume and overwritten in the final run record | Resumed run's before/after evidence reflects partially-applied state; run record misleading for audit and reconciliation | Preserve the original run's `beforeCounts` on resume; never overwrite | Resume-preserves-beforeCounts test |
| **F-PR1-11** | **P3** | `cli.ts:1–6`, `printHelp`; runbook line 56 | Dry-run writes `TenantBackfillRun`, `TenantBackfillCheckpoint`, `TenantOwnershipIssue` | Operator may run dry-run under a no-write expectation; run/issue records accumulate unexpectedly | Reword to "does not mutate merchant ownership rows"; state which control tables dry-run writes | — |
| **F-PR1-12** | **P3** | `PR1_TENANT_EXPANSION_IMPLEMENTATION_REPORT.md:14–15, 124–125` | Report names `0d836e1…` as final SHA; CI evidence cites runs `30578113974` / `30578403947`, neither the exact-head run `30578683952` | Permanent record contains no CI evidence for the reviewed commit | Update identity to `7aabb095…` and record run `30578683952` / job `90993206934` | — |
| **F-PR1-13** | **P3** | 4 Markdown files under `docs/phases/phase-1/` | `git diff --check 8ccc8d2 pr11` exits 2 (trailing whitespace, Markdown hard breaks) | None functional; a required check does not pass cleanly | Convert hard breaks or exclude docs from the check, and record the rationale | — |
| **F-PR1-14** | **P3** | `engine.ts:731–738`, `818–825`; `604–618` | Guarded `UPDATE` result never inspected; counted `updated` regardless. Cursor skips rows inserted mid-run below the cursor | Reported `updatedCount` can overstate actual changes; mid-run inserts silently unexamined | Count affected rows from the `UPDATE`; document the "no concurrent inserts" precondition in the runbook | Concurrent-insert-during-run test |
| **F-PR1-15** | **P3** | `engine.ts` — all `$queryRawUnsafe` identifier interpolation | Table names come from frozen `tables.ts` constants; values are bound parameters. Not exploitable as written | None currently | Add a runtime allowlist assertion before interpolation for defence in depth | Allowlist-rejection test |

---

## 13. Positive findings

These are real and worth recording:

1. **Scope discipline is excellent.** Every PR 1 exclusion was independently verified against the live schema — no RLS, no Shop FKs, no `NOT NULL`, no composite child FKs, no runtime conversion, no PR 2/PR 3 leakage. This is the single hardest thing to get right in a phased migration and it was got right.
2. **Evidence redaction is thoughtful.** Storing only `{length, sha256}` of shop strings, and asserting in test that access tokens never surface, shows real care about a class of leak that is easy to miss.
3. **Real PostgreSQL migration tests**, not mocks, including a dedicated empty-database case and a current-main-schema case.
4. **The `AND "shopId" IS NULL` update guard** prevents overwriting existing ownership — exactly right.
5. **Reason-code coverage is comprehensive**: invalid domain, missing parent, parent unresolved, parent/child mismatch, existing-id mismatch, conflicting normalized domain, duplicate shop settings, PO/supplier mismatch, lead-time mismatches.
6. **Canonical `Shop` creation is race-safe** via upsert + re-read.
7. **Deterministic, well-specified checksums** and stable `id`-ordered batching.
8. **The runbook is operationally useful** — verification queries, rollback limitations, and explicit prohibitions are all present.
9. **Open risks kept honestly open.** F-016/R-022, Q-011, R-028/R-029 all correctly remain open; no premature closure.
10. **Lint is clean**, `npm ci` is reproducible against the pinned toolchain, and CI at the exact head is genuinely green.

---

## 14. Required correction sequence

**Before PR 1 acceptance (P1 — mandatory):**

1. **F-PR1-01** — Make dry-run classification equivalent to apply. Introduce an in-memory proposed-ownership map for direct owners; child resolution consults it in dry-run.
2. **F-PR1-02** — Persist issues atomically with checkpoint advancement inside the batch transaction. Ensure resume regenerates or preserves cross-domain issues for already-completed tables.
3. **F-PR1-03** — Make cross-domain issues increment unresolved counts, or redefine and document the blocking condition as zero-unresolved **and** zero-open-issues, with the CLI testing both.
4. **F-PR1-04** — Reopen re-detected `RESOLVED` issues; define `issueCount` unambiguously and consistently across all exit paths.
5. **F-PR1-06** — Add post-creation index verification (existence, `indisvalid`, definition match) so an invalid or mismatched index cannot be silently accepted.
6. **Add the missing tests** for 1–5 above, plus the boundary tests for F-PR1-08 / F-PR1-09.

**Before PR 1 acceptance (P2 — correct, or obtain explicit ChatGPT deferral decision):**

7. **F-PR1-05** — Obtain and record an explicit product-owner deviation decision for the non-CONCURRENTLY index rollout in `DECISIONS.md`, and make the external CONCURRENTLY path a mandatory verified precondition for populated databases.
8. **F-PR1-07** — Replace the pooled session-level advisory lock with `pg_advisory_xact_lock` in a single transaction or an application-level run lock. Must be corrected before any production apply is authorized.
9. **F-PR1-08 / F-PR1-09** — Enforce DNS label and hostname length bounds; reject non-ASCII before lowercasing.
10. **F-PR1-10** — Preserve original `beforeCounts` on resume.

**P3 — evidence and documentation hygiene:**

11. **F-PR1-12** — Correct the implementation report identity and record exact-head CI (`30578683952` / `90993206934`).
12. **F-PR1-11** — Correct the "non-mutating" dry-run wording.
13. **F-PR1-13**, **F-PR1-14**, **F-PR1-15** — whitespace check, affected-row counting and concurrent-insert precondition, identifier allowlist assertion.

**Verification gap to close independently:**

14. A reviewer with unrestricted egress must execute `npx prisma generate`, `npx prisma validate`, `npx prisma migrate deploy`, `npm run test:migrations`, `npm run typecheck`, `npm run build`, and `npm run graphql-codegen` and record exit codes and output. I could not, and I make no claim about their outcome beyond the exact-head CI result.

---

## 15. Final verdict

# `NOT READY`

Reasons the acceptance criteria are not met:

* **Open P1 findings remain:** F-PR1-01, F-PR1-02, F-PR1-03, F-PR1-04, F-PR1-06.
* **Backfill behaviour does not match the approved PR 1 contract.** Dry-run/apply equivalence is explicitly required and is violated. Quarantine evidence can be permanently lost across a crash-and-resume, and cross-domain inconsistency is invisible to the operational gate.
* **Not all required commands were verified.** Seven Prisma-dependent commands could not be executed in this environment; exact-head CI is green and was independently confirmed, but independent execution has not been performed.
* **A deviation is neither corrected nor explicitly approved.** The index rollout departs from the approved brief and requires a recorded product-owner decision; documenting a deviation does not authorize it. The `IF NOT EXISTS` silent acceptance of an invalid index requires correction regardless.

Conditions that **are** correctly satisfied and remain in good standing:

* ✅ F-016 / R-022 remain correctly open for later PRs; PR 1 does not claim to resolve them.
* ✅ Q-011 remains open.
* ✅ Production inventory writes remain **UNAPPROVED**.
* ✅ All inventory-write flags remain **default OFF**; the PR touches no feature-flag source.
* ✅ No RLS, no runtime access conversion, no PR 2/PR 3 work, no Phase 2 work.
* ✅ PR remains open and in draft; nothing was merged.

**No merge authorization is given. PR 2 and PR 3 are not authorized.** The repository was not modified during this review — no commits, branches, pushes, or PR state changes.

---

*Prepared for preservation at `stocky-plus/docs/phases/phase-1/PR1_TENANT_EXPANSION_REVIEW_REPORT.md`.*
