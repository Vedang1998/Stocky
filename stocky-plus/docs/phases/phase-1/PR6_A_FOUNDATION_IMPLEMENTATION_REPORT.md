# Phase 1 PR6-A — Order / refund fact foundation implementation report

Status: **PR6-A AUTHORIZED / IN PROGRESS**. Independent Claude review of this
implementation head is **pending**. This report does not claim independent
review, ChatGPT acceptance, or merge authorization.

## 1. Authority and base

| Item | Value |
| --- | --- |
| Role | Cursor — PR6-A implementation owner |
| Authority | ChatGPT Phase 1 PR6-A foundation implementation only. Do **not** create D-055. Recorded as D-054 item 23. |
| Required / current main | `09feffd3f36eb4698f2ed8a152efe414cd9b77bd` |
| PR #34 | CLOSED / MERGED `2026-09-07T00:53:25Z` (squash) |
| Post-merge PR #34 CI | Run `34071226302` — `push` — SUCCESS. Classify `101588830168` SUCCESS. Heavy `101588852919` SKIPPED. CI Gate `101588852489` SUCCESS. |
| Final independent planning verdict | `APPROVE PR6 CURRENT-MAIN PLANNING` |
| Final review blob | `4f5ea10f6d36175d3540cb977a8f3543f36c15c2` |
| Branch | `phase-1/pr6-a-order-refund-fact-foundation` |
| Authority/control commit | `ea5830b159709e207827bc6f03ae55eafa49943b` |
| Draft PR | Opened from this branch after the implementation commit. GitHub assigns the number; this file does not invent the PR number or this commit’s own SHA. |
| D-055 | **Not created** |

This lane does **not** authorize PR6-B, PR6-C, PR6-D, production, merchant
production data, Shopify writes, inventory writes, deployment, feature-flag
enablement, `read_all_orders`, or `write_orders`.

## 2. Schema / models added

DIRECT merchant models added:

- `ShopifyOrderFact`
- `ShopifyOrderLineFact`
- `ShopifyOrderRefundFact`
- `OrderFactObservationInFlight`

CHILD merchant models added:

- `ShopifyOrderRefundLineFact`
- `ShopifyOrderAdjustmentFact`
- `ShopifyOrderAgreementFact`
- `ShopifyOrderAgreementSaleFact`
- `ShopifyOrderRefundTransactionFact`

`ShopifyOrderShippingLineFact` was **not** added. Refund shipping money is
persisted as columns on `ShopifyOrderRefundFact` per approved plan §5.3.1.

Shop columns added (nullable-first, no fake defaults):

- `Shop.ianaTimezone`
- `Shop.currencyCode`

DIRECT / CHILD counts:

| Inventory | Pre-PR6-A | PR6-A delta | Post-PR6-A |
| --- | --- | --- | --- |
| DIRECT | 20 | +4 | **24** |
| CHILD | 6 | +5 | **11** |
| Merchant-owned total | 26 | +9 | **35** |

## 3. Migration identity and safety

Folder:

`prisma/migrations/20260907010000_pr6_a_order_refund_fact_foundation/`

Safety:

- Additive SQL only. Existing migrations were not edited.
- No destructive drops, no production DML, no production connection.
- `Shop` column adds use `lock_timeout = 5s` and `statement_timeout = 15s`.
- New tables are empty, so ordinary transactional indexes are used.
- No second observation-generation sequence. Reuses
  `stocky_catalog_observation_gen_seq`.
- Rollback is drop new tables/enums/functions then drop the two nullable Shop
  columns. Shop column drop is a later maintenance window; no data backfill
  exists in this lane.

## 4. Tenant / RLS / roles

Registered additively in:

- `app/tenant/models.ts`
- `app/tenant/tenant-db.server.ts`
- `app/tenant/relations.ts`
- `app/tenant/selectors.ts`
- `app/tenant/legacy-scope.ts`
- `scripts/tenant-enforcement/manifest.ts`
- `scripts/tenant-enforcement/roles.ts`
- `scripts/tenant-access/allowlist.ts`

Classification: `merchant_domain`, `rlsRequired: true`, FORCE RLS through
existing enforcement.

Runtime table privileges follow the existing SELECT/INSERT/UPDATE/DELETE
pattern. `stocky_runtime` still has no BYPASSRLS, no table ownership, and no
`DataIssue` DML. Sequence privilege remains USAGE-only. PUBLIC remains denied.

Control-plane Shop grants remain column-level (F-PR4-06). Lifecycle columns
stay SELECT+UPDATE. `ianaTimezone` and `currencyCode` are **SELECT-only** so
Prisma `UPDATE … RETURNING *` on uninstall/reinstall does not fail, and
control-plane cannot write those Shopify facts.

Composite tenant FKs added:

- `ShopifyOrderLineFact (shopId, shopifyOrderGid) → ShopifyOrderFact`
- `ShopifyOrderRefundLineFact (shopId, shopifyRefundGid) → ShopifyOrderRefundFact`
- `ShopifyOrderAdjustmentFact (shopId, shopifyRefundGid) → ShopifyOrderRefundFact`
- `ShopifyOrderAgreementFact (shopId, shopifyOrderGid) → ShopifyOrderFact`
- `ShopifyOrderAgreementSaleFact (shopId, shopifyAgreementGid) → ShopifyOrderAgreementFact`
- `ShopifyOrderRefundTransactionFact (shopId, shopifyRefundGid) → ShopifyOrderRefundFact`

No Refund → Order FK. No historical order-line → `ShopifyVariantFact` FK.

## 5. Observation-in-flight contract

`OrderFactObservationInFlight` is a separate order-domain table. It does not
reuse `CatalogObservationInFlight`.

Lifecycle:

- ACTIVE ⇒ `responseGen IS NULL`
- COMPLETED ⇒ `responseGen IS NOT NULL`
- durable failure / incomplete-snapshot evidence columns exist
- request/response generation lineage uses
  `stocky_catalog_observation_gen_seq`
- tenant owned; later B/C/D may use it for pagination/fetch failures

Lease SET uses `clock_timestamp()`. No generation counter was added to `Shop`.

## 6. Lock contract

Version: `stocky-pr6-canonical-lock-v1`

Resource kinds: `Order`, `OrderLine`, `Refund`, `RefundLine`

Encoding: length-prefixed UTF-8 components, SHA-256, signed int32 `key1`/`key2`
from digest bytes 0..7. No JS Number 64-bit lock key.

PR5 catalog lock known-answer vectors remain unchanged.

## 7. Types contract

File: `app/lib/order-facts/types.ts`

Types/interfaces only. No Prisma import, no GraphQL-generated import, no
network I/O, no database I/O, no applicator behavior. `app/types/**` was not
added.

## 8. Local validation

Environment: disposable local PostgreSQL 16 + Redis. No production connection.
Inventory-write flags remain false.

| Check | Result |
| --- | --- |
| `npx prisma validate` | pass |
| `npx prisma generate` | pass (Prisma Client 6.19.3) |
| `npm run lint` | pass |
| `npm run typecheck` | pass |
| `npx vitest run app/lib/order-facts` | 17 passed |
| `npx vitest run app/lib/catalog-facts/lock-key.test.ts` | 5 passed |
| `npm test` | 385 passed; 5 failed on gitignored `app/types/admin-2026-07.schema.json` absence (PO-11 carry-forward; CI generates this file first) |
| `npm run test:migrations -- scripts/tenant-enforcement/tests/pr6-a-order-fact-foundation.test.ts` | 18 passed (after SELECT-only Shop grant correction) |
| `npm run test:sync-uninstall` | 8 passed |
| `npx vitest run --config vitest.sync-integration.config.ts app/sync/__tests__/sync-control-plane.integration.test.ts` | 17 passed |
| `npm run test:sync-role-isolation` | 9 passed |
| sequence-privilege tests | 2 passed |
| tenant-db + unique-selector tests | 24 passed |
| db-isolation `isolation.test.ts` | 14 passed |
| tenant:access:audit | 0 violations; 35 models covered |
| tenant:enforcement:preflight | merchantTableCount 35; compositeFkCount 19 |
| tenant-expansion.migration.test.ts | 7 passed |
| definition-drift + exact-privilege-complete-matrix | 38 passed |
| schema-drift.migration.test.ts | 3 passed |
| architecture-audit.test.ts | 25 passed |
| `npm run build` | pass |
| `git diff --check` | pass |

Exact-head GitHub Actions `pull_request` CI is the authoritative automatic
evidence after this branch is pushed. This file does not invent a CI run ID
or this commit’s own SHA. Independent review must use the live PR head and
exact-head Classify / Heavy / CI Gate jobs.

First exact-head run `34074356984` on `368e46454331e3cea3130e9d532aea8e347b4cb3`
failed Heavy step “Sync control-plane integration tests” (8 failures): Prisma
`tx.shop.update()` in `app/sync/uninstall.server.ts` returned PostgreSQL
`42501 permission denied for table Shop`. Cause: F-PR4-06 column-level Shop
grants did not yet SELECT the new PR6-A columns, so `UPDATE … RETURNING *`
failed. Correction: SELECT-only grants for `ianaTimezone` / `currencyCode`;
UPDATE remains denied. Control-plane lifecycle UPDATE columns are unchanged.
No later push is intended after the corrected exact-head run is green.

## 8a. Files in the implementation commit

Runtime / schema / enforcement:

- `stocky-plus/prisma/schema.prisma`
- `stocky-plus/prisma/migrations/20260907010000_pr6_a_order_refund_fact_foundation/migration.sql`
- `stocky-plus/app/lib/order-facts/constants.ts`
- `stocky-plus/app/lib/order-facts/lock-key.ts`
- `stocky-plus/app/lib/order-facts/advisory-lock.ts`
- `stocky-plus/app/lib/order-facts/types.ts`
- `stocky-plus/app/lib/order-facts/lock-key.test.ts`
- `stocky-plus/app/lib/order-facts/types.test.ts`
- `stocky-plus/app/lib/order-facts/foundation-safety.test.ts`
- `stocky-plus/scripts/tenant-enforcement/manifest.ts`
- `stocky-plus/scripts/tenant-enforcement/roles.ts`
- `stocky-plus/scripts/sync-control-plane/roles.ts`
- `stocky-plus/scripts/sync-control-plane/tests/sync-role-isolation.test.ts`
- `stocky-plus/scripts/tenant-enforcement/tests/pr6-a-order-fact-foundation.test.ts`
- `stocky-plus/scripts/tenant-backfill/tests/tenant-expansion.migration.test.ts`
- `stocky-plus/app/tenant/models.ts`
- `stocky-plus/app/tenant/selectors.ts`
- `stocky-plus/app/tenant/relations.ts`
- `stocky-plus/app/tenant/legacy-scope.ts`
- `stocky-plus/app/tenant/tenant-db.server.ts`
- `stocky-plus/app/tenant/__tests__/tenant-db.test.ts`
- `stocky-plus/app/tenant/__tests__/db-isolation/isolation.test.ts`
- `stocky-plus/app/tenant/__tests__/top-level-unique-selectors.test.ts`
- `stocky-plus/scripts/tenant-access/allowlist.ts`
- `stocky-plus/scripts/tenant-access/architecture-audit.test.ts`
- `stocky-plus/docs/phases/phase-1/PR2_TENANT_ACCESS_INVENTORY.md`
- `stocky-plus/docs/phases/phase-1/PR3_DATABASE_ENFORCEMENT_INVENTORY.md`

Navigation / this report:

- `stocky-plus/docs/README.md`
- `stocky-plus/docs/phases/phase-1/README.md`
- `stocky-plus/docs/phases/phase-1/PR6_A_FOUNDATION_IMPLEMENTATION_REPORT.md`

Authority/control records (`PROJECT_STATUS.md`, `DECISIONS.md`, `RISK_REGISTER.md`,
and the PR6-A authorization rows in `phases/phase-1/README.md`) live in the
separate first commit `ea5830b159709e207827bc6f03ae55eafa49943b`.

## 9. Risks addressed by PR6-A

Opened as R-166…R-185 from approved plan §21.1. PR6-A addresses foundation
portions of R-166, R-167, R-168, R-169, R-171, R-172, R-173, R-174, R-176,
R-177, R-179, R-181, R-182, R-183, and R-184. Those rows remain OPEN until
independent review and later lanes close them with evidence.

PR6-A does **not** close R-170 (webhook/import), R-175 (C apply races),
R-178 (B Admin reads), R-180 (C money apply), or R-185 (B/C/D review).

## 10. Accepted planning P3s carried forward

- Final planning P3: potential refund-money reconciliation diagnostic noise on
  unsettled/failed transactions — later money/applicator work.
- PO-11 gitignored-codegen provenance note.

Neither required a PR6-A architecture change.

## 11. Explicit non-authorizations

Not implemented and not authorized:

- PR6-B Admin GraphQL / `app/types/**` / webhook/import runtime
- PR6-C canonical applicator
- PR6-D
- GraphQL production documents
- `shopify.app.toml` scope changes
- `read_all_orders` / `write_orders`
- Shopify Admin reads or writes
- inventory writes
- forecasting / ABC/U / buying / replenishment / PO / receiving
- production, deployment, feature-flag enablement
