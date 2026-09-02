# PR5-F2A Admin Read — S01 Correction Independent Review (Claude Code)

**Review type:** Focused Tier-A / read-boundary correction re-review
**Scope:** `NEW-CLAUDE-PR5F2A-S01` only, plus non-regression of previously reviewed boundaries
**Reviewer posture:** Independent verification. No fixes implemented. No PR state changed.

---

## 1. Verified identity

| Item | Value | How verified |
| --- | --- | --- |
| Authorized base (`origin/main`) | `5129707ee684e66cadcf96b976e16eb57385a7cb` | `git fetch origin main` then `git rev-parse origin/main` |
| Exact reviewed head | `bfbe369f590e38f36de8165e366dd7e84449ecd7` | `git fetch origin cursor/pr5-f2a-admin-read-3ff2`; head commit `Record PR5-F2A S01 correction for missing InventoryLevel by-id identity.` (`2026-08-19T14:20:18Z`) |
| Merge-base(head, base) | `5129707ee684e66cadcf96b976e16eb57385a7cb` | `git merge-base bfbe369… 5129707…` — equals the authorized base exactly; the branch is not stale and carries no foreign base |
| Cumulative diff | 36 files, +7103 / −23 | `git diff --stat 5129707… bfbe369…` |
| S01 delta vs prior head `febe08f…` | 4 files: `resources.ts` (+16/−8), `resources.test.ts` (+102/−23), implementation report, second-correction review artifact | `git diff --stat febe08f… bfbe369…` |

**Live PR #29 state (GitHub API):** `state=open`, `draft=true`, `merged=false`, `mergeable_state=clean`, head `bfbe369f590e38f36de8165e366dd7e84449ecd7`, base `main` @ `5129707…`.
Required posture **OPEN / DRAFT / UNMERGED** is satisfied and was **not** altered by this review.

**Exact-head CI verified from GitHub, not from the report:** run `32263496048`, workflow `CI` (`.github/workflows/ci.yml`), `event=pull_request`, `head_sha=bfbe369f590e38f36de8165e366dd7e84449ecd7`, `run_attempt=1`, `status=completed`, `conclusion=success`, linked to PR #29. Head SHA equals the reviewed head — this is genuine exact-head evidence, not a stale-head run.

---

## 2. Prior immutable artifact verification

All three prior review artifacts are **byte-identical** at the reviewed head (blob SHAs read directly from the head tree via `git rev-parse bfbe369…:<path>`):

| Artifact | Expected blob | Observed blob | Result |
| --- | --- | --- | --- |
| `PR5_F2A_ADMIN_READ_INDEPENDENT_REVIEW.md` | `81bc0678ea9041b6567c02c8fe5655752fc53441` | `81bc0678ea9041b6567c02c8fe5655752fc53441` | **UNMODIFIED** |
| `PR5_F2A_ADMIN_READ_CORRECTION_INDEPENDENT_REVIEW.md` | `d06fc9f603b8ec86efc1493babaa3973a73d3806` | `d06fc9f603b8ec86efc1493babaa3973a73d3806` | **UNMODIFIED** |
| `PR5_F2A_ADMIN_READ_SECOND_CORRECTION_INDEPENDENT_REVIEW.md` | `acbd51277319d0737861355d1db5b5068a070747` | `acbd51277319d0737861355d1db5b5068a070747` | **UNMODIFIED** |

No prior verdict was rewritten, softened, or retro-edited.

---

## 3. The S01 change under review

Single production change, in `stocky-plus/app/lib/catalog-facts/admin-read/resources.ts`:

```ts
function assertReturnedGidMatches(requested, returned, createError, noun): void {
  if (returned == null) {                       // was: `if (returned == null) return;`  ← the S01 defect
    throw createError(`${noun} returned identity is missing`);
  }
  if (typeof returned !== "string") {
    throw createError(`${noun} returned identity type:${typeof returned} does not match requested ${requested}`);
  }
  if (returned === "") {
    throw createError(`${noun} returned identity is empty`);
  }
  if (returned !== requested) {
    throw createError(`${noun} returned identity ${returned} does not match requested ${requested}`);
  }
}
```

**Blast-radius check (critical, because this is a shared helper):** `grep -rn assertReturnedGidMatches stocky-plus/app/` returns exactly **two** hits — the definition (`resources.ts:58`) and **one** call site (`resources.ts:407`, inside `readInventoryLevelById`). The stricter contract therefore cannot leak onto `readInventoryLevelByPair`, `readProduct`, `readLocation`, or the BulkOperation path. This was the primary regression risk of the chosen fix and it is contained.

Guard ordering is correct and contains no dead branch: `null`/`undefined` → non-string → empty-string → inequality. `""` is reachable (it is a non-null string) and is rejected before the equality comparison, so an empty requested id cannot trivially "match" an empty returned id.

**No requested-GID substitution.** `mapInventoryLevelNode` sets `shopifyLevelGid: optionalString(node.id)` and the by-id path calls it as `mapInventoryLevelNode(level)` with **no** `fallbackIdentity` argument. The requested GID is never written into the returned identity on the by-id path. Post-correction, a missing/blank id throws before mapping is reached, so `shopifyLevelGid` cannot be `null` on a successful by-id read.

---

## 4. S01 falsification — independent probe

I did **not** rely on the author's assertions. I wrote a separate adversarial suite (`__claude_s01_probe.test.ts`, 14 cases) against the compiled module and ran it at the reviewed head, then **deleted it** so it is not part of this commit.

### 4.1 Exact-id success proof

| Probe | Result |
| --- | --- |
| Returned `id` exactly equals requested `gid://shopify/InventoryLevel/111` | **PASS** — resolves; `shopifyLevelGid === requested`; `identity` is taken from the *response* `item`/`location` (`InventoryItem/1`, `Location/2`), confirming the by-id path reports observed identity, not requested identity |

### 4.2 Fail-closed proofs (all seven mandated shapes)

Every case rejects with `InventoryLevelIdentityMismatchError` **and** carries `code === "INVENTORY_LEVEL_IDENTITY_MISMATCH"`; none silently resolves.

| # | Returned `id` shape | Result |
| --- | --- | --- |
| 1 | `null` | **FAILS CLOSED** — `inventoryLevel returned identity is missing` |
| 2 | key omitted entirely | **FAILS CLOSED** — `inventoryLevel returned identity is missing` |
| 3 | `""` | **FAILS CLOSED** — `inventoryLevel returned identity is empty` |
| 4 | `12345` (numeric) | **FAILS CLOSED** — `type:number does not match requested` |
| 5 | `{ id: … }` (object) | **FAILS CLOSED** — `type:object does not match requested` |
| 6 | `[ … ]` (array) | **FAILS CLOSED** — `type:object does not match requested` |
| 7 | `gid://shopify/InventoryLevel/999` (different valid GID) | **FAILS CLOSED** — `does not match requested` |

### 4.3 Top-level authoritative-null proof

| Probe | Result |
| --- | --- |
| `data.inventoryLevel === null` | **PASS** — resolves to `null`. Authoritative absence is preserved and is *not* converted into an identity error. The stricter guard sits behind the existing `if (!level) return null;` early return, so absence and malformed-presence remain correctly distinguished. |

### 4.4 Original-defect reproduction (discrimination proof)

To prove the probe actually discriminates rather than passing vacuously, I restored the **pre-S01** `resources.ts` (from `febe08fb952eb463383524766f88e59381b74a00`) into the reviewed tree and re-ran the identical probe:

```
× P2 fails closed for null id      → AssertionError: promise resolved "{ shopifyLevelGid: null, …(5) }" instead of rejecting
× P2 fails closed for omitted id   → AssertionError: promise resolved "{ shopifyLevelGid: null, …(5) }" instead of rejecting
✓ (all 12 other probes pass)
Tests  2 failed | 12 passed (14)
```

This is the **exact** original S01 defect: the pre-correction reader returned a fully-formed `InventoryLevelRead` carrying `shopifyLevelGid: null` — an unidentified inventory level accepted as a valid canonical read. Restoring the S01 code makes all 14 probes pass. The defect is **reproducible before the change and not reproducible after it**, and the two failing modes are precisely the two S01 targeted (empty/numeric/object/array/different-GID already failed closed pre-correction via the inequality branch).

---

## 5. Pair-read non-regression

`readInventoryLevelByPair` does **not** call the changed helper; it uses the separate `assertInventoryLevelPairMatchesRequest`, which is untouched at this head. Independently falsified:

| Probe | Expected | Result |
| --- | --- | --- |
| Wrong returned **item** GID vs requested pair | reject | **FAILS CLOSED** (`InventoryLevelIdentityMismatchError`) |
| Wrong returned **location** GID vs requested pair | reject | **FAILS CLOSED** (`InventoryLevelIdentityMismatchError`) |
| Relation ids omitted (`item: null`, `location: null`), correct requested pair | resolve with requested pair as fallback | **PASS** — `identity === { InventoryItem/1, Location/2 }`; approved fallback semantics **retained** |
| Top-level `inventoryItem.inventoryLevel === null` | resolve `null` | **PASS** |
| Pair-read with `id: null` on the level node | resolve, `shopifyLevelGid: null` | **PASS** — the by-id top-level GID contract was **not** imposed on the pair API |

All five pair probes produce **identical** results on the pre-S01 and post-S01 trees, which is direct evidence that S01 caused no pair-read drift. The separate-API boundary the brief required is intact.

---

## 6. Cumulative smoke regression

| Boundary | Evidence at reviewed head | Result |
| --- | --- | --- |
| AST mutation rejection **before** network | `execute.ts` calls `assertCanonicalReadDocument(document)` as the first statement of `executeAdminReadQuery`, before the retry loop containing the only `admin.graphql(...)` call | **INTACT** |
| No Shopify mutation in boundary | No `mutation` operation, `inventorySetQuantities`, or `inventoryAdjustQuantities` in non-test `catalog-facts` source. `bulkOperationRunQuery` appears only in a comment stating it is deliberately **not** wrapped here | **INTACT** |
| `bulkOperation(id:)`, not `currentBulkOperation` | `documents.ts:255` uses `bulkOperation(id: $id)`; `currentBulkOperation` appears only in the AST **denylist** (`safety/graphql-ast.ts:114-115`) and in tests asserting its absence | **INTACT** |
| Eight quantity names | `types.ts:8-17` — `available, on_hand, incoming, committed, reserved, damaged, safety_stock, quality_control` (exactly 8) | **INTACT** |
| Strict DateTime | `decimal.ts` throws `must be a Shopify DateTime / RFC3339 timestamp` | **INTACT** |
| Complete location/collection pagination | `cursor-pagination.ts` drives a `while (hasMore)` loop with fail-closed handling for empty-page-with-`hasNextPage`, missing `endCursor`, and repeated-cursor loops; no silent `first: 50` cap | **INTACT** |
| 2026-07 schema gate is local-file-only in tests | `bulk-query-schema.ts` uses `node:fs` `existsSync`/`readFileSync` on `app/types/admin-2026-07.schema.json`; error text explicitly states the gate "does not fetch shopify.dev". No network client present | **INTACT** |
| No canonical writes | No `prisma`, `db.`, `.create(`, `.update(`, `.upsert(` anywhere in non-test `admin-read/` | **INTACT** |
| `FEATURE_COST_SYNC` DEFAULT OFF | `feature-flags.server.ts:24` — `costSync: () => envFlag("FEATURE_COST_SYNC")` with `envFlag(name, defaultEnabled = false)` and no override | **DEFAULT OFF** |

**Adjacent same-class audit.** Because S01 is a fail-open identity-check defect, I checked the one other returned-GID assertion in the package: `bulk-operation.ts:100-115` already rejects `node.id == null` **and** non-string before comparing. The S01 defect class does **not** exist there. No sibling instance found.

**P3 residual status.** S01 touched only `assertReturnedGidMatches`, which is unrelated to P3-1, P3-2, P3-4, and P3-5. P3-3 (pair-read skips comparison when relation ids are absent) is the pair path and is provably unchanged (§5). **No previously accepted P3 residual is materially worsened by this head.**

---

## 7. Independent evidence

Executed against a clean worktree checked out at `bfbe369f590e38f36de8165e366dd7e84449ecd7`, with `npm ci` from the committed lockfile (node `v22.22.2`, npm pinned to `11.5.2` per `package.json` engines). Mock Admin client only — **no Shopify API calls, no Shopify mutations, no production data**.

| Command | Result |
| --- | --- |
| `npm run graphql-codegen` | **exit 0** — regenerated `admin.types.d.ts`, `admin.generated.d.ts`, `admin-2026-07.schema.json` |
| `npx vitest run app/lib/catalog-facts/admin-read/resources.test.ts` | **exit 0 — 21 tests passed** |
| Claude independent adversarial probe (14 cases, since removed) | **exit 0 — 14/14 passed** at head; **2 failed** on pre-S01 code |
| `npx vitest run app/lib/catalog-facts` | **exit 0 — 13 files / 110 tests passed** |
| `npm test` | **exit 0 — 19 files / 166 tests passed** |
| `npm run lint` | **exit 0** |
| `npm run typecheck` | **exit 0** (`react-router typegen && tsc --noEmit`) |

Every count claimed in `PR5_F2A_ADMIN_READ_IMPLEMENTATION_REPORT.md` (21 / 110 / 166) was **independently reproduced**, not accepted on assertion.

---

## 8. Findings

### New P0 findings: **0**
### New P1 findings: **0**
### New P2 findings: **0**

No new cross-tenant exposure, inventory/financial corruption, authentication break, data loss, or secret exposure. No new incorrect inventory, cost, entitlement, or reconciliation behavior. No new reliability, performance, or migration defect. The S01 change is narrowly scoped, single-call-site, strictly fail-closed, and moves behavior from fail-open to fail-closed only.

### New P3 findings: **1** (nonblocking)

| ID | Severity | File / line | Finding |
| --- | --- | --- | --- |
| **P3-6** | P3 | `resources.ts:64` and `resources.ts:72` | The `returned identity is missing` and `returned identity is empty` messages omit the requested GID, unlike the type-mismatch and inequality messages which interpolate `${requested}`. **Merchant/support impact:** a production identity failure on a by-id inventory-level read produces a log line that does not say *which* level was being read, forcing correlation against surrounding request context. **Expected:** interpolate `${requested}` in all four branches for uniform diagnosability. **Missing test:** no assertion pins the requested GID into the missing/empty message text. Fail-closed behavior is correct; this is diagnosability only and does not affect inventory correctness. |

P3-1 through P3-5 from the prior immutable reviews remain **open, unworsened, nonblocking residuals**. P3-6 is likewise nonblocking and may be scheduled independently.

---

## 9. Scope discipline

The head implements S01 **only**. It does not close R-163, does not enable any inventory-write flag, does not add canonical writes, does not touch schema or migrations, and does not begin F3 / PR 6. Risks R-016 / R-132 / R-134 / R-136 / R-138 / R-163 remain **OPEN** and are not claimed closed by this head.

---

## 10. Verdict

**APPROVE PR5-F2A ADMIN READ S01 CORRECTION**

P0 = 0 · P1 = 0 · P2 = 0 · New P3 = 1 (P3-6, nonblocking)

The `NEW-CLAUDE-PR5F2A-S01` P2 is **CLOSED**. The defect was independently reproduced against pre-correction code and is no longer reproducible at `bfbe369f590e38f36de8165e366dd7e84449ecd7`. The by-id InventoryLevel identity contract now fails closed on all seven mandated malformed shapes while preserving top-level authoritative absence, and the separate pair-read contract is provably unregressed.

Approval covers **this correction package at this exact head only**. It is not a readiness verdict for PR5-F2A as a whole, not merge authorization, and not authorization for production, F3, or PR 6.

---

*Independent review by Claude Code. No corrections implemented. PR #29 left OPEN / DRAFT / UNMERGED and otherwise untouched; branch `cursor/pr5-f2a-admin-read-3ff2` was read-only to this review.*
