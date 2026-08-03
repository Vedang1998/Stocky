# PR 3 — Independent Database Enforcement Review Report

**Reviewer:** Claude Code (independent)
**Implementation owner:** Cursor
**Technical acceptance authority:** ChatGPT
**Review date:** 2026-08-03
**Production access:** NONE

---

## 1. Identity

| Field | Value |
|---|---|
| Repository | `Vedang1998/Stocky` |
| Application | `stocky-plus/` |
| Pull request | #15 — open, **draft**, unmerged, `mergeable_state: clean` |
| Base | `main` @ `00fb925721ad374b3ff976652ec99dbf655ebb11` |
| Branch | `phase-1/tenant-enforcement` |
| **Exact reviewed head** | `57016ed4b685c8958ad49d821f4afd9ea9894a9b` |
| **Actual last runtime/test implementation commit** | `0ee3ae027d746b9696c990dfbc59976f4ef56ae7` |
| Commit range | `00fb925..57016ed` — **17 commits**, merge-base = `00fb925` |
| Changed files | 45 (+5178 / −98) |
| Checkout | detached at `57016ed`, working tree clean before and after review |
| History rewritten | No — linear, base is a true ancestor |

### Chain-of-custody classification (independently derived)

| Commit | Class | Touches `app/` |
|---|---|---|
| `0d4ba3c` Record PR 3 enforcement inventory and architecture | docs + db tooling | no |
| `5808838` Add tenant enforcement preflight and role provisioning | db tooling | no |
| `ffdd55c` Add tenant composite keys, constraints, enforcement apply | schema/migration + db tooling | no |
| `4035f6e` Integrate transaction-local tenant context into TenantDb | **runtime** | yes |
| `aeeecc2` Add database isolation and pool leakage tests | test + CI + docs + runtime(1 line) | yes |
| `1467483` Record PR 3 draft PR #15 identity | documentation | no |
| `a254178` Refresh PR2 tenant-access inventory | documentation | no |
| `27234f6` Re-grant runtime role after tenant-access schema reset | **runtime** + test | yes |
| `d4dd43f` Fix unused-import lint failures | **runtime** + test + docs | yes |
| `6ffa2d3` Retrigger PR 3 enforcement CI | **empty retrigger** (0 files) | no |
| `bc6734d` Fix pragma comments that broke runtime URL construction | db tooling + test | yes |
| `0ee3ae0` Adapt unit Prisma mocks for TenantDb transaction-local context | **runtime + test — LAST implementation commit** | yes |
| `5652ff1` Record PR 3 exact-head CI evidence | documentation | no |
| `af964c0` Align phase-1 README with PR 3 draft status | documentation | no |
| `9c2c98c` Pin PR 3 final exact head | documentation | no |
| `d036705` Finalize PR 3 exact-head handoff identity | documentation | no |
| `57016ed` Sync remaining PR 3 handoff fields | documentation | no |

**Finding:** the PR body and implementation report both state *"Runtime/test implementation head: `aeeecc2`"*. This is **incorrect**. Runtime code under `app/` changed in three later commits (`27234f6`, `d4dd43f`, `bc6734d`) and finally in `0ee3ae0`, which modified `app/tenant/db-context.server.ts`. The last runtime/test implementation commit is **`0ee3ae0`**. Both documents separately (and correctly) identify `0ee3ae0` as the first green implementation tip, so the documents are internally inconsistent. Recorded as F-PR3-21.

### Superseded CI failures — dispositions (all inspected, none harmless-by-assumption)

| Head | Run | Failed step | Correcting change — inspected |
|---|---|---|---|
| `1467483` | 30781828372 | Tenant enforcement preflight (stale PR2 access inventory) | `a254178` regenerated `PR2_TENANT_ACCESS_INVENTORY.md` only. Doc-only; no enforcement logic weakened. |
| `a254178` | 30783051009 | Tenant access PostgreSQL (runtime grants wiped by schema reset) | `27234f6` added grant re-application in `app/tenant/__tests__/helpers.ts` **and 17 lines in `app/db.server.ts`** (lazy client reset). Real runtime change — reviewed in §11. |
| `27234f6` | 30783403916 | Lint (unused imports) | `d4dd43f` removed 3 unused imports. No behavior change; verified diff is import-only. |
| `d4dd43f` | 30783921950 | Initialize containers (Docker Hub pull) | Infrastructure flake; `6ffa2d3` empty retrigger. Confirmed 0 files changed. |
| `6ffa2d3` | 30784345386 | Typecheck (pragma commented out `const u`) | `bc6734d` moved `// pragma: allowlist secret` comments that had commented out live code in `roles.ts`, `helpers.ts`, `enforcement.migration.test.ts`. **Material** — this had broken runtime URL construction. Corrected code reviewed and exercised. |
| `bc6734d` | 30784928634 | Unit tests (Prisma mocks missing `$executeRaw`) | `0ee3ae0` added `app/test-utils/prisma-tenant-context-mock.ts` **and changed `app/tenant/db-context.server.ts`** to use `$queryRawUnsafe` so mocks can omit `$queryRaw`. Production runtime behavior changed to accommodate test mocks — noted as F-PR3-29(b). |

Cancelled runs `30781820588`, `30786118789`, `30787397181` confirmed cancelled, not failed.

---

## 2. Verdict

# NOT READY — CORRECTIONS REQUIRED

The *applied* enforcement state is correct and materially stronger than the PR claims: every merchant table is FORCE-RLS protected, tenant keys are immutable, all eight composite tenant foreign keys reject cross-tenant parents, and the restricted runtime role cannot escalate. I independently reproduced every count Cursor reported and every committed test result.

However, six P1 defects block acceptance. They cluster in three areas:

1. **The verification and drift controls cannot detect the failures they exist to detect.** I rewrote one RLS policy to `USING (true)` — producing a complete cross-tenant read bypass — and `tenant:rls:verify`, `tenant:enforcement:verify` and `tenant:enforcement:drift` all reported `ok:true`. Same for a composite FK replaced with a wrong same-named definition, and for a disabled immutability trigger.
2. **Forward recovery is broken.** Enforcement apply deadlocked under ordinary concurrent write traffic, leaving the runtime role with unrestricted DML on all 18 merchant tables and RLS entirely absent — 100,000 rows across 50 shops readable with no tenant context — and `tenant:enforcement:apply` then refused to run again, permanently. The runbook's stated recovery ("Re-run apply; prior verified steps remain") is false.
3. **The runtime/migration credential separation is a literal string comparison** with no privilege verification, accepting four trivially-realistic equivalent forms of the same privileged URL in production-like mode.

None of these are hypothetical; each was reproduced on a disposable PostgreSQL 16 instance and is documented with exact reproduction steps below.

---

## 3. Scope verification (§7) — PASS

Independently verified across all 45 changed files:

| Prohibited | Present? |
|---|---|
| PR 4 persistent inbox / replay / dead-letter tables | **No** — 0 hits; the single `replay` hit is the string `"replay_repair"` in a test loop label |
| New Shopify fact ingestion | No |
| Forecasting / ABC-U | No |
| PO, receiving, stocktake, transfer feature expansion | No |
| Cost ledger | No |
| Billing | No — 2 hits are pre-existing `ShopSettings.subscriptionPlan` context lines |
| AI | No — 6 pattern hits are all the substring `llm` inside `a**llM**erchantRlsSql` |
| Inventory mutation / enabled write flag | No |
| Production or merchant data | No |
| Real secret / `.env` | No — only `.env.example` template |
| Broad dependency upgrade | **No changes at all** to `package.json` dependencies |
| Unrelated UI work | No |
| Destructive legacy-column removal | No — legacy `shop` columns retained |

All inventory-write flags default OFF in `.env.example` and CI: `FEATURE_STOCKTAKE_INVENTORY_WRITES`, `FEATURE_ADJUSTMENT_WRITES`, `FEATURE_RECEIPT_WRITES`, `FEATURE_COST_SYNC`, `FEATURE_TRANSFER_WRITES` = `false`.

**No scope violation.**

---

## 4. Enforcement inventory — independently derived (§8)

Derived from `prisma/schema.prisma` (24 models) and the live PostgreSQL catalog after apply, **not** from the manifest.

| Item | Cursor reported | Independently derived | Match |
|---|---|---|---|
| Merchant-owned tables | 18 | **18** | ✓ |
| Bootstrap tables | 2 | **2** (`Session`, `Shop`) | ✓ |
| Control/maintenance tables | 4 | **4** | ✓ |
| Composite parent keys `(shopId,id)` | 18 | **18** unique, valid, exact column order | ✓ |
| Composite tenant FKs | 8 | **8** | ✓ |
| RLS policies | 72 | **72** (4 × 18, 4 distinct shapes) | ✓ |
| Immutability triggers | 18 | **18** | ✓ |
| Helper functions | 3 | **3** | ✓ |
| `shopId → Shop(id)` FKs | not reported | **18**, `ON DELETE RESTRICT`, all validated | — |

**All reported counts are accurate.**

### Relation completeness — no composite FK is missing

Every inter-merchant relation in the Prisma schema is covered:

| Relation | Composite FK | Covered |
|---|---|---|
| `SupplierSkuMapping.supplierId → Supplier` | `SupplierSkuMapping_shopId_supplierId_fkey` | ✓ |
| `VolumePriceTier.supplierId → Supplier` | `VolumePriceTier_shopId_supplierId_fkey` | ✓ |
| `LeadTimeSnapshot.supplierId → Supplier` | `LeadTimeSnapshot_shopId_supplierId_fkey` | ✓ |
| `PurchaseOrder.supplierId → Supplier` | `PurchaseOrder_shopId_supplierId_fkey` (cross-domain) | ✓ |
| `POLineItem.purchaseOrderId → PurchaseOrder` | `POLineItem_shopId_purchaseOrderId_fkey` | ✓ |
| `TransferLineItem.transferOrderId → TransferOrder` | `TransferLineItem_shopId_transferOrderId_fkey` | ✓ |
| `StocktakeLineItem.stocktakeId → Stocktake` | `StocktakeLineItem_shopId_stocktakeId_fkey` | ✓ |
| `LeadTimeSnapshot.purchaseOrderId → PurchaseOrder` (**no Prisma relation**) | `LeadTimeSnapshot_shopId_purchaseOrderId_fkey` (secondary lineage) | ✓ |

I searched for omitted relations and found none. The eighth FK creates referential integrity that did not previously exist — see F-PR3-19.

### Per-table matrix (all 18, from live catalog)

`relrowsecurity = t`, `relforcerowsecurity = t`, `owner = stocky` (migration owner, **never** `stocky_runtime`), `shopId is_nullable = NO`, 4 policies, 1 trigger — for **every** merchant table:

`Supplier`, `PurchaseOrder`, `ShopifyVariantCache`, `InventorySnapshot`, `VariantAbcClass`, `ForecastOverride`, `SalesDailyAggregate`, `ShopSettings`, `TransferOrder`, `Stocktake`, `BomComponent`, `LowStockAlert`, `SupplierSkuMapping`, `VolumePriceTier`, `LeadTimeSnapshot`, `POLineItem`, `TransferLineItem`, `StocktakeLineItem`.

Bootstrap (`Session`, `Shop`) and control (`TenantBackfillRun`, `TenantBackfillCheckpoint`, `TenantOwnershipIssue`, `TenantOwnershipIssueDetection`): RLS off, 0 policies, 0 triggers — correct per approved classification.

---

## 5. Role matrix (§10) — PASS on privileges, FAIL on verification

Runtime role `stocky_runtime`: `rolsuper=f`, `rolbypassrls=f`, `rolcreatedb=f`, `rolcreaterole=f`, `rolinherit=f`, `rolcanlogin=t`. Owns **no** tables.

### Negative privilege tests — all correctly denied

| Attempt as `stocky_runtime` | Result |
|---|---|
| `ALTER TABLE "Supplier" ADD COLUMN` | `ERROR: must be owner of table Supplier` |
| `DROP POLICY` / `CREATE POLICY` | `ERROR: must be owner` |
| `DISABLE ROW LEVEL SECURITY` / `NO FORCE ROW LEVEL SECURITY` | `ERROR: must be owner` |
| `DISABLE TRIGGER` | `ERROR: must be owner` |
| `SET row_security = off; SELECT …` | `ERROR: query would be affected by row-level security policy` |
| `SET ROLE stocky` / `SET ROLE postgres` | `ERROR: permission denied to set role` |
| `SET session_replication_role = replica` | `ERROR: permission denied to set parameter` |
| `ALTER TABLE … OWNER TO stocky_runtime` | `ERROR: must be owner` |
| `SELECT` on all 4 control tables | `ERROR: permission denied` |
| `SELECT` on `_prisma_migrations` | `ERROR: permission denied` |
| `CREATE TABLE` / `CREATE FUNCTION` in `public` | `ERROR: permission denied for schema public` |
| `GRANT ALL ON "Supplier" TO stocky_runtime` | `WARNING: no privileges were granted` |

**The runtime role's privilege boundary is sound.**

### Role drift detection — material gaps

| Drift injected | `tenant:roles:verify` | Correct? |
|---|---|---|
| `BYPASSRLS` | `ok:false` `["runtime_has_bypassrls"]` | ✓ |
| `SUPERUSER` | `ok:false` `["runtime_is_superuser", …]` | ✓ |
| Missing `SELECT` grant | `ok:false` `["missing_priv:Supplier:SELECT"]` | ✓ |
| Grant on control table | `ok:false` `["runtime_can_select_control:…"]` | ✓ |
| **`GRANT stocky TO stocky_runtime` (role membership)** | **`ok:true`** — and runtime can then `SET ROLE stocky` | **✗ F-PR3-05 (P1)** |
| **`GRANT ALL ON "Supplier" TO PUBLIC`** | **`ok:true`** | **✗ F-PR3-09 (P2)** |
| **Excess `TRIGGER, TRUNCATE, REFERENCES` grants** | **`ok:true`** | **✗ F-PR3-10 (P2)** |
| `BYPASSRLS` then re-provision | **silently repaired**, `ok:true`, `errors:[]` | **✗ F-PR3-11 (P2)** |

`provisionRoles` cannot repair membership drift (verified: membership survives re-provision) and does not re-assert `NOINHERIT` on an existing role.

### Runtime URL guard (§10 / §22) — F-PR3-06 (P1)

`resolveRuntimeDatabaseUrl` in both `scripts/tenant-enforcement/connection.ts:72` and `app/db.server.ts:21`:

| Case (`STOCKY_REQUIRE_RUNTIME_DB_URL=1`) | Result |
|---|---|
| runtime URL absent | REJECTED ✓ |
| runtime === migration (byte-identical) | REJECTED ✓ |
| runtime === maintenance (byte-identical) | REJECTED ✓ |
| `NODE_ENV=production`, only `DATABASE_URL` | REJECTED ✓ |
| **runtime = migration + trailing `/`** | **ACCEPTED ✗** |
| **runtime = migration + `?schema=public`** | **ACCEPTED ✗** |
| **runtime = migration, `127.0.0.1` vs `localhost`** | **ACCEPTED ✗** |
| **runtime = migration, `postgres://` vs `postgresql://`** | **ACCEPTED ✗** |
| malformed runtime URL (`not-a-url`) | ACCEPTED (fails later at connect) |
| runtime URL is a pooler endpoint | ACCEPTED (acceptable — `is_local` GUCs are transaction-scoped) |

There is **no startup verification** that the connecting role is non-superuser, lacks `BYPASSRLS`, or does not own merchant tables. §10's required fail-closed cases "runtime role lacks required grants" and "runtime role unexpectedly owns table" are not implemented anywhere.

---

## 6. RLS matrix (§13) — PASS

All 72 policies collapse to exactly 4 shapes, each `PERMISSIVE`, each scoped `TO stocky_runtime` only (never PUBLIC), with predicate:

```
("shopId" IS NOT NULL)
AND ("shopId" = stocky_current_tenant_id())
AND (stocky_current_tenant_context_version() = 'phase1-db-tenant-context-v1')
```

| Command | `polcmd` | USING | WITH CHECK | Count |
|---|---|---|---|---|
| SELECT | `r` | ✓ | — | 18 |
| INSERT | `a` | — | ✓ | 18 |
| UPDATE | `w` | ✓ | ✓ | 18 |
| DELETE | `d` | ✓ | — | 18 |

### Behavioral tests (runtime role, real connections)

| Case | Result |
|---|---|
| No context — SELECT | 0 rows ✓ |
| No context — INSERT | `ERROR: new row violates row-level security policy` ✓ |
| Shop A context | sees only Shop A rows ✓ |
| Shop B context | sees only Shop B rows ✓ |
| Context version mismatch | 0 rows ✓ |
| Context version absent | 0 rows ✓ |
| Empty string shop id | 0 rows ✓ |
| Nonexistent shop id | 0 rows ✓ |
| Trailing whitespace (`'shopA '`) | 0 rows ✓ |
| Shop A context, INSERT as Shop B | denied ✓ |
| Shop A context, DELETE Shop B row | `DELETE 0` ✓ |

No unexpected permissive policies; no PUBLIC-targeted policy; helper functions cannot leak via error (they are `NULLIF(current_setting(…, true), '')` — no exception path).

### FORCE ROW LEVEL SECURITY (§14)

`pg_class.relrowsecurity` and `relforcerowsecurity` both `true` for all 18 tables, read directly from the catalog (not inferred from migration text).

**Owner behavior — F-PR3-13 (P2):** with the table owner as a **non-superuser**, FORCE RLS correctly binds it (0 rows without context). But in CI and in the documented local setup the migration owner (`stocky`) **is a superuser**, and superusers bypass RLS unconditionally — I measured 2 rows visible. Nothing in the tooling verifies the migration owner is non-superuser, the runbook does not require it, and `defaultMigrationRoleName()` returns `stocky_migration`, a role that does not exist in CI at all — so `verifyRoles` never inspects the actual owner's attributes. The migration owner's expected bypass behavior is undocumented.

**SECURITY DEFINER functions: zero.** Confirmed `SELECT count(*) FROM pg_proc WHERE prosecdef` outside system schemas = 0. No definer attack surface.

---

## 7. Immutability matrix (§15) — enforcement PASS, verification FAIL

Trigger shape (all 18 identical): `tgtype = 19` = ROW + BEFORE + UPDATE, `tgenabled = 'O'`, function `stocky_prevent_shop_id_mutation`, owner `stocky`, targeted at the `shopId` column (`tgattr` → `shopId`).

Tested on **all 18 tables** as the runtime role under valid Shop A context:

| Operation | All 18 tables |
|---|---|
| `SET "shopId"='shopB'` | **denied** — `stocky_tenant_key_immutable` |
| `SET "shopId"=NULL` | **denied** — `stocky_tenant_key_immutable` |
| `SET "shopId"='shopA'` (same value) | **allowed**, `UPDATE 1` (documented behavior) |
| `UPDATE … SET "shopId"='shopB'` with no WHERE (updateMany) | **denied** |
| Non-tenant field update | **allowed**, `UPDATE 1` |

Trigger function inspection: `LANGUAGE plpgsql`, `SET search_path = pg_catalog, pg_temp` (fixed), no dynamic SQL, deterministic `RAISE EXCEPTION … ERRCODE = 'integrity_constraint_violation'`, correct `IS DISTINCT FROM` (handles NULL), owned by migration role, `PUBLIC` execute revoked, `proacl = {stocky=X/stocky}` — runtime role has **no** execute grant on it and cannot disable or replace it.

**Trigger drift detection — F-PR3-08 (P2):** `checkTrigger` in `verify.ts:136` matches only on `tgname` and `proname`. It does not read `tgenabled` or `tgtype`. Verified:

| Drift | `tenant:immutability:verify` |
|---|---|
| `DISABLE TRIGGER` | **`ok:true`** ✗ |
| `ENABLE REPLICA TRIGGER` (replica-only) | **`ok:true`** ✗ |

---

## 8. Constraint matrix (§16) — PASS

All 18 `(shopId, id)` unique indexes verified from `pg_get_indexdef`: exact columns, exact order, `indisunique=t`, `indisvalid=t`, correct table, deterministic name `<Table>_shopId_id_key`.

All 8 composite FKs verified from `pg_get_constraintdef`, all `convalidated=t`:

| FK | Definition | ON DELETE | Cross-tenant insert |
|---|---|---|---|
| `SupplierSkuMapping_shopId_supplierId_fkey` | `(shopId,supplierId) → Supplier(shopId,id)` | CASCADE | **rejected** ✓ |
| `VolumePriceTier_shopId_supplierId_fkey` | `(shopId,supplierId) → Supplier(shopId,id)` | CASCADE | **rejected** ✓ |
| `LeadTimeSnapshot_shopId_supplierId_fkey` | `(shopId,supplierId) → Supplier(shopId,id)` | CASCADE | **rejected** ✓ |
| `POLineItem_shopId_purchaseOrderId_fkey` | `(shopId,purchaseOrderId) → PurchaseOrder(shopId,id)` | CASCADE | **rejected** ✓ |
| `TransferLineItem_shopId_transferOrderId_fkey` | `(shopId,transferOrderId) → TransferOrder(shopId,id)` | CASCADE | **rejected** ✓ |
| `StocktakeLineItem_shopId_stocktakeId_fkey` | `(shopId,stocktakeId) → Stocktake(shopId,id)` | CASCADE | **rejected** ✓ |
| `PurchaseOrder_shopId_supplierId_fkey` | `(shopId,supplierId) → Supplier(shopId,id)` | NO ACTION | **rejected** ✓ |
| `LeadTimeSnapshot_shopId_purchaseOrderId_fkey` | `(shopId,purchaseOrderId) → PurchaseOrder(shopId,id)` | NO ACTION | **rejected** ✓ |

Each was tested individually with a child row in Shop A referencing a Shop B parent whose **bare id exists** — the exact bypass the composite key must stop. Two required a second fixture because the pre-existing `LeadTimeSnapshot_purchaseOrderId_key` unique constraint masked the FK; both then rejected correctly.

Also verified: orphan parent reference rejected; `UPDATE` of a child's parent id to a foreign-tenant parent rejected; same-tenant insert succeeds; no invented cascade (declared actions match the catalog exactly).

**Shop FK:** all 18 merchant tables carry `shopId → Shop(id) ON DELETE RESTRICT`. `DELETE FROM "Shop"` with dependent data is correctly blocked. No unsafe cascade.

---

## 9. Context and pool matrix (§12, §23)

### Transaction-local context — PASS, with physical backend evidence

On one pinned backend (`pg_backend_pid() = 22691`):

| Point | `current_setting('stocky.current_shop_id', true)` |
|---|---|
| Inside transaction | `shopA` |
| **After COMMIT** | `[]` (empty) — and `SELECT … FROM "Supplier"` → **0 rows** |
| **After ROLLBACK** | `[]` |
| **After failed transaction** (`1/0`) | `[]` |

Context is genuinely transaction-local (`set_config(…, is_local=true)`), does not survive commit, rollback, failure, or reuse of the same physical connection.

The committed pool test proves the same property mechanically — `isolation.test.ts:462` asserts `expect(pid2).toBe(pid1)`, i.e. **real backend PID reuse**, not merely two logical clients. This satisfies §23's core requirement.

### Context forgery — NOT a P1

The runtime role **can** execute `set_config('stocky.current_shop_id', …)` directly; I confirmed this from a bare `psql` session. §12 makes this a P1 only if an unrestricted runtime raw-SQL path exists. It does not:

- Only two runtime (non-test) modules import the raw client: `app/tenant/bootstrap.server.ts` and `app/tenant/tenant-db.server.ts`.
- `TenantDb` blocks `$queryRaw`, `$queryRawUnsafe`, `$executeRaw`, `$executeRawUnsafe`, `$runCommandRaw`, `$parent`, `_engine`, `_runtimeDataModel` via a Proxy that throws `raw_client_escape`.
- `TenantAuthority` is a **non-forgeable WeakSet brand**; `setTransactionLocalTenantContext` calls `assertTenantAuthority` first, so the exported setter cannot be pointed at an arbitrary shop.
- The PR 2 architecture scanner mechanically blocks new raw-SQL paths. **I verified this adversarially**: I planted `app/services/__claude_probe_raw.server.ts` containing `prisma.$executeRawUnsafe("SELECT set_config('stocky.current_shop_id', …)")` and `npm run tenant:access:audit` failed with 5 violations (`db_server_import`, `raw_sql` ×2, `merchant_delegate_call` ×2), exit 1. Probe deleted; tree clean.

The architecture doc honestly states the trust boundary: *"PostgreSQL GUCs do NOT authenticate Shopify identity. Application TenantAuthority validation remains required."* This is the correct and honest treatment. **No finding.**

### Pool test coverage — F-PR3-20 (P2)

Only 2 of §23's 16 required scenarios are committed (context does not leak across reuse; concurrent A/B isolation). I manually confirmed rollback, failed transaction, and post-commit clearing on a reused backend. Missing from the committed suite: statement cancellation, timeout, client disconnect/reconnect, pool saturation, transaction retry, Prisma interactive-transaction failure, worker+web sharing a pool, context-setter failure before first query.

---

## 10. Bootstrap matrix (§21) — PASS with one observation

Runtime role, **no** tenant context, against the fully-enforced restored database:

| Operation | Result | Expected |
|---|---|---|
| `Session` SELECT / INSERT / UPDATE / DELETE | allowed | ✓ per manifest |
| `Shop` SELECT by domain | allowed | ✓ |
| `Shop` INSERT / UPDATE | allowed | ✓ |
| **`Shop` DELETE** | `ERROR: permission denied` | ✓ |
| `Supplier`, `PurchaseOrder`, `ShopSettings`, `ForecastOverride`, `Stocktake`, `TransferOrder`, `POLineItem`, `SupplierSkuMapping` | **0 rows** | ✓ |
| All 4 control tables | `ERROR: permission denied` | ✓ |

Bootstrap grants do **not** create a general merchant-data bypass. No SECURITY DEFINER functions exist, so §21's injection/search-path sub-checks are not applicable.

**Observation (F-PR3-29(a), P3):** `SELECT count(*) FROM "Shop"` returns all 50 shops. Any runtime code path can enumerate the complete tenant list (every merchant's `myshopifyDomain`). This is consistent with the approved bootstrap exemption, but the enumeration is unbounded — a function-mediated lookup returning only the resolved Shop would be tighter.

---

## 11. Runtime Prisma construction (§22)

`app/db.server.ts` — lazy `Proxy` over a global singleton, recreated when the resolved URL changes (non-production only).

| Challenge | Assessment |
|---|---|
| Method binding | `value.bind(client)` for functions — correct for delegates and `$transaction` |
| Concurrent first-use race | Safe — `getPrisma()` is fully synchronous; Node cannot interleave |
| Connection leak on URL change | `void global.prismaGlobal?.$disconnect()` — fire-and-forget, non-production only. Acceptable. |
| Production guard | `NODE_ENV !== "production"` gates recreation; production creates once. Correct. |
| `resetPrismaSingletonForTests` importable from runtime | Exported from the runtime module, guarded only by `NODE_ENV` (F-PR3-25, P3) |
| Fallback to privileged `DATABASE_URL` | Only when `STOCKY_REQUIRE_RUNTIME_DB_URL≠1` and `NODE_ENV≠production` — correct |
| **Migration-URL comparison** | **Literal string only — F-PR3-06 (P1)** |
| Pooler detection | Applied to migration URL only; not required for runtime |
| `Reflect.get(client, prop, receiver)` passes the **proxy** as receiver (F-PR3-26, P3) | Latent: any accessor on the prototype would receive the proxy as `this` |

**TenantDb integration:** every merchant read (`findUnique`, `findUniqueOrThrow`, `findFirst`, `findFirstOrThrow`, `findMany`, `count`, `aggregate`, `groupBy`) and every write (`create`, `createMany`, `update`, `updateMany`, `upsert`, `delete`, `deleteMany`) is wrapped in a tenant-bound transaction that sets **and then verifies** context before the first query. I confirmed no operation reaches a delegate outside a context-bearing transaction.

**F-PR3-18 (P2):** this makes every single read a Prisma interactive transaction with 3 `set_config` round-trips plus 1 verification read — roughly 4 extra round-trips per read, plus transaction overhead, on every merchant query. No benchmark or scalability evidence accompanies this change.

---

## 12. Migration and lock evidence (§17, §18) — populated scale

### Fixture

Disposable PostgreSQL 16.13, database `stocky_lowlock`: **50 shops**, **100,000 `Supplier`** (direct), **20,000 `PurchaseOrder`**, **100,000 `POLineItem`** (child), **50,000 `SupplierSkuMapping`** (cross-domain child) — 270,000 rows total, all with valid same-tenant relationships.

### Preflight on populated data — PASS (and it caught a real defect)

My initial seed produced `POLineItem` rows whose `shopId` did not match their parent PO. Preflight failed closed with exactly `preflight_failed:POLineItem:parent_tenant_mismatch` — non-zero exit, no mutation, structured safe counts, no merchant values, stable on rerun. After correcting the fixture, `ok:true`. This is genuine populated-scale evidence for §9 items 4–7.

### Apply under concurrent representative traffic — **FAILED**

Concurrent load: continuous SELECT / INSERT / UPDATE / DELETE on `Supplier`, a tenant transaction reading `POLineItem`, and a bootstrap `Session` read.

| Metric | Empty fixture (Cursor) | **Populated + concurrent (this review)** |
|---|---|---|
| Result | `ok:true`, 129/129 steps | **`ok:false`, 13 steps incomplete** |
| `maxObservedLockHoldMs` | 14 ms local / 44 ms CI | **1003 ms** |
| Failure | — | **`cfk:LeadTimeSnapshot_shopId_supplierId_fkey: deadlock detected`** |

`pg_locks` sampling captured the cause: the apply held `ShareRowExclusiveLock` on `LeadTimeSnapshot` while waiting (`granted=f`, ~750 ms+) for `ShareRowExclusiveLock` on `Supplier` — `ALTER TABLE … ADD FOREIGN KEY … NOT VALID` takes that lock on **both** child and parent, contending with ordinary DML on the parent. Concurrent application statements themselves were never blocked or failed.

The 14 ms / 44 ms empty-database figures are not representative; §17's concern is confirmed.

### State left behind — F-PR3-02 (P1)

| Property | Value |
|---|---|
| `shopId NOT NULL` applied | 18 / 18 |
| `shopId` FKs applied | 20 |
| **FORCE RLS applied** | **0 / 18** |
| Runtime role `SELECT` on merchant tables | **granted** |
| **Runtime role, no context: `SELECT count(DISTINCT "shopId"), count(*) FROM "Supplier"`** | **50 shops, 100,000 rows** |

The `roles` step is #2 of 129; `rls_triggers` is #129. Any failure in between leaves the restricted runtime role with unrestricted cross-tenant DML on all 18 merchant tables. This is precisely §20's prohibited window, and it is reachable by an ordinary deadlock.

### Forward recovery — F-PR3-01 (P1)

Re-running `tenant:enforcement:apply -- --apply` from the failed state:

```
preflight_failed:tenant:schema:drift_failed_exit_1
```

`preflight.ts:159` computes `enforcementAlreadyApplied` as *all 18 tables forced*. After a partial apply that flag is `false`, so the Prisma schema-drift gate runs — and it now fails permanently, because NOT NULL and the new FKs have legitimately diverged from the (intentionally nullable) Prisma schema. Preflight fails → apply refuses → **the system cannot be driven forward or backward by the shipped tooling**.

I proved the gate is the sole cause: after manually issuing `ENABLE/FORCE ROW LEVEL SECURITY` on all 18 tables out-of-band, `preflight` → `ok:true`, `apply` → `ok:true`, `verify` → `ok:true`. The documented recovery path therefore requires an undocumented manual DDL intervention that bypasses the very gate meant to protect the operation.

The runbook's Forward-recovery table states *"Timeout mid-VALIDATE → Re-run apply; prior verified steps remain."* **This is false.** Confirmed independently: un-forcing RLS on a **single** table is enough to make apply refuse.

### Timeout handling — PASS, with unstructured reporting

Holding a conflicting `ACCESS EXCLUSIVE` lock on `Supplier` with `TENANT_ENFORCEMENT_LOCK_TIMEOUT_MS=3000`:

- CLI exit **1** ✓
- `canceling statement due to lock timeout` ✓
- Data intact (100,000 rows) ✓
- Step **not** falsely completed (`Supplier_shopId_fkey_shop` count = 0) ✓
- Rerun after lock release → `ok:true` ✓
- **But**: the error escaped `runPreflight` (which does `SELECT COUNT(*)`) and was printed by the top-level catch — **no JSON, no `event`, no step attribution** (F-PR3-14, P2).

### Advisory lock — PASS

With the lock held by an independent session (`pg_locks`: `objid=1398033203`, `granted=t`, `pid=18915`), apply returned `ok:false`, `applied:false`, `advisory_lock_unavailable`, exit 1. Backend-pinned and correct. *(An earlier negative result in my testing used a miscomputed key and was invalid.)*
Release does not check `pg_advisory_unlock`'s return value (F-PR3-23, P3).

### Checkpointing — F-PR3-15 (P2)

There is **no durable checkpoint**. `EnforcementApplyResult.steps` is an in-memory array rebuilt as all-`pending` on every invocation. Idempotency comes from per-object existence checks, which is functionally adequate for resume, but the report's and runbook's "checkpointed" language is inaccurate.

### Giant transaction — F-PR3-12 (P2)

`apply.ts:528` issues `allMerchantRlsSql(runtimeRole)` as **one multi-statement `client.query()`**. libpq's simple-query protocol wraps this in an implicit transaction, so ENABLE + FORCE RLS + 72 policies + 18 triggers across **all 18 tables** execute in a single transaction, accumulating `ACCESS EXCLUSIVE` locks on every merchant table until commit. §17 explicitly prohibits "a giant transaction spanning all tables". It is atomic (safe on failure) but is the maximum-blocking shape on a busy database.

---

## 13. Verification and drift adequacy (§15, §19) — the central failure

I injected drift and asked the shipped controls whether the database was healthy.

| Injected drift | `enforcement:verify` | `rls:verify` | `immutability:verify` | `enforcement:drift` | Real impact |
|---|---|---|---|---|---|
| Baseline | ok | ok | ok | ok | — |
| `DISABLE TRIGGER` on `Supplier` | **ok** | ok | **ok** | **ok** | Immutability unenforced |
| `ENABLE REPLICA TRIGGER` | **ok** | ok | **ok** | **ok** | Immutability unenforced |
| `Supplier_tenant_select` rewritten to `USING (true)` | **ok** | **ok** | ok | **ok** | **Runtime read `shopA,shopB` — total cross-tenant bypass** |
| `POLineItem_shopId_purchaseOrderId_fkey` replaced with single-column FK, same name | **ok** | ok | ok | **ok** | **Cross-tenant child insert succeeded** |

Root causes in `scripts/tenant-enforcement/verify.ts`:

- `checkPolicies` (line 58) selects `polqual`/`polwithcheck`… no — it never selects them at all. It compares only `polname`, `polcmd` and roles. **Policy predicates are never verified.** It also selects `polpermissive` and discards it.
- `checkFk` (line 236) checks only that a constraint with that name exists, is type `f`, and is validated. **Columns, referenced table, referenced columns, and ON DELETE/ON UPDATE actions are never verified.**
- `checkCompositeKey` (line 186) never verifies that the indexed columns are exactly `(shopId, id)` in order.
- `checkTrigger` (line 136) never reads `tgenabled` or `tgtype`.
- `checkNotNull` (line 178) queries the helper CHECK and then discards it: `void check;`.
- `detectEnforcementDrift` (line 329) is `verifyEnforcement` with a string prefix — drift detection adds nothing.
- Helper functions are checked by `proname` only — not owner, `prosecdef`, `proconfig`, or PUBLIC execute.

Additionally, `apply.ts` **silently accepts** wrong pre-existing definitions: `addCompositeFk`, `addShopFk` and `addNotValidNotNullCheck` all short-circuit on `constraintExists(name)`. I confirmed a re-apply over the corrupted FK reported `ok:true` and left the wrong definition in place. §19 requires "wrong definitions fail instead of being silently replaced"; here they are neither replaced nor detected.

(`createUniqueIndexConcurrently` is the one exception — it does compare catalog columns and throws `index_wrong_definition`.)

---

## 14. Prisma / schema alignment (§26) — F-PR3-07 (P2)

The Prisma schema deliberately keeps `shopId String?` and declares no composite FKs; enforcement is applied externally. Consequences measured on a fully-enforced database:

| Command | Result |
|---|---|
| `prisma migrate deploy` | "No pending migrations" ✓ safe |
| `prisma migrate status` | "Database schema is up to date!" ✓ safe |
| `npm run tenant:schema:drift` | **exit 2, permanently fails** after enforcement; reports `Reported differences (allowlisted, max 25): (none recognized)` |
| `prisma migrate diff` | **would DROP 8 composite FKs, 18 Shop FKs, and 18 `NOT NULL` constraints** (26 `DROP CONSTRAINT`, 18 `DROP NOT NULL`) |

RLS, policies and triggers are invisible to Prisma and would survive — leaving a *partially* dismantled state (RLS on, tenant keys nullable, composite FKs gone), which is worse than either extreme.

`package.json` ships `db:migrate` (`prisma migrate dev`) and `db:push` (`prisma db push`). Either would destroy enforcement on a developer or staging database with no guard, no warning, and no detection (the custom drift command already fails, so it cannot distinguish "expected divergence" from "enforcement destroyed"). The drift reporter's "(none recognized)" output gives an operator nothing actionable.

---

## 15. Migration history and reproducibility (§27) — PASS

Durable definitions live in two places: the three helper functions in `prisma/migrations/20260803120000_tenant_enforcement_helpers/migration.sql`; everything else (RLS, policies, triggers, composite keys/FKs, NOT NULL, grants) in the TypeScript enforcement tooling.

Fresh rebuild from an **empty** database, executed end to end:

```
prisma migrate deploy              → all migrations applied
tenant:indexes:apply --apply       → "failed":[]
tenant:roles:provision --apply     → ok:true
tenant:enforcement:preflight       → ok:true
tenant:enforcement:apply --apply   → ok:true
tenant:enforcement:verify          → ok:true
tenant:rls:verify                  → ok:true
tenant:immutability:verify         → ok:true
tenant:enforcement:drift           → ok:true
```

Deterministic and reproducible. Role names are environment-overridable (`STOCKY_RUNTIME_ROLE`, `STOCKY_MIGRATION_ROLE`) — acceptable, though `STOCKY_MIGRATION_ROLE` is effectively unused by verification (see F-PR3-13).

---

## 16. Backup and recovery (§28) — PASS (executed)

The runbook marks backup/restore rehearsal as **not executed** ("completed before any future production approval (not authorized here)"), which satisfies §28's honesty requirement. I executed it anyway:

`pg_dump -Fc` of the fully-enforced 270k-row database (2.0 MB) → restore into a fresh database:

| Property after restore | Value |
|---|---|
| `pg_restore` errors | **0** |
| FORCE RLS tables | **18** |
| Policies | **72** |
| Immutability triggers | **18** |
| Composite FKs | **8** |
| Rows | 100,000 |
| Runtime role grants survived | yes |
| Tenant isolation on restored DB | Shop 7 context → **1 shop, 2,000 rows** ✓ |
| `tenant:enforcement:verify` | **ok:true** |

Recovery from individual failure modes: role drift → repairable by re-provision (except membership); lost runtime grant → detected and repaired; missing trigger / policy → repairable by re-running apply's `rls_triggers` step **only if all 18 tables are still forced** (see F-PR3-01); timeout mid-apply → data intact, resumable only when the drift gate allows.

Note: roles are cluster-scoped. A cross-cluster restore requires re-running `tenant:roles:provision`; the runbook does not say so.

---

## 17. Security functions (§29) — PASS

| Function | Volatility | Strict | SecDef | search_path | Owner | ACL |
|---|---|---|---|---|---|---|
| `stocky_current_tenant_id()` | STABLE | no | **no** | `pg_catalog, pg_temp` | `stocky` | `{stocky=X, stocky_runtime=X}` |
| `stocky_current_tenant_context_version()` | STABLE | no | **no** | `pg_catalog, pg_temp` | `stocky` | `{stocky=X, stocky_runtime=X}` |
| `stocky_prevent_shop_id_mutation()` | VOLATILE | no | **no** | `pg_catalog, pg_temp` | `stocky` | `{stocky=X}` |

All SECURITY INVOKER, all with fixed `search_path`, all with `PUBLIC` execute revoked, all owned by the migration role. No identifier interpolation, no dynamic SQL, no injectable inputs (helpers take no arguments). Errors cannot leak data. **Zero SECURITY DEFINER functions in the database.**

---

## 18. CI verification (§6) — PASS

| Field | Verified value |
|---|---|
| Workflow | CI |
| Run ID | `30787422727` |
| Job ID | `91603628956` |
| Job name | Lint, typecheck, test, build, Prisma, GraphQL |
| `head_sha` | `57016ed4b685c8958ad49d821f4afd9ea9894a9b` ✓ exact reviewed head |
| Conclusion | **success** |
| Steps | **70 material steps, all `success`, none skipped, none cancelled** |
| Duration | 05:32:00 → 05:44:07 |

All twelve enforcement-specific steps executed with real commands:

Tenant enforcement inventory freshness (#15) · Tenant database role provisioning (#16) · Tenant enforcement preflight (#17) · Tenant enforcement apply (#18) · Tenant database role verification (#19) · Tenant RLS policy verification (#20) · Tenant immutability verification (#21) · Tenant composite constraint verification (#22) · Tenant enforcement drift verification (#23) · Tenant pooled-connection isolation tests (#24) · Tenant database isolation full suite (#25) · Tenant low-lock enforcement migration tests (#26).

No `-t` pattern filters are used anywhere in the workflow — test steps select by **file path**, so no step can silently match zero tests. I confirmed locally that each named test file yields a non-zero count.

CI is treated as supporting evidence only. Every enforcement claim in this report was independently reproduced locally.

---

## 19. Local execution environment and commands (§30)

| Item | Value |
|---|---|
| PostgreSQL | 16.13 (Ubuntu 16.13-0ubuntu0.24.04.1) |
| Collate / ctype / provider | `C.UTF-8` / `C.UTF-8` / `c` |
| Migration owner role | `stocky` (**superuser** — see F-PR3-13) |
| Runtime role | `stocky_runtime` — `rolsuper=f`, `rolbypassrls=f`, `rolcreatedb=f`, `rolcreaterole=f`, `rolinherit=f`, `rolcanlogin=t`, owns 0 tables |
| Redis | 7.0.15 on port 6399, isolated; `DBSIZE` before **0**, after **0** |
| Node | v22.22.2 |
| npm | **11.5.2** (pinned; the repo's `engine-strict` correctly rejected npm 10.9.7) |
| Databases | `stocky_plus_ci`, `stocky_lowlock`, `stocky_fresh`, `stocky_restore` — all disposable |
| Credentials | test-only throughout; no production or merchant data |

### Command results

| Command | Exit | Result |
|---|---|---|
| `npm ci` | 0 | 970 packages |
| `npx prisma generate` | 0 | Client v6.19.3 |
| `npx prisma validate` | 0 | schema valid |
| `npx prisma migrate deploy` | 0 | 6 migrations applied |
| `npm run tenant:indexes:apply -- --apply` | 0 | `"failed":[]` |
| `npm run tenant:indexes:verify` | 0 | `ok:true, mismatches:[]` |
| `npm run tenant:schema:drift` | 0 | `tenant_prisma_schema_drift_ok` (pre-enforcement) |
| `npm run tenant:indexes:plan` | 0 | `valid_exact: 44` |
| `npm run tenant:access:audit` | 0 | `tenant_access_audit_ok`, 18 models covered |
| `npm run tenant:access:inventory` | 0 | 1050 findings, 0 violations |
| `npm run tenant:access:inventory:check` | 0 | fresh |
| `npm run tenant:enforcement:inventory` | 0 | digest `bf054868d2d7f3ea`, 18 merchant tables |
| `npm run tenant:enforcement:inventory:check` | 0 | fresh |
| `npm run tenant:enforcement:preflight` | 0 | `ok:true`, 18 tables, `globalFailures:[]`, `productionDataInspected:false` |
| `npm run tenant:roles:provision -- --apply` | 0 | `ok:true`, 23 grants, 4 revokes |
| `npm run tenant:roles:verify` | 0 | `ok:true`, `failures:[]` |
| `npm run tenant:enforcement:plan` | 0 | 129 steps pending, non-mutating |
| `npm run tenant:enforcement:apply -- --apply` | 0 | `ok:true`, **129/129 completed**, `maxObservedLockHoldMs: 63` (empty fixture) |
| `npm run tenant:enforcement:verify` | 0 | `ok:true`, `issues:[]` |
| `npm run tenant:enforcement:drift` | 0 | `ok:true`, `issues:[]` |
| `npm run tenant:rls:verify` | 0 | `ok:true`, `issues:[]` |
| `npm run tenant:immutability:verify` | 0 | `ok:true`, `issues:[]` |
| `npm run test:db-isolation` (isolation.test.ts) | 0 | **14 passed** |
| `npm run test:db-isolation` (full) | 0 | **23 passed** (2 files) |
| `npm run test:migrations` (enforcement) | 0 | **4 passed** |
| `npm run test:tenant-access` | 0 | **291 passed** (34 files) |
| `npm run test:migrations` | 0 | **110 passed** (25 files) |
| `npm run test:subject-memory` | 0 | **2 passed** |
| `npm run lint` | 0 | clean |
| `npm run typecheck` | 0 | clean |
| `npm test` | 0 | **56 passed** (6 files) |
| `npm run build` | 0 | built |
| `npm run graphql-codegen` | 0 | clean |
| `git diff --check` | 0 | clean |

**Every test count Cursor reported reproduced exactly**: 14 / 23 / 4 / 291 / 110 / 56 / 2. Inventories regenerate to a byte-identical tree (`git status --porcelain` empty after regeneration).

---

## 20. Findings

### P0 — none

### P1 — six, all blocking

---

**F-PR3-01 · P1 · Forward recovery from a partial apply is impossible with the shipped tooling**

- **Object:** `scripts/tenant-enforcement/preflight.ts:159-168`
- **Requirement:** §19 rerun idempotent; §28 recovery from timeout mid-apply; runbook "Timeout mid-VALIDATE → Re-run apply; prior verified steps remain."
- **Reproduction:** Populate 270k rows; run `tenant:enforcement:apply -- --apply` under concurrent DML; it fails at `cfk:LeadTimeSnapshot_shopId_supplierId_fkey` with `deadlock detected`. Re-run apply.
- **Actual:** `preflight_failed:tenant:schema:drift_failed_exit_1`. `enforcementAlreadyApplied` requires **all 18** tables forced; after a partial apply it is `false`, so the Prisma drift gate runs and now fails permanently because NOT NULL/FKs have legitimately diverged. Apply refuses forever. Verified that un-forcing RLS on **one** table reproduces this; verified that manually forcing RLS on all 18 restores `preflight → ok:true`, `apply → ok:true`.
- **Expected:** Preflight must recognise partial-enforcement states and allow resume; the drift gate must key off per-object expected divergence, not an all-or-nothing flag.
- **Merchant impact:** An enforcement window that fails part-way cannot be completed or rolled back; the database is stranded in the least safe state (F-PR3-02).
- **Correction:** Replace the boolean with a per-table/per-object enforcement-state assessment; make the drift gate compare against the *expected post-enforcement* shape.
- **Missing test:** Partial-apply → resume → full verify, with the interruption injected after `roles`, after the first NOT NULL, after the first FK, and before `rls_triggers`.
- **Blocks acceptance: YES**

---

**F-PR3-02 · P1 · Partial apply leaves the runtime role with unrestricted cross-tenant access**

- **Object:** `scripts/tenant-enforcement/apply.ts:440-531` (step `roles` = #2, `rls_triggers` = #129)
- **Requirement:** §20 — the ordering must prevent "unrestricted runtime app operating after role grants but before policies."
- **Reproduction:** As F-PR3-01. Then connect as `stocky_runtime` with **no** tenant context.
- **Actual:** `SELECT count(DISTINCT "shopId"), count(*) FROM "Supplier"` → **50 shops, 100,000 rows**. 18/18 NOT NULL and 20 FKs applied; **0/18** FORCE RLS.
- **Expected:** Grants must not precede policy activation, or the window must be atomic, or grants must be withheld until enforcement verification succeeds.
- **Merchant impact:** Every tenant's data readable by any process holding runtime credentials, for the entire duration of the stranded state — which F-PR3-01 makes indefinite.
- **Correction:** Enable RLS + policies **before** granting runtime DML (policies on a table with no grants are harmless), or apply grants as the final step, gated on `tenant:enforcement:verify`.
- **Missing test:** Assert that at no point during a failed apply can the runtime role read foreign-tenant rows.
- **Blocks acceptance: YES**

---

**F-PR3-03 · P1 · RLS verification and drift detection cannot detect policy-predicate tampering**

- **Object:** `scripts/tenant-enforcement/verify.ts:58-134` (`checkPolicies`)
- **Requirement:** §13 "SELECT policy is correct; INSERT policy uses correct WITH CHECK; UPDATE uses both USING and WITH CHECK"; §15 "Verifier must catch all."
- **Reproduction:** `DROP POLICY "Supplier_tenant_select" ON "Supplier"; CREATE POLICY "Supplier_tenant_select" ON "Supplier" FOR SELECT TO stocky_runtime USING (true);`
- **Actual:** `tenant:rls:verify` → `ok:true`; `tenant:enforcement:verify` → `ok:true`; `tenant:enforcement:drift` → `ok:true`. Runtime role under Shop A context then read **`shopA,shopB`** — complete cross-tenant bypass. `checkPolicies` never reads `polqual` or `polwithcheck`.
- **Expected:** Compare `pg_get_expr(polqual, polrelid)` and `pg_get_expr(polwithcheck, polrelid)` against the canonical predicate for every policy; assert `polpermissive`; assert UPDATE has a non-null WITH CHECK.
- **Merchant impact:** The controls the runbook lists under "Monitoring" and CI runs on every PR would report a healthy database while tenant isolation is entirely absent.
- **Correction:** Verify policy expressions, not just names.
- **Missing test:** Drift fixture that rewrites each policy predicate and asserts the verifier fails.
- **Blocks acceptance: YES**

---

**F-PR3-04 · P1 · Composite FK definitions are neither verified nor repaired; wrong same-named constraints are silently accepted**

- **Object:** `scripts/tenant-enforcement/verify.ts:236-252` (`checkFk`); `scripts/tenant-enforcement/apply.ts:220-247` (`addShopFk`, `addCompositeFk`)
- **Requirement:** §16 exact columns/actions; §19 "wrong definitions fail instead of being silently replaced."
- **Reproduction:** Replace `POLineItem_shopId_purchaseOrderId_fkey` with a single-column `FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"(id)` under the same name. Run verify, drift, and re-apply.
- **Actual:** verify `ok:true`; drift `ok:true`; re-apply `ok:true` and **does not repair** (short-circuits on `constraintExists`). Cross-tenant child insert (`shopId='shopA'`, `purchaseOrderId='poB'`) then **succeeded**.
- **Expected:** Verify `conkey`, `confrelid`, `confkey`, `confdeltype`, `confupdtype`; fail closed on any same-named constraint whose definition differs.
- **Merchant impact:** Composite tenant enforcement can be silently absent on any subset of the 8 FKs while all gates are green.
- **Correction:** Full catalog-definition comparison in `checkFk`, and an explicit definition check (not bare existence) before skipping in apply.
- **Missing test:** Per-FK wrong-definition drift fixture asserting verify and apply both fail.
- **Blocks acceptance: YES**

---

**F-PR3-05 · P1 · Role verification ignores role membership — runtime role can be granted the migration owner and still pass**

- **Object:** `scripts/tenant-enforcement/roles.ts:151-260` (`verifyRoles`)
- **Requirement:** §10 "cannot assume migration role", "cannot SET ROLE into a privileged role"; §11 "wrong role membership" must fail.
- **Reproduction:** `GRANT stocky TO stocky_runtime;` then `npm run tenant:roles:verify`; then as `stocky_runtime`: `SET ROLE stocky;`
- **Actual:** `tenant:roles:verify` → **`ok:true`, `failures:[]`**. `SET ROLE stocky` **succeeds** — the runtime role becomes the owner of all 18 merchant tables (and, in the CI/local configuration, a superuser). `verifyRoles` never queries `pg_auth_members`. Because the role is `NOINHERIT`, `has_table_privilege` does not surface the membership, so the existing checks miss it entirely. Re-provisioning does **not** revoke the membership.
- **Expected:** Assert the runtime role has no membership in any role other than an explicitly approved set; assert `rolinherit=false`; revoke unapproved memberships on provision.
- **Merchant impact:** A single mis-issued `GRANT` yields full database-owner control from runtime credentials, with every shipped control reporting healthy.
- **Correction:** Add a `pg_auth_members` check to `verifyRoles` and a revoke step to `provisionRoles`; re-assert `NOINHERIT` on existing roles.
- **Missing test:** Membership-drift fixture asserting `roles:verify` fails and `SET ROLE` is impossible.
- **Blocks acceptance: YES**

---

**F-PR3-06 · P1 · Runtime/migration URL separation is a literal string comparison with no privilege verification**

- **Object:** `app/db.server.ts:21-56`; `scripts/tenant-enforcement/connection.ts:72-116`
- **Requirement:** §10 critical runtime URL tests; §22 "A runtime process gaining migration-owner access is P1."
- **Reproduction:** With `STOCKY_REQUIRE_RUNTIME_DB_URL=1`, set `DATABASE_MIGRATION_URL=postgresql://owner:p@h:5432/d` and `DATABASE_RUNTIME_URL` to any of: the same URL plus `/`; plus `?schema=public`; with `127.0.0.1` for `localhost`; with scheme `postgres://`.
- **Actual:** All four **ACCEPTED**. Only byte-identical strings are rejected. No check that the connecting role is non-superuser, lacks `BYPASSRLS`, or owns no merchant tables — §10's "runtime role lacks required grants" and "runtime role unexpectedly owns table" fail-closed cases are unimplemented. `?schema=public` is the form Prisma's own documentation recommends appending, making this a likely misconfiguration rather than an exotic one.
- **Expected:** Normalise and compare host/port/database/user semantically; and at startup in production-like mode, assert `rolsuper=false`, `rolbypassrls=false`, and zero owned merchant tables for the connected role, failing closed otherwise.
- **Merchant impact:** A production web or worker process silently runs as the migration owner — able to drop policies, disable triggers, and (if the owner is a superuser) bypass FORCE RLS entirely across all tenants.
- **Correction:** Semantic URL comparison plus a runtime privilege self-check on first connection.
- **Missing test:** Table-driven startup test over the equivalence forms above, plus a self-check test connecting as the owner.
- **Blocks acceptance: YES**

---

### P2 — twelve

| ID | Severity | Object | Summary | Blocks |
|---|---|---|---|---|
| **F-PR3-07** | P2 | `prisma/schema.prisma`; `package.json` `db:migrate`, `db:push` | `prisma migrate diff` on an enforced DB emits 26 `DROP CONSTRAINT` (8 composite FKs + 18 Shop FKs) and 18 `DROP NOT NULL`. `db:migrate`/`db:push` would execute this with no guard. `tenant:schema:drift` permanently fails post-enforcement and reports "(none recognized)", so it cannot distinguish expected divergence from destroyed enforcement. | YES |
| **F-PR3-08** | P2 | `verify.ts:136-163` | `checkTrigger` ignores `tgenabled` and `tgtype`. `DISABLE TRIGGER` and `ENABLE REPLICA TRIGGER` both leave `immutability:verify` reporting `ok:true`. | YES |
| **F-PR3-09** | P2 | `roles.ts:151-260` | `GRANT ALL ON "Supplier" TO PUBLIC` → `roles:verify` `ok:true`. §11 requires PUBLIC-grant drift to fail. | YES |
| **F-PR3-10** | P2 | `roles.ts:218-228` | Only checks that the 4 DML privileges are *present*; excess `TRIGGER`, `TRUNCATE`, `REFERENCES` grants → `ok:true`. §11 requires excess-grant drift to fail. | YES |
| **F-PR3-11** | P2 | `roles.ts:74-78` | `ALTER ROLE … NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS` silently repairs dangerous drift. Provisioning a runtime role that had `BYPASSRLS` returns `ok:true, errors:[]` with no signal that a security-relevant deviation existed. Masks incidents. | YES |
| **F-PR3-12** | P2 | `apply.ts:526-531`, `sql.ts:126-131` | All 18 tables' ENABLE/FORCE RLS + 72 policies + 18 triggers execute in **one** implicit transaction, accumulating `ACCESS EXCLUSIVE` locks on every merchant table. §17 prohibits "a giant transaction spanning all tables". | YES |
| **F-PR3-13** | P2 | `connection.ts:18-22`; runbook | Migration owner is a **superuser** in CI/local, so FORCE RLS does not bind it (measured: owner sees rows; a non-superuser owner sees 0). Nothing requires or verifies a non-superuser production owner. `defaultMigrationRoleName()` returns `stocky_migration`, which does not exist in CI — `verifyRoles` never inspects the real owner. Owner bypass behavior is undocumented. | YES |
| **F-PR3-14** | P2 | `preflight.ts` / `cli.ts:161-164` | A `lock_timeout` during preflight's `COUNT(*)` escapes as an unstructured top-level error — no JSON, no `event`, no step attribution. Operator cannot tell where the run stopped. Fail-closed behavior itself is correct. | NO |
| **F-PR3-15** | P2 | `apply.ts:26-42, 362` | No durable checkpoint exists; `steps` is in-memory and rebuilt all-`pending` each run. Idempotency comes from existence checks. Report/runbook "checkpointed" language is inaccurate. | NO |
| **F-PR3-16** | P2 | `worker-surfaces.test.ts:113-160` | The five "surfaces" (`export`, `privacy`, `reconciliation`, `replay_repair`, `scheduler`) are the **same generic test**; only the `source` string and correlation id differ. No export/privacy/reconciliation/replay code paths exist in the repo. §24 required real code paths or an explicit deferral; the test naming implies coverage that does not exist. | YES |
| **F-PR3-17** | P2 | Runbook §"Runtime cutover" / §"Step groups" | §20 requires assessment of blue/green compatibility, migration/app release sequencing, maintenance-window requirements, failure after policies but before runtime deployment, and failure after runtime deployment but before constraints validate. **None are addressed.** The runbook also does not gate runtime cutover on successful `tenant:enforcement:verify`, which is what would contain F-PR3-02. The required rollback statement ("the pre-Phase-1 application is not a valid rollback target after RLS activation") **is** present ✓. | YES |
| **F-PR3-18** | P2 | `tenant-db.server.ts:1604-1624` | Every merchant read now opens a Prisma interactive transaction and performs 3 `set_config` round-trips + 1 verification read before the query — ~4 extra round-trips per read plus transaction overhead. No benchmark or scalability evidence accompanies the change. | NO |
| **F-PR3-19** | P2 | `manifest.ts` `LeadTimeSnapshot_shopId_purchaseOrderId_fkey`; architecture doc | This FK creates referential integrity that did not previously exist (`LeadTimeSnapshot.purchaseOrderId` had no Prisma relation). Measured: `DELETE FROM "PurchaseOrder"` now fails when a lead-time snapshot exists (`ON DELETE NO ACTION`). Undocumented merchant-visible behavior change; no test. | NO |
| **F-PR3-20** | P2 | `isolation.test.ts:411-529` | Only 2 of §23's 16 pool scenarios are committed. Backend-PID reuse **is** proven (`expect(pid2).toBe(pid1)`) ✓. Missing: cancellation, timeout, disconnect/reconnect, saturation, retry, interactive-transaction failure, worker+web sharing, setter-failure-before-query. | NO |

### P3 — nine

| ID | Object | Summary |
|---|---|---|
| F-PR3-21 | PR #15 body; implementation report | Both state "Runtime/test implementation head: `aeeecc2`". Runtime code changed in `27234f6`, `d4dd43f`, `bc6734d`, `0ee3ae0`. The actual last runtime/test commit is **`0ee3ae0`** — which both documents separately identify as the first green tip, so they are self-contradictory. |
| F-PR3-22 | `PR3_DATABASE_ENFORCEMENT_IMPLEMENTATION_REPORT.md` | Stale at the reviewed head: names `9c2c98c` as "Final exact PR head" and run `30786796167`/job `91601769081`, whereas the head is `57016ed` and the authoritative run is `30787422727`/job `91603628956`. Lists 15 of 17 commits (omits `d036705`, `57016ed`). Does not overstate CI success — the exact head is genuinely green — but does not describe itself. |
| F-PR3-23 | `apply.ts:59-63` | `pg_advisory_unlock` return value discarded; release is not verified. |
| F-PR3-24 | `roles.ts:64-67` | Hardcoded default runtime password fallback `"stocky_runtime_ci_only"` used when `STOCKY_RUNTIME_ROLE_PASSWORD` is unset — a production-like apply would silently set a publicly-known password. Password is interpolated into DDL (escaped, but not parameterised). |
| F-PR3-25 | `app/db.server.ts:101-110` | `resetPrismaSingletonForTests` is exported from a runtime module and importable by production code; guarded only by `NODE_ENV`. |
| F-PR3-26 | `app/db.server.ts:87-93` | `Reflect.get(client, prop, receiver)` passes the **proxy** as receiver; any accessor on `PrismaClient.prototype` would receive the proxy as `this`. Latent. |
| F-PR3-27 | `verify.ts:178-183`; `apply.ts:98-100, 472-479` | Dead code: `void check;` discards the helper-CHECK query; `void compositeKeyName;` in a no-op "promote to constraint" branch; `void expected;` after building an unused expected index definition. |
| F-PR3-28 | `preflight.ts:172-175` | `STOCKY_PREFLIGHT_SKIP_ACCESS_INVENTORY=1` disables the access-inventory freshness gate **inside the apply path**, not just in tests. |
| F-PR3-29 | Grants; `db-context.server.ts:48-51` | (a) The runtime role can enumerate all `Shop` rows (all tenant domains) with no context — by design, but unbounded. (b) `readTransactionLocalTenantContext` uses `$queryRawUnsafe` **specifically so unit-test mocks can omit `$queryRaw`** — production code shaped by test-mock convenience. |

---

## 21. Residual dependencies

### Acceptable PR 3 residuals (no correction required)

- RLS, policies, triggers and composite constraints live in enforcement tooling rather than Prisma migration SQL. Deliberate (D-024 pattern: no `CONCURRENTLY`/`VALIDATE` inside Prisma Migrate transactions) and proven reproducible by the fresh-rebuild test.
- PostgreSQL context does not authenticate Shopify identity. The architecture states this explicitly, `TenantAuthority` is a non-forgeable brand, and the raw-SQL surface is mechanically constrained by the PR 2 scanner (adversarially verified).
- Helper `CHECK (shopId IS NOT NULL)` constraints retained after `SET NOT NULL` — redundant but harmless.
- Same-value `shopId` updates succeed. Documented and correct.

### Production-rollout evidence still required (before any production authorisation)

- Populated-scale apply on a production-shaped dataset **after** F-PR3-01/02/12 are corrected, with concurrent traffic and measured lock waits.
- Backup/restore rehearsal on production-shaped data (I executed it at 270k rows successfully; the runbook still marks it unexecuted, which remains accurate for production).
- A documented, tested deployment sequence covering blue/green, maintenance window, and every partial-failure boundary (F-PR3-17).
- Confirmation that the production migration owner is a **non-superuser** table owner (F-PR3-13).
- Cross-cluster restore procedure including role re-provisioning.

### PR 4 dependencies (correctly deferred — do not implement here)

- Persistent inbox, replay and dead-letter tables — correctly absent.
- Real export, privacy-processing, reconciliation and replay/repair execution paths. §24's isolation requirements for these cannot be met until the code exists; F-PR3-16 asks only that the current tests stop implying they do.

### Unacceptable defects (must be corrected before acceptance)

F-PR3-01 through F-PR3-06 (P1) and F-PR3-07 through F-PR3-13, F-PR3-16, F-PR3-17 (mandatory P2).

---

## 22. Confirmations

- **No production access.** Only disposable local PostgreSQL 16 databases (`stocky_plus_ci`, `stocky_lowlock`, `stocky_fresh`, `stocky_restore`) and an isolated Redis 7 on port 6399 were used.
- **No production data or merchant data** was read, written, or inspected. All fixtures were synthetic (`shopA`/`shopB`, `shop1`–`shop50`).
- **No deployment.** No production or staging environment was touched.
- **No backfill** was executed.
- **No inventory writes.** All inventory-write feature flags remained default OFF throughout.
- **No production secrets.** Test-only credentials exclusively.
- **Implementation code unchanged by the reviewer.** All adversarial probes were temporary and deleted; `git status --porcelain` is empty at `57016ed` apart from this report. The one planted file (`app/services/__claude_probe_raw.server.ts`) was removed immediately after the scanner test.
- **PR #15 remains open, draft and unmerged.** It was not marked ready, not merged, and no implementation commit was amended, rebased, or force-pushed.
- The only change contributed by this review is this report file.

---

## 23. Next action

**Return to ChatGPT for the exact Cursor PR 3 correction prompt.**

Suggested correction ordering (highest leverage first):

1. **F-PR3-02 + F-PR3-01** — reorder grants after RLS activation, and make preflight resume-aware. These two together convert the worst failure mode from "indefinite cross-tenant exposure" into "safe retry".
2. **F-PR3-03 + F-PR3-04 + F-PR3-08** — make `verify`/`drift` compare actual catalog definitions (policy predicates, FK columns and actions, composite key columns, `tgenabled`/`tgtype`). Without this, no other guarantee is durable.
3. **F-PR3-05 + F-PR3-09 + F-PR3-10 + F-PR3-11** — complete `verifyRoles` (membership, PUBLIC grants, excess grants) and make provisioning report rather than silently repair drift.
4. **F-PR3-06** — semantic runtime-URL comparison plus a startup privilege self-check.
5. **F-PR3-07 + F-PR3-13 + F-PR3-17** — guard Prisma developer tooling, require a non-superuser migration owner, and complete the deployment-ordering runbook.
6. **F-PR3-12 + F-PR3-16** — split the RLS step per table; rename or remove the five synthetic "surface" tests and state the deferral explicitly.

---

*Reviewed head: `57016ed4b685c8958ad49d821f4afd9ea9894a9b`. This report was added as a separate, report-only commit and is not part of the reviewed implementation.*
