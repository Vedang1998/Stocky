# PR 2 — Tenant Access Architecture

**Phase:** 1  
**Work unit:** PR 2 — Tenant-bound access conversion  
**Branch:** `phase-1/tenant-access`  
**Status:** Implemented — pending independent review and ChatGPT acceptance  
**Normalization:** `phase1-shop-domain-v1`  
**Job envelope:** `tenant-job-envelope-v1`

## Authority derivation

| Surface | Authority source | Module |
|---|---|---|
| Admin routes | Shopify `authenticate.admin` → normalize `session.shop` → resolve canonical `Shop` → branded `TenantAuthority` | `app/tenant/require-admin-tenant.server.ts` |
| afterAuth | Verified session → upsert `Shop` → branded authority → tenant-bound `ShopSettings` upsert | `app/tenant/after-auth.server.ts` |
| Webhooks | Shopify `authenticate.webhook` verified domain only → branded authority + envelope | `app/tenant/webhook-tenant.server.ts` |
| Jobs / workers | Validate `tenant-job-envelope-v1` → resolve Shop ID+domain match → branded `verified_job` authority | `app/tenant/job-envelope.server.ts` |
| Weekly ABC scheduler | Bootstrap enumerates canonical Shops → one envelope per Shop → per-shop worker | `app/tenant/scheduler.server.ts` |

Client-supplied `shop` / `shopId` from query, headers, JSON, or form **never** establish authority. Conflicts with the verified shop are denied (`client_shop_conflict`).

Branded authority is issued only via `issueTenantAuthority` inside `app/tenant/` and tracked in a module-private `WeakSet`. Raw domain/`shopId` objects are not accepted by `createTenantDb`.

## Bootstrap boundary

`app/tenant/bootstrap.server.ts` may access only:

- `Session` (including lazy `PrismaSessionStorage` for Shopify)
- `Shop` upsert/resolve/enumerate

It must not expose the raw Prisma client or merchant delegates (`getMerchantDelegate()` fails closed).  
`shopify.server.ts` receives `shopifySessionStorage` from bootstrap — it does not import `db.server`.

## Raw Prisma boundary

`app/db.server.ts` remains the sole low-level `PrismaClient` construction point for the app runtime.

Value imports of `db.server` are forbidden outside approved exceptions. Type-only `@prisma/client` imports remain allowed.

## Tenant database contract

`createTenantDb(authority)` returns scoped delegates for all 18 merchant-owned models.

Behavior:

- Every read merges `shopId` (and for direct models, legacy `shop`) into `where`
- Creates inject `shopId` (+ legacy `shop` for direct models)
- Explicit foreign `shopId` / `shop` rejected
- Updates cannot assign a different `shopId`
- Unique reads rewrite to tenant-scoped `findFirst` (never unrestricted unique-then-check)
- Upserts require a tenant-bearing unique selector; legacy `shop` fields are coerced to the authority domain
- Deletes use tenant-scoped `deleteMany`
- Parent FKs validated same-tenant before child/PO creates (pre-PR 3 composite FK stand-in)
- Nested child creates receive tenant ownership injection
- `$queryRaw*` / `$executeRaw*` / raw client escape blocked on the returned object

## Unique-operation handling

| Operation | Strategy |
|---|---|
| `findUnique` / `findUniqueOrThrow` | Rewrite to scoped `findFirst` |
| `update` / `delete` | Locate via scoped `findFirst`, mutate via scoped `updateMany` / `deleteMany` |
| `upsert` | Require tenant-bearing unique; coerce `shop` in selector; inject ownership on create |

## Child-parent validation (pre-PR 3)

Enforced in the tenant contract:

- `SupplierSkuMapping` / `VolumePriceTier` / `LeadTimeSnapshot` → `Supplier`
- `POLineItem` → `PurchaseOrder`
- `TransferLineItem` → `TransferOrder`
- `StocktakeLineItem` → `Stocktake`
- `PurchaseOrder.supplierId` → `Supplier`

## Job envelope

Producers accept branded `TenantAuthority` (or an already-built envelope) and attach `tenant-job-envelope-v1` separately from payload fields.

Workers call `resolveTenantJobContext` **before** any merchant access.

**Non-claim:** database-backed envelope persistence, durable replay, dead-letter tables, and durable idempotency remain PR 4 / PR 7. R-039 is only mitigated for in-process transport validation.

## Webhook path

1. `authenticate.webhook`
2. `resolveWebhookTenant(verifiedShop, topic)`
3. `enqueueWebhook({ tenant: envelope, payloadShop, payload, topic })`
4. Worker validates envelope + optional payload shop match

## Scheduler path

1. Control-plane job `abc-analysis` calls `planPerShopSchedulerJobs`
2. Enqueues `abc-analysis-shop` with one envelope per canonical Shop
3. Per-shop worker validates envelope then runs ABC — no global `ShopSettings` scan

## Exception model

Exceptions are **exact-file** entries in `scripts/tenant-access/allowlist.ts`. Directory-wide / wildcard paths are forbidden.

| ID | Path | Category |
|---|---|---|
| EX-RAW-001 | `app/db.server.ts` | raw Prisma construction |
| EX-BOOT-001 | `app/tenant/bootstrap.server.ts` | restricted bootstrap |
| EX-TDB-001 | `app/tenant/tenant-db.server.ts` | tenant-bound access |
| EX-BF-* | exact `scripts/tenant-backfill/**` files | PR 1 maintenance |
| EX-IDX-* | exact `scripts/tenant-indexes/**` files | PR 1 indexes |
| EX-SEED-001 | `prisma/seed.ts` | dev seed |
| EX-TEST-* | exact `app/tenant/__tests__/**` files | integration test harness |

CI: `tenant:access:audit`, `tenant:access:inventory:check`, granular tenant PostgreSQL/relation/envelope/Redis/client-hint/nested-write suites, then full `test:tenant-access`.

## Tenant scope (corrected)

### Direct models

```
(shopId = tenant.shopId AND shop = tenant.domain)
OR (shopId IS NULL AND shop = tenant.domain)
```

Foreign non-null `shopId` is never recovered via legacy `shop`. Conflicting pairs fail closed. Updates must not mutate `shopId` or `shop` (no silent repair).

### Child models

Parent must prove same-tenant ownership; child `shopId` is either the current tenant or null under that verified parent lineage. Secondary evidence such as `LeadTimeSnapshot.purchaseOrderId` is validated. Ambiguous lineage fails closed.

### Relations and nested writes

`include` / `select` / `_count` are recursively scoped. Unknown merchant relation shapes fail closed.

Every nested relation selector (`connect` / `set` / `disconnect` / nested `update` / `delete` / `connectOrCreate.where`, object and array forms) is validated through model-aware unique-selector metadata (`app/tenant/selectors.ts`), resolved with a tenant/lineage-scoped lookup, and rewritten to canonical `{ id }` (or explicit `create`) before Prisma mutation. Unsupported selector shapes fail closed. `connectOrCreate` performs an unscoped existence check after a tenant miss so a foreign global unique match cannot be connected. Nested `updateMany` / `deleteMany` array forms receive scalar tenant predicates (Prisma ScalarWhereInput cannot carry relation filters; the parent nested write already constrains the collection).

Partial nested `select` injects minimum ownership proof fields internally and strips them before return. Single-row `update` uses real Prisma `update` (not `updateMany`) so nested writes and `include`/`select` projections are preserved, inside an internal serializable transaction when not already nested.

PR 3 RLS / composite FKs remain defense in depth — not a substitute for this application contract.

## Job envelope transport integrity (PR 2) vs persistence (PR 4)

**PR 2 transport authentication and integrity:** HMAC-SHA256 over deterministic unsigned fields, dedicated `TENANT_JOB_ENVELOPE_SECRET` (≥32 bytes), `timingSafeEqual`, closed source allowlist, parsed `issuedAt` with 5-minute future skew and 24-hour max age, producers accept branded `TenantAuthority` only.

**PR 4 persistence (not this PR):** durable envelope ledger, replay governance, dead letters, durable idempotency. Version/shape/Shop matching alone is **not** integrity validation.

## PR 3 handoff

PR 2 establishes application-level tenant authority and scoped access. PR 3 must still add:

- non-null `shopId`
- composite tenant FKs
- runtime/migration roles
- forced RLS + DB immutability

## Known residual gaps

- Operational backfill of nullable `shopId` remains an environment gate (not executed in PR 2)
- Job envelope is cryptographically transport-authenticated — not DB-persisted (PR 4)
- Pool leakage of DB session variables is N/A until RLS session vars (PR 3); app-level TenantDb isolation tests cover concurrent shops on a shared Prisma pool
- Webhook path requires pre-existing canonical Shop (`createIfMissing: false`); Shopify redelivery covers install races (F-PR2-07 residual — no provenance schema added)
- Inventory writes remain frozen and default OFF
