# Phase 1 PR 2 — Follow-up Correction Implementation Report

**Decision:** D-029
**Branch:** `phase-1/tenant-access`
**Pull request:** [#13](https://github.com/Vedang1998/Stocky/pull/13) (draft, unmerged)
**Authorized base:** `main@04289d61f605414597ac85f47830a3c9d2f9e33d`

## Identity

| Field | Value |
|---|---|
| Original rejected implementation head | `6f9ca22c069a46003b6944ff56c888ff91e95cdc` |
| First corrected implementation head | `e6a9a06a8a399bbfb17687399c59582f1712f442` |
| Independent correction-review report commit | `b5fbd2bd346dee1730500be46d47c4fb164fd788` |
| Starting head for this cycle | `b5fbd2bd346dee1730500be46d47c4fb164fd788` |
| Follow-up implementation head |  |
| Handoff head | recorded after documentation commit / exact-head CI |
| PR state | OPEN, draft, unmerged |

## Independent review context

Verdict at `e6a9a06…`: `NOT READY — FURTHER CORRECTIONS REQUIRED`
Findings: P0:0 / P1:3 / P2:5 / P3:3 (F-PR2C-01..11)
F-PR2-03 remains **closed** (HMAC envelopes preserved).
F-PR2-07..09 remain closed/documented.

## Finding dispositions (Cursor implementation — PENDING INDEPENDENT REVIEW)

| Finding | Sev | Correction | Files | Tests | Residual |
|---|---|---|---|---|---|
| F-PR2C-01 | P1 | Model-aware selector metadata; resolve → `{ id }`; unknown shapes fail closed | `selectors.ts`, `tenant-db.server.ts`, `relations.ts` | `nested-selector-auth.test.ts` | Application-layer only; PR 3 composite FKs still required |
| F-PR2C-02 | P1 | Tenant miss + unscoped existence check; rewrite to connect/create | `selectors.ts`, `tenant-db.server.ts` | connectOrCreate cases in nested-selector-auth | Concurrent unique insert race residual until PR 3 |
| F-PR2C-03 | P1 | Normalize `T\|T[]`; scalar scope for nested updateMany/deleteMany; scrub shopId/shop | `tenant-db.server.ts`, `legacy-scope.ts` | array-form cases | Nested ScalarWhereInput cannot use relation filters (by design) |
| F-PR2C-04 | P2 | Trusted `lower(btrim(shop))` ID scope; shopId match unless foreign myshopify conflict | `legacy-scope.ts` | `legacy-normalization.test.ts`, nullable matrix | Broader SQL prefilter + normalizer post-check; no silent rewrite |
| F-PR2C-05 | P2 | Inject proof fields into nested select; strip before return | `tenant-db.server.ts` | `partial-select-update.test.ts` | — |
| F-PR2C-06 | P2 | Real `delegate.update` with nested writes + include/select; internal tx | `tenant-db.server.ts` | partial-select-update | — |
| F-PR2C-07 | P2 | Constant-fold provenance; tainted clients; aliases; exact fixtures | `scan.ts`, fixtures, architecture-audit | architecture-audit.test.ts | **Intra-file** tracking only — not full interprocedural taint |
| F-PR2C-08 | P2 | 1 MiB body / 20k nodes / depth 12; form name scan; nested shop object walk | `client-shop.server.ts` | `large-payload-hints.test.ts` | Limits documented; still fail closed on overrun |
| F-PR2C-09 | P3 | Serializable internal write transactions + bounded retry | `tenant-db.server.ts` | `write-atomicity.test.ts` | Application mitigation only; PR 3 residual remains |
| F-PR2C-10 | P3 | Supersession note; this follow-up report; real allowlist validator test | docs + architecture-audit | — | — |
| F-PR2C-11 | P3 | Exact `exceptionForPath`; `*.rdb` gitignore | `allowlist.ts`, `.gitignore` | architecture-audit exact-path cases | — |

All items: **IMPLEMENTATION PENDING INDEPENDENT REVIEW**.

## Technical evidence

### Selector metadata

Explicit per-model unique selectors in `MODEL_UNIQUE_SELECTORS` (`app/tenant/selectors.ts`), including `id`, `shopId_id`, compound business uniques, `LeadTimeSnapshot.purchaseOrderId`, and `SupplierSkuMapping.supplierId_shopifyVariantId`.

### connectOrCreate

Tenant-scoped lookup → connect `{ id }`; else unscoped existence check → `foreign_relation_target` or explicit create with injected ownership. Prisma never evaluates the caller's unscoped `connectOrCreate.where` after rewrite.

### Array normalization

All nested ops normalized via `normalizeToArray`. Nested bulk ops use `nestedBulkScalarScopeWhere` (Prisma ScalarWhereInput constraint).

### Transaction / atomicity

`withWriteTransaction`: reuse when `inTransaction`; else serializable `$transaction` with 3 serialization retries. Documented PR 3 residual.

### Legacy scope

`resolveDirectTenantScopeWhere` uses trusted raw SQL ID lists. `rowOwnershipOk` applies normalizer conflict rules. Sync scopes remain for include where injection.

### Proof fields / update

Inject `id`/`shopId`/`shop` as needed; strip after validation. Updates use `delegate.update({ where: { id } })`.

### Scanner

Intra-file constant-folding + tainted binding set. Unresolved dynamic imports on runtime surfaces fail closed. Exact allowlist paths only.

### Hint limits

`CLIENT_HINT_MAX_BODY_BYTES=1048576`, `CLIENT_HINT_MAX_NODES=20000`, `CLIENT_HINT_MAX_DEPTH=12`.

## Safety

- Inventory-write flags default OFF; no Shopify inventory mutation
- No production access / backfill / merchant data
- No RLS / DB roles / non-null / composite FKs / tenant-key triggers
- No PR 3 / PR 4 persistence
- No real secret committed
- No rebase/amend/force-push of prior history
- Independent review report file unchanged

## Exact next action

```text
Return to ChatGPT for exact-head triage and the second independent PR 2 correction-review prompt.
```
