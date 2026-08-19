# PR5-F2A Admin Read — Second Correction Independent Review

**Reviewer:** Claude Code (independent principal engineer / architecture, security, and release-risk review)
**Review type:** Tier-A adversarial re-review of the PR5-F2A second correction package
**Status:** Immutable artifact. Documentation only.

---

## 1. Verified revision identity

| Item | Value | Verification |
|---|---|---|
| Authorized base | `5129707ee684e66cadcf96b976e16eb57385a7cb` | `git rev-parse` — matches PR base ref `main` |
| Exact corrected head | `febe08fb952eb463383524766f88e59381b74a00` | `git rev-parse origin/cursor/pr5-f2a-admin-read-3ff2` — equals live branch head |
| Merge base | `5129707ee684e66cadcf96b976e16eb57385a7cb` | `git merge-base base head` — **equals the authorized base; no unauthorized rebase or drift** |
| Branch | `cursor/pr5-f2a-admin-read-3ff2` | GitHub PR head ref |
| Commits in PR | 13 | `pull_request_read: get_commits` |

Both prior immutable Claude review artifacts were re-hashed at the exact head and are **byte-identical to their recorded blobs**:

| Artifact | Blob at head | Expected | Result |
|---|---|---|---|
| `PR5_F2A_ADMIN_READ_INDEPENDENT_REVIEW.md` | `81bc0678ea9041b6567c02c8fe5655752fc53441` | `81bc0678…` | **UNEDITED** |
| `PR5_F2A_ADMIN_READ_CORRECTION_INDEPENDENT_REVIEW.md` | `d06fc9f603b8ec86efc1493babaa3973a73d3806` | `d06fc9f6…` | **UNEDITED** |

No prior review artifact was rewritten to accommodate this package.

---

## 2. PR state — discrepancy from the review mandate

The review mandate stated PR #29 must be **OPEN / DRAFT / UNMERGED**. Observed live state:

| Field | Observed |
|---|---|
| `state` | **`closed`** |
| `draft` | `true` |
| `merged` | **`false`** |
| `mergeable_state` | `clean` |
| `closed_at` | `2026-08-19T03:17:10Z` |
| `updated_at` | `2026-08-19T03:17:10Z` |

**DRAFT and UNMERGED hold. OPEN does not.** PR #29 was closed again at `2026-08-19T03:17:10Z`, after the second-correction head was pushed (`2026-08-19T01:29:28Z`) and after its CI completed (`02:12:29Z`).

This is a process observation, not a code defect, and it is recorded here because the mandate asserted a state that is not the live state. Consistent with the PR body's own note about the earlier external closure: **closure is not rejection and not acceptance.** The head commit, its diff, and its CI are unaffected by the PR's open/closed flag, so the technical review below stands on its own.

Per instruction, this review **did not close, merge, reopen, mark ready, or otherwise alter PR #29.**

---

## 3. Changed-file scope

35 files, +6589 / −23 against the authorized base. Scope is confined to the declared lane.

| Area | Files | Assessment |
|---|---|---|
| `stocky-plus/app/lib/catalog-facts/admin-read/**` | 27 (impl + tests + mock) | In-lane |
| `stocky-plus/app/lib/catalog-facts/foundation-safety.test.ts` | 1 | In-lane (recursive scan wiring) |
| `.github/workflows/ci.yml` | 1 | **Shared file** — reviewed below |
| `stocky-plus/package.json` / `package-lock.json` | 2 | Adds `graphql ^16.14.2` to dependencies only |
| `stocky-plus/docs/phases/phase-1/PR2_TENANT_ACCESS_INVENTORY.md` | 1 | **Shared file** — scanner-generated refresh |
| PR5-F2A phase docs (2 immutable reviews + implementation report) | 3 | Documentation |

**Boundary confirmations (grep + suite):**

- No Prisma/database writes anywhere under `admin-read/` (`prisma`, `.create(`, `.update(`, `.upsert(` — zero non-test hits).
- No Shopify mutations. The only occurrences of `bulkOperationRunQuery` are two comments in `bulk-query-documents.ts` explicitly stating the document must **not** be wrapped in it.
- No schema or migration changes.
- `FEATURE_COST_SYNC` unchanged and DEFAULT OFF: `envFlag(name, defaultEnabled = false)`, `.env.example` = `false`, test configs pin `"false"`.

`ci.yml` diff is a **pure move** of the pre-existing `GraphQL codegen / schema validation` step from after `Build` to before `Unit tests`. Triggers, classifier, job matrix, CI Gate, and docs-only logic are untouched. `PR2_TENANT_ACCESS_INVENTORY.md` changes only `scannedFiles` 284 → 285; I independently reproduced `scannedFiles: 285, findings: 1408, violations: 0` and `tenant_access_inventory_fresh`.

---

## 4. Independent execution evidence

Executed by this reviewer at the exact head in a clean worktree — **not** taken from the implementation report. Node `v22.22.2`, npm pinned to `11.5.2` per `.npmrc` `engine-strict=true`.

| Command | Exit | Result |
|---|---|---|
| `npm ci` | 0 | 970 packages |
| `npm run graphql-codegen` | 0 | Generated `app/types/admin-2026-07.schema.json` (6,978,270 bytes) |
| `npm test` | 0 | **19 files / 160 tests passed** — matches the claim exactly |
| `npm run lint` | 0 | clean |
| `npm run typecheck` | 0 | clean |
| `npm run tenant:access:audit` | 0 | `scannedFiles: 285`, `findings: 1408`, `violations: 0` |
| `npm run tenant:access:inventory:check` | 0 | `tenant_access_inventory_fresh` |

**Exact-head automatic CI** (`pull_request`, run `32205143369`, `head_sha=febe08fb952eb463383524766f88e59381b74a00` — equal to the live head), verified via the Actions API rather than the report:

- Classify change set `95926829351` — **SUCCESS**
- Lint, typecheck, test, build, Prisma, GraphQL `95926853111` — **SUCCESS**
- CI Gate `95934068487` — **SUCCESS**
- Run conclusion: **success**, `run_attempt: 1`

Step-level ordering inside the Heavy job independently confirms C01:

| # | Step | Start → End |
|---|---|---|
| 128 | Typecheck | 02:00:26 → 02:00:35 |
| **129** | **GraphQL codegen / schema validation** | **02:00:35 → 02:00:39** |
| **130** | **Unit tests** | **02:00:39 → 02:00:44** |

---

## 5. C01–C06 verification

Each item was verified from the source and by executing adversarial probes written by this reviewer, independent of Cursor's tests.

### C01 — codegen ordering and fail-closed schema gate: **VERIFIED**

| Requirement | Evidence | Result |
|---|---|---|
| Only one `graphql-codegen` invocation | `grep -n graphql-codegen .github/workflows/ci.yml` → **single hit, line 670** | PASS |
| Runs before `npm test` | Heavy steps 129 → 130 (above); ci.yml orders codegen above `Unit tests` | PASS |
| No outbound network fallback | `bulk-query-schema.ts` imports only `node:fs`, `node:path`, `node:url`, `graphql`. No `fetch`, no `http`, no `shopify.dev`, no proxy string | PASS |
| Missing local schema fails closed | **Live probe:** renamed `app/types/admin-2026-07.schema.json` away and re-ran the gate → **5 of 8 tests failed hard** with `Admin 2026-07 schema artifact is absent at … This gate reads only the generated local file and does not fetch shopify.dev.` No fallback, no skip, no silent pass | PASS |
| Schema described as generated, not committed | `.gitignore:42` `/app/types/admin-*.schema.json`; `git ls-tree <head> stocky-plus/app/types/` → **empty**. I ran the real generator and it emitted **exactly** `app/types/admin-2026-07.schema.json`, the path the gate reads | PASS |
| R-016 remains OPEN | `RISK_REGISTER.md` is **not in the diff**; R-016 row still reads "Keep in CI for now; document dependency" | PASS |

The claim is accurate and non-inflated: the module header states plainly that codegen still needs the Shopify network and that R-016 remains open.

### C02 — stock `specifiedRules` validation: **VERIFIED**

| Requirement | Evidence | Result |
|---|---|---|
| Normal graphql-js `specifiedRules` only | `export const bulkQueryValidationRules = specifiedRules;` — a re-export, not a filtered copy. Asserted by identity (`toBe`), so a future `.filter()` breaks the test | PASS |
| All three canonical bulk documents validate | **Independent re-validation** against the freshly generated Admin 2026-07 schema using my own `validate(schema, parse(d), specifiedRules)` call: **0 errors on all 3** | PASS |
| Schema-required `first: Int!` on an unrelated field remains an error | **Independent probe:** `{ shop { productTags { edges { node } } } }` → `Field "productTags" argument "first" of type "Int!" is required, but it was not provided.` | PASS |
| Collapsed traversal fails | `{ products { id } }` → `Cannot query field "id" on type "ProductConnection"` | PASS |
| Missing `quantities(names:)` fails | `Field "quantities" argument "names" of type "[String!]!" is required` | PASS |
| Bad field fails | `Cannot query field "idDoesNotExistXyz" on type "Product"` | PASS |
| Mutation negative fails | Planted `inventoryAdjustQuantities` mutation → `CanonicalReadMutationRejectedError` | PASS |

No pagination-argument relaxation of any kind is present. The P1 defect from the first review (bulk documents invalid because node fields were selected directly on Connection types) is confirmed corrected and is now covered by a real schema gate rather than field-name counting.

### C03 — pagination fails closed: **VERIFIED**

`readCursorPageInfo` in `cursor-pagination.ts` is shared by location and collection pagination, so the two cannot diverge. Verified by direct probes against `paginateCursorConnection`:

| Case | Behaviour | Result |
|---|---|---|
| `pageInfo` absent | throws `pageInfo is missing from Admin response` | PASS |
| `pageInfo` is an array | throws `pageInfo is not an object` | PASS |
| `hasNextPage: "true"` (truthy string) | throws `must be a boolean` | PASS |
| `hasNextPage: 1` | throws `must be a boolean` | PASS |
| **`hasNextPage: null`** | throws `must be a boolean` | **PASS — the critical case.** Under the previous `Boolean()` coercion this became `false` and silently truncated the result set |
| `endCursor: 12` | throws `endCursor must be a string or null` | PASS |
| `hasNextPage: true` with empty edges | throws `page was empty while pageInfo.hasNextPage is true (missing page)` | PASS |
| `hasNextPage: true`, no `endCursor` | throws | PASS |
| duplicate `endCursor` | throws `refusing to loop or skip` | PASS |
| page bound exceeded | throws `refusing to return a truncated set` | PASS |

Scale proofs remain in the suite: `locations.test.ts` — *"exhausts cursors for more than 50 locations with no duplicates or omissions"*; `collections.test.ts` — *"exhausts cursors for more than 250 memberships with no silent truncation"* (251 nodes over 2 pages, asserting `after` = the page-1 end cursor). **There is no code path that returns a partial set without throwing.**

### C04 — malformed quantity rows cannot disappear: **VERIFIED**

Probe with a mixed batch (`available` valid, `name: 123`, `name: ""`, `name: null`, `on_hand` with string quantity, unknown name):

| Channel | Value | Assessment |
|---|---|---|
| `byName` | `["available"]` | Only approved, well-formed rows |
| `malformedRows` | 3 rows, `observedNameKind` = `empty_string`, `null`, `number` | Malformed names surface and **cannot vanish** |
| `malformedQuantityNames` | `["on_hand"]` | Distinct from malformed names |
| `unexpectedNames` | `["not_a_real_name"]` | Distinct |
| `missingApprovedNames` | correctly excludes `on_hand` (present but malformed) | Distinct |

The `malformedRows` channel is **genuinely non-persisted**: each row carries only `reason` and `observedNameKind`. I asserted that no raw value field is attached — an untrusted Shopify value is classified, never stored. `updatedAt` routes through the strict `optionalIsoTimestamp` mapper: `"not-a-date"` throws, `"2026-07-04T10:20:30-04:00"` is preserved unchanged, and a nullable `null` is preserved as `null` rather than coerced.

### C05 — recursive deny-by-default scanner: **VERIFIED**

Built a synthetic module tree and ran the real scanner:

| Vector | Finding produced | Result |
|---|---|---|
| `import` declaration | `forbidden_import` | PASS |
| `export * from "@shopify/x"` | `a.ts:forbidden_import` | PASS |
| dynamic `await import("@shopify/y")` | `b.ts:forbidden_import` | PASS |
| statically resolvable `require("@shopify/z")` | `c.ts:forbidden_import` | PASS |
| nested `deep/deeper/d.ts` relative import into `app/services/` | `deep/deeper/d.ts:forbidden_import` | PASS — recursion confirmed two directories deep |
| malformed GraphQL-shaped literal | `f.ts:syntax` | PASS |
| valid `query Ok { shop { id } }` | **no finding** | PASS — valid queries remain allowed |

Import denial is rule-derived (`@shopify/*`, write-capable server modules, `services/` including resolved relative paths), with an explicitly **empty** exception list — deny-by-default, not a substring allowlist.

**Runtime AST check executes before the Admin network call:** in `execute.ts`, `assertCanonicalReadDocument(document)` is the **first statement** of `executeAdminReadQuery`, before the retry loop and before any `admin.graphql(...)` call. A mutation therefore cannot reach the Shopify client from this module. Confirmed by 17 passing `mutation-safety.test.ts` cases.

I also probed a suspected blind spot — `forbiddenImportSpecifiers` hardcodes `ts.ScriptKind.TS` while the module lister accepts `.tsx`. **The probe did not falsify the guard:** a `.tsx` module containing JSX still produced `forbidden_import`, because the TypeScript parser's error recovery preserves the `ImportDeclaration`. Recorded below as hygiene only, not a defect.

### C06 — DateTime and returned-identity discipline: **VERIFIED WITH ONE EXCEPTION**

| Requirement | Evidence | Result |
|---|---|---|
| Valid Shopify DateTime preserved byte-for-byte | `2026-07-04T10:20:30Z`, `2024-02-29T00:00:00Z`, `2026-07-04T10:20:30.123456Z`, `2026-12-31T23:59:59+05:45`, `2026-01-01T00:00:00-08:00` all returned **identical to input**. Validation is regex + explicit calendar arithmetic with **no `Date.parse` round-trip**, so no normalization or timezone rewrite occurs | PASS |
| Invalid calendar dates fail | `2026-02-29` (2026 is not a leap year), `2025-02-29`, `2026-04-31`, `2026-00-10`, `2026-13-01`, `2026-07-04T24:00:00Z` all throw | PASS |
| Malformed types fail | numeric epoch throws; space-separated and offset-less forms throw | PASS |
| **BulkOperation-by-id returned GID mismatch fails** | returned `…/BulkOperation/999` vs requested `…/111` → `BulkOperationGidError … does not match requested`. Missing/`null` id → `bulkOperation returned identity is missing`. Non-string id → throws | PASS |
| **InventoryLevel-by-id returned GID mismatch fails** | returned `…/InventoryLevel/999` vs requested `…/111` → `InventoryLevelIdentityMismatchError` | PASS |
| Pair-identity check remains | `assertInventoryLevelPairMatchesRequest` cross-checks returned `item.id` and `location.id` against the requested pair | PASS |

**Exception — see NEW-CLAUDE-PR5F2A-S01 below.** `assertReturnedGidMatches` returns early on a `null` returned identity, so `readInventoryLevelById` accepts a response whose `inventoryLevel.id` is `null` without any identity cross-check — while the sibling `readBulkOperationById` path, corrected in this same package, fails closed on exactly that input.

---

## 6. Regression review of earlier F2A findings

All previously accepted corrections were re-verified at this head. **No regressions.**

| Earlier finding | Status | Evidence at this head |
|---|---|---|
| Bulk query executability | **HOLDS** | All 3 canonical documents independently validate with 0 errors against the generated Admin 2026-07 schema |
| 8 quantity names | **HOLDS** | `available, on_hand, incoming, committed, reserved, damaged, safety_stock, quality_control` |
| `unitCost` preflight | **HOLDS** | Cheap **non-bulk** `CATALOG_FACT_UNIT_COST_PREFLIGHT_QUERY` selects the with/no-unitCost bulk document; 9 tests pass; does not enable `FEATURE_COST_SYNC` |
| `bulkOperation(id:)` | **HOLDS** | Polls by persisted GID; `currentBulkOperation` is an AST-forbidden field (`CanonicalReadForbiddenFieldError`) |
| `partialDataUrl` | **HOLDS** | `canonicalSuccessEligible` requires `COMPLETED` **and** non-empty `url` **and** `partialDataUrl == null` |
| Money / ID precision | **HOLDS** | `requireDecimalString` rejects non-strings; `optionalLegacyResourceId` and `stringifyUnsignedCount` refuse `Number`. No `parseFloat`/`Number()` on money paths |
| Mutation safety | **HOLDS** | Deny-by-default on operation type via graphql-js AST; 17 tests; pre-network |
| Recursive scanner | **HOLDS** | Falsified two directories deep by my own probe (R-163 requirement met) |
| No canonical writes | **HOLDS** | Zero Prisma/DB write calls under `admin-read/` |
| No Shopify mutations | **HOLDS** | Only comments referencing `bulkOperationRunQuery`, instructing that it must not be used here |
| `FEATURE_COST_SYNC` DEFAULT OFF | **HOLDS** | `envFlag` defaults `false`; `.env.example=false`; test configs pin `"false"` |

The P2 carried forward from the first correction re-review (bulk documents excluded from schema coverage; substitute test counted field names only) is **fully closed** by C01+C02: the documents are now validated by real graphql-js schema validation against the generated artifact, and the gate fails closed without it.

---

## 7. New findings

### P0 — none.
### P1 — none.

### P2

#### NEW-CLAUDE-PR5F2A-S01 — `readInventoryLevelById` fails **open** on a null returned identity

- **Severity:** P2
- **File:** `stocky-plus/app/lib/catalog-facts/admin-read/resources.ts:58-72` (`assertReturnedGidMatches`), consumed at `resources.ts:399`
- **Evidence:** the guard short-circuits before any comparison:

  ```ts
  function assertReturnedGidMatches(requested, returned, createError, noun) {
    if (returned == null) return;   // <-- fail-open
    ...
  }
  ```

- **Reproduction (executed, not hypothesized):** requested `gid://shopify/InventoryLevel/111`; Admin response `inventoryLevel: { id: null, item: { id: "gid://shopify/InventoryItem/OTHER" }, location: { id: "gid://shopify/Location/OTHER" }, quantities: [] }`. `readInventoryLevelById` **returned successfully** with:

  ```json
  {"shopifyLevelGid":null,
   "identity":{"inventoryItemGid":"gid://shopify/InventoryItem/OTHER",
               "locationGid":"gid://shopify/Location/OTHER"}, ...}
  ```

  The caller asked about one inventory level and received a record labelled with a **different item and a different location**, with no error raised.
- **Merchant impact:** none today. This lane performs no canonical writes and production is unauthorized, so nothing persists the mis-identified record. The exposure is latent: once F3/PR6 writes observations or canonical facts from these readers, a mis-identified inventory level becomes wrong on-hand data for the wrong location.
- **Why this is a defect and not an accepted trade-off:** the *same* correction package hardened the *same* class of bug in the sibling reader. `readBulkOperationById` explicitly throws `bulkOperation returned identity is missing` on `node.id == null`, and I verified that it does. The two by-id readers now disagree about whether an absent returned identity is acceptable. C06's stated intent is fail-closed returned-identity discipline; this path does not implement it. `InventoryLevel.id` is `ID!` in the Admin schema, so a `null` is only reachable via a malformed, truncated, or proxied response — which is precisely the threat model these guards exist for, and the reason the bulkOperation path was corrected.
- **Expected behavior:** an absent or non-string returned identity must fail closed, matching `readBulkOperationById`.
- **Recommended correction (one line, no redesign):** in `assertReturnedGidMatches`, replace the early `return` with a throw, e.g. `if (returned == null) throw createError(\`${noun} returned identity is missing\`);`. Callers that legitimately tolerate an absent identity should opt in explicitly rather than inheriting silence by default.
- **Missing test:** a `readInventoryLevelById` negative case asserting `InventoryLevelIdentityMismatchError` when `inventoryLevel.id` is `null` or non-string — mirroring the `bulkOperation` null-identity test that already exists.

**No other P2 findings.**

---

## 8. P3 findings — residual hygiene, no blockers

None of the following blocks acceptance. All either fail in the safe direction or are latent with no current trigger. Listed for the register, not for this gate.

| ID | Finding | File | Why residual |
|---|---|---|---|
| P3-1 | JSON-shaped string literals are misreported as GraphQL. `looksLikeGraphQLDocument` accepts any literal starting with `{`, so `const cfg = '{"a":1}'` yields `syntax: GraphQL-shaped literal failed to parse: Expected Name, found String "a"` and would fail the boundary scan. **Verified by probe.** | `safety/scan.ts` (`looksLikeGraphQLDocument`) | Fails **closed** and build-time only. Cost is a confusing message plus a blocked legitimate constant, never a missed mutation |
| P3-2 | `forbiddenImportSpecifiers` hardcodes `ts.ScriptKind.TS` while `listProductionTypeScriptModulesRecursive` accepts `.tsx`; `extractGraphQLDocumentsFromTypeScript` correctly branches on `.tsx`, so the two disagree | `safety/scan.ts` | **Probed and not falsified** — TS error recovery still produced the `ImportDeclaration` for a JSX module. Consistency fix only |
| P3-3 | `assertInventoryLevelPairMatchesRequest` skips comparison when returned `item.id`/`location.id` are absent (`if (responseItemGid && …)`) | `resources.ts:74-89` | Mitigated: `mapInventoryLevelNode` then falls back to the **requested** identity, so the row is labelled with what was asked for. Same fail-open family as S01 but not independently exploitable |
| P3-4 | `isValidShopifyDateTime` accepts `second == 60` on any minute (not just a real leap second) and does not reject year `0000` | `decimal.ts` | Over-permissive by a hair on inputs Shopify does not emit; no rewriting or precision loss |
| P3-5 | `scanCatalogFactsProductionModules` passes an **absolute** path as `fileName` to `forbiddenImportSpecifiers` but a POSIX-**relative** path to the GraphQL extractor | `safety/scan.ts` | Cosmetic provenance inconsistency; relative-import resolution still works |

The five P3 items from the previous re-review are unchanged in character; none were reopened by this package.

---

## 9. Risk posture recommendation

| Risk | Recommended posture | Basis |
|---|---|---|
| **R-016** — codegen depends on live Shopify network | **REMAIN OPEN** | Correctly handled and correctly *not* claimed closed. The gate consumes only the generated local artifact, but `npm run graphql-codegen` still requires shopify.dev, and CI now depends on it *earlier* in the Heavy job. Moving the step before `Unit tests` slightly **widens** the blast radius of a Shopify outage: unit tests now fail on a network outage that previously only broke a post-build step. Acceptable trade for a real schema gate; the vendored/cached-schema remedy remains future work |
| **R-132** — missing `unitCost` permission aborts catalog sync | **REMAIN OPEN** | Cheap non-bulk preflight and dual document shapes are implemented and tested, but no production shop has exercised permission denial. `FEATURE_COST_SYNC` stays DEFAULT OFF |
| **R-134** — polling deprecated `currentBulkOperation` | **REMAIN OPEN, evidence strengthened** | `bulkOperation(id:)` binding, GID contract, and AST-forbidden `currentBulkOperation` are all verified. Close only once the ingest lane actually consumes it end-to-end |
| **R-136** — silent location cap at `first: 50` | **REMAIN OPEN, evidence strengthened** | Complete cursor pagination with >50 and >250 proofs and no silent-truncation path. Close only when the legacy `fetchLocations` caller is retired; this lane adds a correct reader beside it and does not remove the cap in production code |
| **R-138** — accidental Shopify writes | **REMAIN OPEN** | Deny-by-default AST rejection is semantic, pre-network, and recursively scanned. Production inventory writes remain UNAPPROVED; keep open until write authorization is formally granted |
| **R-163** — non-recursive safety scanner | **OPEN — correction satisfied; hold pending S01** | The recursive-discovery requirement is met and independently falsified two directories deep. Recommend closing this risk **together with** the S01 fix, so the fail-open identity guard is not left behind under a closed risk |

---

## 10. Artifact and process record

- **Artifact path:** `stocky-plus/docs/phases/phase-1/PR5_F2A_ADMIN_READ_SECOND_CORRECTION_INDEPENDENT_REVIEW.md`
- **Push branch:** `claude/pr5-f2a-admin-read-review-36zihy` (mandated Claude review branch)
- **Why not the PR branch:** this session's operating constraints mandate the Claude review branch and forbid pushing to another branch without explicit permission. Additionally, PR #29 is currently **closed**, so a push to `cursor/pr5-f2a-admin-read-3ff2` would not produce a `pull_request` CI run on a review-artifact head. PR #29 was **not** closed, merged, reopened, or marked ready by this review.
- **Scope of the commit:** this artifact only. No runtime, test, package, schema, migration, CI, or prior review artifact was modified.

---

## 11. Verdict

C01 through C06 each meet their stated acceptance criteria; I verified all six by execution rather than by reading the implementation report, and every earlier F2A finding holds without regression. The exact-head CI is genuinely green and its Heavy-job step ordering independently confirms C01. The engineering quality of this package is high, and the evidence in the implementation report was accurate everywhere I checked it.

One P2 defect nevertheless remains in the cumulative lane. `readInventoryLevelById` accepts a response bearing a **different** item and location identity when the returned level GID is `null`, while the sibling `readBulkOperationById` — corrected in this very package — fails closed on the identical input. This is a demonstrated fail-open in an identity guard, inside a lane whose entire justification is fail-closed identity discipline, and it is a one-line correction. Issuing an acceptance verdict now would close R-163 over a guard that still fails open, and would carry that gap into the F3/PR6 write lane where it stops being harmless.

Per verdict discipline, no readiness verdict may exceed what the evidence supports.

**CORRECTIONS REQUIRED**

Required to clear: **NEW-CLAUDE-PR5F2A-S01** (P2) plus its missing negative test. P3-1 through P3-5 are residual hygiene and are **not** blockers; they may be scheduled independently. No P0 or P1 findings exist in this package.
