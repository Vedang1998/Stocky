# PR5-F2C — Current-Main Exact-Head Independent Review

**Reviewer:** Claude Code (independent principal engineer / architecture, security and release-risk reviewer)
**Review date:** 2026-09-03
**Review tier:** Tier-A exact-head, final gate before ChatGPT's PR #30 merge decision
**Repository:** `Vedang1998/Stocky`
**Application:** `stocky-plus/`

---

## 1. Scope and posture

This review answers one question: **is the exact integrated PR #30 head still safe to merge now that
F2C is colocated with the real merged F2A and F2B implementations on current main?**

Approval was **not** inherited from the historical isolated-core review. Every mandatory integration
target was re-derived against the merged code, and the composition was actively attacked with
independently authored adversarial probes on a disposable PostgreSQL 16 instance. Where Cursor made a
claim, the claim was verified from primary evidence (Git object hashes, the GitHub Actions API, and
executed code) rather than from PR prose.

No file in PR #30 was modified. No F3 or PR6 work was performed. Nothing was merged.

---

## 2. Identity verification

| Item | Expected | Observed | Result |
|---|---|---|---|
| Reviewed exact head | `7495adc0527e225f190f84c5e4a4cc59ca18ab19` | `7495adc0527e225f190f84c5e4a4cc59ca18ab19` | ✅ |
| Current main | `0284b66c776bbfa0ce7b8c7d9e579a365d7dfe26` | `0284b66c776bbfa0ce7b8c7d9e579a365d7dfe26` | ✅ |
| Accepted isolated head in ancestry | `2d2e8801dd383a778c1237cec4ed068922859cf0` | ancestor of `7495adc` | ✅ |
| Historical base in ancestry | `5129707ee684e66cadcf96b976e16eb57385a7cb` | ancestor of `7495adc` | ✅ |
| Current main in ancestry | `0284b66` | ancestor of `7495adc` | ✅ |

Current main carries F2A (`f65ab4b`, canonical Shopify admin read boundary, PR #29) and F2B
(`0284b66`, canonical fact applicator, PR #31).

### 2.1 Prior immutable review blobs

All three prior F2C review artifacts are present at the reviewed head and **byte-identical** to the
mandated blob hashes:

| Artifact | Required blob | Observed blob | Result |
|---|---|---|---|
| `PR5_F2C_COMPATIBILITY_PROJECTION_INDEPENDENT_REVIEW.md` | `5d2d109b9ea5edbe0516bbb7bed115b6f6c83ed7` | identical | ✅ |
| `PR5_F2C_COMPATIBILITY_PROJECTION_CORRECTION_INDEPENDENT_REVIEW.md` | `816dc7fb46cc84c394d8914ac0198c9f110a1825` | identical | ✅ |
| `PR5_F2C_COMPATIBILITY_PROJECTION_SECOND_CORRECTION_INDEPENDENT_REVIEW.md` | `d637a9ecf0f42c3ae62f87e0391abb0b80e2e2ad` | identical | ✅ |

---

## 3. Exact-head CI verification (via GitHub, not PR prose)

Workflow run **33679637702** was read directly from the GitHub Actions API.

| Field | Expected | Observed | Result |
|---|---|---|---|
| `event` | `pull_request` | `pull_request` | ✅ |
| `head_sha` | `7495adc…` | `7495adc0527e225f190f84c5e4a4cc59ca18ab19` | ✅ |
| `conclusion` | `success` | `success` | ✅ |
| `head_branch` | — | `cursor/pr5-f2c-compat-projection-core-7c2d` | ✅ |
| Associated PR | — | `30` | ✅ |

| Job | ID | Conclusion | Result |
|---|---|---|---|
| Classify change set | `100412829943` | `success` | ✅ |
| Lint, typecheck, test, build, Prisma, GraphQL (heavy) | `100412886159` | `success` | ✅ |
| CI Gate | `100427770063` | `success` | ✅ |

The heavy job ran the full path — migrations on ephemeral PostgreSQL, tenant role provisioning, RLS /
immutability / composite-constraint verification, the tenant-access suite, lint, typecheck, GraphQL
codegen, unit tests, migration tests and build — 135 steps, all `success`. The classification job
executed the full-CI path (not docs-only), consistent with `docs_only=false` / `full_ci=true`.

---

## 4. Current-main merge-prep claim verification

Cursor's five sync claims were each independently checked.

**4.1 Final review cherry-picked onto PR30 — verified.** `1af129f` ("independent re-review of the
second correction package") sits on the branch directly above the accepted isolated head `2d2e880`.

**4.2 Current main merged with `--no-ff`, no rebase, no force-push — verified.** Merge commit
`b1d012d` has exactly two parents: `1af129f` (branch) and `0284b66` (current main). The accepted
isolated head, the historical base and current main are all still ancestors of the reviewed head, so
no history was rewritten. PR #30 adds 20 commits on top of main.

**4.3 Sole merge conflict was generated `PR2_TENANT_ACCESS_INVENTORY.md` — verified.**
`git diff-tree -c -r --name-only b1d012d` lists exactly one conflict-resolved path:

```
stocky-plus/docs/phases/phase-1/PR2_TENANT_ACCESS_INVENTORY.md
```

**4.4 `compatibility-projection/**` has no diff vs the accepted isolated head — verified precisely.**
The directory tree object is identical in both commits:

```
2d2e880:…/compatibility-projection  ->  4a2d3cd85a5e95361c3e86cffecd3572b2aba4f9
7495adc:…/compatibility-projection  ->  4a2d3cd85a5e95361c3e86cffecd3572b2aba4f9
```

All 16 core files are unchanged, as is
`prisma/migrations/20260730160100_tenant_compatibility_indexes/migration.sql`
(blob `40e6998…` in both). **Precision note:** a naive glob for `*compatibility-projection*` also
matches `app/tenant/__tests__/pr5-f2c-compatibility-projection.test.ts`, which *did* grow by 750
lines in merge-prep commit `893d3b6`. That file is the PostgreSQL integration **test**, not the
projection core. The claim is correct as stated for the runtime lane; the only F2C-related change
since the accepted head is additive test evidence.

**4.5 Additional current-main compatibility tests apply F2B facts then project — verified.** The new
cases drive the real merged `applyCanonicalFacts` through a live PostgreSQL transaction and only then
invoke `projectCompatibilityFromCanonicalFacts`.

### 4.6 Full PR #30 surface against current main

```
A  app/lib/catalog-facts/compatibility-projection/  (16 files)
A  app/tenant/__tests__/pr5-f2c-compatibility-projection.test.ts
A  docs/phases/phase-1/PR5_F2C_*  (4 files: 1 report + 3 immutable reviews)
M  docs/RISK_REGISTER.md
M  docs/phases/phase-1/PR2_TENANT_ACCESS_INVENTORY.md   (generated)
M  scripts/tenant-access/allowlist.ts                    (one TEST_FILES entry)
```

No schema change, no migration change, no F2A/F2B runtime change, no worker wiring, no feature-flag
change. The merge did not widen the lane.

---

## 5. Generated-inventory / allowlist-masking check

This was the target most likely to hide a manual edit behind a "generated file" conflict resolution.

**Regeneration is byte-identical.** Running the deterministic generator against the current-main
runtime reproduced the committed file exactly:

```
committed    sha256: ae72f23e56108a87f7bd82d84f12f89d7038a7dc861ba9185e3f3564ef61fa0a
regenerated  sha256: ae72f23e56108a87f7bd82d84f12f89d7038a7dc861ba9185e3f3564ef61fa0a
```

`npm run tenant:access:inventory:check` (the CI freshness gate) passes. The recorded content digest
moves from `4670755f…` to `16ab2297…` with scanned files 301 → 318 and findings 1408 → 1567, which is
the expected consequence of F2A + F2B landing on main plus F2C's own files — not a hand-edited
allowlist.

**The `allowlist.ts` change is not a merge-prep edit.** It adds exactly one line:

```ts
"app/tenant/__tests__/pr5-f2c-compatibility-projection.test.ts",
```

`git log` attributes it to `4c346fc` — the *original* F2C core commit — and the file is byte-identical
to the accepted isolated head `2d2e880`. It registers a real, existing test file. No enforcement
surface was widened.

---

## 6. Mandatory integration targets

### 6.1 Canonical immutability — PASS

Two independent lines of evidence.

**Structural.** The legacy writer is typed against a deliberately narrowed view of `TenantDb`:

```ts
type TenantDbLike = Pick<
  TenantDb,
  "authority" | "$transaction" | "shopifyVariantCache" | "inventorySnapshot"
>;
```

No canonical fact model is reachable through the writer at all. `project.ts` touches canonical models
only through `findMany` / `findUnique`. `safety.test.ts` additionally denies
`shopify*Fact.(create|update|upsert|delete)`, `catalogObservationInFlight.*`, any
`compatibilityProjectionState` assignment, and any advisory-lock or observation-generation helper.

**Empirical (probe P1 / P1b).** A full-column fingerprint (`to_jsonb` of every row of
`ShopifyProductFact`, `ShopifyVariantFact`, `ShopifyInventoryItemFact`, `ShopifyLocationFact`,
`ShopifyInventoryLevelFact` — including every observation clock, generation, freshness, diagnostic,
absence-nomination and `compatibilityProjectionState` column) was captured before and after
projection. It is **byte-identical** after both a *failing* projection and a *succeeding* one.

Projection failure occurs strictly after the canonical F2B transaction is committed and durable; the
projector holds no canonical transaction and cannot roll one back (probes P1, P8).

### 6.2 F2B fact shape — PASS

Every resource kind was exercised through the **real merged applicator** — `Product`, `ProductVariant`,
`InventoryItem`, `Location`, `InventoryLevel` — not hand-seeded rows.

- **Existence domain.** `CatalogExistenceState` is exactly `{LIVE, ABSENT}`. F2C's `coerceExistence`
  accepts precisely that set and fails closed otherwise, so the non-retryable
  `invalid_canonical_existence` branch is **unreachable from any state F2B can write**. There is no
  third-value poison path.
- **Relationships.** `ShopifyVariantFact.product` and `ShopifyInventoryLevelFact.{inventoryItem,
  location}` are non-nullable FKs; `ShopifyInventoryItemFact.variant` is nullable because
  `shopifyVariantGid` is nullable. F2C treats the nullable case as a *known-unknown* and fails closed
  retryable (`canonical_variant_link_missing`), never inventing a link from SKU, barcode, title or
  legacy cache.
- **First-LIVE rules.** F2B refuses a first-LIVE insert without complete authoritative attributes, so a
  LIVE variant row always carries non-null `title` / `shopifyProductGid`. F2C's coercion cannot trip on
  a legitimately applied row.
- **Nullable attributes / null-version diagnostics.** Reachable and handled (§6.5).
- **Tombstones.** F2B tombstones are an UPDATE of an existing row, never a physical delete (§6.6).
- **Quantity clocks.** All eight (`available`, `onHand`, `incoming`, `committed`, `reserved`, `damaged`,
  `safetyStock`, `qualityControl`) exist with value / updatedAt / requestGen / responseGen columns.
  F2C reads **only** `availableQuantity`, which is correct: the legacy `InventorySnapshot` compatibility
  row has exactly one quantity column. The other seven are canonical-only and are not projected,
  flattened, or summed.

### 6.3 Parent convergence — PASS (with one informational finding)

Re-falsified against a real F2B product tombstone (probe P3).

After the merged applicator tombstones the Product while the Variant remains LIVE — the genuine
`§10.3` lag graph — projection:

- fails closed (`canonical_product_not_live`);
- is **retryable** (`retryable: true`);
- emits **no** `poisonHalt`;
- **preserves** the existing legacy cache row (title and `imageUrl` unchanged — no degraded overwrite,
  no fabricated title/image);
- leaves the rebuild **cursor un-advanced** (`{ phase: "variants" }`, no `afterGid`), so retry cannot
  falsely claim progress;
- leaves the canonical fingerprint byte-identical.

**Convergence proven.** After the Product returns LIVE, the *same* Variant identity projects
successfully. No item is silently skipped forever because parent convergence lagged.

**Terminal ABSENT vs transient lag, tested separately.** `isTerminalResource` is `kind !== "InventoryLevel"`,
so `Product` is terminal and its revival uses the two-confirmation protocol, not last-writer-wins. A
*single* LIVE observation against a terminally-tombstoned Product yields
`terminal_first_confirmation` and does **not** revive it; the probe confirms the fact row stays ABSENT
and projection stays retryable-without-poison across that intermediate state. Only after the second
non-overlapping confirmation does existence return to LIVE and projection succeed. This behavioural
difference is recorded as **NEW-CLAUDE-F2CCM-01** (P3, informational — see §8).

A further correctness detail worth recording: in the converged state F2B's attribute clock had
*rejected* an equal-version rename, so the canonical title remained `"Prod"`. F2C projected
`"Prod — V"` — the **committed** canonical value — and never the rejected observation. The projector
is faithful to canonical truth rather than to the most recent inbound payload.

### 6.4 Inventory identity — PASS

- **Ambiguous LIVE identity fails closed.** With two LIVE `InventoryItem` rows applied by the real F2B
  applicator against one variant, projection fails with
  `canonical_multiple_live_inventory_items`, `retryable: false`, and a `halt_on_poison` disposition. No
  GID is picked (there is no `localeCompare` tiebreak — asserted by `safety.test.ts`), and **no cache
  row is written** (probe P4).
- **No fabricated zero.** A LIVE `InventoryLevel` whose `availableQuantity` is NULL fails closed
  (`canonical_available_quantity_missing`, retryable) and creates **zero** `InventorySnapshot` rows —
  null is never coerced to Shopify zero (probe P5). `safety.test.ts` statically forbids
  `availableQuantity ?? 0` anywhere in the lane.
- **Canonical 0 and negatives** are copied exactly, not clamped.
- **Empty `inventoryItems: []`** remains valid (zero-live-item behaviour → `inventoryItemId: null`).
- **Malformed / non-array `inventoryItems`** fails closed non-retryable rather than being reinterpreted
  as zero items.
- **Disconnect/reconnect** does not manufacture identity: `DISCONNECT_WEBHOOK` / `DISCONNECT` drive
  existence state only, and F2C reads existence rather than inferring it.

Explicit ABSENT evidence (level, item, location or variant) may legitimately project zero; *unknown* may
not. That distinction is enforced in `resolveSnapshotQuantity` and was exercised in both directions.

### 6.5 Null version / attribute freshness — PASS

Driven through the real applicator (probe P7). A null-version observation against a versioned stored
fact produced exactly the documented outcome: `attributeFreshnessState = DEGRADED`, diagnostic
`CATALOG_NULL_VERSION_OBSERVATION`, and the **stale attributes were not applied** (title stayed
`"Prod"`, not `"NullVer"`).

Projecting that shop then showed:

- F2C projected the **committed** canonical value, not the rejected unversioned one — it cannot
  overwrite a fresher compatibility cache using stale/unversioned data, because the stale data never
  became canonical in the first place;
- `canonicalHealthDecision` is `deferred_to_integration` and
  `canonicalCompatibilityProjectionStateWrite` is `omitted_by_f2c_lane`;
- the serialized result contains **no** `"HEALTHY"` token and no
  `recommendedCanonicalProjectionState` — merchant HEALTHY is never fabricated;
- the canonical fingerprint (including every `attributeFreshnessState` and
  `compatibilityProjectionState` column) is unchanged.

F2C's production code contains **no functional read or write** of `attributeFreshnessState`,
`compatibilityProjectionState` or `existenceDiagnosticState` — only comments referencing them. It
therefore does not treat DEGRADED as trustworthy absolute freshness; it makes no freshness claim at
all and defers the decision. That deferral is correct for this lane, and the residual — that a
DEGRADED-freshness canonical value lands in a legacy row carrying no freshness marker — is precisely
what **R-145** and **R-165** already track as OPEN. It is not closed by this PR and must not be
treated as merchant-safe before the DEGRADED/HEALTHY integration exists.

### 6.6 Tombstones / R-164 — PASS

After the real F2B applicator tombstones a variant, the canonical row **still exists** with
`existenceState = "ABSENT"` (probe P6). F2B's own contract confirms this by construction: *"Tombstone
remains an UPDATE of an already-inserted fact"*, and an unseen ABSENT observation preserves no row
rather than fabricating one.

F2C then removed only the *legacy compatibility representation* (the `ShopifyVariantCache` row, plus
zeroing today's snapshots for historical locations), reported `skippedTombstoneCount: 1`, and left the
canonical fingerprint byte-identical. Physical deletion and mutation of canonical facts remain outside
this lane. R-164 stays open and untouched.

### 6.7 Tenancy — PASS

Proved on disposable PostgreSQL with tenant roles, RLS, forced-RLS and composite constraints applied
exactly as CI applies them.

- **Identical Shopify IDs in two shops remain isolated** (probe P2). Shop A and Shop B were each seeded
  through the real applicator with the *same* `Product/1`, `ProductVariant/1`, `InventoryItem/1` and
  `Location/1` GIDs but different quantities (A = 7, B = 99). Projecting as Shop A produced exactly one
  `ShopifyVariantCache` row and one `InventorySnapshot` row, both `shopId = A`, with
  `quantityAvailable = 7`. Shop B's value never leaked, and no cross-tenant compatibility cache row was
  created or updated.
- **Shop A cannot project Shop B's canonical facts** (probe P2b). With data seeded only in Shop B,
  requesting Shop B's variant GID under Shop A authority failed with `canonical_variant_missing` and
  wrote nothing. There is no bypass through the identity list.
- **No bypass via cursor/cache state.** `shop_rebuild` keyset predicates carry no `shopId`; scoping is
  injected by `TenantDb` and enforced beneath by forced RLS. The probe above exercises exactly that
  path with colliding keys and confirms isolation empirically rather than by inspection.

### 6.8 Transaction failure — PASS

All five injections were exercised; in every case the committed F2B canonical state remained durable
and the canonical fingerprint byte-identical:

| Injection | Result |
|---|---|
| Compatibility write failure (writer throws) | `FAILED`, canonical unchanged, no legacy row written |
| Malformed compatibility input (bad limit / cursor / writer) | Fails closed non-retryable before any write |
| Retryable parent-not-live | `retryable: true`, no `poisonHalt`, cache preserved, canonical unchanged |
| Poison identity (2×LIVE items) | `retryable: false`, `halt_on_poison`, canonical unchanged, nothing written |
| PostgreSQL failure after canonical commit (`P1017`) | `projection_transient_write_failed`, `retryable: true`, canonical commit durable |

### 6.9 Cursor / retry — PASS

- **Retryable `canonical_product_not_live`:** cursor does not advance; `remainingIdentities` retains the
  failed identity; the legacy cache row is preserved; no `poisonHalt`; resume re-attempts the same
  identity and succeeds once canonical converges.
- **Permanent malformed canonical variant / poison:** `retryable: false` plus an explicit
  `PoisonHaltDisposition` with `durableQuarantineRequired: true`. Critically,
  `resumeAfterQuarantineCursor` is documented and typed as **not** the retry cursor — it is unusable
  until a later worker durably quarantines or repairs the identity, so F2C never advances past
  corruption on its own.
- **Unknown / unclassified errors default to non-retryable** (`projection_unclassified_failure`); only
  an explicitly reviewed reason (six enumerated Prisma infrastructure codes) may be retryable.
- **No silent permanent skip.** Proven by convergence in §6.3.

### 6.10 F2A mutation scanner — PASS

The merged recursive scanner (`listProductionTypeScriptModulesRecursive`, R-163) walks the entire
`app/lib/catalog-facts/` tree from `foundation-safety.test.ts`, and
`assertCatalogFactsReadBoundarySafe` applies the deny-by-default GraphQL-AST mutation check across it.
Because `compatibility-projection/` is a subdirectory of `catalog-facts/`, **all 9 F2C production
modules are automatically inside scanner scope** — verified by direct execution:

```
total catalog-facts production modules scanned: 42
F2C modules INSIDE scanner scope: 9
  constants.ts  cursor.ts  errors.ts  index.ts  legacy-writer.ts
  mapping.ts    project.ts  snapshot-date.ts    types.ts
```

PR #30 adds no path that escapes scanner coverage, imports a forbidden Admin mutation service, or
introduces Shopify inventory/product mutation capability. F2C's own `safety.test.ts` adds a second,
lane-specific deny layer (`@shopify`, `graphql-request`, `admin.shopify`, `inventoryAdjustQuantities`,
`inventoryBulkToggleActivation`, `bulkOperationRunQuery`, forecast/ABC/LowStockAlert imports, `fetch(`).
Inventory-write feature flags remain `false`.

### 6.11 Generated / shared file inventory — PASS

See §5.

### 6.12 Current-main test evidence — independently reproduced

Not taken on Cursor's report. Executed locally against disposable PostgreSQL 16 with the CI
environment contract reproduced (pinned npm 11.5.2, migrations, compatibility indexes, tenant role
provisioning, enforcement apply):

| Suite | Result |
|---|---|
| F2C unit + safety + F2B apply-safety (9 files) | **81 passed** |
| Full unit suite (`npm run test`) | **280 passed** (30 files) |
| F2C PostgreSQL integration (`pr5-f2c-compatibility-projection.test.ts`) | **35 passed** |
| Tenant-access suite (`npm run test:tenant-access`) | **321 passed**, 4 skipped |
| `npm run lint` | **pass** |
| `npm run typecheck` | **pass** |
| `npm run tenant:access:inventory:check` | **pass** |
| Git diff check (CI step) | **clean** |
| **Independent Claude adversarial probes (authored for this review)** | **10 passed** |

**Reproducibility discipline — three environment-only failures, each run to ground:**

1. An initial run showed 31 of 35 F2C integration tests failing. Root cause was **my** environment, not
   the code: the tenant runtime role and enforcement objects had not been provisioned, so
   `resetPublicSchema`'s regrant step failed. After running CI's provisioning steps the suite was
   35/35. The tell was that failures surfaced as `projection_unclassified_failure` instead of the
   specific expected codes — an infrastructure error, not a logic error.
2. Five unit failures in `bulk-query-schema.test.ts` were caused by the absent
   `admin-2026-07.schema.json` artifact, which CI materializes in an earlier `graphql-codegen` step.
   After codegen: 280/280.
3. `queue-redis.test.ts` fails locally because no Redis service is available; CI provides one.

None of these are defects in PR #30, and each is recorded here so the evidence is auditable rather
than merely asserted.

---

## 7. Independent PostgreSQL probes

Ten adversarial probes were authored specifically for this review — deliberately **not** reusing
Cursor's assertions — and run on a disposable PostgreSQL 16 instance provisioned to CI parity. Each
drives the **real merged F2B applicator** through a live transaction and only then invokes the PR30
projector. All ten pass, and all were re-run on a freshly rebuilt database to confirm they are not
order- or state-dependent.

| Probe | Target | Result |
|---|---|---|
| P1 | Failing projection mutates no canonical column (full-column fingerprint) | ✅ |
| P1b | Succeeding projection mutates no canonical column | ✅ |
| P2 | Identical Shopify GIDs across two shops stay isolated (A=7 vs B=99) | ✅ |
| P2b | Shop A authority cannot project Shop B's identity | ✅ |
| P3 | Real F2B product tombstone → retryable, no poison, cursor held, then converges | ✅ |
| P4 | Two LIVE InventoryItems → fail closed, no fabricated pick | ✅ |
| P5 | LIVE level with NULL availableQuantity → no fabricated zero row | ✅ |
| P6 | R-164: F2B tombstone leaves the canonical row present | ✅ |
| P7 | DEGRADED / null-version → no fabricated HEALTHY, no projection-state write | ✅ |
| P8 | PostgreSQL failure cannot roll back the committed F2B apply | ✅ |

The probe file was temporary and was **deleted before commit**; the working tree is clean and no PR #30
file was modified.

---

## 8. Findings

### New

**NEW-CLAUDE-F2CCM-01 — P3 — informational — Terminal-parent revival lengthens the parent-convergence retry window beyond a single observation cycle**

- **File / line:** `stocky-plus/app/lib/catalog-facts/apply/types.ts:299` (`isTerminalResource`),
  `stocky-plus/app/lib/catalog-facts/apply/existence.ts` (terminal revival protocol),
  `stocky-plus/app/lib/catalog-facts/compatibility-projection/mapping.ts:84` (`requireLiveProduct`).
- **Evidence:** `isTerminalResource` returns true for every kind except `InventoryLevel`, so `Product` is
  terminal. Reviving a terminally-tombstoned Product requires **two non-overlapping** LIVE confirmations
  with a matching `shopifyCreatedAt`. Probe P3 confirms a single LIVE observation leaves the fact ABSENT
  (`terminal_first_confirmation`), and that projection of the still-LIVE child variant keeps failing
  `canonical_product_not_live` across that intermediate state.
- **Merchant impact:** none today. F2C behaves correctly throughout — retryable, cache-preserving, no
  `poisonHalt`, cursor never advanced — and the lane is not wired to a worker.
- **Reproduction:** tombstone a Product via the real applicator, apply one LIVE observation, project;
  the failure is still `canonical_product_not_live` with `retryable: true`.
- **Expected behaviour:** F3's bounded retry budget for `canonical_product_not_live` must be sized for
  **at least two full observation cycles**, not one, so a legitimately converging variant is not
  exhausted and misclassified as permanently degraded.
- **Recommended correction:** owned by F3. When the retry bound named in NEW-CLAUDE-F2CC2-01 is
  specified, state the terminal-revival cycle count explicitly as its lower bound.
- **Missing test:** an F3 worker test asserting that a parent-ABSENT variant survives the full terminal
  revival protocol without exhausting its retry budget.

This sharpens the already-recorded NEW-CLAUDE-F2CC2-01 rather than introducing an independent defect.
It is nonblocking and explicitly owned by F3.

### Retained

`NEW-CLAUDE-F2CC2-01`, `NEW-CLAUDE-F2CC2-02` and `NEW-CLAUDE-F2CC2-03` are **retained unchanged**. No
exact-head evidence justified changing their status; the current-main composition neither resolved nor
worsened any of them.

### Counts

| Severity | Count |
|---|---|
| **P0** | **0** |
| **P1** | **0** |
| **P2** | **0** |
| **P3** | **4** (1 new: F2CCM-01; 3 retained: F2CC2-01/02/03) |

Every P3 is genuinely nonblocking and explicitly owned by F3 or later integration.

---

## 9. Risk posture

**R-142, R-145, R-156 and R-165 remain OPEN.** None is closed by this review, and PR #30 does not
attempt to close any of them. The register change in this PR is strictly conservative:

- **R-145** was *strengthened*, not relaxed — it now records that a fail-closed F2C inventory
  projection preserves a stale `InventorySnapshot` that `forecasting.server.ts` consumes as current,
  and states explicitly that *"F2C core does not close this risk."* Independently confirmed:
  `forecasting.server.ts:207` orders by `snapshotDate desc` with **no freshness bound** and
  `:214/:224` feed `onHand?.quantityAvailable ?? 0` into the buying calculation.
- **R-165** was *added* as OPEN (P2). Independently confirmed still real:
  `app/jobs/workers/webhook-processor.ts:258` and `:261` still write
  `quantityAvailable: inv.available ?? 0` into the same unique key F2C refuses to fabricate. The
  lane-level "UNKNOWN is never zero" invariant is therefore **not end-to-end**, and PR #30 correctly
  does not patch the legacy webhook from inside the isolated F2C core.
- No risk row was closed, downgraded, or removed.

**R-163** (recursive scanner) and **R-164** (physical-delete reachability) also remain as recorded;
§6.10 and §6.6 confirm F2C neither erodes the recursive scan nor introduces a canonical physical-delete
path.

**F2C does not make PR5 merchant-complete.** F3 still owns worker wiring, projection health state
(`compatibilityProjectionState` DEGRADED/HEALTHY), bounded retries, and legacy webhook fencing. The
`processingEnabled` gate in this core is a caller-supplied boolean and is explicitly documented as
insufficient for production — F3 must read the live authoritative control-plane value immediately
before projection work.

---

## 10. Verdict

The exact integrated head is a clean composition. The projection core is byte-identical to the
independently approved isolated head; the only runtime-adjacent additions are test evidence, a
correctly regenerated deterministic inventory, and one allowlist entry that predates the merge. Every
mandatory integration target was re-derived against the real merged F2A/F2B code and survived
adversarial falsification, including full-column canonical immutability, cross-tenant isolation under
colliding Shopify IDs, no-fabricated-zero, tombstone persistence, and durability of committed canonical
state across five distinct failure injections.

Attempts to falsify the composition produced no P0, P1 or P2 defect.

**APPROVE PR5-F2C CURRENT-MAIN INTEGRATION**

Approval is scoped to merging the F2C compatibility-projection **core** alongside merged F2A and F2B.
It is **not** an approval to wire F2C to merchant-visible surfaces, and it does not close R-142, R-145,
R-156, R-163, R-164 or R-165.
