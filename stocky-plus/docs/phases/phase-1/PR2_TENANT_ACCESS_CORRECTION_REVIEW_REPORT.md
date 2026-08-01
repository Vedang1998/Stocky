# Phase 1 PR 2 — Independent Correction Review Report

**Reviewer:** Claude Code (independent)
**Correction implementation owner:** Cursor
**Final technical acceptance authority:** ChatGPT

---

## 1. Review identity

| Field | Value |
|---|---|
| Pull request | [#13](https://github.com/Vedang1998/Stocky/pull/13) — Phase 1 PR 2, tenant-bound access conversion |
| Authorized base SHA | `04289d61f605414597ac85f47830a3c9d2f9e33d` (verified `= origin/main`) |
| Original independently reviewed head | `6f9ca22c069a46003b6944ff56c888ff91e95cdc` |
| Original verdict | `NOT READY — CORRECTIONS REQUIRED` |
| **Exact corrected head reviewed** | **`e6a9a06a8a399bbfb17687399c59582f1712f442`** |
| Correction range | `6f9ca22..e6a9a06` — 11 commits, merge-base = `6f9ca22` (no rebase, no rewritten history) |
| Branch | `phase-1/tenant-access` |
| Checkout state | Detached at `e6a9a06…`; `git status --porcelain` empty before, during (after each probe removal) and after review |
| OS | macOS 26.4.1 (Darwin 25.4.0, arm64) |
| Node | v22.19.0 (satisfies `engines.node` `>=20.19 <22 \|\| >=22.12`) |
| npm | 11.5.2 (exact `engines.npm`) |
| PostgreSQL | 16.14 (Debian 16.14-1.pgdg13+1, aarch64) — disposable Docker container, test credentials |
| Redis | 7.4.10 — disposable Docker container |
| Container runtime | Docker Engine 29.6.2 |
| Review date | 2026-08-01 |
| Implementation code modified | **No** |
| Merchant / production data used | **No** |

### Clean-checkout evidence

```text
$ git rev-parse origin/main
04289d61f605414597ac85f47830a3c9d2f9e33d
$ git rev-parse origin/phase-1/tenant-access
e6a9a06a8a399bbfb17687399c59582f1712f442
$ git checkout --detach e6a9a06a8a399bbfb17687399c59582f1712f442
HEAD is now at e6a9a06 Clarify PR 2 correction exact-head bookkeeping in report
$ git rev-parse HEAD
e6a9a06a8a399bbfb17687399c59582f1712f442
$ git status --porcelain
(empty)
```

### Correction ancestry

```text
$ git merge-base 6f9ca22… e6a9a06…      → 6f9ca22c069a46003b6944ff56c888ff91e95cdc
$ git rev-list --count 6f9ca22..e6a9a06 → 11
$ git merge-base --is-ancestor 6f9ca22 e6a9a06 → true
$ git merge-base --is-ancestor 04289d6 e6a9a06 → true
```

| # | SHA | Subject |
|---|---|---|
| 1 | `1db2ce5` | Record independent PR 2 review and correction backlog |
| 2 | `9863468` | Support nullable tenant ownership compatibility |
| 3 | `ad94773` | Enforce tenant scope on nested relations and writes |
| 4 | `f76df41` | Authenticate tenant job envelopes |
| 5 | `6ae5967` | Harden tenant access architecture checks |
| 6 | `69c05ed` | Expand tenant authority and isolation tests |
| 7 | `45d9d90` | Record PR 2 correction implementation |
| 8 | `4f5d8ea` | Record exact PR 2 correction head in implementation report |
| 9 | `20659dd` | Remove accidental Redis dump.rdb from correction branch |
| 10 | `f9af302` | Sync correction evidence to exact head after dump.rdb removal |
| 11 | `e6a9a06` | Clarify PR 2 correction exact-head bookkeeping in report |

All eleven expected SHAs are present and in the expected order. The original implementation history is intact; no correction commit precedes the reviewed head; no unrelated phase was mixed in. Correction diff: 63 files, +4,959 / −720.

---

## 2. Executive verdict

# `NOT READY — FURTHER CORRECTIONS REQUIRED`

Three P1 cross-tenant nested-write bypasses were **independently reproduced** on the exact corrected head against real PostgreSQL 16. F-PR2-05 is **not closed**. F-PR2-01, F-PR2-02, F-PR2-04 and F-PR2-06 are only partially closed and each carries a demonstrated product regression or bypass. F-PR2-03 is genuinely closed.

The correction work is substantial and much of it is correct — reads, `_count`, nested `where`, relation pagination, top-level `updateMany`/`deleteMany`, child lineage, envelope authentication and client-hint coverage all behave correctly under adversarial probing. But the nested-write boundary can still be driven across tenants with ordinary Prisma syntax, and that is an unconditional acceptance blocker under §10 of the review standard ("Any demonstrated cross-tenant nested mutation is a P1 acceptance blocker").

| Severity | Count |
|---|---|
| P0 | 0 |
| P1 | 3 |
| P2 | 5 |
| P3 | 3 |

No `READY` verdict is possible: three P1s and five P2s remain open.

---

## 3. Original finding disposition

| Finding | Sev | Status | Basis |
|---|---|---|---|
| F-PR2-01 Nullable ownership compatibility | P1 | **Partially closed** | Disjunction implemented and verified for canonical rows; child parent-lineage scope correct; no silent repair. **But** the legacy `shop` column is compared by exact SQL equality, not normalized — F-PR2C-04, reproduced (N-1/N-2/N-3). |
| F-PR2-02 Recursive relation isolation | P1 | **Partially closed** | Relation metadata is complete against the Prisma schema; `include`/`select`/`_count`/nested `where`/pagination/ordering all scope correctly and reject attacker-supplied foreign filters (N-4, N-5, P-11). **But** post-load validation rejects legitimate partial selects — F-PR2C-05, reproduced (P-5, P-6). |
| F-PR2-03 Signed envelope integrity | P1 | **Closed** | HMAC-SHA256 over deterministic serialization of every unsigned field; dedicated ≥32-byte secret with missing/weak fail-closed; `timingSafeEqual` with length guard; exact schema version; closed source allowlist; source/job compatibility; `issuedAt` parse + 5-min skew + 24-h age; verification strictly before canonical `Shop` lookup and before authority issuance; producers accept branded `TenantAuthority` only. 25 committed tamper tests pass; independent tamper probes confirm (P-15). One documented residual (§8). |
| F-PR2-04 Scanner and inventory enforcement | P2 | **Partially closed** | Compiler-API scanner, exact-file allowlists with owner/reason/expiry, deterministic content digest, deterministic inventory (regeneration produced a zero-byte diff). **But** the scanner matches literal source text and does not follow derived values — the review prompt's own named probe forms are undetected: F-PR2C-07 (B-1, B-2, B-3, B-5, B-6, B-9 vs control B-8). |
| F-PR2-05 Nested write ownership | P2 → **P1** | **OPEN** | Three independently reproduced cross-tenant nested mutations: F-PR2C-01, F-PR2C-02, F-PR2C-03. Severity raised from P2 to P1 per the review standard. |
| F-PR2-06 Client-hint conflict detection | P2 | **Partially closed** | Coverage is genuinely comprehensive — duplicate query values, all five headers, route params, nested JSON, arrays, form and bracket-form fields, multipart, depth/node/string limits, fail-closed on hint keys with nested structures; matching hints never establish authority (P-13, R-6). **But** the node budget denies ordinary business payloads — F-PR2C-08 (R-5, P-12). |
| F-PR2-07 Webhook `createIfMissing` | P3 | **Closed (documented residual)** | `resolveWebhookTenant` passes `createIfMissing: false`; Shopify redelivery documented as the install-race mitigation; no provenance schema added. |
| F-PR2-08 R-039 wording | P3 | **Closed** | R-039 now separates PR 2 transport authentication/integrity from PR 4 persistence/replay/dead-letter/durable idempotency, and states explicitly that version/shape/Shop matching is *not* integrity validation. |
| F-PR2-09 Tool versions | P3 | **Closed** | `.env.example` and `phases/phase-1/README.md` document Node via `engines` and npm exactly `11.5.2`; CI pins and asserts. Verified locally: Node v22.19.0, npm 11.5.2. |

---

## 4. New findings

### F-PR2C-01 — P1 — Nested `connect` / `set` / `disconnect` / `delete` accept compound and alternate unique selectors without any ownership check

**File / line:** `stocky-plus/app/tenant/tenant-db.server.ts:422-433` (`extractConnectIds`), consumed at `:490-497` (`connect`), `:498-505` (`set`), `:506-513` (`disconnect`), `:619-626` (`delete`).

**Original finding affected:** F-PR2-05 / C-05.

**Root cause:** `extractConnectIds` returns `[value.id]` only when `value.id` is a string, and `[]` otherwise. Every ownership check downstream is `assertRowIdsOwned(...)`, which returns immediately when the id list is empty (`:406`). A Prisma unique selector that is not `id` therefore produces **zero** validation, and the raw selector is passed to Prisma unchanged. The schema exposes such selectors on every relevant target: `Supplier @@unique([shopId, id])`, `PurchaseOrder @@unique([shopId, id])`, `TransferOrder @@unique([shopId, id])`, `Stocktake @@unique([shopId, id])`, `SupplierSkuMapping @@unique([supplierId, shopifyVariantId])`, `LeadTimeSnapshot.purchaseOrderId @unique`.

`rejectForeignShopId` does not compensate: it recurses into `create` / `createMany` / `connectOrCreate.create` but never into `connect` (`:183-202`), and the foreign `shopId` is nested one level deeper inside the compound-key object.

**Reproduction** (real PostgreSQL 16, two seeded shops, `db` = TenantDb for Shop A):

```ts
// (a) steal a foreign tenant's child row
await dbA.supplier.create({ data: { name: "A-new", skuMappings: { connect: {
  supplierId_shopifyVariantId: { supplierId: SUPPLIER_B_ID, shopifyVariantId: "gid://v/777" },
} } } });

// (b) attach an own PurchaseOrder to a foreign supplier
await dbA.purchaseOrder.create({ data: { locationId: "loc-1",
  supplier: { connect: { shopId_id: { shopId: SHOP_B_ID, id: SUPPLIER_B_ID } } } } });

// (c) inject a line item into a foreign TransferOrder
await dbA.transferLineItem.create({ data: { shopifyVariantId: "gid://v/1", quantity: 5,
  transferOrder: { connect: { shopId_id: { shopId: SHOP_B_ID, id: TRANSFER_B_ID } } } } });

// (d) inject a line item into a foreign Stocktake
await dbA.stocktakeLineItem.create({ data: { shopifyVariantId: "gid://v/1", expectedQty: 3,
  stocktake: { connect: { shopId_id: { shopId: SHOP_B_ID, id: STOCKTAKE_B_ID } } } } });
```

**Actual behavior:**

```text
P1c-RESULT throw= NO-THROW | foreignMapping.supplierId= MOVED-TO-A | shopId= B
P2c-RESULT throw= NO-THROW | created PO shopId= A | PO.supplierId= FOREIGN-B
S2-RESULT  throw= NO-THROW | lines injected into foreign transfer order= 1
S3-RESULT  throw= NO-THROW | lines injected into foreign stocktake= 1
S4-RESULT  victim B skuMappings before= 1 after= 0
```

The control case using a plain `id` is correctly rejected — `P2d-RESULT throw= Parent Supplier … is not owned by the current tenant` — which isolates the selector shape as the sole cause.

**Expected behavior:** every relation-target selector, regardless of shape (`id`, compound `@@unique`, alternate single-field `@unique`, aliased, array element), must be resolved through a tenant-scoped lookup before the mutation reaches Prisma; unresolvable or foreign targets must fail closed.

**Merchant impact:** an authenticated merchant can re-parent another merchant's supplier SKU mappings, lead-time snapshots and volume tiers into its own records (silent data loss for the victim, verified: victim's mapping count 1 → 0), and can inject purchase-order / transfer / stocktake line items into another merchant's operational documents. Line items drive receiving, landed cost and inventory-write paths, so this is a purchasing- and inventory-integrity break in a foreign tenant, not merely a read exposure.

**Required correction:** replace `extractConnectIds` with a selector resolver that, for each relation target, performs a tenant-scoped `findFirst` on the supplied selector (normalizing compound-key wrappers and arrays), asserts exactly one owned row, and rewrites the outgoing selector to the resolved `id`. Reject any selector shape the resolver does not understand.

**Required regression test:** for every relation in `app/tenant/relations.ts` and every nested op in `RELATION_WRITE_OPS`, assert rejection for compound-unique, alternate-unique, array-of-compound and mixed own/foreign selector arrays — driven through `create` and `upsert`, not only `update`.

**Blocks acceptance: yes.**

---

### F-PR2C-02 — P1 — `connectOrCreate.where` matching a foreign row is treated as "not found → create", then Prisma connects the foreign row

**File / line:** `stocky-plus/app/tenant/tenant-db.server.ts:514-536`, specifically:

```ts
const existing = await getDelegate(client, rel.targetModel).findFirst({
  where: mergeWhere(item.where, tenantScopeWhere(rel.targetModel, authority)),
  select: { id: true },
});
if (!existing) {
  // create branch — inject ownership later; where miss is OK for create
}
```

**Original finding affected:** F-PR2-05 / C-05. This is the exact hazard named in §10 of the review instructions.

**Root cause:** the tenant-scoped precheck miss is discarded. Prisma then evaluates the caller's **unscoped** `where`, which does match the foreign row, and takes the connect branch.

**Reproduction:**

```ts
// Shop B owns leadTimeSnapshot{ purchaseOrderId: PO_B_ID }
await dbA.supplier.create({ data: { name: "A-coc", leadTimeSnapshots: { connectOrCreate: {
  where:  { purchaseOrderId: PO_B_ID },      // tenant-scoped precheck misses
  create: { purchaseOrderId: PO_A_ID, leadTimeDays: 1 },  // own parent → passes ownership check
} } } });
```

**Actual behavior:** `S1-RESULT throw= NO-THROW | foreignSnapshot.supplierId= MOVED-TO-A | snapshotCount= 1`. The count stays at 1, proving the foreign row was **connected**, not created.

**Expected behavior:** when the tenant-scoped precheck finds nothing, the contract must prove that no globally-matching row exists before allowing Prisma's unscoped `connectOrCreate`; otherwise fail closed.

**Merchant impact:** silent theft of a foreign merchant's lead-time history (and any other globally-unique child); the victim loses the record from its own supplier.

**Required correction:** after a tenant-scoped miss, perform an unscoped existence check on the same selector. If a row exists, fail closed (`foreign_relation_target`). Only when no row exists at all may the create branch proceed. Alternatively, resolve the selector first and rewrite `connectOrCreate` into an explicit `connect` or `create`.

**Required regression test:** for each relation with a non-`id` unique, assert `foreign_relation_target` when the `where` matches a foreign row and the `create` branch is otherwise valid.

**Blocks acceptance: yes.**

---

### F-PR2C-03 — P1 — Array-form nested `updateMany` / `deleteMany` bypass tenant scope injection and `shopId` immutability

**File / line:** `stocky-plus/app/tenant/tenant-db.server.ts:609-618` (`updateMany`), `:627-632` (`deleteMany`).

Both branches are guarded by `isPlainObject(value.updateMany)` / `isPlainObject(value.deleteMany)`. Prisma accepts both `Op | Op[]` for these nested operations. When an array is supplied the guard is false, so the branch is skipped entirely: no `mergeWhere(..., tenantScopeWhere(...))`, and for `updateMany` no `scrubUpdateData`. The op-name allowlist at `:462-488` still passes, because it only checks the key, not the value shape.

**Original finding affected:** F-PR2-05 / C-05 ("array forms" in §10).

**Reproduction:**

```ts
// (a) re-tenant your own child rows into another shop
await dbA.supplier.upsert({
  where:  { shopId_id: { shopId: SHOP_A_ID, id: SUPPLIER_A_ID } },
  create: { name: "ignored" },
  update: { skuMappings: { updateMany: [{ where: {}, data: { shopId: SHOP_B_ID } }] } },
});

// (b) delete a child row you are not allowed to read
await dbA.supplier.upsert({
  where:  { shopId_id: { shopId: SHOP_A_ID, id: SUPPLIER_A_ID } },
  create: { name: "ignored" },
  update: { skuMappings: { deleteMany: [{ shopId: SHOP_B_ID }] } },
});
```

**Actual behavior:**

```text
P4c-RESULT throw= NO-THROW | myMapping.shopId= MOVED-TO-B
P10-RESULT throw= NO-THROW | foreign-owned child under A parent still present= false
```

The object form is correctly rejected — `P4d-RESULT throw= Explicit foreign shopId rejected at SupplierSkuMapping.update` — which isolates the array shape as the sole cause.

**Expected behavior:** array and object forms must be handled identically; every element must receive scope injection and update-data scrubbing.

**Merchant impact:** (a) a merchant can push its own rows into another tenant's ownership, breaking the immutability guarantee R-037 depends on and corrupting the backfill/reconciliation baseline; (b) a merchant can delete rows it is denied read access to. Both are silent.

**Required correction:** normalize `updateMany` / `deleteMany` (and every other nested op) to an array before processing, and apply the same scoping and scrubbing to each element. Add a defensive default that rejects any nested-op value whose runtime shape is not explicitly handled.

**Required regression test:** array-form `updateMany`, `deleteMany`, `update`, `delete`, `connect`, `set`, `disconnect`, `connectOrCreate` — each asserted to fail closed on foreign targets and to reject `shopId` / `shop` mutation.

**Blocks acceptance: yes.**

---

### F-PR2C-04 — P2 — Direct-model scope compares the legacy `shop` column by exact SQL equality, not normalized; affected rows are permanently invisible and unrepairable

**File / line:** `stocky-plus/app/tenant/tenant-db.server.ts:71-87` (`directTenantScopeWhere`), `:872-890` (`rowOwnershipOk`), `:256-278` (`scrubUpdateData`).

**Original finding affected:** F-PR2-01 / C-01 — the approved requirement is to compare the **normalized** legacy shop.

**Evidence that non-canonical values are possible:** `scripts/tenant-backfill/engine.ts:1498` shows the PR 1 backfill only ever executes `UPDATE "<table>" SET "shopId" = $1 …`. It never rewrites the legacy `shop` string column. `app/tenant/shop-domain.ts` (`phase1-shop-domain-v1`) trims and lowercases, so `"SHOP-A.myshopify.com"` and `"shop-a.myshopify.com "` are the *same tenant* under the approved normalization while being different SQL values.

**Reproduction:** seed six `Supplier` rows for Shop A — canonical / uppercase / trailing-space legacy `shop`, each with and without `shopId` — then `db.supplier.findMany({})`:

```text
N1-RESULT visible= ["canonical + null shopId","canonical + shopId"] | totalSeeded= 6
```

Four of six rows are invisible, **including two rows carrying the correct canonical `shopId`**. Because the first disjunct is `shopId = tenant AND shop = domain`, running the PR 1 backfill does not help:

```text
N2-RESULT after simulated backfill visible rows= 0
N3-RESULT blank legacy shop visible= 0
```

And `scrubUpdateData` (`:271-276`) throws `shop_domain_immutable` on any attempt to repair the column through the tenant contract, so the state is unrecoverable from inside the application.

**Expected behavior:** compare the normalized legacy shop, or state explicitly (with repository evidence) that every legacy value is already canonical and enforce that with a check. `shopId = tenant` should be sufficient on its own once ownership has been assigned — requiring the legacy string to also match exactly makes the backfill ineffective for these rows.

**Merchant impact:** merchant data silently disappears from the UI after the PR 2 conversion and stays gone after the operational backfill. This is precisely the F-PR2-01 defect class (invisible PR 1 rows), reintroduced through a different mechanism.

**Required correction:** either (a) make the second predicate a normalized comparison (e.g. a generated/normalized column or `lower(btrim(shop))`, with a matching compatibility index), or (b) drop the legacy-`shop` conjunct from the *first* disjunct so a canonical `shopId` alone authorizes, keeping the legacy comparison only for the `shopId IS NULL` compatibility branch — and document which was chosen.

**Required regression test:** the ten-case direct-model matrix from §6 of the review instructions, explicitly including "uppercase but normalizable", "whitespace but normalizable", and "canonical `shopId` with semantically equivalent non-canonical legacy domain" — asserting **visibility**, not just denial.

**Blocks acceptance: yes** (mandatory P2 on an unclosed P1 finding).

---

### F-PR2C-05 — P2 — Post-load ownership validation rejects legitimate partial selects

**File / line:** `stocky-plus/app/tenant/tenant-db.server.ts:872-890` (`rowOwnershipOk`), `:932-939` (to-one proof requirement), reached from `:892-960`.

**Original finding affected:** F-PR2-02 / C-02 — §7 of the review instructions requires that a legitimate query selecting a to-one relation without its `id` "must not produce an avoidable product regression", and that the contract either inject the proof field safely or deny the shape deliberately and document it. Neither was done: the query executes and then throws a `foreign_relation_row` error that misdescribes owned data as foreign.

**Root cause:** `rowOwnershipOk` reads `row.shop` / `row.shopId` from the returned object. When the caller's nested `select` omits those columns they are `undefined`, and for direct-model targets `shop !== authority.myshopifyDomain` is true, so a correctly scoped, correctly owned row is reported as foreign. Separately, to-one validation hard-requires `typeof value.id === "string"`.

**Reproduction:**

```ts
await dbA.purchaseOrder.findMany({ select: { id: true, supplier: { select: { name: true } } } });
await dbA.supplier.findMany({ select: { id: true, purchaseOrders: { select: { id: true } } } });
```

**Actual behavior:**

```text
P-5 threw= To-one relation PurchaseOrder.supplier missing id for ownership proof
P-6 threw= Relation Supplier.purchaseOrders returned a foreign or ambiguous row
```

Controls confirm the trigger is the partial selection, not the data: `R7 include supplier:true → NO-THROW`, `R8 include purchaseOrders:true → NO-THROW`, `R9 select { id, name } → NO-THROW`.

**Expected behavior:** inject the proof fields (`id`, and `shop`/`shopId` for direct targets) into nested selections and strip them from the result before returning, or reject the shape deliberately at query-construction time with a clear, documented error.

**Merchant impact:** any future route that uses a narrow nested `select` — the normal way to avoid over-fetching — fails at runtime with a message that falsely implies a tenant-isolation violation. Current routes happen to use full-row includes, so this is latent today, but it makes the contract unsafe to build on and would be diagnosed as a security incident rather than a bug.

**Required correction:** inject proof fields into `scopeRelationObject` for both cardinalities, and track injected keys so they can be removed from the returned object.

**Required regression test:** nested `select` without `id`, without `shopId`, without `shop`, and combinations thereof, for one to-one and one to-many relation of each of a direct and a child target model.

**Blocks acceptance: yes.**

---

### F-PR2C-06 — P2 — `TenantDb.update()` cannot perform nested relation writes and silently drops `include` / `select`

**File / line:** `stocky-plus/app/tenant/tenant-db.server.ts:1048-1076` (`rewriteUniqueWrite`, `update` branch).

The update path resolves the row and then calls `delegate.updateMany({ where, data })`. Prisma's `updateMany` accepts scalar data only, and its args carry no `select` / `include`. Consequences:

1. Every nested relation write submitted through `db.X.update()` fails with a raw Prisma validation error rather than a `TenantAccessError`.
2. The `include` / `select` supplied by the caller is discarded; the re-read at `:1071` uses no projection, so relations the caller asked for are simply absent from the returned object — with no error.
3. The C-05 nested-write validation performed at `:1054` is unreachable in practice through `db.X.update()`, so the mandatory nested-write correction is only exercised through `create` / `upsert` / `updateMany`.

**Reproduction / actual behavior:**

```text
Q0-RESULT  update + nested create → throw= Invalid `delegate.updateMany()` invocation … | rows= 0
Q0b-RESULT update include skuMappings → keys= ["id","shop","shopId","name",…] | hasSkuMappings= false
```

**Expected behavior:** either route validated updates through `delegate.update` with a tenant-bearing selector (the schema provides `@@unique([shopId, id])` on all four parent models for exactly this purpose), or reject nested relation writes and unsupported projections explicitly as `TenantAccessError` and document the limitation.

**Merchant impact:** callers relying on Prisma's documented `update` contract get silently incomplete data (item 2 is the dangerous one — no error is raised). Combined with item 3, the reported nested-write test coverage overstates what is actually enforced on the update path.

**Required correction:** use `delegate.update({ where: { shopId_id: { shopId, id } }, data, select/include })` after the ownership precheck for the four models that expose the composite unique, and fail closed with a typed error where a tenant-bearing unique is unavailable.

**Required regression test:** `update` with `include`, with `select`, and with each nested relation op — asserting the projection is honoured and that unsupported shapes raise `TenantAccessError`.

**Blocks acceptance: yes.**

---

### F-PR2C-07 — P2 — Architecture scanner matches literal source text and does not follow derived values

**File / line:** `stocky-plus/scripts/tenant-access/scan.ts:525-561` (dynamic import), `:388-398` (delegate calls), `:502-523` (`issueTenantAuthority`), `:653-711` (queue payload / envelope producer).

**Original finding affected:** F-PR2-04 / C-04, which required detection of "dynamic imports, re-export chains, aliases, computed/aliased delegates, destructuring".

**Reproduction:** each source below was written into a scratch tree and passed to `scanRepository({ roots, pathRoot, checkAllowlistPaths: false })`.

| Probe | Source | Violations |
|---|---|---|
| B-1 | `const spec = "../" + "db.server"; const db = (await import(spec)).default; db.supplier.findMany(…)` | **`[]`** |
| B-2 | `` const db = (await import(`../${seg}.server`)).default; db.purchaseOrder.findMany(…) `` | **`[]`** |
| B-3 | dynamic import + `const { supplier: table } = client; table.findMany({})` | **`[]`** |
| B-5 | `queue.server.ts`: `export async function enqueueAnything(envelope: TenantJobEnvelopeV1)` forwarding to `q.add` | **`[]`** |
| B-6 | `import { issueTenantAuthority as mint } from …; mint({…})` outside `app/tenant/` | **`[]`** |
| B-9 | `const key = "sh"+"op"; queue.add("sync", { [key]: domain, payload: {} })` | **`[]`** |
| B-4 | `createRequire(import.meta.url)("../db.server").default.supplier.findMany()` | `["merchant_delegate_call"]` |
| B-7 | re-export module + consumer | `["…b7.ts:merchant_delegate_call","…data-client.ts:db_server_reexport"]` |
| **B-8 (control)** | identical to B-1 but with a **literal** specifier | `["db_server_dynamic_import","merchant_delegate_call"]` |

B-1 is verbatim the bypass named in §9 of the review instructions. B-8 proves the gap is the derived specifier, not the probe harness. Worse, in B-1 the delegate call `db.supplier.findMany(…)` is not merely missed — the receiver-name heuristic at `:397-404` classifies it as `conversionStatus: "converted"`, i.e. the scanner affirmatively reports raw-Prisma access as tenant-bound.

**Expected behavior:** the scanner should resolve constant-initialised identifiers and binary/template concatenations for import specifiers and delegate keys, track destructured bindings from a raw-client value, treat any parameter typed as `TenantJobEnvelopeV1` on a producer as an arbitrary-envelope input, and match aliased imports of `issueTenantAuthority` by resolving the local binding rather than the identifier text.

**Merchant impact:** none directly — the scanner is a guardrail, not the enforcement — but it is the mechanism that keeps the enforcement boundary from eroding, and C-04 made these categories mandatory.

**Required correction:** constant-folding for string-literal-initialised locals; binding resolution for import aliases and destructuring; producer-parameter type check independent of union syntax; computed-key folding for queue payload objects.

**Required regression test:** committed negative fixtures for B-1, B-2, B-3, B-5, B-6 and B-9.

**Blocks acceptance: yes** (mandatory P2 correction not fully delivered).

---

### F-PR2C-08 — P2 — Client-hint traversal node budget denies ordinary business payloads

**File / line:** `stocky-plus/app/tenant/client-shop.server.ts:24` (`MAX_NODES = 200`), `:60-118` (`walkJson`), `:106-112` (fail-closed on hint key with nested value).

**Original finding affected:** F-PR2-06 / C-06 — §11 of the review instructions requires confirming that bounded traversal "does not create an easy denial of service for ordinary large business payloads unrelated to tenant identity".

**Reproduction:** JSON body `{ intent: "create", lines: [ { variantId, qty, unitCost } × N ] }` with **no shop-hint keys anywhere**, passed to `denyConflictingClientShop`:

```text
R5-RESULT lines=20 => ok
R5-RESULT lines=40 => ok
R5-RESULT lines=49 => ok
R5-RESULT lines=50 => DENIED
R5-RESULT lines=60 => DENIED
P12-RESULT 60-line PO JSON body throw= Client shop-hint inspection exceeded maximum node count
```

A 50-line purchase order is a small order for this product. The equivalent flat urlencoded form with 120 fields passes (`P12b → NO-THROW`), so the cliff is object nesting, not payload size as such. Separately, an ordinary payload with a business object named `shop` is rejected outright:

```text
R6-RESULT {"shop":{"name":"My Store","plan":"basic"}} → Recognized shop-hint key shop has a nested structure that exceeds safe inspection
```

**Expected behavior:** the traversal budget must be sized for real inventory payloads (bulk PO lines, stocktake counts, transfer lines), or the traversal must degrade to a bounded key-scan rather than denying the request. Fail-closed is correct for *ambiguous tenant identity*; it is not correct for a payload that contains no tenant identifier at all.

**Merchant impact:** authenticated merchants are denied on ordinary large submissions with a tenant-authority error. Because the same helper runs on every `requireAdminTenant` call, this bounds every future JSON API in the product at ~49 nested objects.

**Required correction:** raise `MAX_NODES` to a value justified against the largest approved payload (bulk stocktake and buying-table submissions), make the limit configurable, and consider recording an "inspection truncated" outcome that still denies only on an *observed* conflicting hint. For the nested-object-under-hint-key case, deny only when the nested structure actually yields a conflicting string.

**Required regression test:** representative maximum-size buying-table, stocktake and transfer payloads asserted to pass; a payload with a conflicting hint at the far end of a large body asserted to be denied.

**Blocks acceptance: yes.**

---

### F-PR2C-09 — P3 — Ownership precheck and mutation are not atomic

**File / line:** `stocky-plus/app/tenant/tenant-db.server.ts:331-352` (`assertParentIdOwned`), `:400-420` (`assertRowIdsOwned`), invoked from `runScopedOperation` (`:1198-1232`) outside any transaction.

**Reproduction:** start `db.supplierSkuMapping.create({ data: { supplierId: SUPPLIER_A_ID, … } })`, re-tenant `SUPPLIER_A` to Shop B concurrently, then await.

**Actual behavior:** `R10-RESULT throw= NO-THROW | child rows created= 1` — the child was written under a parent that is no longer same-tenant.

**Expected behavior:** the precheck and the mutation should share a transaction so the window is closed at application level, ahead of the PR 3 database enforcement that closes it properly.

**Merchant impact:** narrow — requires a concurrent ownership change, which today only the backfill performs. Recorded as a mitigable residual rather than a blocker.

**Required correction:** wrap precheck + mutation in `client.$transaction` when the incoming client is not already a transaction client. This is achievable inside the existing `$transaction` contract and does not require PR 3.

**Required regression test:** the interleaving above, asserting `foreign_parent`.

**Blocks acceptance: no.**

---

### F-PR2C-10 — P3 — Correction evidence overstates closure; one audit test is tautological; exact head left as a placeholder

**Files / lines:**

* `docs/phases/phase-1/PR2_TENANT_ACCESS_CORRECTION_IMPLEMENTATION_REPORT.md:19` — `| Final exact head |  (pre-finalization; PR body carries tip) |`. The committed artifact does not record the head it describes; chain of custody depends on the mutable PR body.
* Same file, `:26-31` — F-PR2-01 … F-PR2-06 are all marked **"Corrected"**. Per §3 above, F-PR2-05 is open and four others are partial.
* Same file, `:48-50` — "Test evidence … Commands and counts are recorded in the handoff return report", i.e. no counts in the repository artifact.
* `docs/phases/phase-1/PR2_TENANT_ACCESS_ARCHITECTURE.md` ("Relations and nested writes") — "`connect` / `set` / `disconnect` / nested update/delete targets are resolved through tenant-scoped lookups before mutation". Disproved by F-PR2C-01 and F-PR2C-03.
* `scripts/tenant-access/architecture-audit.test.ts:177-196` — the "fails when allowlist contains a directory-wide path" test writes a probe file, never scans it, and then asserts a locally-written `if (badPath.endsWith("/")) throw` block. It exercises the test's own three lines, not the scanner or `assertExactAllowlistShape`. (The production guard at `allowlist.ts:205-220` does work; only the evidence is fake.)

**Required correction:** record the exact head in the committed report; restate dispositions to match verified reality; embed command/count evidence; correct the architecture claim; rewrite the wildcard-allowlist test to assert on `scanRepository` output for an injected directory-path exception.

**Blocks acceptance: no** (but the disposition table must be corrected before ChatGPT relies on it).

---

### F-PR2C-11 — P3 — `exceptionForPath` matches allowlist entries by path suffix

**File / line:** `stocky-plus/scripts/tenant-access/allowlist.ts:222-227` — `normalized === ex.path || normalized.endsWith("/" + ex.path)`.

Any future file whose path ends with an allowlisted suffix (for example a second workspace containing `app/tenant/tenant-db.server.ts` or `app/db.server.ts`) silently inherits that exception, defeating the "exact file" requirement of C-04. The suffix form is used for fixture scans; the production scan should require an exact match.

**Required correction:** exact match for repository scans; pass a fixture-root prefix explicitly where suffix matching is needed.

**Blocks acceptance: no.**

---

## 5. Security matrices

### 5.1 Nullable direct-model rows (`Supplier`, tenant A)

| # | Stored `shopId` | Stored legacy `shop` | Expected | Actual | Verdict |
|---|---|---|---|---|---|
| 1 | A | canonical A | visible | visible | ✅ |
| 2 | `NULL` | canonical A | visible | visible | ✅ |
| 3 | B (foreign) | canonical A | denied | denied | ✅ |
| 4 | A | canonical B | denied | denied | ✅ |
| 5 | `NULL` | canonical B | denied | denied | ✅ |
| 6 | `NULL` | malformed | denied | denied | ✅ |
| 7 | `NULL` | uppercase, normalizable → A | visible | **denied** | ❌ F-PR2C-04 |
| 8 | `NULL` | trailing whitespace, normalizable → A | visible | **denied** | ❌ F-PR2C-04 |
| 9 | A | uppercase / whitespace, normalizable → A | visible | **denied** | ❌ F-PR2C-04 |
| 10 | A | empty string | visible | **denied** | ❌ F-PR2C-04 |

Cases 3–6 confirm the disjunction fails closed exactly as C-01 required. Cases 7–10 are the unclosed half.

### 5.2 Child lineage

| Case | Expected | Actual | Verdict |
|---|---|---|---|
| same-tenant parent + canonical child `shopId` | visible | visible | ✅ |
| same-tenant parent + `NULL` child `shopId` | visible | visible | ✅ |
| same-tenant parent + foreign child `shopId` | denied | denied (excluded from reads and `_count`) | ✅ |
| foreign parent + canonical child `shopId` | denied | denied | ✅ |
| foreign parent + `NULL` child `shopId` | denied | denied | ✅ |
| missing / ambiguous lineage | fail closed | `missing_parent_lineage` | ✅ |
| `LeadTimeSnapshot` secondary `purchaseOrderId` ownership | enforced | enforced (`foreign_parent` on read) | ✅ |
| read / count / update / updateMany / delete / deleteMany | all scoped | all scoped (top-level) | ✅ |
| silent `shopId` / `shop` repair on read or update | never | never (`shop_id_immutable`, `shop_domain_immutable`) | ✅ |

### 5.3 Nested relation reads

| Shape | Expected | Actual | Verdict |
|---|---|---|---|
| Shop A parent + Shop A child | returned | returned | ✅ |
| Shop A parent + `NULL` child with valid lineage | returned | returned | ✅ |
| Shop A parent + Shop B child | excluded | excluded | ✅ |
| Shop A child under Shop B parent | excluded | excluded | ✅ |
| nested `include`, nested-in-nested `include` | scoped | scoped | ✅ |
| nested `select` | scoped | scoped | ✅ |
| `_count` (bare `true` rejected; enumerated scoped) | scoped | scoped — foreign child excluded from count | ✅ |
| relation pagination (`take`) and ordering (`orderBy`) | scoped | scoped | ✅ |
| attacker-supplied nested `where: { shopId: B }` | intersected → empty | empty | ✅ |
| `findUnique` / `findFirst` / `findMany` on foreign id | `null` | `null` | ✅ |
| `create` / `upsert` returning an included relation | validated | validated | ✅ |
| unknown merchant relation in `include` | fail closed | fail closed | ✅ |
| relation metadata vs Prisma schema | complete | complete (14 relations; all 18 models covered) | ✅ |
| to-one nested `select` omitting `id` | must not regress | **throws** | ❌ F-PR2C-05 |
| to-many nested `select` omitting `shop`/`shopId` on a direct target | must not regress | **throws (owned rows reported foreign)** | ❌ F-PR2C-05 |

### 5.4 Nested write selectors

| Operation | `id` selector | Compound `@@unique` | Alternate `@unique` | Array form |
|---|---|---|---|---|
| `connect` | ✅ rejected when foreign | ❌ **unchecked** | ❌ unchecked | ❌ unchecked |
| `connectOrCreate.where` | ✅ rejected when foreign | ⚠️ raw Prisma error (fail-closed, ungraceful) | ❌ **connects foreign row** | ❌ unchecked |
| `set` | ✅ | ❌ unchecked | ❌ unchecked | ❌ unchecked |
| `disconnect` | ✅ | ❌ unchecked | ❌ unchecked | ❌ unchecked |
| `delete` | ✅ | ❌ unchecked | ❌ unchecked | ❌ unchecked |
| `update` | ✅ (id required) | ✅ rejected (`unsafe_nested_update`) | ✅ rejected | ⚠️ handled |
| `updateMany` | n/a | n/a | n/a | ❌ **scope + scrub skipped** |
| `deleteMany` | n/a | n/a | n/a | ❌ **scope skipped** |
| `create` / `createMany` | ✅ ownership injected, parent verified | — | — | ✅ |
| `upsert` (nested) | ✅ rejected in PR 2 | ✅ | ✅ | ✅ |
| unknown nested operation | ✅ `unknown_relation_operation` | — | — | — |
| empty selector | ✅ no-op | — | — | — |
| mixed own/foreign id array | ✅ rejected | ❌ unchecked | ❌ unchecked | ❌ unchecked |
| concurrent ownership change | ❌ race (F-PR2C-09) | — | — | — |

### 5.5 Envelope tampering (24 cases from §8)

| # | Case | Result |
|---|---|---|
| 1 | changed `shopId` | ✅ `envelope_signature_invalid` |
| 2 | changed domain | ✅ `envelope_signature_invalid` |
| 3 | domain re-formatted to normalize identically | ⚠️ **accepted** — signature is computed over the normalized domain; resolves to the same tenant, so no cross-tenant effect. Scheme/path/port/credential forms are rejected by `normalizeShopDomain` (`scheme_present` etc.). Recorded as an accepted residual, §8. |
| 4 | changed source | ✅ rejected |
| 5 | changed correlation id | ✅ rejected |
| 6 | changed causation id | ✅ rejected |
| 7 | removed causation id | ✅ rejected (serialized as `null`, so presence is bound) |
| 8 | changed `issuedAt` | ✅ rejected |
| 9 | invalid timestamp | ✅ `envelope_issued_at_invalid` |
| 10 | future timestamp > 5 min | ✅ `envelope_issued_at_future` |
| 11 | expired > 24 h | ✅ `envelope_expired` |
| 12 | added field | ✅ `envelope_unexpected_field` |
| 13 | removed field | ✅ rejected |
| 14 | missing signature | ✅ `missing_envelope_signature` |
| 15 | invalid signature | ✅ rejected |
| 16 | wrong-length signature | ✅ length guard before `timingSafeEqual` |
| 17 | unknown schema version | ✅ `unknown_envelope_version` |
| 18 | raw shop-only payload | ✅ `missing_envelope` |
| 19 | direct Redis/BullMQ injection | ✅ rejected at worker (`queue-redis.test.ts`, verified against live Redis 7.4.10) |
| 20 | source / job-name mismatch | ✅ `envelope_source_job_mismatch` |
| 21 | webhook-topic / source mismatch | ✅ rejected |
| 22 | retry inside the valid age window | ✅ accepted (transport replay is in scope for PR 4, per R-039) |
| 23 | retry after expiry | ✅ rejected |
| 24 | concurrent jobs for two shops | ✅ isolated |

Ordering verified by reading `resolveTenantJobContext` (`job-envelope.server.ts:381-422`): parse + signature → source/job compatibility → payload-shop cross-check → `requireCanonicalShopMatch` → `issueTenantAuthority` → `createTenantDb`. No merchant query occurs before signature verification. No logging path emits the secret, key material, or full payloads.

**Secret behavior:** missing → `envelope_secret_missing`; `<32` bytes → `envelope_secret_weak`; hex material decoded before length check; module-level cache with `resetTenantJobEnvelopeSecretCache()` for tests. The cache means a secret change requires a process restart — an operational note for future rotation, not a PR 2 defect.

**Producer boundary:** searched for `TenantAuthority | TenantJobEnvelopeV1`, `createTenantJobEnvelope`, `signTenantJobEnvelope`, `getWebhookQueue().add`, `getCronQueue().add`, `new Queue`. All four producers (`enqueueWebhook`, `enqueueCatalogSync`, `enqueueAfterAuthCatalogSync`, `enqueueAbcAnalysisForShop`) call `requireAuthority` → `isTenantAuthority` (WeakSet brand) before building an envelope. No runtime producer accepts or forwards a prebuilt envelope. The scanner would not *catch* one if added (F-PR2C-07/B-5), but none exists.

### 5.6 Client hints

| Vector | Result |
|---|---|
| first query value / duplicate query values / mixed matching+conflicting | ✅ denied (`getAll`) |
| `shop`, `x-shop`, `x-shop-id`, `x-shopify-shop-domain`, `x-myshopify-domain` | ✅ denied |
| top-level JSON / deeply nested JSON / JSON arrays | ✅ denied |
| top-level form fields / bracket-form nested / duplicate form fields / multipart | ✅ denied |
| route parameters (`requireAdminTenant({ request, params })`) | ✅ denied |
| alternate capitalization, key spelling variants (7 recognized keys) | ✅ denied |
| matching hint | ✅ ignored — never establishes authority (authority comes only from `authenticate.admin` + canonical `Shop`) |
| max depth (6) / depth+1 | ✅ pass / fail closed |
| max nodes (200) / nodes+1 | ✅ pass / fail closed — but see F-PR2C-08 |
| max string length (512) / length+1 | ✅ pass / fail closed |
| recognized hint key with nested object | ⚠️ fail closed even for ordinary business data (F-PR2C-08) |
| malformed JSON / unreadable multipart body | ✅ ignored, authority unaffected |
| large unrelated body with no hint keys | ❌ **denied at ≥50 nested objects** (F-PR2C-08) |

### 5.7 Scanner bypasses

See the table in F-PR2C-07. Static import, path alias, namespace import, literal dynamic import, re-export chain, computed delegate key on a statically imported client, raw-SQL alias, maintenance runtime import, bootstrap merchant access, unauthorized `issueTenantAuthority` (unaliased), literal raw shop-only queue payload, union-typed envelope producer, wildcard/directory allowlist, and stale allowlist paths are all detected. Derived-value forms are not.

---

## 6. Execution evidence

All commands run from `stocky-plus/` at `HEAD = e6a9a06a8a399bbfb17687399c59582f1712f442` against disposable PostgreSQL 16.14 and Redis 7.4.10 in Docker with test-only credentials and a test-only envelope secret.

| Command | Exit | Result |
|---|---|---|
| `node --version` | 0 | `v22.19.0` |
| `npm --version` | 0 | `11.5.2` |
| `npm ci` | 0 | clean install |
| `npx prisma generate` | 0 | client generated |
| `npx prisma validate` | 0 | schema valid |
| `npx prisma migrate deploy` | 0 | 5 migrations applied |
| `npm run tenant:indexes:apply -- --apply` | 0 | 28 created, 0 skipped, 0 failed |
| `npm run tenant:indexes:verify` | 0 | `{"ok":true,"mismatches":[]}` |
| `npm run tenant:schema:drift` | 0 | `tenant_prisma_schema_drift_ok` |
| `npm run tenant:indexes:plan` | 0 | `{"valid_exact":28}` |
| `npm run tenant:access:audit` | 0 | `tenant_access_audit_ok`, `modelsCovered: 18` |
| `npm run tenant:access:inventory` | 0 | `findings: 534, violations: 0` |
| `npm run tenant:access:inventory:check` | 0 | `tenant_access_inventory_fresh` |
| — determinism check | — | regeneration produced **zero** working-tree diff (`git status --porcelain` empty) |
| `npm run test:tenant-access` | 0 | **10 files, 116 tests passed** |
| `npm run lint` | 0 | clean |
| `npm run typecheck` | 0 | clean |
| `npm test` | 0 | **6 files, 56 tests passed** |
| `npm run test:migrations` | 0 | **24 files, 106 tests passed** |
| `npm run test:subject-memory` | 0 | **1 file, 2 tests passed** |
| `npm run build` | 0 | built |
| `npm run graphql-codegen` | 0 | 3 outputs generated |
| `git diff --check` | 0 | clean |

### Per-suite counts (run separately)

| Suite | Exit | Tests |
|---|---|---|
| `nullable-ownership` + `tenant-db` + `bootstrap` | 0 | 31 |
| `relation-isolation` | 0 | 10 |
| `job-envelope` | 0 | 25 |
| `queue-redis` | 0 | 4 |
| `client-hints` + `authority` | 0 | 22 |
| `nested-writes` | 0 | 8 |
| `architecture-audit` | 0 | 16 |

### Environment note (not a finding against PR 2)

`scripts/tenant-backfill/tests/helpers.ts:47` hard-codes `GRANT ALL ON SCHEMA public TO stocky`. The migration suite therefore fails with `role "stocky" does not exist` on any database whose owning role is not literally `stocky`. This is pre-existing PR 1 harness code, unchanged in the correction range. The PostgreSQL container was recreated with `POSTGRES_USER=stocky` / `POSTGRES_DB=stocky_plus_ci` to match CI exactly, after which all 106 migration tests and both subject-memory tests pass. Recorded so the environment dependency is explicit; **not** counted as a correction defect.

### Independent adversarial probes

Probes were written to temporary files inside the working tree, executed, and removed. `git status --porcelain` was verified empty after each cycle; no implementation file was modified. Probe identifiers used above: `Q0`, `Q0b`, `P-1c`, `P-2c`, `P-2d`, `P-3c`, `P-4c`, `P-4d`, `P-5`, `P-6`, `P-7`, `P-10`, `P-11`, `P-12`, `P-12b`, `P-13`, `P-15`, `R-1`, `R-2`, `R-3`, `R-4`, `R-5`, `R-6`, `R-7`, `R-8`, `R-9`, `R-10`, `S-1`…`S-5`, `N-1`…`N-6`, `B-1`…`B-9`.

---

## 7. Exact-head CI verification

Independently verified through the GitHub API (`gh api`):

| Field | Value |
|---|---|
| PR | #13, `OPEN`, `draft: true`, `merged: false` |
| Base | `main` @ `04289d61f605414597ac85f47830a3c9d2f9e33d` |
| Head | `phase-1/tenant-access` @ `e6a9a06a8a399bbfb17687399c59582f1712f442` |
| Commits / changed files | 17 / 92 (+9,698 / −627) |
| Mergeability | `MERGEABLE`, `mergeStateStatus: CLEAN` |
| Workflow | CI |
| Run ID | `30676471193` (`event: pull_request`, `head_sha: e6a9a06…`) |
| Job ID | `91304681262` — "Lint, typecheck, test, build, Prisma, GraphQL" |
| Conclusion | `success` |

All 32 steps report `success`, including every step named in §4 of the review instructions: Tenant access architecture audit, Tenant access inventory freshness, Tenant access PostgreSQL tests, Tenant relation isolation tests, Tenant job-envelope integrity tests, Tenant queue/Redis tests, Client authority denial tests, Nested write ownership tests, Tenant access architecture negative fixtures, Tenant access tests, Git diff check, Lint, Typecheck, Unit tests, Migration and tenant-backfill tests, Constrained-memory subject evidence, Build, GraphQL codegen / schema validation. **No material step was skipped.**

CI is green and honest about what it runs. It does not close the findings above, because the committed tests do not exercise the semantically equivalent bypasses (compound selectors, array-form nested ops, derived import specifiers, partial selects).

---

## 8. Redis dump history inspection

| Field | Finding |
|---|---|
| Introduced by | `45d9d90c5329d61dc1bf8893f03dd059ed4edac4` ("Record PR 2 correction implementation") |
| Removed by | `20659dda0de592f17ff11d130ddb8518b9a13129` |
| Blob | `cae7715f893091a413923b54488f74c59a71e058`, 843 bytes, SHA-256 `2ef5386d1603a271873ddc11cd2781ff474b3aa9c2e31d35642fd4dce93446d5` |
| Absent from final tree | Yes; reachable in PR history |

The blob was extracted with `git cat-file -p` and loaded into a throwaway Redis 7 container. It contains 6 keys, all BullMQ metadata for the `stocky-cron` queue: `bull:stocky-cron:{1,events,id,marker,meta,wait}` — one queued `catalog-sync` job.

| Question | Answer |
|---|---|
| Secret / HMAC key material | **No.** Only an HMAC *digest*. |
| Token, session, cookie, API credential | **No** |
| Merchant or production data | **No.** The only shop identifier is `phase1-pr2-shop-a.myshopify.com`, the fixture domain defined at `app/tenant/__tests__/helpers.ts:11`, with a synthetic cuid `shopId` and `correlationId: "corr-redis-a"`. |
| Webhook payload / personal data / PII | **No** |
| Production identifier | **No** |
| Can the test envelope secret be derived from it? | **No new exposure.** HMAC-SHA256 does not reveal its key. The signed message is fully known, which permits an offline guessing attack — but the secret that produced this signature is already committed in plaintext at `vitest.tenant-access.config.ts:5`. I verified this by recomputing the HMAC over the deterministic serialization: the vitest default secret **matches** the stored signature; the CI secret does not. The blob confirms which test secret was used and adds nothing that was not already public in the repository. |

**Conclusion:** disposable synthetic test data only. **Not** P0 or P1. No secret rotation and no history sanitization are required. Retaining the blob in PR history is acceptable under repository hygiene rules — it is 843 bytes, contains no credential or merchant information, and the branch will be squash-merged.

**Recurrence prevention:** `.gitignore:1` now contains `dump.rdb`, which (having no slash) matches at any directory depth. Recommended P3 hardening: broaden to `*.rdb` and `appendonly.aof*` so alternate Redis persistence filenames are also covered.

---

## 9. Documentation review

| Requirement | Status |
|---|---|
| Original review preserved verbatim apart from the declared preface | ✅ `PR2_TENANT_ACCESS_REVIEW_REPORT.md` carries an HTML-comment chain-of-custody preface only; `git diff 1db2ce5..e6a9a06` on the file is empty |
| D-028 records correction **authorization**, not acceptance | ✅ "AUTHORIZED FOR PR 2 CORRECTION IMPLEMENTATION — PENDING INDEPENDENT CORRECTION REVIEW AND CHATGPT ACCEPTANCE"; "PR 2 remains **unaccepted**" |
| Q-011 remains open | ✅ Open; explicitly states PR 2 application scoping "does **not** close this gate" |
| R-022 remains open | ✅ Unchanged — "Mandatory Phase 1 P1 gate — do not downgrade. Implementation not started." |
| R-064 … R-067 pending independent verification | ✅ All four read "Correction implemented — pending independent verification" |
| R-039 separates transport integrity from PR 4 persistence | ✅ Corrected; states version/shape/Shop matching is "**not** integrity validation" |
| PR #13 remains draft | ✅ `draft: true`, `merged: false` |
| PR 3 not started | ✅ Recorded in `PROJECT_STATUS.md` and `phases/phase-1/README.md` |
| No risk prematurely closed | ✅ R-024, R-027, R-038, R-039 all downgraded only to "pending independent verification" |
| Documentation must not claim independent verification before this review | ✅ No such claim found |
| Architecture doc removed "unscoped nested includes are an acceptable PR 3 residual" | ✅ Removed from "Known residual gaps" |

**Assessment of the "Final exact head" placeholder:** not acceptable as final chain-of-custody documentation. Delegating the tip to the PR body makes the committed artifact depend on mutable, non-versioned metadata; PR 1 precedent (`PR1_TENANT_EXPANSION_CORRECTION_IMPLEMENTATION_REPORT.md`) records exact SHAs in-file. This is captured as F-PR2C-10 (P3) and should be corrected in the next correction cycle, together with the overstated disposition table.

---

## 10. Scope and safety

Verified by scanning the full correction-range diff (`git diff 6f9ca22..e6a9a06`) and the final tree.

| Prohibited item | Present? |
|---|---|
| RLS / `ENABLE ROW LEVEL SECURITY` | **Absent** (only pre-existing documentation prose) |
| Policies (`CREATE POLICY`) | **Absent** |
| Runtime role / migration role / `CREATE ROLE` / `ALTER ROLE` / `SET ROLE` | **Absent** |
| `BYPASSRLS` | **Absent** (documentation prose only) |
| Non-null `shopId` | **Absent** — `prisma/schema.prisma` unchanged in the range |
| Composite tenant foreign keys | **Absent** |
| Tenant-key triggers | **Absent** |
| PR 3 migration | **Absent** — no files under `prisma/migrations/` changed |
| PR 4 persistence / replay tables | **Absent** |
| Production configuration | **Absent** |
| Deployment | **Absent** |
| Production backfill | **Absent** |
| Shopify inventory mutation | **Absent** |
| Inventory-write flag enablement | **Absent** — all five flags default `false` in `.env.example` and forced `false` in `vitest.tenant-access.config.ts` and CI |
| Real secret | **Absent** — `.env.example` blank; CI and vitest use declared test-only values; the historical `dump.rdb` contains no key material (§8) |
| Merchant or production data | **Absent** |
| Unrelated dependency upgrade | **Absent** — `package.json` and `package-lock.json` unchanged in the range |

---

## 11. Residual risks

### 11.1 Acceptable PR 2 residuals

* **Envelope domain normalization tolerance.** The HMAC covers the *normalized* domain, so a case- or whitespace-variant of the correct domain verifies successfully. `normalizeShopDomain` rejects schemes, paths, ports, credentials, non-ASCII and over-length labels, and normalization is deterministic onto a single tenant, so this cannot redirect a job to a different shop. Document it as intended behavior.
* **Envelope secret caching.** `cachedSecret` is process-lifetime; rotation requires a restart of web and worker processes. Not required for PR 2; record in the PR 3/PR 4 operational runbook.
* **Envelope replay within the 24-hour window.** Correctly scoped to PR 4 per R-039.
* **Webhook `createIfMissing: false`.** The narrow first-delivery race before `afterAuth` completes is covered by Shopify redelivery. F-PR2-07 residual, documented.
* **`LeadTimeSnapshot` secondary-ownership failure mode.** A single inconsistent row raises `foreign_parent` and fails the whole list query rather than filtering. Fail-closed and correct for PR 2; worth revisiting for merchant-visible degradation once PR 3 constraints make such rows impossible.
* **`dump.rdb` in PR history.** 843 bytes of synthetic BullMQ test data; no rotation or history rewrite required (§8).

### 11.2 PR 3 enforcement dependencies (unchanged, not closed by PR 2)

* F-016 / R-022 / Q-011 — database-enforced isolation: forced RLS, restricted runtime role without `BYPASSRLS`, separate migration role, transaction-local tenant context, composite tenant foreign keys, non-null `shopId`.
* R-024 — transaction-local session-variable clearance across pooled connections.
* R-025 / R-026 — role ownership and `BYPASSRLS` posture.
* R-037 — database-enforced `shopId` immutability. **Note:** F-PR2C-03 shows the application-level guarantee is currently breakable, which increases the weight PR 3 must carry.
* Operational backfill of nullable `shopId` (R-028, R-029).

### 11.3 PR 4 persistence dependencies

* R-039 persistence half — durable envelope ledger, replay governance, dead-letter, durable idempotency. Correctly excluded from PR 2 and correctly documented as not closed.

### 11.4 Unacceptable remaining PR 2 defects

These must be corrected before PR 2 acceptance and must **not** be deferred to PR 3 RLS, because each is a demonstrated application-layer defect on the exact corrected head:

1. **F-PR2C-01** (P1) — cross-tenant nested `connect` / `set` / `disconnect` / `delete` via compound and alternate unique selectors.
2. **F-PR2C-02** (P1) — `connectOrCreate.where` connects a foreign row after a tenant-scoped precheck miss.
3. **F-PR2C-03** (P1) — array-form nested `updateMany` / `deleteMany` bypass scope injection and `shopId` immutability.
4. **F-PR2C-04** (P2) — exact-equality legacy `shop` comparison permanently hides owned rows, including after backfill.
5. **F-PR2C-05** (P2) — post-load validation rejects legitimate partial selects.
6. **F-PR2C-06** (P2) — `update()` cannot perform nested relation writes and silently drops projections.
7. **F-PR2C-07** (P2) — scanner does not follow derived values.
8. **F-PR2C-08** (P2) — client-hint node budget denies ordinary business payloads.

---

## 12. Non-authority statement

This review authorized nothing beyond itself. No implementation code was modified. PR #13 was not marked ready, not merged, and not deployed. No RLS, database role, migration, non-null constraint, composite foreign key, tenant-key trigger, production database access, production backfill, PR 3 work, PR 4 persistence, inventory write, or inventory-write flag change was made or enabled. The only file added by this review is this report.

---

## 13. Exact next action

```text
Return to ChatGPT for the exact Cursor follow-up correction prompt.
```
