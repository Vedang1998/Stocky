# Phase 1 PR5-F3 — Remaining Integration Implementation Report

**Lane:** PR5-F3 remaining-integration runtime
**Authorization date:** 2026-09-05
**Authority:** Existing **D-054 EFFECTIVE**
**Decision boundary:** This authorization is **not D-055**
**Authorized base:** `28c810090394f319e599fc6c501b898befa39cad`
**Branch:** `cursor/pr5-f3-remaining-integration-6d09`
**Status:** `AUTHORIZED / IN PROGRESS`
**Production:** `NOT AUTHORIZED`
**Merchant production data:** `NOT AUTHORIZED`
**Shopify inventory mutations:** `NOT AUTHORIZED`
**Inventory-write flags:** `DEFAULT OFF`
**`FEATURE_PR5_ABSENCE_TOMBSTONE`:** `DEFAULT OFF`
**PR6 runtime:** `NOT AUTHORIZED`
**PR #34:** Must remain untouched at baseline head `f5d429b7b3577c87e67c5ef3445e88560e565a5c`

This report is the durable implementation-evidence record for the single approved
PR5-F3 runtime merge boundary. ChatGPT expressly authorized this lane on
2026-09-05 under D-054 EFFECTIVE. The merged planning packet and Emergency
Continuity Sprint packet did not themselves authorize runtime; this later,
explicit authorization does.

The Cursor Cloud branch suffix is required by the execution environment. The
authorized logical lane name supplied by ChatGPT was
`cursor/pr5-f3-remaining-integration`; the concrete branch carrying this work is
`cursor/pr5-f3-remaining-integration-6d09`.

This lane does not authorize production access, production data, deployment,
backfill, Shopify inventory mutation, any inventory-write flag, PR6 runtime,
editing PR #34, merging this PR, or creating D-055.

## 1. Starting repository evidence

| Field | Observed value |
|---|---|
| Authorized starting SHA | `28c810090394f319e599fc6c501b898befa39cad` |
| `origin/main` after explicit fetch | `28c810090394f319e599fc6c501b898befa39cad` |
| Current HEAD before branch creation | `28c810090394f319e599fc6c501b898befa39cad` |
| Working tree before branch creation | Clean (`git status --porcelain` emitted no paths) |
| Base identity | PR #33 squash merge, verified from GitHub |
| Base post-merge CI | Run `33978361886`, `push`, exact head `28c810090394f319e599fc6c501b898befa39cad`, `SUCCESS` |
| Active F3 PR before branch creation | None for the concrete branch |
| PR #34 baseline | Open draft; head `f5d429b7b3577c87e67c5ef3445e88560e565a5c` |

Draft PR [#35](https://github.com/Vedang1998/Stocky/pull/35) was opened after
the authorization commit and remains DRAFT / UNMERGED.

## 2. Approved integrated scope

The one required F3 merge boundary contains:

1. JSONL bulk ingestion;
2. paired GID/ordinal checkpointing and deterministic resume;
3. authoritative Shopify webhook handling through refetch;
4. absence nomination and confirmation/reconcile;
5. compatibility-projection triggering and recovery;
6. v1 legacy-authority fencing/cutover;
7. recursive two-root mutation/no-Shopify safety scanning; and
8. inventory/catalog health-state integration.

No part of this scope may fabricate authoritative current state, weaken tenant
isolation, introduce ordinary physical deletion of canonical facts, or make a
compatibility writer authoritative.

## 3. Baseline evidence

Baseline was recorded before any runtime, schema, migration, test, Shopify
configuration, or CI-workflow edit. The only branch commit at baseline was
authorization documentation commit
`ee57405ec2a3efd10d6194882834c6ae7a48faa2`.

### 3.1 Required reading and frozen runtime identities

The required governance, product, phase, approved F3 plan, immutable review,
F2A/F2B/F2C report/review, PR #33 packet, implementation, schema, migration,
job, health, flag, and test records were read before runtime implementation.
Immutable Claude artifacts were not edited.

| Slice | Current merged runtime identity | Frozen implementation identity |
|---|---|---|
| F2A admin read | `f65ab4b906f53b3a1c72cdd7b29cdc0cbde6a7d7` | accepted head `bfbe369f590e38f36de8165e366dd7e84449ecd7` |
| F2B canonical applicator | `0284b66c776bbfa0ce7b8c7d9e579a365d7dfe26` | accepted head `1b72a4c95f0056783c6c3356bea18a572ca4d5ef` |
| F2C compatibility projection | `f9841691307583381695973600df3546dd1b9ee4` | isolated accepted head `2d2e8801dd383a778c1237cec4ed068922859cf0` |

### 3.2 Existing migrations

`npx prisma migrate deploy` applied **18/18** migrations to disposable local
PostgreSQL 16.15 and `npx prisma migrate status` reported the schema up to date.
The latest migration was
`20260816193000_pr5_catalog_fact_foundation`. No F3 migration existed.

Existing migration directories:

`20260728000000_init_stocky_plus`,
`20260730160000_tenant_expansion`,
`20260730160100_tenant_compatibility_indexes`,
`20260730210000_tenant_backfill_correction`,
`20260730220000_tenant_ownership_issue_detection`,
`20260803120000_tenant_enforcement_helpers`,
`20260804180000_sync_control_plane`,
`20260804210000_sync_control_plane_correction`,
`20260804220000_sync_control_plane_correction_defaults`,
`20260805120000_sync_control_plane_second_correction`,
`20260805130000_sync_control_plane_receipt_probe_revoke`,
`20260805140000_sync_control_plane_enqueued_failed`,
`20260806220000_sync_control_plane_d047_fair_claim_indexes`,
`20260807010000_sync_control_plane_d048_dispatch_ready_shop`,
`20260807150000_sync_control_plane_d049_dispatch_schedule`,
`20260811190000_sync_control_plane_d050_split_claim_statement_triggers`,
`20260812230000_sync_control_plane_d051_readiness_lock_scope`, and
`20260816193000_pr5_catalog_fact_foundation`.

### 3.3 Existing test counts

Environment: disposable local PostgreSQL 16.15, isolated Redis 7.0.15, Node
22.14.0, npm 11.5.2, no production credentials or data, inventory-write flags
unset/false.

| Command | Exit | Baseline result |
|---|---:|---|
| `npx vitest run app/lib/catalog-facts/admin-read --reporter=verbose --passWithNoTests false` | 0 | **94 passed / 10 files** |
| `npx vitest run app/lib/catalog-facts/apply --reporter=verbose --passWithNoTests false` | 0 | **43 passed / 4 files** |
| `npx vitest run app/lib/catalog-facts/compatibility-projection --reporter=verbose --passWithNoTests false` | 0 | **70 passed / 7 files** |
| `npx vitest run app/lib/catalog-facts --reporter=verbose --passWithNoTests false` | 0 | **224 passed / 24 files** |
| `npm test -- --reporter=verbose --passWithNoTests false` | 0 | **280 passed / 30 files** |
| `npm run test:migrations -- scripts/tenant-enforcement/tests/pr5-catalog-fact-foundation.test.ts scripts/tenant-enforcement/tests/pr5-f2b-canonical-applicator.test.ts` | 0 | **91 passed / 2 files** (F1 19 + F2B 72) |
| `npx vitest run --config vitest.tenant-access.config.ts app/tenant/__tests__/pr5-f2c-compatibility-projection.test.ts --reporter=verbose --passWithNoTests false` | 0 | **35 passed / 1 file** |
| `npm run graphql-codegen` | 0 | Admin 2026-07 schema/documents generated successfully |
| `npx prisma validate` | 0 | schema valid |
| `npx prisma generate` | 0 | Prisma Client generated |
| `npm run test:sync-integration` with the repository's complete CI test environment | 0 | **241 passed / 20 files** |

The first `npm run test:sync-integration` attempt omitted CI-only Shopify
placeholder variables. Eighteen files / 228 tests passed, while two suites
failed during module collection with the explicit
`empty appUrl configuration` error and collected zero tests. This was an
environment setup failure, not accepted as test evidence. The two affected
suites were rerun with the repository's test-only CI placeholders and passed
**13/13**. A complete all-files rerun with the same CI test environment is
recorded in the table and passed **241/241** before runtime implementation.

### 3.4 Flags, scanner, legacy authority, and health

With all relevant environment variables explicitly unset, the five existing
inventory-write flags evaluated `false`. At baseline,
`FEATURE_PR5_ABSENCE_TOMBSTONE` was not yet defined. Its authorized F3 default
is `false`; it must not be enabled.

Baseline scanner execution returned:

```text
root A app/lib/catalog-facts: 42 production files, 14 GraphQL documents, 0 findings
root B app/jobs/workers/catalog-facts: absent
```

Therefore R-163 was globally OPEN: recursion existed for Root A only; no Root B
proof existed.

The live legacy defects were directly observed:

- `app/jobs/workers/webhook-processor.ts` wrote
  `quantityAvailable: inv.available ?? 0` on both create and update, then
  called `computeForecast` and could create `LowStockAlert`;
- `app/services/shopify-sync.server.ts` used full-body
  `response.text()` + `split`, per-row `ShopifyVariantCache` upserts, and
  `startCatalogSync`;
- `app/services/shopify-gql.server.ts` polled
  `currentBulkOperation`;
- `app/jobs/queue.server.ts` enqueued `catalog-sync-v1`; and
- `app/sync/health.server.ts` could report `HEALTHY` solely from the latest
  successful job/run, without checking unknown authoritative quantity,
  projection pending/failure, absence uncertainty, or incomplete deletion
  reconciliation.

### 3.5 Baseline risk posture

All planning/runtime risks R-129 through R-165 remained OPEN unless an earlier
accepted lane explicitly satisfied only a sub-obligation. F3 owns the
end-to-end evidence for these carry-forwards:

| Risk | Baseline F3 disposition |
|---|---|
| R-157 | OPEN — F3 fence/direct allocation paths unimplemented |
| R-158 | OPEN — real direct-refetch interval scheduling unimplemented |
| R-159 | OPEN — worker crash/late-response integration unimplemented |
| R-160 | OPEN — all F3 canonical/diagnostic/nomination writers not yet anchored |
| R-161 | OPEN — derived aggregate worker-concurrency capacity proof absent |
| R-162 | OPEN pending safe downstream-consumer proof |
| R-163 | OPEN globally; Root B absent |
| R-164 | OPEN pending F3 ordinary-path no-physical-delete proof |
| R-165 | OPEN; legacy webhook still coerced unknown availability to zero |

Related F3-owned integration obligations remained OPEN across R-129 through
R-156: partial-bulk honesty, GID identity, eight-state freshness, unit-cost
preflight consumption, forecast isolation, persisted BulkOperation identity,
bounded streaming, complete locations, RLS, mutation denial, exact money,
expired-result recovery, bulk document limits, compatibility authority,
bulk/webhook ordering, absence candidates, projection health, byte-zero
resume, bounded reconcile, clock separation, signal/refetch deletion,
presence-on-no-op, nullable versions, sequence allocation, role-separated
checkpointing, blast-radius control, terminal revival, and diagnostic
reconciliation.

## 4. Implementation evidence

`PENDING.`

## 5. Test and validation evidence

`PENDING.`

## 6. Risk and carry-forward dispositions

`PENDING. R-163 remains globally OPEN and may become only a candidate for
closure pending exact-head independent Claude evidence.`

## 7. Exact-head CI and PR state

`PENDING. The pull request must remain DRAFT and UNMERGED.`

## 8. Explicit safety accounting

| Action | Count / state |
|---|---|
| Production accesses | `0` |
| Merchant production-data accesses | `0` |
| Shopify inventory writes | `0` |
| Production deployments | `0` |
| Inventory-write flags enabled | `0`; all remain `DEFAULT OFF` |
| PR6 runtime changes | `0`; `NOT AUTHORIZED` |
| PR #34 changes | `0`; must remain untouched |

