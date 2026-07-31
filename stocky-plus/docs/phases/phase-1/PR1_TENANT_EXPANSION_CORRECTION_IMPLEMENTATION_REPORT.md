# Phase 1 Correction Implementation Report — PR 1 Tenant Expansion

**Status:** CORRECTIONS IMPLEMENTED — AWAITING INDEPENDENT VERIFICATION
**Implementer:** Cursor

## Identity (immutable heads vs live tip)

| Item | Value |
|---|---|
| Base main SHA | `8ccc8d29a78e05615b31324b38df17f4f1d1296e` |
| Branch | `phase-1/tenant-expand` |
| Pull request | [#11](https://github.com/Vedang1998/Stocky/pull/11) (draft, OPEN, unmerged) |
| Original Claude-reviewed head | `7aabb095806716697bfea2783379351b15e1cda2` |
| Correction-review Claude head | `fb04345f129b8664566c5947f2ad75f57102269b` |
| Correction-review verdict | `NOT READY` (preserved verbatim in `PR1_TENANT_EXPANSION_CORRECTION_REVIEW_REPORT.md`) |
| Review-record commit (docs only) | Recorded after push (first custody commit before F-N code) |
| Current live PR tip + exact-head CI | Recorded in PR description after push — **mutable** |

## Summary

Addressed Claude correction-review findings **F-N01 through F-N09** on draft PR #11 without merging, without starting PR 2/3, without RLS/runtime conversion, and without enabling inventory writes. Prior R9 evidence at `fb04345f…` is **rejected and superseded**. Findings remain open pending unrestricted independent verification.

## Subject-evidence version and field manifest

- Evidence version: **`phase1-tenant-subject-v2`**
- Domain normalization remains: **`phase1-shop-domain-v1`**
- Manifest: `scripts/tenant-backfill/subject-manifest.ts`
- Streaming digests: `scripts/tenant-backfill/subject-evidence.ts`
- Coherent capture: `scripts/tenant-backfill/starting-snapshot.ts`

Direct-owner fields include `id`, legacy `shop`, and immutable creation evidence where present (`createdAt` / `calculatedAt`). Child-owner fields include `id`, parent FKs, and LeadTime `supplierId`+`purchaseOrderId`+`recordedAt`. Nullable `shopId` is excluded.

## Coherent-snapshot architecture

1. `BEGIN` REPEATABLE READ (Prisma interactive transaction).
2. Capture Shop snapshot, beforeCounts, table subject digests, Session evidence, bounded domain discovery, `shopsWouldCreatePredicted`, postgres snapshot id.
3. Persist compact `startingEvidence` on the run; commit before mutation.
4. Resume parses `startingEvidence` and fail-closes if absent/malformed — never recaptures.

## Session evidence-boundary design

Evidence-only (no `shopId` on Session; Shopify session storage unchanged): high-water Session id, row count, subject digest over `(id, shop)`, normalized domains, redacted invalid candidates. New Session rows after capture belong to a later run.

## F-N01 / F-N05 / F-N06 — concurrent-index proof (supersedes prior R9)

- Holder: `BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY` with non-null `backend_xmin` while idle in transaction.
- Builder: exact PID + target relation progress must reach **`waiting for old snapshots`** with granted **`ShareUpdateExclusiveLock`** and no `AccessExclusiveLock`.
- Settle timestamp captured inside promise fulfillment/rejection via `process.hrtime.bigint()`.
- 10 deterministic iterations; fixture 100,000 Supplier rows.
- Removed tautology `buildSettled || true`.

## Local validation (representative)

| Command | Exit |
|---|---|
| `git diff --check` | 0 |
| `npm run test:migrations` | 0 (78 tests) |
| `npm run test:subject-memory` | 0 (25k rows, batch 250, heap delta ~6MB under 256MB cap) |
| `npm run lint` | 0 |
| `npm run typecheck` | 0 |
| `npm test` | 0 (56 tests) |
| `npm run build` | 0 |

Prisma migrate/plan/apply/verify/drift and graphql-codegen must be re-recorded on the pushed tip / CI. Independent Claude review must use an unrestricted environment (`binaries.prisma.sh`, `shopify.dev`).

## Explicit non-claims

- No production or merchant data accessed.
- No deployment.
- No RLS / non-null tenant enforcement / composite child FKs / runtime conversion.
- PR 2 and PR 3 not started.
- Inventory writes UNAPPROVED; every inventory-write flag DEFAULT OFF.
- Findings not independently closed.

## Next action

Return to ChatGPT for exact-head verification and an unrestricted fresh Claude correction review.
