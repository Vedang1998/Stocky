# Phase 1 PR 2 — Third Correction Cycle Implementation Report

**Decision:** D-030  
**Branch:** `phase-1/tenant-access`  
**Pull request:** [#13](https://github.com/Vedang1998/Stocky/pull/13) (draft, unmerged)  
**Authorized base:** `main@04289d61f605414597ac85f47830a3c9d2f9e33d`

## Identity

| Field | Value |
|---|---|
| Original rejected implementation head | `6f9ca22c069a46003b6944ff56c888ff91e95cdc` |
| First corrected head | `e6a9a06a8a399bbfb17687399c59582f1712f442` |
| First correction-review report | `b5fbd2bd346dee1730500be46d47c4fb164fd788` |
| Second corrected head (independently reviewed) | `99d7a2bb73e77f62bd4ed0029961b40ab04a08e0` |
| Second correction-review report | `fed21a48a5ae77a61f62b5bd899c698c48a68f49` |
| Starting head for this cycle | `fed21a48a5ae77a61f62b5bd899c698c48a68f49` |
| **Third-cycle implementation head** | **`d7058294af7eb3d8f287f48cd0657a74475892e7`** |
| Final handoff head (green tip) | **`bab5fe90cfd81a1f0351d9f6d6db709378b2b25e`** |
| PR state | OPEN, draft, unmerged |
| Exact-head CI on handoff tip | run `30736171401`, job `91465255400`, conclusion `success`, `head_sha` = `bab5fe90cfd81a1f0351d9f6d6db709378b2b25e` |
| Prior green tip | `c142e8fe215904007b1464ebd78bc8fd9097f126` (run `30735830014`, job `91464351163`) |

## Independent review context

Verdict at `99d7a2bb…`: `NOT READY — FURTHER CORRECTIONS REQUIRED`  
Findings: P0:0 / P1:3 / P2:3 / P3:4 (F-PR2R2-01..10)  
No cross-tenant read or write was reproduced.  
Closed originals preserved: signed envelopes, nested-selector denial, array nested isolation, update projections, serializable writes, raw-Prisma scanner provenance, exact allowlist matching, default-off inventory-write gates.

## Finding dispositions (Cursor implementation — PENDING INDEPENDENT REVIEW)

| Finding | Sev | Correction | Files | Focused tests | Residual |
|---|---|---|---|---|---|
| F-PR2R2-01 | P1 | Flatten compound WhereUniqueInput → scalar predicates; resolve owned `{ id }` before mutation | `selectors.ts`, `tenant-db.server.ts` | `top-level-unique-selectors.test.ts` | Application-layer only |
| F-PR2R2-02 | P1 | Scalable scope: `{ shopId }` OR null+`shop in distinct raws`; no owned-row ID lists | `legacy-scope.ts` | `tenant-scope-scale.test.ts` (30k–40k) | Distinct raw representation count still binds; not row count |
| F-PR2R2-03 | P1 | Unprovable to-one → null; to-many filtered; parent list continues | `tenant-db.server.ts` + route null-safe display | `mixed-relation-ownership.test.ts` | Top-level access to unprovable row itself remains denied |
| F-PR2R2-04 | P2 | `appendNestedOperation` merges connectOrCreate into sibling connect/create | `selectors.ts`, `tenant-db.server.ts` | `connect-or-create-merge.test.ts` | — |
| F-PR2R2-05 | P2 | One D-030 ownership path for reads/writes/relations/bulk | `legacy-scope.ts`, `tenant-db.server.ts` | `normalization-consistency.test.ts` | — |
| F-PR2R2-06 | P2 | Inject/strip `purchaseOrderId` for LeadTimeSnapshot | `tenant-db.server.ts` | `lead-time-partial-select.test.ts` | — |
| F-PR2R2-07 | P3 | ArrayBuffer.byteLength body ceiling; UTF-8 decode; multipart cumulative | `client-shop.server.ts` | `client-hint-byte-limits.test.ts` | Body limit = 1_048_576 **bytes** |
| F-PR2R2-08 | P3 | Key-specific shop hints; business arrays under `shop` ignored unless plausible domain | `client-shop.server.ts` | `client-hint-byte-limits.test.ts` | Matching hints never establish authority |
| F-PR2R2-09 | P3 | Local const / namespace / computed / identity-helper issuer aliases | `scan.ts` | `authority-issuer-scanner.test.ts` | Intra-file only — not full cross-file taint |
| F-PR2R2-10 | P3 | This report; chain of custody; CI file gates; status docs | docs + `ci.yml` | — | Pending third independent review |

All items: **IMPLEMENTATION PENDING INDEPENDENT REVIEW**.

## Product decision (D-030)

Non-null `shopId` equal to the current tenant authorizes the row. Legacy `shop` is non-authoritative compatibility data in that case and must not hide the row. Null `shopId` still requires exact `phase1-shop-domain-v1` normalized legacy match. Foreign non-null `shopId` denies. Child ownership requires verified parent + child `shopId` tenant-or-null.

## Technical evidence (local disposable environment)

| Item | Result |
|---|---|
| PostgreSQL | 16.14 disposable local cluster |
| Redis | 7.0.15 on isolated port **6389**; DBSIZE before=0; flushed after |
| Node / npm | v22.14.0 / 11.5.2 |
| Scale n=40000 findMany/count | findManyMs≈4–5, countMs≈6–7; **no bind-parameter failure** |
| Focused new files | 35/35 + 6/6 scale = pass |
| Full `test:tenant-access` | **198/198 pass** |
| `npm test` | 56/56 pass |
| `test:migrations` | 106/106 pass |
| lint / typecheck / build / graphql-codegen | pass |
| tenant indexes apply/verify/drift/plan | pass |
| tenant:access:audit / inventory:check | pass |

## Safety confirmation

- No production or merchant data
- No deployment / production backfill / ownership repair
- No RLS, policies, database roles, BYPASSRLS
- No non-null shopId / composite tenant FKs / tenant-key triggers
- No Prisma schema or migration change
- No PR 3 / PR 4 persistence
- No Shopify inventory mutation; write flags default OFF
- No real secret / `.env` committed
- No history rewrite; independent review reports unchanged
- PR #13 remains draft and unmerged

## Next action

Return to ChatGPT for exact-head triage and the third independent PR 2 correction-review prompt.


## Exact-head CI evidence (final handoff tip)

| Field | Value |
|---|---|
| Workflow | CI |
| Run ID | `30736171401` |
| Job ID | `91465255400` |
| Job name | Lint, typecheck, test, build, Prisma, GraphQL |
| `head_sha` | `bab5fe90cfd81a1f0351d9f6d6db709378b2b25e` |
| Conclusion | `success` |
| URL | https://github.com/Vedang1998/Stocky/actions/runs/30736171401 |

### Focused steps (tests actually executed on `bab5fe90…`)

| Step | File | Tests |
|---|---|---|
| Tenant top-level unique-selector tests | `top-level-unique-selectors.test.ts` | 7 passed |
| Tenant scope scale tests | `tenant-scope-scale.test.ts` | 6 passed |
| Tenant mixed relation ownership tests | `mixed-relation-ownership.test.ts` | 5 passed |
| Tenant connectOrCreate merge tests | `connect-or-create-merge.test.ts` | 4 passed |
| Tenant normalization consistency tests | `normalization-consistency.test.ts` | 2 passed |
| Tenant LeadTimeSnapshot projection tests | `lead-time-partial-select.test.ts` | 3 passed |
| Tenant request-byte and shop-hint tests | `client-hint-byte-limits.test.ts` | 7 passed |
| Tenant authority-issuer scanner tests | `authority-issuer-scanner.test.ts` | 7 passed |
| Full Tenant access tests | `npm run test:tenant-access` | **198 passed** |

No focused step used a `-t` filter that can match zero tests. Scale evidence at n=40000: `findManyMs≈6`, `countMs≈10`; no bind-parameter failure.

**Note:** Any subsequent evidence-only documentation commit advances the PR tip. ChatGPT must triage the exact PR tip SHA after confirming green CI on that tip (recorded in the PR body). The runtime/test implementation head remains `d7058294…`.

