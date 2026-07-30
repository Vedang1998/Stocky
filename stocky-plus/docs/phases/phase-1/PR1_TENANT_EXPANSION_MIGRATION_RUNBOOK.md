# PR 1 — Tenant Expansion Migration Runbook

**Phase:** 1  
**Work unit:** PR 1 — Tenant expansion and backfill  
**Audience:** Implementers and reviewers  
**Production execution:** **PROHIBITED** without a later reviewed deployment plan and explicit authorization.

## Exact migrations

1. `20260730160000_tenant_expansion` — `Shop`, backfill control tables, nullable `shopId` columns  
2. `20260730160100_tenant_compatibility_indexes` — compatibility indexes  

Do **not** modify `20260728000000_init_stocky_plus`.

## Normalization

Version: **`phase1-shop-domain-v1`**

1. Trim whitespace  
2. Lowercase ASCII letters  
3. Require plain hostname  
4. Require exactly one store label + `.myshopify.com`  
5. Label: lowercase letters, numbers, internal hyphens  
6. Reject leading/trailing hyphen on label  
7. Reject schemes (`http://`, `https://`) — do not strip  
8. Reject ports, paths, query, fragment, credentials, custom domains, blanks, malformed labels  

Invalid values are quarantined. No Shopify network calls.

## Table-by-table ownership source

See `PR1_TENANT_OWNERSHIP_INVENTORY.md`.

Direct owners: derive `shopId` from own legacy `shop`.  
Children: derive only from verified parent `shopId`.  
Never guess. Never overwrite conflicting non-null `shopId`. Never modify legacy `shop`.

## Dry-run procedure

```bash
cd stocky-plus
export DATABASE_URL="postgresql://…/disposable_db"
npm run tenant:diagnose
# or
npm run tenant:backfill -- --dry-run --batch-size 500
```

Default CLI behavior is non-mutating dry-run.

## Apply procedure (disposable / authorized environments only)

```bash
npm run tenant:backfill -- --apply --batch-size 500
```

Mutation requires explicit `--apply`.  
**Do not run apply against production or merchant data in this PR.**

## Status / checkpoint procedure

```bash
npm run tenant:backfill:status -- --run-id <id>
```

Checkpoints are unique per `(runId, tableName)` and resume from `lastProcessedId`.

## Resume procedure

```bash
npm run tenant:backfill -- --apply --batch-size 500 --resume-run-id <id>
```

Completed table checkpoints are skipped. In-progress tables continue after the last processed primary key.

## Concurrency protection

Apply mode acquires PostgreSQL advisory lock key `0x53544b31` (`1398031153`) via `pg_try_advisory_lock`.  
If the lock is held on another session, apply fails closed with a non-zero exit / thrown error.

## Timeout behavior

Migrations set:

* `lock_timeout = 5s`  
* `statement_timeout = 60s` (expansion) / `30min` (indexes)  

Lock timeout aborts the migration safely; data and prior migrations remain intact. Session timeouts are `RESET` at end of each migration.

## Failure recovery

* Failed apply preserves completed checkpoints and does not delete issues.  
* Re-run apply or resume from run id.  
* Unresolved rows remain nullable.  
* No operational history is deleted.

## Issue / quarantine interpretation

Open `TenantOwnershipIssue` rows block later PR 3 enforcement for affected domains.  
Reason codes: see inventory / `scripts/tenant-backfill/reason-codes.ts`.  
Evidence fields store redacted length+SHA-256 of shop strings — never access tokens, session secrets, or unnecessary PII.

## Checksum interpretation

Per-table SHA-256 over canonical JSON of `{id, shopId}` rows ordered by `id`.  
Identical checksums on rerun prove idempotent ownership state for that table.

## Index creation deviation and production CONCURRENTLY path

Prisma Migrate 6.19 wraps migrations in a transaction. `CREATE INDEX CONCURRENTLY` fails with SQLSTATE `25001` / Prisma `P3018` under `prisma migrate deploy` (verified on disposable PostgreSQL).

PR 1 therefore creates compatibility indexes with `CREATE INDEX IF NOT EXISTS` / `CREATE UNIQUE INDEX IF NOT EXISTS` inside Migrate, with lock/statement timeouts.

For large production tables (later authorized deployment only), build the **same index names** outside Migrate:

```sql
SET lock_timeout = '5s';
SET statement_timeout = '30min';
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Supplier_shopId_idx" ON "Supplier"("shopId");
-- …repeat for each index in 20260730160100… —
```

Interrupted concurrent builds may leave `INVALID` indexes:

```sql
DROP INDEX CONCURRENTLY IF EXISTS "Supplier_shopId_idx";
-- recreate CONCURRENTLY
```

## Rollback limitations

* Rolling back application code does **not** remove added nullable columns or control records.  
* There is no destructive down migration.  
* Forward recovery: keep nullable columns; continue backfill; do not enable PR 3 enforcement until unresolved count is zero.

## Verification queries

```sql
-- Nullable shopId present; legacy shop retained
SELECT table_name, column_name, is_nullable
FROM information_schema.columns
WHERE table_schema='public' AND column_name IN ('shop','shopId')
ORDER BY 1,2;

-- No RLS
SELECT c.relname FROM pg_class c
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity;

-- Open quarantine
SELECT "reasonCode", COUNT(*) FROM "TenantOwnershipIssue"
WHERE status='OPEN' GROUP BY 1 ORDER BY 2 DESC;
```

## Explicit prohibitions

* No production migration or deployment without later reviewed plan + authorization.  
* No RLS activation in PR 1.  
* No runtime access conversion in PR 1.  
* No inventory-write flag enablement.  
* No operational history deletion.  
* Application rollback ≠ schema rollback of nullable columns/control tables.
