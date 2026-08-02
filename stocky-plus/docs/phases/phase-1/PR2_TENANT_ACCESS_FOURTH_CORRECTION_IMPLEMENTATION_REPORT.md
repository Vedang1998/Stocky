# Phase 1 PR 2 — Fourth Correction Cycle Implementation Report

**Decision:** D-031  
**Branch:** `phase-1/tenant-access`  
**Pull request:** [#13](https://github.com/Vedang1998/Stocky/pull/13) (draft, unmerged)  
**Authorized base:** `main@04289d61f605414597ac85f47830a3c9d2f9e33d`

## Identity

| Field | Value |
|---|---|
| Third-cycle runtime/test implementation head | `d7058294af7eb3d8f287f48cd0657a74475892e7` |
| Third-cycle reviewed handoff head | `fec8500095197798be183d08b3dd004632adba80` |
| Third independent review report-only commit | `000e53cdae6cd39b690fc8107d7d3f4f4791adf1` |
| Fourth-cycle starting head | `000e53cdae6cd39b690fc8107d7d3f4f4791adf1` |
| **Fourth-cycle runtime/test implementation head** | **`21aba6660e71fa5af558d81499190ee8eb0e645e`** |
| Prior green evidence tip | `bd2fc24b2e71510d2b03dab4371d83c7a4d8f12c` (run `30762016174`, job `91534135863`, success) |
| **Fourth-cycle final handoff head** | **`867460f84bdc76673d2c676e83124bce83183964`** |
| PR state | OPEN, draft, unmerged |
| Exact-head CI on final handoff | run `30762359407`, job `91535068210`, conclusion `success`, `head_sha` = `867460f84bdc76673d2c676e83124bce83183964` |
| Exact-head CI on prior tip `bd2fc24…` | run `30762016174`, job `91534135863`, conclusion `success` |
| Third-cycle correction range commit count | `fed21a48…`..`fec8500…` = **11** (prior prompt expected 12 was incorrect; merge base exact; no history rewrite) |
| Intermediate green documentation tip (not final reviewed head) | `bab5fe90cfd81a1f0351d9f6d6db709378b2b25e` |

## Independent review context

Verdict at `fec8500…`: `NOT READY — FURTHER CORRECTIONS REQUIRED`  
Findings: P0:0 / P1:0 / P2:3 / P3:4 (F-PR2R3-01..07)  
No cross-tenant read or write was reproduced. All twelve prior security regressions remain closed.

## Finding dispositions (Cursor implementation — PENDING INDEPENDENT VERIFICATION)

| Finding | Sev | Correction | Files | Focused tests | Count | Residual |
|---|---|---|---|---|---:|---|
| F-PR2R3-01 | P2 | `phase1-legacy-evidence-v1` bound (default **1024**, absolute max **4096**); fail closed `legacy_evidence_overflow`; no near-limit `in` list; create / foreign selector / canonical-ID paths avoid unnecessary collection | `legacy-scope.ts`, `selectors.ts` | `legacy-evidence-overflow.test.ts` | **12** | Application-layer bound only; operational backfill still separate |
| F-PR2R3-02 | P2 | Validate tenant-bearing `shop`/`shopId` before flatten/coerce; reject `foreign_selector_tenant`; own case/whitespace variants still canonicalize after normalize | `selectors.ts`, `tenant-db.server.ts` | `tenant-bearing-unique-selectors.test.ts` | **6** | — |
| F-PR2R3-03 | P2 | Shared `PHASE1_SHOP_DOMAIN_SPEC` + exact ECMAScript trim code points; SQL `btrim(shop, sharedTrimSet)`; JS remains final authority; corpus equivalence | `shop-domain.ts`, `legacy-scope.ts` | `legacy-normalization-equivalence.test.ts` | **4** | — |
| F-PR2R3-04 | P3 | Honest CI naming; dedicated bulk-mutation + relation suites; rename read-gate title | CI + new test files | bulk **2** + relations **2** + read consistency **2** | **6** | — |
| F-PR2R3-05 | P3 | Active docs record third-cycle range = **11** commits | `PROJECT_STATUS.md`, phase README, this report | — | — | Documentary only |
| F-PR2R3-06 | P3 | Distinguish runtime `d7058294…`, reviewed handoff `fec8500…`, report `000e53c…`; demote `bab5fe90…` to intermediate tip | status/README/this report | — | — | — |
| F-PR2R3-07 | P3 | Accepted synthetic Redis-history residual — no rotation/rewrite | `PROJECT_STATUS.md`, backlog, this report | — | — | Blob remains reachable |

All items: **IMPLEMENTATION PENDING INDEPENDENT VERIFICATION**.

## Overflow policy

| Item | Value |
|---|---|
| Version | `phase1-legacy-evidence-v1` |
| Default limit | `1024` |
| Absolute max | `4096` (env `TENANT_MAX_DISTINCT_LEGACY_SHOP_FORMS` clamped) |
| Applies to | Distinct raw legacy `shop` forms for **null `shopId` only** |
| On overflow | Stop; do not build `in`; throw `legacy_evidence_overflow` with model / shopId / limit / observedCount / correlationId — **no raw values** |
| Operational resolution | Inspect PR 1 ownership diagnostics; separately authorized backfill; retry within boundary |

## Selector intent

Before any flatten/coerce/legacy collection, `assertSelectorTenantIntent` inspects every tenant-bearing field. Foreign `shopId` / foreign normalized `shop` → `foreign_selector_tenant`. Malformed → `unsupported_relation_selector`. Matching normalized own domain → accepted then canonicalized.

## Normalization

Source of truth: `phase1-shop-domain-v1` in `app/tenant/shop-domain.ts`. Shared trim code-point set drives JS `String.prototype.trim` and PostgreSQL `btrim(..., characters)`. Corpus covers space/tab/LF/CR/VT/FF/NBSP/BOM/mixed/case/URL/path/foreign/non-ASCII/overlong/embedded/empty.

## Local validation evidence

| Item | Result |
|---|---|
| PostgreSQL | **16.14** disposable cluster `127.0.0.1:55432` |
| Redis | **7.0.15** isolated `127.0.0.1:56379`; DBSIZE before=0; flushed after |
| Node / npm | v22.14.0 / **11.5.2** |
| Focused overflow | **12/12** |
| Focused selectors | **6/6** |
| Focused equivalence | **4/4** |
| Focused bulk mutations | **2/2** |
| Focused relations | **2/2** |
| Full `test:tenant-access` | **224/224** |
| `npm test` | **56/56** |
| `test:migrations` | **106/106** |
| `test:subject-memory` | **2/2** |
| lint / typecheck / build / graphql-codegen | pass |
| tenant indexes apply/verify/drift/plan | pass |
| tenant:access:audit / inventory:check | pass (0 violations; inventory regenerated; tree clean after inventory) |

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
- Q-011 / F-016 / R-022 remain open
- R-072 / R-073 / R-074: correction implemented — pending independent verification

## Redis history disposition (F-PR2R3-07)

| Field | Value |
|---|---|
| Decision | **Accepted repository-history hygiene residual — no secret rotation or history rewrite required** |
| Introducing commit | `45d9d90` |
| Deleting commit | `20659dd` |
| Blob SHA | `cae7715f893091a413923b54488f74c59a71e058` |
| Size | 843 bytes |
| Contents | Synthetic fixture domain + BullMQ test keys only |
| Sensitive exposure | None (no credentials, PII, merchant data, production IDs; HMAC secret not derivable) |
| Recurrence | `*.rdb` / `dump.rdb` ignored; future `.rdb` commits prohibited |
| Reachability | Historical blob remains reachable from retained history |

## Next action

Return to ChatGPT for exact-head triage and the fourth independent PR 2 correction-review prompt.

## Exact-head CI evidence (prior green tip `bd2fc24…`)

| Field | Value |
|---|---|
| Workflow | CI |
| Run ID | `30762016174` |
| Job ID | `91534135863` |
| Job name | Lint, typecheck, test, build, Prisma, GraphQL |
| `head_sha` | `bd2fc24b2e71510d2b03dab4371d83c7a4d8f12c` |
| Conclusion | `success` |
| URL | https://github.com/Vedang1998/Stocky/actions/runs/30762016174 |

### New focused steps (tests actually executed on `bd2fc24…`)

| Step | File | Tests |
|---|---|---:|
| Tenant legacy-evidence overflow tests | `legacy-evidence-overflow.test.ts` | 12 |
| Tenant-bearing unique-selector tests | `tenant-bearing-unique-selectors.test.ts` | 6 |
| Tenant legacy SQL/JS normalization equivalence tests | `legacy-normalization-equivalence.test.ts` | 4 |
| Tenant legacy bulk-mutation consistency tests | `legacy-normalization-bulk-mutations.test.ts` | 2 |
| Tenant legacy relation consistency tests | `legacy-normalization-relations.test.ts` | 2 |
| Tenant legacy normalization read consistency tests | `normalization-consistency.test.ts` + `legacy-normalization.test.ts` | 5 |
| Full Tenant access tests | `npm run test:tenant-access` | **224** |

No focused step used a `-t` filter. Constrained-memory subject evidence step was present in workflow; job conclusion success.

## Exact-head CI evidence (final handoff tip `867460f…`)

| Field | Value |
|---|---|
| Workflow | CI |
| Run ID | `30762359407` |
| Job ID | `91535068210` |
| Job name | Lint, typecheck, test, build, Prisma, GraphQL |
| `head_sha` | `867460f84bdc76673d2c676e83124bce83183964` |
| Conclusion | `success` |
| URL | https://github.com/Vedang1998/Stocky/actions/runs/30762359407 |

Any subsequent documentation-only pin advances the tip; ChatGPT must triage the exact PR tip after confirming green CI on that tip. Runtime/test implementation head remains `21aba66…`.
