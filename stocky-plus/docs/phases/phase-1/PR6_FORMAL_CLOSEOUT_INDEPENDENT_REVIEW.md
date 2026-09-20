# Phase 1 PR6 — Formal Repository Closeout — Independent Documentary / Control Review

**Verdict: `APPROVE PR6 FORMAL REPOSITORY CLOSEOUT`**

**Scope of this verdict:** documentary and control only. It is **not** merge authorization, **not**
formal closure itself, **not** PR7 runtime authorization, and **not** a production-readiness
finding. Formal PR6 repository closure becomes effective only on ChatGPT's closeout/risk
disposition followed by owner squash-merge of PR [#47](https://github.com/Vedang1998/Stocky/pull/47).

**Findings:** P0 = 0 · P1 = 0 · P2 = 0 · P3 = 3 (all dispositioned **accept as-is**; none blocks closeout).

**Subject PR:** [#47](https://github.com/Vedang1998/Stocky/pull/47) — `phase-1/pr6-formal-closeout-b15d` — OPEN / DRAFT / UNMERGED
**Subject head:** `fde01dc5ba2e0076b1579d6690f0548db749af56`
**Base / squash W / current `origin/main`:** `ee193f38491245a10fb2fa60d2cf9a29f3271605`
**Authority:** PR47 comment [5746511091](https://github.com/Vedang1998/Stocky/pull/47#issuecomment-5746511091), under the closeout mandate PR43 comment [5745082755](https://github.com/Vedang1998/Stocky/pull/43#issuecomment-5745082755), under existing **D-054 EFFECTIVE**.

Executed by **Claude Code** (Anthropic CLI, isolated remote container), configured model
`claude-opus-5` — a separate tool and session from the Cursor writer that authored the subject.
No implementation, no fixes, no document corrections, no risk edits, no code, no CI rerun, no
store calls, no mark-ready, no merge. This review adds exactly one file on its own branch.

---

## 1. Identity, lineage and scope — independently verified

All values below were resolved from Git objects in a fresh repository-root checkout and from the
GitHub Actions/PR API. No value was copied from the subject's own prose without re-derivation.

| Check | Expected (subject claim) | Independently resolved | Result |
|---|---|---|---|
| Subject head | `fde01dc5…` | `fde01dc5ba2e0076b1579d6690f0548db749af56` | **MATCH** |
| Subject sole parent | **W** | `ee193f38491245a10fb2fa60d2cf9a29f3271605` (exactly one parent) | **MATCH** |
| Live `origin/main` | **W** | `ee193f38…` (`git ls-remote`) | **MATCH — no drift** |
| Live PR47 branch tip | subject | `fde01dc5…` (`git ls-remote`) | **MATCH — no later push** |
| **W** sole parent **V** | `a3ff480f…` | `a3ff480f1477237f8055f10c43298480a05728a1` | **MATCH** |
| `W^{tree}` | `b24d75b5…` | `b24d75b56a6b371608c450c87bcd887dd4a056c1` | **MATCH** |
| Final accepted PR43 head **R** | `ef2b98c4…` | `ef2b98c42c69f76303c44d0809058ca3c7f3052b` | **MATCH** |
| `R^{tree}` = `W^{tree}` | equal | both `b24d75b5…` | **MATCH** |
| **R** sole parent = accepted **C** | `ca33d9a7…` | `ca33d9a7871fd0eef77d19d06cbe2bfae47dad0b` | **MATCH** |
| C→R delta | one commit, one added file | `A stocky-plus/docs/phases/phase-1/PR6_D_QUOTA_EVIDENCE_INDEX_CORRECTION_INDEPENDENT_REVIEW.md` | **MATCH** |
| **W** merge timestamp | `2026-09-19T18:22:10Z` | committer date `2026-09-19T18:22:10Z` | **MATCH** |
| Changed paths W→subject | 9 | 9 | **MATCH** |
| Additions / deletions | 735 / 66 | 735 / 66 | **MATCH** |
| Commits on PR47 | 1 | 1 | **MATCH** |

### 1.1 Exclusive nine-path allowlist — exact

```
M  stocky-plus/docs/ACCELERATED_SAFE_DELIVERY.md
M  stocky-plus/docs/DECISIONS.md
M  stocky-plus/docs/OPEN_QUESTIONS.md
M  stocky-plus/docs/PROJECT_STATUS.md
M  stocky-plus/docs/README.md
M  stocky-plus/docs/RISK_REGISTER.md
A  stocky-plus/docs/phases/phase-1/PR6_ACCEPTED_RESIDUAL_BACKLOG.md
A  stocky-plus/docs/phases/phase-1/PR6_CLOSURE_REPORT.md
M  stocky-plus/docs/phases/phase-1/README.md
```

Exactly the nine paths the mandate allowlists; the two creates and seven updates match. **Zero**
non-docs paths changed. Tree-identity check against **W**:

| Surface | Result |
|---|---|
| `stocky-plus/app` | **IDENTICAL** |
| `stocky-plus/prisma` | **IDENTICAL** |
| `stocky-plus/scripts` | **IDENTICAL** |
| `.github` | **IDENTICAL** |
| `stocky-plus/package.json`, `package-lock.json` | **IDENTICAL** |
| `stocky-plus/shopify.app.toml` | **IDENTICAL** |

No schema, migration, grant, dependency, CI, scope, flag or PR45 change. `git diff --check`
W→subject is clean. The subject commit does **not** embed its own SHA.

### 1.2 No duplicate writer

Open PRs to `main` at review time: **#47** (this closeout), **#45** planning, **#41** parked
tooling, **#38** docs audit — exactly the set the PR body declares. No competing closeout writer
or PR exists. No branch `claude/pr47-pr6-formal-closeout-review` existed before this review, so
no active exact review was duplicated.

---

## 2. CI evidence — verified, not rerun

No Actions run was triggered, rerun or cancelled by this review.

### 2.1 Required exact-head docs-only CI (subject)

Run [`35471512645`](https://github.com/Vedang1998/Stocky/actions/runs/35471512645) — event **`pull_request`**, attempt **1**, `head_sha` **`fde01dc5…`**, conclusion **SUCCESS**.

| Job | ID | Conclusion | Required | Result |
|---|---|---|---|---|
| Classify change set | `105973195700` | **SUCCESS** | SUCCESS | **MATCH** |
| Lint, typecheck, test, build, Prisma, GraphQL (Heavy) | `105973213679` | **SKIPPED** | SKIPPED | **MATCH** |
| CI Gate | `105973213466` | **SUCCESS** | SUCCESS | **MATCH** |

Event is `pull_request`, not `workflow_dispatch`. The branch tip is still the subject, so there
was **no stamp-only push after green**. A skipped Heavy is the correct outcome for a provably
docs-only diff under `CI_POLICY.md` §3–§4.

### 2.2 Classifier — executed locally by this review

| Command | Result |
|---|---|
| `bash .github/scripts/classify-ci-change-set.test.sh` | exit 0 — `assertions=40 pass=40 fail=0`, "self-test OK" |
| `classify-ci-change-set.sh --from-git ee193f38… fde01dc5…` | `changed_path_count=9`, `classification_reason=every_changed_path_is_docs_allowlist`, `docs_only=true`, `full_ci=false` |

Both reproduce the subject's declared values exactly.

### 2.3 Upstream CI identities re-verified against the Actions API

| Run | Event | Head | Conclusion | Claim | Result |
|---|---|---|---|---|---|
| [`35460969411`](https://github.com/Vedang1998/Stocky/actions/runs/35460969411) | `push` (main) | **W** `ee193f38…` | **SUCCESS** | exact-W post-merge | **MATCH** |
| — Heavy `105944660979` | — | — | **SUCCESS**, 146 executed steps incl. PostgreSQL/Redis/migration suites | "full Heavy, not SKIPPED" | **MATCH** |
| [`35454095462`](https://github.com/Vedang1998/Stocky/actions/runs/35454095462) | `pull_request` | **R** `ef2b98c4…` | **SUCCESS** | exact-R pre-merge, R-only | **MATCH** |
| [`35219870613`](https://github.com/Vedang1998/Stocky/actions/runs/35219870613) | `pull_request` | `62f7a060…` | **FAILURE** | preserved failure | **MATCH** |
| [`35336443725`](https://github.com/Vedang1998/Stocky/actions/runs/35336443725) | `pull_request` | `2084aebdea65…` | **FAILURE** | preserved failure | **MATCH** |
| [`35415196729`](https://github.com/Vedang1998/Stocky/actions/runs/35415196729) | `pull_request` | `1e5c18ed…` | **FAILURE** | preserved failure | **MATCH** |

`35412301750` (`28d93421…`, FAILURE) is corroborated by contemporaneous PR43 records
[5741540117](https://github.com/Vedang1998/Stocky/pull/43#issuecomment-5741540117) /
[5741972761](https://github.com/Vedang1998/Stocky/pull/43#issuecomment-5741972761). **No failed run
was relabelled as success anywhere in the closeout.**

---

## 3. Review preservation — every immutable artifact intact

Blob hashes resolved with `git rev-parse <rev>:<path>` at both **W** and the subject.

### 3.1 Six immutable PR6-D reviews

| Artifact | Blob at W | Blob at subject | Result |
|---|---|---|---|
| `PR6_D_COMPLETE_INTEGRATION_INDEPENDENT_REVIEW.md` | `48ac291a781b2347cb6017af862f2de9677826a5` | same | **UNCHANGED** |
| `PR6_D_CORRECTION_INDEPENDENT_REVIEW.md` | `ba82a3c981cda4bec52ea453c2618319288fa66c` | same | **UNCHANGED** |
| `PR6_D_SOURCE_CONTRACT_INDEPENDENT_REVIEW.md` | `1eb18cae44cdf7a6660256e2632ebc8019d6da0d` | same | **UNCHANGED** |
| `PR6_D_SC_RECOVERY_FINAL_INDEPENDENT_REVIEW.md` | `e8525c2fd2778c8baf118d0008a9213b7af4eca8` | same | **UNCHANGED** |
| `PR6_D_FINAL_CONTROL_INTEGRATION_INDEPENDENT_REVIEW.md` | `ee3f625ce2106b893e9018319e19ef2685e6beab` | same | **UNCHANGED** |
| `PR6_D_QUOTA_EVIDENCE_INDEX_CORRECTION_INDEPENDENT_REVIEW.md` | `74e57479c15cb8c8ed7ca8a98b07ad820da62e85` | same | **UNCHANGED** |

Reviewed heads and exact verdicts in the closeout's table were re-read from each artifact and all
six match: `25226e46…` / `7e0329f6…` / `09029c09…` / **H** `4768033b…` / **S** `dab5accc…` →
`CORRECTIONS REQUIRED`; **C** `ca33d9a7…` → `APPROVE PR6-D QUOTA-EVIDENCE AND INDEX CORRECTION`.
**Five of the six terminal PR6-D reviews are negative and all five remain byte-identical.** The
closeout does not soften, summarize away or reinterpret any of them.

### 3.2 Upstream planning / A / B / C / tooling blobs

| Artifact | Claimed blob | Result |
|---|---|---|
| `PR6_EMERGENCY_ORDER_REFUND_FACTS_PLAN_INDEPENDENT_REVIEW.md` | `d72340c01dd9c662d0e8bb4aa8d43482940470d9` | **MATCH** |
| `PR6_EMERGENCY_ORDER_REFUND_FACTS_PLAN_CORRECTION_INDEPENDENT_REVIEW.md` | `fca2b260d03e3105782ed216f7773c53e6aef2a7` | **MATCH** |
| `PR6_CURRENT_MAIN_FINAL_INDEPENDENT_REVIEW.md` | `4f5ea10f6d36175d3540cb977a8f3543f36c15c2` | **MATCH** |
| `PR6_A_FOUNDATION_INDEPENDENT_REVIEW.md` | `198e55548a2ca09942843798a9ebd3e03a30d0fa` | **MATCH** |
| `PR6_A_FOUNDATION_CORRECTION_INDEPENDENT_REVIEW.md` | `da388c5d2ffa8bc0e04312de9c14a831b5ba4010` | **MATCH** |
| `PR6_B_ADMIN_READ_INDEPENDENT_REVIEW.md` | `b4533610b5af305816aef5434b884c3065b06f94` | **MATCH** |
| `PR6_B_ADMIN_READ_CORRECTION_INDEPENDENT_REVIEW.md` | `e902a1ce07e30174cd56cea13114be7325195c98` | **MATCH** |
| `PR6_C_APPLICATOR_INDEPENDENT_REVIEW.md` | `a90ae442a80ee593bb43bee3b15c2228f32d6e15` | **MATCH** |
| `PR6_C_APPLICATOR_CORRECTION_INDEPENDENT_REVIEW.md` | `8c384b698bc45a7a9ac0a1dffa2ab8fdbcc65704` | **MATCH** |
| `PR6_C_APPLICATOR_FINAL_INTEGRATION_INDEPENDENT_REVIEW.md` | `0daa0e5395c69b1fb86508f133f6ade3f8430f56` | **MATCH** |
| `PR6_BC_CI_RELIABILITY_INDEPENDENT_REVIEW.md` | `5a47f6f8133806848ad71a545e07c030a2137e37` | **MATCH** |

The source-contract provenance qualification on blob `1eb18cae…` / commit `7710758b…`
(`Cursor Agent` / `cursor[bot]` GitHub author metadata, ChatGPT-unverified independence) is
**preserved verbatim and not converted into verified independence**. Correct.

---

## 4. Acceptance-record conformance

Each governing PR43 record was read in full and compared against the closeout's characterization.

| Record | What it actually says | Closeout's use | Result |
|---|---|---|---|
| [5743346411](https://github.com/Vedang1998/Stocky/pull/43#issuecomment-5743346411) | C-head technical acceptance of the quota-evidence/index correction | cited as earlier C-head acceptance | **FAITHFUL** |
| [5744256383](https://github.com/Vedang1998/Stocky/pull/43#issuecomment-5744256383) | "**ACCEPT PR6-D REPOSITORY IMPLEMENTATION** … repository implementation acceptance, **not** formal PR6/Phase 1 closure or production approval"; "This decision closes no risk row by implication" | cited as D technical acceptance only | **FAITHFUL** |
| [5744321465](https://github.com/Vedang1998/Stocky/pull/43#issuecomment-5744321465) | owner squash-merge verified; W / sole parent V / tree = R; "Formal PR6 closure is NOT declared" | cited as merge verification | **FAITHFUL** |
| [5745082755](https://github.com/Vedang1998/Stocky/pull/43#issuecomment-5745082755) | post-merge evidence accepted; authorizes ONE docs-only closeout PR; nine paths; present-state wording; effective-on-merge clause; individual R-166…R-185 adjudication; R-176 OPEN/P0; R-164 unchanged | cited as closeout authority | **FAITHFUL** |

**Mandate-by-mandate conformance of the subject:**

| Mandate requirement | Result |
|---|---|
| Nine allowlisted paths, no more | **MET** (exactly 9) |
| Branch created from exact **W**; platform suffix returned verbatim | **MET** (`-b15d` declared) |
| One NEW draft docs-only PR; no reuse of PR43/45/46 | **MET** |
| Present-state wording ("technically accepted and merged; formal closure pending") | **MET** — used consistently across all seven live control files |
| Explicit effective-on-merge clause | **MET** — `PR6_CLOSURE_REPORT.md` |
| No invented closeout squash SHA or premature closure timestamp | **MET** — no self-SHA; no "PR6 FORMALLY CLOSED" string anywhere |
| Scope/acceptance-to-evidence crosswalk | **MET** |
| All D correction families (D-R, original N, SC, SC-R, NEW-SCQ, JSONL, CLEANUP-01, INDEX-01/02) with final dispositions | **MET** — all present; original meanings and severities preserved; the "N-04…N-08 relabel" hazard is explicitly flagged and resolved against blob `ba82a3c…` |
| Evidence-class separation (independent review / Cursor execution / source inspection / CI / inference) | **MET** — dedicated attribution table |
| CI success vs intentionally skipped opt-in envelope separated | **MET** — per-head envelope table; W/R marked "not rerun" |
| Source/production limits stated and not upgraded | **MET** |
| Phase 1 / PR7 entry conditions and non-authorizations | **MET** |
| Six D blobs preserved on the closeout branch | **MET** (§3.1) |
| Next unused D-054 subitem appended; no D-055 | **MET** — **W** ends at item 25; subject adds **item 26**; no `D-055` decision created |
| `ACCELERATED_SAFE_DELIVERY.md` current-authority paragraph only | **MET** — exactly one paragraph changed; governance body untouched |
| Q-008, Q-012…Q-016 remain open | **MET** — all six verified OPEN; only stale PR6 entry language changed |
| No `read_all_orders` grant claimed | **MET** — explicitly disclaimed |
| `git diff --check`, classifier self-test, W→head classification | **MET** (§2.2) |
| Classify SUCCESS / Heavy SKIPPED / Gate SUCCESS at exact head | **MET** (§2.1) |
| No CI modification, no `workflow_dispatch`, no stamp-only push | **MET** |
| Historical records linked as dated source records, not rewritten | **MET** — see §5 |

### 4.1 Newly introduced Git identities — all re-derived

Every Git object newly introduced into the nine documents was checked against the repository:
**W**, **V**, **M** (`bdbb5bba…`, tree `9e5a700b…`), **T** (`f5ec7abb…`), **U** (`1ec7af31…`),
**R**, **C**, the planning squash `09feffd3…`, all eleven upstream review blobs, the six D blobs,
and every referenced Actions run. **No fabricated identity, path, filename or run ID was found.**
All 29 Markdown references in the two new reports resolve to files that exist at the subject
(`PHASE_BRIEF.md`, `PR6_D_SCRATCH_OPERATOR_RUNBOOK.md`, `PR5_F3_ACCEPTED_RESIDUAL_BACKLOG.md`,
the six D reviews, and the rest). The cited test paths
`scripts/tenant-enforcement/tests/pr6-d-scale-envelope.test.ts`,
`scripts/tenant-enforcement/tests/pr6-c-scale-envelope.test.ts` and
`vitest.migrations.config.ts` all exist on **W**.

**Timestamp note (not a finding).** Three merge timestamps carried into the closeout —
**U** `2026-09-14T20:15:14Z`, **T** `2026-09-14T02:27:29Z`, planning `2026-09-07T00:53:25Z` —
run one second ahead of the corresponding Git committer dates. These are GitHub `mergedAt`
values, they are reproduced verbatim from records already accepted on **W**, and **M**/**V**/**W**
match their committer dates exactly. No correction is warranted.

---

## 5. Historical preservation — dated snapshots not rewritten

The closeout converts stale live-status sentences in historical snapshot tables into explicitly
labelled historical rows rather than deleting or restating the original claims. Spot-checks:

- The T-era snapshot's PR6-B / PR6-C / PR6-D rows are re-labelled "**Historical T-era row**" and
  retain what was true at T ("technically accepted, not yet merged", "in correction / not accepted").
- `NEW-CLAUDE-PR33CP-01` is extended with "**Later resolution (not a rewrite of the original
  finding)**" rather than having its original P3 statement replaced.
- DECISIONS item 25 gains a "**Historical at item 25 publication**" clause; its original text is
  otherwise untouched. Items 22–24 are unmodified.
- The closeout publishes an explicit table of records carrying stale live sentences that it is
  forbidden to edit (A closure, B/C closure, D execution brief, D implementation report, B/C
  execution brief, the six D reviews) and routes live status to the seven control files.

**The five negative PR6-D verdicts, the negative A and B and C original verdicts, and every dated
acceptance snapshot survive intact.** No historical negative review was softened.

---

## 6. Findings

### P3-CLOSEOUT-01 — risk→evidence traceability is contract-level, not case-level (18 of 20 rows)

- **Severity:** P3 · **Class:** documentary traceability · **Disposition: ACCEPT AS-IS**
- **Location:** `stocky-plus/docs/RISK_REGISTER.md` rows R-166…R-185; `PR6_CLOSURE_REPORT.md`
  "Risk recommendations" matrix.
- **Evidence:** Most rows justify a scoped-closure recommendation with a lane-level assertion
  ("C applicator net-units contract is **satisfied** at squash **V**") rather than a citation to
  the specific approved test case or review section that proves it. The three immutable PR6-C
  reviews name only `R-161`, `R-164` and `R-176`; they never mention `R-166`…`R-185`, and the
  frozen policy identifier `net-units-order-date-v1` appears only in planning documents, not in
  the C reviews or in application code. Only **R-172** cites a plan case by ID (`T27`); **R-171**
  and **R-180** cite A review blobs.
- **Why it is P3 and not higher:** the mapping is substantively supportable. I traced it to the C
  review's §6 requirement-to-test matrix, which independently adjudicates the plan §19 cases that
  carry these risks — `T07`/`T08`/`T47`/`T55` (unit ledger, no double subtraction → R-181, R-168),
  `T27` (presentment/shop money, no FX → R-172), `T41`/`T42`/`T43` (aged-out null, in-window
  tombstone, unverified delete → R-176, R-177), `T09`/`T44`/`T45` (stale parent, snapshot
  atomicity → R-179), `T46` (null refund-line id, ordinal identity → R-180), `T11`/`T12` (no SKU
  relink → R-171). I additionally verified two claims directly against `schema.prisma` at **W**:
  `ShopifyOrderLineFact` relates only to `Shop` and `ShopifyOrderFact` with **no FK to
  `ShopifyVariantFact`** (R-171), and `ShopifyOrderRefundLineFact` carries a non-null
  `refundLineOrdinal` inside the composite unique
  `(shopId, shopifyRefundGid, shopifyLineItemGid, refundLineOrdinal)`, so refund-line identity does
  not depend on the nullable `shopifyGid` (R-180). Both hold.
- **Merchant impact:** none. The risk is future auditability: a later reader cannot confirm a
  scoped closure from the register row alone without re-deriving the mapping.
- **Recommended correction:** none required for this closeout. ChatGPT may optionally require plan
  §19 case IDs beside each scoped-closure recommendation in a later authorized docs pass.
- **Missing test:** not applicable (documentary).

### P3-CLOSEOUT-02 — one stale live sentence outside the allowlist is not disclosed

- **Severity:** P3 · **Class:** undisclosed live contradiction beyond the allowlist · **Disposition: ACCEPT AS-IS; location returned here**
- **Location:** `stocky-plus/docs/phases/phase-1/PR5_CATALOG_LOCATION_INVENTORY_FACTS_BRIEF.md`
  **line 18** and **line 54** — both name PR27's squash merge as the current `origin/main`,
  giving `7827e535415c9acbacfbbb4bdedff08be6650d5c`.
- **Evidence:** `7827e535…` is the PR #27 (PR5-F1) squash. Current `origin/main` is **W**
  `ee193f38…`. The statement has been stale since PR #29 and is pre-existing on **W**. The
  closeout's "Historical records with stale live-status sentences (not rewritten)" table lists six
  record classes and does **not** include this file. The mandate requires returning the exact
  location of a material live contradiction beyond the allowlist rather than expanding scope; the
  subject correctly did not edit it, but also did not name it. I swept every mutable document in
  `stocky-plus/docs/**` for stale current-main, "live main" and present-tense
  "PR6-D is **ADMITTED**" claims; this is the **only** undisclosed instance. All other hits are
  dated implementation reports and immutable reviews whose snapshot framing is the established
  repository convention.
- **Merchant impact:** none. It is a PR5-era brief and contradicts no PR6 claim made by this
  closeout.
- **Recommended correction:** do **not** widen this closeout. ChatGPT may fold the two lines into a
  later authorized docs pass, or record them in the closeout's stale-sentence table at disposition
  time. This finding discharges the mandate's "return its exact location" obligation.
- **Missing test:** not applicable (documentary).

### P3-CLOSEOUT-03 — a historical identity is dropped when a T-era row is re-labelled

- **Severity:** P3 · **Class:** historical detail reduction · **Disposition: ACCEPT AS-IS**
- **Location:** `stocky-plus/docs/PROJECT_STATUS.md`, PR #42 / T-era snapshot table, PR6-B row.
- **Evidence:** the pre-existing row read "…accepted correction subject `57bebc6b…`; B runtime/tests
  byte-identical through this T merge". The replacement row preserves the status
  ("technically accepted, not yet merged") but drops the identity `57bebc6b…` and the
  byte-identity statement.
- **Why it is P3:** no repository-level evidence loss. `57bebc6b…` remains recorded in four dated
  source records at the subject — `PR6_BC_CI_RELIABILITY_INDEPENDENT_REVIEW.md`,
  `PR6_BC_CI_RELIABILITY_REPORT.md`, `PR6_BC_EXECUTION_BRIEF.md` and
  `PR6_B_ADMIN_READ_IMPLEMENTATION_REPORT.md` — and the object remains reachable on
  `origin/claude/admiring-thompson-gk4rbb`.
- **Merchant impact:** none.
- **Recommended correction:** none. The identity is preserved where dated records belong.
- **Missing test:** not applicable (documentary).

### No P0 / P1 / P2 documentary defects

Specifically **not** found: an invented closeout squash SHA; a premature closure declaration; a
D-055; an edited immutable review; a silenced negative verdict; a silent risk-status or severity
change; a relabelled failed CI run; a fabricated test, command, run ID, blob or path; a
production-readiness claim; a PR7 authorization; a PR45 edit or adoption; an inference presented
as proven fact.

---

## 7. Twenty-row risk adjudication — decision-ready for ChatGPT

**Register state is unchanged by the subject and by this review.** All twenty rows remain **OPEN**
at their original severities; the diff touches only the Evidence, Residual and Follow-up columns.
I re-extracted the severity and Residual status of all twenty rows at **W** and at the subject:
**every severity identical; every status still OPEN**. R-176's residual now reads "OPEN / **P0**"
— added emphasis, not a status change. No ID renumbering, no new risk invented, no severity
reduced.

The recommendations below are for **ChatGPT's** disposition. "Scoped closure" means recording that
the *repository* obligation is discharged; it does not by itself close the register row.

| # | Risk | Sev | Subject's recommendation | My adjudication | Basis / qualification |
|---|---|---|---|---|---|
| 1 | **R-166** | P1 | Scoped closure + standing regression control | **ACCEPT (qualified)** | B LIST/connection gates at **U**; D refetch accepted on **W**. Close the repository obligation; **re-arm** the anti-truncation control if a REST-delta or `first`-paginated reader is ever reintroduced. Not live-store proof. |
| 2 | **R-167** | P1 | Scoped closure of window-representation | **ACCEPT (qualified) — row stays OPEN** | Repository honesty obligation discharged. The operational 60-day / Partner-grant limitation is a *live* remainder and must stay explicitly with **R-176** / **Q-016**. Do not close the whole row. |
| 3 | **R-168** | P1 | Scoped closure + standing control | **ACCEPT — full register closure defensible** | C net-units contract; D invents no second arithmetic authority. Traceability caveat P3-CLOSEOUT-01 applies; substance confirmed via plan §19 `T07`/`T08`/`T47`/`T55`. Retain the standing guard. |
| 4 | **R-169** | P1 | Scoped closure + standing control | **ACCEPT — full register closure defensible** | C location contract at **V**; no `"default"` on the canonical path. Retain the standing guard. |
| 5 | **R-170** | P1 | Scoped closure | **ACCEPT (qualified) — row stays OPEN** | Webhook-as-signal + Admin refetch accepted on **W**. **Live webhook traffic was never observed**; that remainder is real and belongs to production enablement, not to a closed row. |
| 6 | **R-171** | P1 | Scoped closure + standing schema guard | **ACCEPT — full register closure defensible** | **Independently re-verified at schema level on W**: `ShopifyOrderLineFact` has no FK to `ShopifyVariantFact`. Retain the schema guard. |
| 7 | **R-172** | P1 | Scoped closure of persist/no-FX; keep Q-012 | **ACCEPT (qualified) — row stays OPEN** | Best-evidenced row (cites `T27`). Persist/no-FX discharged; ABC **labels** remain **Q-012**. Do not invent a new risk ID for the label question. |
| 8 | **R-173** | P2 | Scoped closure of declarations; live registration unfulfilled | **ACCEPT (qualified) — row MUST stay OPEN** | Only the *declaration* obligation is discharged. Live Partner/subscription registration is unfulfilled on this same row. Record as **partial**, never as closed. |
| 9 | **R-174** | P1 | Scoped closure + standing control | **ACCEPT — full register closure defensible** | C independent Order/Refund clocks at **V**; D reuses them. Retain the anti-clock-collapse guard. |
| 10 | **R-175** | P1 | Scoped closure | **ACCEPT (qualified)** | B schema + bulk-rule gates at **U**; D runs both before any submitter call; Bulk B disabled, Bulk C rejected. Closure is defensible **because no submitter is enabled**; re-arm on any live bulk enablement. See also residual `NEW-CLAUDE-PR6B-C01`. |
| 11 | **R-176** | **P0** | **KEEP OPEN / P0** | **ACCEPT — ENDORSED. Reject any closure.** | A representability + C window/unverified-delete/two-confirmation revival + D repository evidence accepted on **W** are *repository* evidence only. The access-window / tombstone safety control, the `read_all_orders` dependency and all future-change obligations stand. Mass false tombstoning is unrecoverable and remains a production-gating P0. |
| 12 | **R-177** | P1 | Scoped closure of deletion signal | **ACCEPT (qualified) — row stays OPEN** | Repository deletion-signal obligation discharged; live registration remains with R-173's live portion. Not sound deletion authority in production until registered. |
| 13 | **R-178** | P1 | Scoped closure of reconcile/diagnostics | **ACCEPT (qualified) — row stays OPEN** | Reconcile/coverage discharged. **Aged-out history remains unhealable** without a later authorized grant — a real remainder tied to **Q-016** / **R-176**. |
| 14 | **R-179** | P1 | Scoped closure + standing control | **ACCEPT — full register closure defensible** | C snapshot atomicity at **V** (`T09`/`T44`/`T45`); D maps incomplete parents to no receipt. Retain the guard. |
| 15 | **R-180** | P1 | Scoped closure + standing schema guard | **ACCEPT — full register closure defensible** | **Independently re-verified at schema level on W**: non-null `refundLineOrdinal` inside the composite unique key; identity does not depend on nullable `shopifyGid`. Retain the schema guard. |
| 16 | **R-181** | P1 | Scoped closure + standing control | **ACCEPT — full register closure defensible** | C unit-event contract at **V**; D adds no second unit-event writer. Retain the anti-double-subtraction guard. |
| 17 | **R-182** | P1 | **KEEP OPEN** (later PO-02 cutover) | **ACCEPT — ENDORSED** | D retains frozen v1 projections; the sanitizer cutover is a **later authorized PR**, owner ChatGPT. Correctly **not** routed to the completed D branch and **not** implied to be PR7 runtime. |
| 18 | **R-183** | P1 | Scoped closure | **ACCEPT (qualified) — row stays OPEN** | A columns + C writers + D `DataIssue` control-plane mirroring discharged. Explicitly **not** production-ops proof; operational diagnostic visibility remains unproven. |
| 19 | **R-184** | P2 | Scoped closure of persist/signal code | **ACCEPT (qualified) — row MUST stay OPEN** | Persist and `order_transactions/create` signal **code** accepted; live registration remaining. `OrderTransaction.status` mutability is unobservable in production until registered. |
| 20 | **R-185** | P2 | Scoped closure | **ACCEPT (qualified)** | Bulk C reject + Bulk B disabled/costed fallback at **U**; D enables neither. Closure defensible while no submitter is enabled; re-arm on live bulk enablement. |
| — | **R-164** | P3 | **UNCHANGED** | **ACCEPT — ENDORSED** | Row is untouched by the diff. Tenant-scoped physical DELETE remains reachable at the DB layer; ordinary apply remains tombstone-only. This closeout alters no DELETE privilege, RLS or tombstone contract. |

**Summary for disposition.** Seven rows — **R-168, R-169, R-171, R-174, R-179, R-180, R-181** —
carry no surviving non-repository obligation; a full register closure plus a standing
regression/schema guard is defensible today. Three rows — **R-166, R-175, R-185** — are defensible
now but must be re-armed the moment a live reader or bulk submitter is enabled. Ten rows —
**R-167, R-170, R-172, R-173, R-176, R-177, R-178, R-182, R-183, R-184** — **must remain OPEN**:
each carries a genuine live-operation, Partner-grant, later-metric or later-cutover obligation that
no repository evidence can discharge. **R-176 stays OPEN / P0 unconditionally.**

Every surviving obligation in the subject's register rows names a real owner and venue —
this closeout disposition, ChatGPT / production-enablement authority, a later authorized cutover
PR, or **Q-012**/**Q-016**. **No follow-up routes work to the completed PR6-D implementation
branch, and no row's present tense claims D is unbuilt.** I checked all twenty; this is correct.
Standing regression controls are correctly framed as guards against reintroduction, **not** as
newly reproduced defects.

---

## 8. Residual backlog adjudication

`PR6_ACCEPTED_RESIDUAL_BACKLOG.md` carries every required field per row (original severity, class,
source blob, affected scope, evidence, owner, follow-up trigger, and the three blocking questions).
Each source ID was checked against its cited artifact:

| Residual | Claimed source | Verified |
|---|---|---|
| `NEW-CLAUDE-PR6B-C01` (P3, accepted / not fixed) | B correction review `e902a1ce…` | **PRESENT** — "duplicate fragment names are silently last-wins in the rule gate considered alone" |
| `P3-FINAL-01` (standing control) | C final integration `0daa0e53…` §9 | **PRESENT** |
| `P3-FINAL-02` (fixture hygiene) | C final integration `0daa0e53…` §9 | **PRESENT** |
| `P3-FINAL-03` (at-sale provenance) | C final integration `0daa0e53…` §9 (titled "F-11 at-sale provenance on first read") | **PRESENT** |
| `SC-R-05` (accepted limitation) | quota-evidence review `74e57479…` §7 | **PRESENT** — "Accepted limitation, scope unchanged" |
| `SC-R-07` (accepted limitation) | quota-evidence review `74e57479…` §7 | **PRESENT** — "unreachable through production staging" |
| `NEW-SCQ-03` (accepted methodological limitation) | final-control `ee3f625c…`; quota-evidence `74e57479…` §6.3/§7 | **PRESENT** — "client-side timed … not server-timestamped proof" |
| `SC-R-08` (**unattributed**, not a fixed bug) | SC-recovery `e8525c2f…`; preserved at C | **PRESENT** — "Unattributed, unchanged" |
| `P3-CLAUDE-F3XH-06` / `-08` (PR5, not discharged) | `PR5_F3_ACCEPTED_RESIDUAL_BACKLOG.md` | **PRESENT** — both remain, correctly cross-referenced only |

The separation the mandate demanded is handled correctly: `PR43-CI-CLEANUP-01`, `-INDEX-01`,
`-INDEX-02`, the JSONL isolation follow-up, `NEW-SCQ-01` and `NEW-SCQ-02` are recorded as **fixed
failure instances** that must not be kept open, while `P3-FINAL-01` / `NEW-SCQ-03` remain as
**standing controls** with the explicit statement that future timing-sensitive F-F03 failures are
not claimed impossible and still fail CI closed. `SC-R-08` is correctly kept **unattributed**
rather than fabricated as fixed. The historical cause of run `35415196729` is correctly retained as
an **inference**, not a proven reproduction.

---

## 9. Repository closure vs production readiness — the distinction holds

This is the central control question, and the subject answers it correctly throughout.

**What the evidence supports:** PR6 A/B/C/D *repository implementation* is independently reviewed,
ChatGPT-accepted and merged at **W**, with full-Heavy exact-W push CI SUCCESS, six preserved
immutable D reviews ending in an approval, and a million-line canonical order-line envelope
independently executed at **H**, **S** and **C**.

**What it does not support, and what the subject correctly refuses to claim:** production
readiness. No live Shopify merchant call, no live subscription registration, no Partner
`read_all_orders` approval, no production migration, no deployment, no merchant data, no inventory
write, no flag enablement. Sampled RSS/heap/scratch peaks are recorded as high-water observations,
**not** mathematical bounds. SIGKILL recovery is **not** claimed as physical power-loss proof. The
million-line envelope is opt-in and was **not** executed inside ordinary CI and **not** rerun on
**R** or **W** — the subject states this explicitly and rests the equivalence on
`W^{tree} == R^{tree}` and `C` runtime, which I verified. Exact-W CI is correctly labelled W-only
and exact-R R-only, with no transfer between heads.

Phase 1 remains **IN PROGRESS**; PR7 and PR8 remain later units; **Q-008** and the unresolved
product/production questions remain open; PR45 remains a separate unaccepted planning lane that
this closeout neither edits nor adopts. I confirmed PR45 is untouched by the diff.

Per the mandate I performed **no runtime retesting** for a documentation-only change.

---

## 10. Evidence limits of this review

| Class | What I did |
|---|---|
| **Executed here** | Fresh `origin` fetch and full Git object resolution; `git diff`/`--name-status`/`--check` W→subject; tree-identity comparison of `app`, `prisma`, `scripts`, `.github`, `package*.json`, `shopify.app.toml`; `git rev-parse` of 17 review blobs at W and at the subject; `classify-ci-change-set.test.sh` (40/40); `classify-ci-change-set.sh --from-git W subject`; full-text reads of the two new reports, all seven modified documents' diffs, `AGENTS.md`, the six immutable D reviews' verdict/subject/residual sections, the B and C review artifacts, `PR5_F3_ACCEPTED_RESIDUAL_BACKLOG.md`, `OPEN_QUESTIONS.md`; direct `schema.prisma` inspection at **W** for R-171 and R-180; reference-resolution sweep of all Markdown links in both new reports; repository-wide sweep for undisclosed stale live-status sentences. |
| **Verified via GitHub API (read-only)** | PR47 metadata and comment 5746511091; PR43 comments 5705430913, 5707545217, 5708288971, 5713115882, 5741540117, 5741972761, 5742905459, 5743829737, 5744256383, 5744321465, 5744703880, 5745082755; open-PR list; workflow runs 35471512645 (+3 jobs), 35460969411 (+Heavy job step list), 35454095462, 35415196729, 35219870613, 35336443725. |
| **Reused, not re-executed** | The million-line envelope results at **H** / **S** / **C**; all PostgreSQL, Redis, filesystem, SIGKILL, mutation and concurrency probes from the six immutable D reviews; the A/B/C review probe suites. Per mandate, none was rerun for a docs-only change. |
| **Not executed / out of scope** | Any Actions run, rerun or cancellation; any PostgreSQL or Redis corpus; any scale benchmark; any Shopify store call; any customer or production data; any code, plan, document or risk edit; mark-ready; merge. |
| **Inferred, and labelled as such** | The mapping from eighteen register rows to the C/D review evidence that substantiates them (P3-CLOSEOUT-01). I traced it to plan §19 cases and verified two rows directly at schema level; the remainder is a supported reading, not a quoted citation. |

**Source limitations inherited and preserved, not upgraded:** the source-contract review's
GitHub author metadata does not establish or refute its claimed independence; `SC-R-05` and
`SC-R-07` remain accepted limitations; `NEW-SCQ-03` remains a methodological limitation;
`SC-R-08` remains unattributed; the historical cause of run `35415196729` remains inferred.

**Evidence-lane note.** The PR47 body does not carry the terminal exact-head CI identities —
it states they did not yet exist at publication. ChatGPT comment
[5746511091](https://github.com/Vedang1998/Stocky/pull/47#issuecomment-5746511091) records
`35471512645` / `105973195700` / `105973213679` / `105973213466` and expressly rules that this does
not require a new commit. I verified all four identities independently (§2.1) and confirmed the
branch tip never moved. This is a closed evidence gap, not a defect.

---

## 11. Unchanged-subject confirmation

| Assertion | Status |
|---|---|
| PR47 head still `fde01dc5ba2e0076b1579d6690f0548db749af56` | **CONFIRMED** (`git ls-remote`) |
| `origin/main` still **W** `ee193f38491245a10fb2fa60d2cf9a29f3271605` | **CONFIRMED** (`git ls-remote`) |
| No commit, push, amend, rebase or force-push to the subject branch or `main` by this review | **CONFIRMED** |
| No peer PR (#45, #41, #38) read-modified, synchronized or edited | **CONFIRMED** — read-only |
| No immutable review artifact altered | **CONFIRMED** — all 17 blobs byte-identical |
| No Actions run triggered, rerun or cancelled | **CONFIRMED** |
| This review adds exactly one file on its own branch, sole parent = exact subject | **CONFIRMED** |

---

## 12. Verdict

**`APPROVE PR6 FORMAL REPOSITORY CLOSEOUT`**

The subject is a faithful, evidence-bound documentary closeout of the accepted PR6 A/B/C/D
repository implementation. Scope is exactly the nine allowlisted paths with zero runtime, schema,
grant, dependency, CI, scope or flag change. Lineage, trees, blobs, merge identities and every
cited Actions run reproduce exactly. All seventeen immutable review artifacts — including the five
negative PR6-D verdicts — are preserved byte-for-byte, and dated acceptance snapshots are annotated
as historical rather than rewritten. Register statuses and severities are untouched; the twenty
risk rows receive individual, evidence-bound recommendations rather than a blanket closure.
**R-176 stays OPEN / P0**, **R-182 stays OPEN**, **R-164 is unchanged**, and **Q-008** and
**Q-012…Q-016** remain open. No closeout squash SHA is invented, no formal closure is declared, no
D-055 is created, and no production or PR7 runtime readiness is claimed anywhere.

Three **P3** documentary findings are recorded, all dispositioned **accept as-is**: a
traceability gap between register rows and the approved test cases that substantiate them
(P3-CLOSEOUT-01); one undisclosed stale live sentence outside the allowlist, whose exact location
is returned here rather than silently corrected (P3-CLOSEOUT-02); and one historical identity
dropped from a re-labelled snapshot row but preserved in four dated source records
(P3-CLOSEOUT-03). **No P0, P1 or P2 documentary defect exists. No correction is required before
ChatGPT's closeout/risk disposition.**

Approval is documentary and control only. It does **not** authorize merge, does **not** by itself
make formal closure effective, does **not** authorize PR7 or PR8 runtime, and does **not** find the
product production-ready. Production, merchant production data, Shopify writes, inventory writes,
`read_all_orders`, `write_orders`, live subscription registration, deployment and flag enablement
all remain **NOT AUTHORIZED / DEFAULT OFF**. D-054 remains the authority; there is no D-055.
PR6 and Phase 1 remain **IN PROGRESS** until ChatGPT's disposition and the owner's merge.

---

*Immutable independent-review artifact. Never edit. Review branch `claude/pr47-pr6-formal-closeout-review`, sole parent `fde01dc5ba2e0076b1579d6690f0548db749af56`.*
