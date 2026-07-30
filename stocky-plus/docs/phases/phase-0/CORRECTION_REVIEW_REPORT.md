# Phase 0 Correction Gate — Independent Review Report (PR #6)

**Reviewer:** Claude (independent review)  
**Subject:** GitHub Pull Request #6 — Phase 0 correction gate (`phase-0/correction-gate`)  
**Merged main tip at review time / expected base for follow-up:** `9844aec437cc4cdae5c678dc4a8c6c1aeec6befb`  
**Final verdict:** `BLOCKED`  
**Date recorded in repo:** 2026-07-29  

This file stores Claude’s independent review of PR #6 for the Phase 0 correction gate follow-up. Findings, evidence, and wording are preserved for the approved follow-up scope. The Phase 0 correction gate is **not closed**. Phase 1 must not start. All inventory-write feature flags must remain default OFF.

---

## Verdict

**`BLOCKED`**

PR #6 was merged into `main` before independent review completed. GitHub Actions for PR #6 failed. The local `npm ci` success claimed in the original correction implementation report did **not** reproduce on clean Linux CI. The original completion claim is superseded by the follow-up on `phase-0/correction-gate-followup`.

The Phase 0 correction gate is not closed.

Phase 1 has not started and must not start until this follow-up is green in CI, Claude returns `READY FOR PHASE 1 FOUNDATION`, the review is stored in GitHub, and ChatGPT / product owner explicitly approves merge and the Phase 1 brief.

---

## CI failure evidence (PR #6)

- Workflow run ID: `30470541851`
- Job ID: `90639313793`
- Failure step: `npm ci`
- Error:

```text
Missing: @emnapi/core@2.0.0-alpha.3 from lock file
Missing: @emnapi/runtime@2.0.0-alpha.3 from lock file
Missing: @emnapi/wasi-threads@2.0.1 from lock file
```

Root cause: the committed lockfile referenced those optional packages (for example via peer ranges such as `^2.0.0-alpha.3`) but did not contain corresponding `node_modules/@emnapi/...` package entries for those versions. Clean Linux `npm ci` therefore failed. A macOS-local install could appear healthy while Linux CI remained broken.

---

## Finding F-001 — Repair the lockfile

**Severity:** Gate blocker (CI red)

The committed lockfile fails on a clean Linux installation.

**Known missing entries:**

- `@emnapi/core@2.0.0-alpha.3`
- `@emnapi/runtime@2.0.0-alpha.3`
- `@emnapi/wasi-threads@2.0.1`

**Required work:**

- Start from a clean state.
- Regenerate the lockfile using a documented Node/npm toolchain.
- Do not update application dependency declarations unless strictly necessary.
- Verify the lockfile diff is minimal.

**Expected lockfile change from Claude’s reproduction:**

- Exactly 3 added optional package entries
- 0 removed entries
- 0 unrelated version changes

**Acceptance criteria:**

- Fresh Linux-compatible `npm ci` succeeds.
- `package.json` and `package-lock.json` are synchronized.
- Only the required lockfile repair is introduced.
- No audit remediation or unrelated upgrades are included.

---

## Finding F-006 — Pin npm consistently

**Severity:** Gate process / reproducibility

The workflow pins Node but not npm.

**Required work:**

- Choose and document one npm version compatible with the repository’s supported Node version.
- The same npm version must be used:
  - To generate the lockfile
  - In local validation evidence
  - In GitHub Actions
- Add a `packageManager` declaration to `stocky-plus/package.json`, for example `"packageManager": "npm@<verified-version>"`.
- Make GitHub Actions explicitly install or activate that exact npm version before `npm ci`.
- Do not choose a version merely because it is newest.
- Use the version that successfully generates the minimal lockfile and passes CI.

---

## Finding F-004 — Prevent false transfer receipt completion

**Severity:** Inventory integrity / false completion

Inspect: `stocky-plus/app/routes/app.transfers.tsx`

**Current risk:**

When `shopifyTransferId` is missing, the unsupported Shopify completion call can be skipped and the local transaction can still mark the transfer as `RECEIVED`.

**Required behavior:**

A transfer must not be marked locally received unless the approved Shopify-authoritative workflow succeeded.

For the current API and phase, the safest behavior is to reject the receive action clearly before any local receipt mutation.

**Required work:**

- Ensure the receive intent cannot update `receivedQty`, `receivedAt`, or `status` when Shopify completion is unsupported.
- Ensure this protection applies whether `shopifyTransferId` is present or absent.
- Preserve the default-OFF transfer-write flag.
- Do not invent a Shopify mutation.
- Do not implement the future Phase 5 receive architecture.

**Tests must prove:**

- Transfer with a Shopify transfer ID does not mutate locally when completion is unsupported.
- Transfer without a Shopify transfer ID does not mutate locally.
- No Shopify or database receipt-completion mutation occurs after the unsupported result.
- The merchant receives a clear unsupported-operation response.

---

## Finding F-005 — Complete cross-shop denial coverage

**Severity:** Tenant safety test coverage gap

Existing tests are meaningful but incomplete.

**Add tests for these missing areas:**

### Stocktake parent denial

Prove Shop B cannot perform a parent-record action on Shop A’s stocktake.

Verify:

- Session shop is used server-side.
- No parent update occurs.
- No child mutation occurs.
- No Shopify inventory mutation occurs.

### Transfer parent denial

Prove Shop B cannot perform a parent-record action on Shop A’s transfer.

Verify:

- Session shop is used server-side.
- No parent update occurs.
- No child mutation occurs.
- No Shopify transfer mutation occurs.

### Buying Table mapping denial

Create a case where:

- The supplier itself resolves for Shop B.
- The SKU mapping belongs to Shop A or does not belong to Shop B.

Verify:

- The mapping is rejected.
- No purchase order is created.
- No PO line is created.
- No Shopify mutation occurs.

Do not count feature-flag assertions as cross-shop record-denial cases.

Report the exact number of record-level denial cases separately from other safety tests.

---

## Out of scope for the follow-up (must not do)

- Start Phase 1
- Add Phase 1 schema or fact tables
- Change forecasting formulas
- Implement Smart Forecasting
- Implement the full entitlement platform
- Change pricing strategy
- Change approved product rules
- Enable inventory writes
- Perform broad dependency upgrades
- Run `npm audit fix`
- Merge the follow-up pull request without ChatGPT authorization after Claude re-review

---

## Process correction required before follow-up merge

Before the follow-up PR is merged, add a branch rule for `main` requiring:

- A pull request
- The `CI` status check to pass
- No merge while the PR is draft

This does not replace Claude review or ChatGPT approval, but it prevents another red PR from reaching `main`.

---

## Gate status after this review

| Item | Status |
|---|---|
| Claude verdict on PR #6 | `BLOCKED` |
| Phase 0 correction gate | Not closed |
| Phase 1 | Not started — must not start |
| Inventory-write flags | Must remain default OFF |
| Follow-up branch | `phase-0/correction-gate-followup` |

Claude must independently re-review the follow-up PR. ChatGPT must authorize any merge.
