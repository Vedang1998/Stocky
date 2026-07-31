# PR 1 — Tenant Expansion Migration Runbook

**Phase:** 1
**Work unit:** PR 1 — Tenant expansion and backfill (post-correction)
**Audience:** Implementers and reviewers
**Production execution:** **PROHIBITED** without a later reviewed deployment plan and explicit authorization.

## Exact migrations

1. `20260730160000_tenant_expansion` — `Shop`, backfill control tables, nullable `shopId` columns
2. `20260730160100_tenant_compatibility_indexes` — **no-op marker** (indexes are NOT created here; see D-024)
3. `20260730210000_tenant_backfill_correction` — `COMPLETED_WITH_ISSUES`, issue reopen fields

Do **not** modify `20260728000000_init_stocky_plus`.

A database is PR-1-ready only after:

1. `npx prisma migrate deploy`
2. `npm run tenant:indexes:apply -- --apply`
3. `npm run tenant:indexes:verify`
4. `npm run tenant:schema:drift`

## Normalization

Version: **`phase1-shop-domain-v1`** (correction, not a new version)

1. Trim whitespace
2. Reject non-ASCII on raw trimmed input **before** lowercasing (`non_ascii`)
3. Reject schemes, ports, paths, query, fragment, credentials, controls
4. Lowercase ASCII letters
5. Require exactly one store label + `.myshopify.com`
6. Store label length 1–63; hostname length ≤ 253
7. Letters, digits, internal hyphens only; no leading/trailing hyphen

Invalid values are quarantined. No Shopify network calls.

## Ownership source

See `PR1_TENANT_OWNERSHIP_INVENTORY.md`.

Direct owners: own legacy `shop` → proposed/persisted `shopId`.
Children: verified parent persisted `shopId`, else proposed parent ownership from the same run.
Never guess. Never overwrite conflicting non-null `shopId`. Never modify legacy `shop`.

## Dry-run procedure

Dry-run does not mutate merchant ownership rows, but it writes backfill run, checkpoint, and issue diagnostic records.

```bash
cd stocky-plus
export DATABASE_URL="postgresql://…/disposable_db"
npm run tenant:diagnose
# or
npm run tenant:backfill -- --dry-run --batch-size 500
```

Exit codes: `COMPLETED` → 0; `COMPLETED_WITH_ISSUES` → 2; `FAILED` → 1.

## Apply procedure (disposable / authorized environments only)

Requires a **direct** (non-pooler) URL:

```bash
export TENANT_MAINTENANCE_DATABASE_URL="postgresql://…/disposable_db"
npm run tenant:backfill -- --apply --batch-size 500
```

**Do not run apply against production or merchant data in this PR.**

## Compatibility indexes

```bash
export TENANT_MAINTENANCE_DATABASE_URL="postgresql://…/disposable_db"
npm run tenant:indexes:plan
npm run tenant:indexes:apply -- --apply
npm run tenant:indexes:verify
npm run tenant:schema:drift
```

- One CONCURRENTLY operation at a time; no `IF NOT EXISTS` as proof of correctness
- Invalid/mismatched same-name index → fail closed
- Recovery: authorized `DROP INDEX CONCURRENTLY` then re-apply

## Status / checkpoint / resume

```bash
npm run tenant:backfill:status -- --run-id <id>
npm run tenant:backfill -- --apply --batch-size 500 --resume-run-id <id>
```

Checkpoints advance only with durable issue persistence in the same transaction.
Diagnostic phases (`diagnostic:po_supplier`, `diagnostic:lead_time`, `diagnostic:duplicate_shop_settings`) are separately checkpointed.
Resume preserves original `beforeCounts`, normalization version, source SHA, and schema version.

## Concurrency protection

Apply mode uses `pg_try_advisory_lock` on a dedicated `pg.Client` for the full run lifetime.
Unlock must return true on the same backend PID.

## Blocking condition

A run is clean (`COMPLETED`) only when all checkpoints complete, all per-table unresolved counts are zero, and `blockingIssueCount` is zero.
Otherwise finished runs use `COMPLETED_WITH_ISSUES`. Cross-domain issues block.

## Issue reopen

Re-detected previously `RESOLVED` fingerprints reopen (`OPEN`, `reopenedAt`, `reopenCount++`).

## Rollback limitations

Rolling back application code does not remove nullable columns or control records. No destructive down migration. No operational history deleted.

## Explicit prohibitions

- No production migration/deployment without later authorization
- No RLS in PR 1
- No runtime access conversion
- No inventory-write flag enablement
- No PR 2 / PR 3 work from this runbook
