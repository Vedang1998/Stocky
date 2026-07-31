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

See allowlist in `scripts/tenant-access/allowlist.ts`. Exact IDs:

| ID | Path | Category |
|---|---|---|
| EX-RAW-001 | `app/db.server.ts` | raw Prisma construction |
| EX-BOOT-001 | `app/tenant/bootstrap.server.ts` | restricted bootstrap |
| EX-TDB-001 | `app/tenant/tenant-db.server.ts` | tenant-bound access |
| EX-BF-001 | `scripts/tenant-backfill/` | PR 1 maintenance |
| EX-IDX-001 | `scripts/tenant-indexes/` | PR 1 indexes |
| EX-SEED-001 | `prisma/seed.ts` | dev seed |
| EX-TEST-001 | `app/tenant/__tests__/` | integration test harness |

CI: `npm run tenant:access:audit`, `tenant:access:inventory:check`, `test:tenant-access`.

## PR 3 handoff

PR 2 establishes application-level tenant authority and scoped access. PR 3 must still add:

- non-null `shopId`
- composite tenant FKs
- runtime/migration roles
- forced RLS + DB immutability

## Known residual gaps

- Nullable `shopId` rows not backfilled remain invisible to tenant-scoped reads (operational backfill gate)
- Nested `include` of relations can still return child rows loaded by Prisma relation (composite FK/RLS in PR 3)
- Job envelope is transport-validated only — not DB-persisted (PR 4)
- Pool leakage of DB session variables is N/A until RLS session vars (PR 3); app-level TenantDb isolation tests cover concurrent shops on a shared Prisma pool
- Inventory writes remain frozen and default OFF
