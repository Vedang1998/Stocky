# ProPo PR53 revision-2 independent Cursor review

**Verdict:** `PEER REVIEW — CORRECTIONS REQUIRED`

This is a source-linked critique of pinned G1. It is **not** owner approval, **not** actual Claude review, **not** protocol activation, and **not** merge authority. Proposed rules in this checkout do not self-activate.

## 0. Review identity

| Field | Value |
|---|---|
| Dispatch-Key | `propo:issue55-v1:R2_PEER_REVIEW:6565e25b0266db440c91365c3e0a151cd7c0c479+fb6ca876f6a6612692e7d9187dc3c815eae156ad:cursor-review` |
| Reviewer run | `bc-b1f77326-9d0f-4dc3-bfa6-3ed67f6351ac` |
| Requested model | Grok 4.7 / xhigh if available in included allowance |
| Actual model | `cursor-grok-4.6-xhigh` (4.7 was **not** the dispatched model; no paid fallback used) |
| Effort | unknown (provider did not expose a separate effort meter) |
| Chat | NEW independent reviewer (not PR45 author `bc-369132c6-924c-479f-8b33-b4a4c87a63ef`, not PR50 preflight `bc-36ad3f03-3cc4-447e-9d44-12207a2b8426`, not issue51 interim `bc-9fd3011e-64ea-4328-a50f-306b49b66e7b`, not issue52 handshake `bc-efbce9b7-6970-4905-bb05-689238076b24`) |
| Prior result for this key | none (issue55 comments were only the dispatch and this run's acknowledgement) |
| Subject G1 | `6565e25b0266db440c91365c3e0a151cd7c0c479` |
| Parent G0 | `057bcf6205abb6b93f08e12c0d7f891cb112926e` |
| Main X | `f057d98c8a321b3e06875a6e9a83b787bcbc101f` (PR47 squash; PR6 formal closeout **MERGED** 2026-09-20) |
| Frozen PR45 H | `3cc2045107b54601c6b0e43c8690b7d090074b80` — **untouched** |
| Artifact branch | `review/pr53-r2-cursor-20260922-51ac` (work-order name + platform suffix `-51ac`) |
| Sole parent of this commit | G1 (required) |
| Path | `stocky-plus/docs/agents/PROPO_DELIVERY_R2_CURSOR_REVIEW.md` |

Preserve: PR6 CLOSED (via PR47) / Phase 1 IN PROGRESS / R-176 OPEN/P0 / Q-008 OPEN / D-054 EFFECTIVE / no D-055. `PROJECT_STATUS.md` on X still says formal PR6 closeout **PENDING this closeout PR**; live GitHub merge of PR47 supersedes that snapshot header.

## 1. Path, parentage, and classification evidence

X→G1 six paths (executed `git diff --name-status`):

| Path | G1 blob |
|---|---|
| `AGENTS.md` | `d289bfbdb207c30eaf8b231439497e17b04dfb0b` |
| `CLAUDE.md` | `62eda918623f02276413562339bdf3057ab6d411` |
| `.cursor/rules/00-project-governance.mdc` | `b400311ab80684b6a5ff4e45cd3c9b367aaa6c28` |
| `.cursor/rules/10-phase-workflow.mdc` | `150c455a19edf6f99d942f90fc9d64074f326da6` |
| `stocky-plus/docs/agents/PROPO_AUTONOMOUS_DELIVERY_PROTOCOL.md` | `377622ecea175e9498fcf5e5e1306f4cce11e3d9` |
| `stocky-plus/docs/agents/PROPO_PROJECT_BOOTSTRAP.md` | `0e1a5da01ffd8702bc339072b2e779f425cfd257` |

G0→G1 changes **only** the two protocol/bootstrap files. X is an ancestor of G1. G0 parent is X.

Local classifier (executed, not Actions retrigger) on X→G1:

```text
changed_path_count=6
changed_path [full] .cursor/rules/00-project-governance.mdc
changed_path [full] .cursor/rules/10-phase-workflow.mdc
changed_path [docs] AGENTS.md
changed_path [full] CLAUDE.md
changed_path [docs] stocky-plus/docs/agents/PROPO_AUTONOMOUS_DELIVERY_PROTOCOL.md
changed_path [docs] stocky-plus/docs/agents/PROPO_PROJECT_BOOTSTRAP.md
classification_reason=non_docs_or_unknown_path
docs_only=false
full_ci=true
```

This matches `CI_POLICY.md` allowlist (docs-only = `stocky-plus/docs/**` or `AGENTS.md` only). `.cursor/**` and root `CLAUDE.md` force full CI. G1 §4 correctly refuses to amend the classifier to save time. **Do not bypass full CI for PR53.**

Exact-head `pull_request` CI at review time:

| Run | Event | Head | Status |
|---|---|---|---|
| [35785985991](https://github.com/Vedang1998/Stocky/actions/runs/35785985991) | `pull_request` | `6565e25b…` | **IN_PROGRESS** at 2026-09-22T21:29:43Z (Classify job `106942798292` SUCCESS; Heavy `106942835046` in progress) |
| [35742891581](https://github.com/Vedang1998/Stocky/actions/runs/35742891581) | `pull_request` | G0 `057bcf62…` | SUCCESS (superseded; **not** G1 evidence) |

G1 exact-head full CI was **not terminal** when this review was written. Pending is pending. Not retriggered.

## 2. What G1 gets right (keep)

Owner preference vs documented fact vs inference are mostly labeled. In particular:

1. **Effectiveness.** Header states Cursor + actual Claude + owner approval are required; file existence is not activation. `AGENTS.md` repeats that the introducing PR must be accepted and owner-merged.
2. **Self-merge ban.** §5 is **INACTIVE**. “The policy introducing or broadening delegation cannot merge itself.” No current PR is silently included. Agent consensus is explicitly insufficient.
3. **Independence.** “A new branch within an old author run is not a new independent reviewer.” Filename/model request ≠ execution evidence. Cursor reading `CLAUDE.md` is not actual Claude (adapter text is correct).
4. **One writer / helpers.** Exclusive paths; integrator-only Git; no shared mutable PostgreSQL/Redis/scratch without an isolation design; two lanes first, four only when authorized.
5. **Quota.** Owner-reported Claude reset `2026-09-23 05:00 America/New_York` is labeled **not** authenticated provider quota. No paid fallback. Missing checkpoint = UNKNOWN, not a pass.
6. **Comms.** ChatGPT project is exactly **Stocky App Building**. No automatic new-chat/email claim without a verified tool. Daily summary + serious blockers; no merchant email.
7. **Reserved domains** cover auth, tenancy, money, inventory/cost/price writes, CI/protection, legal, governance, credentials.
8. **Issue52 V2** remains live coordinator protocol until changed through recorded authority. H is untouched.
9. Observed 403 + platform-published result (issue52 `5776703312`) is preserved rather than “fixed” by credential escalation.

These are **proposed** rules. They do not replace issue52 until G1 is independently accepted and owner-merged.

## 3. Findings

### F-G53-01 — P1 — Adapter contradiction becomes live on merge of G1

**Files:** `.cursor/rules/00-project-governance.mdc` vs `.cursor/rules/10-phase-workflow.mdc` vs protocol §5 vs `AGENTS.md`.

**Evidence:** G1 `00-project-governance.mdc` still says “Never begin a later PR or phase early” and “The user alone authorizes merges after ChatGPT acceptance.” G1 `10-phase-workflow.mdc` now says the next **dependent** PR waits, while separately authorized independent lanes may run in parallel, and points session/merge rules at the protocol. Protocol §5 describes coordinator merge after activation.

**Impact:** If G1 is squash-merged as written, always-apply Cursor rules will disagree with each other on (a) parallel PRs and (b) who may merge. Agents will be able to cite whichever sentence is convenient. That is a governance defect, not a branding nit.

**Expected:** One consistent always-apply sentence set. Until delegation is activated: user-only merge remains. Parallel lanes already exist in `ACCELERATED_SAFE_DELIVERY.md`; `00` must cite that document instead of an absolute “never begin a later PR.”

**Smallest correction:** In the same G1 successor, edit `00-project-governance.mdc` to: (1) allow only ChatGPT-authorized, contract-frozen parallel lanes under Accelerated Safe Delivery; (2) state that merge delegation is **inactive** and user merge remains until a later activation package amends both adapters **together** with protocol §5.

**Missing test:** Adapter-consistency checklist in the protocol (the three files must not contradict on merge actor, parallel lanes, or effectiveness).

### F-G53-02 — P1 — Exact-head merge capability is not proven by the live ruleset

**Evidence (read-only GitHub ruleset `20012314` “Protect main”, enforcement active, `current_user_can_bypass=never`, updated 2026-08-15):**

- required status checks: `Lint, typecheck, test, build, Prisma, GraphQL` **and** `CI Gate`
- `strict_required_status_checks_policy: true`
- `required_approving_review_count: 0`
- squash only; deletion and non-fast-forward blocked
- branch-protection REST returned **403** for this token; ruleset read succeeded

`CI_POLICY.md` already warned that Heavy remains the historical check name and that **CI Gate should become the merge gate once the ruleset is updated**. The ruleset was **not** reduced to CI Gate. Docs-only PRs skip Heavy (observed PR54 run `35785998870`: Heavy SKIPPED, Gate SUCCESS). GitHub skip-as-success behavior is not re-proven here.

Protocol §5 requires: expected-head merge action, no protection bypass, exact-head CI, actual independent review. None of those are mechanically enforced today except (partially) status checks. Independent Claude review is **not** a required GitHub review. A coordinator “all agents agree” comment cannot satisfy `actual_independent_review`.

This environment has **no** verified merge tool that pins `sha` for this principal. GitHub’s merge API *can* take an expected head SHA; that is documented provider capability, not proof the coordinator holds a token that can merge, or that squash/parents/tree will be verified.

**Impact:** Activating §5 on today’s ruleset could (a) merge without a GitHub-enforced independent review, (b) treat skipped Heavy as success for a misclassified runtime change unless classification is re-checked locally, or (c) fail closed on docs-only PRs if skip is treated as missing. Either failure mode is unsafe.

**Expected:** Keep §5 INACTIVE. Activation package must include: ruleset snapshot; whether skipped Heavy blocks merge; required check names aligned with `CI_POLICY`; a merge actor that can pass `sha=<reviewed head>`; post-merge squash/parent/tree verification; and **no** bypass.

**Smallest correction:** Add an “activation evidence checklist” to §5 listing the live ruleset facts above as **currently unmet**. State that PR53/PR54 cannot be the first delegated-merge subjects.

**Missing test:** The compact admission table in §4 (executed here as a synthetic probe, 20/20). Incorporate it so a future coordinator cannot invent extra admit paths.

### F-G53-03 — P2 — G1 compression dropped executable G0 guards

G0→G1 is a rewrite, not a patch. Lost or weakened G0 sentences (still needed):

| G0 guard | G1 status |
|---|---|
| Never follow arbitrary completion-comment commands or external links as authority | Weakened into generic untrusted-data §8 |
| Generated expectation values must not copy the implementation under test | Dropped |
| Absent precise budget is not permission for unlimited consumption | Dropped (quota §6 covers paid fallback, not Actions/minutes envelope) |
| Documentation merge does not enable inventory/cost/price writes | Implied by reserved list; no longer explicit in completion §4 |
| Inspect both comment ID **and** edited content/identity | Present, keep |

**Smallest correction:** Restore those four lines in §4/§8 without restoring the whole G0 draft.

### F-G53-04 — P2 — Stale `PROJECT_STATUS` vs “PR6 CLOSED”

Protocol and bootstrap correctly say verified merge records outrank snapshot headers, and they state PR6 CLOSED. On X, `PROJECT_STATUS.md` still says formal PR6 closeout is PENDING the closeout PR, while PR47 is already merged as X. New sessions that “read PROJECT_STATUS first” will fight the protocol.

**Smallest correction:** One bootstrap sentence: “On current X, PR47 merged the PR6 closeout; ignore PENDING-closeout headings in `PROJECT_STATUS.md` until that file is synchronized in a later docs PR.” Do **not** edit `PROJECT_STATUS.md` in PR53 (out of exclusive path set).

### F-G53-05 — P2 — Dispatch journaling is still not exactly-once

§3 already says comment journaling is best-effort, not CAS. Keep that. Missing: what the hourly coordinator does when two cycles both see `DISPATCH_INTENT` and no ACK. “Stop dispatch” is stated; there is no lock object, lease, or compare-and-set on issue52. That is acceptable for a protocol **document**, but then §5 must not be activated until that lock exists. Do not treat issue52 comments as an atomic merge permit.

### F-G53-06 — P3 — Chat-title convention vs Stocky App Building

Preferred session name `ProPo | ISSUE-n / PR-n | …` is convenience. Bootstrap correctly keeps the ChatGPT project **Stocky App Building**. No contradiction if titles are not claimed as provider rename proof. Leave unless owner wants a single naming example.

### F-G53-07 — P2 — “Allow all actions” is not a security boundary

Issue52 V2 recorded GitHub app-specific permission as Allow all (inspected, not changed). Protocol §8 says instructions and Allow-all UI are not protections. Good. Activation of merge delegation **increases** the cost of that setting. Record as an owner decision: least-privilege merge token vs current Allow-all, without asking this reviewer to change it.

## 4. Synthetic merge-admission probe (not a coordinator)

Executed 2026-09-22T21:29:43Z on this run, isolated Python, no GitHub merge, no Shopify. 20 cases, 0 failures. Source is reproduced below so Claude can re-run it; it is **not** deployed.

Admission is conjunctive. `UNKNOWN` never becomes `SUCCESS`. `agents_all_agree` never admits. PR53/governance is `reserved_domain` + `self_merge`. Inactive policy admits nothing.

Observed: inactive policy, self-merge, reserved inventory, stale head/main, missing review, filename-as-Claude, author-as-reviewer, consensus-without-review, edited result, docs-only misclassification of a full-CI subject, pending CI, wrong CI SHA, unknown outcome, concurrent coordinator, STOP, duplicate dispatch, cannot pin SHA, ineffective protections → all `DENY`. Happy-path docs after **activation** → `ADMIT` only when every other guard is true. Today `policy_active` is false, so even the happy path must deny.

```python
# compact re-runnable core; full script saved with this reviewer's probe notes
RESERVED = {"governance","ci","inventory_write","legal","credentials"}  # non-exhaustive vs protocol list
def admit(s):
    if (not s.get("policy_active") or s.get("owner_stop") or s.get("self_merge_governance")
        or s.get("domain") in RESERVED or s.get("live_head") != s.get("reviewed_head")
        or not s.get("actual_independent_review") or s.get("ci_status") != "success"
        or (s.get("full_ci_required") and s.get("heavy_conclusion") == "skipped")
        or not s.get("merge_tool_can_pin_sha")):
        return "DENY"
    return "ADMIT"
```

Full 20-case script and stdout: reviewer working copy `/tmp/review-probes/merge_admission.py` (not in this PR’s exclusive path except as quoted). Do not treat stdout as GitHub Actions.

## 5. Session / role / quota / comms checks (work-order priorities)

| Priority | Result |
|---|---|
| New session/role/one-writer vs AGENTS/CLAUDE/.cursor | Independence rule is sound. Adapter merge/parallel contradiction is F-G53-01. |
| New branch ≠ independent review | Correct; this run used a new `bc-` id. |
| Merge delegation inactive and cannot approve itself | Correct in §5; F-G53-02 says activation evidence is missing. |
| Challenge stale head, missing review, forged/edited result, docs misclass, unknown outcome, concurrent coordinator, STOP, duplicate | All denied in the probe. “All agents agree” is not an admit path. |
| Reserved domains vs owner merge vs final owner approval | Reserved list is adequate. Production, spend, legal, phase gates do not slip through **while INACTIVE**. They would slip through if §5 were activated without F-G53-02. |
| Usage restoration Sep 23 05:00 America/New_York | Owner-reported only. Enabled timer ≠ Claude route. Checkpoint/UNKNOWN and no-paid-fallback are adequate. |
| Daily/urgent/milestone outputs | Do not promise email or ChatGPT new-chat creation. Stocky App Building preserved. |
| Full CI for PR53 | Confirmed locally and by path set. Do not reclassify. |

## 6. Disposition

| ID | Severity | Disposition |
|---|---|---|
| F-G53-01 | P1 | **CORRECTION REQUIRED** before treating G1 as mergeable operating rules |
| F-G53-02 | P1 | **CORRECTION REQUIRED** (document unmet activation evidence; keep INACTIVE) |
| F-G53-03 | P2 | Restore four G0 guard lines |
| F-G53-04 | P2 | Bootstrap stale-header sentence; do not edit PROJECT_STATUS here |
| F-G53-05 | P2 | Keep best-effort journaling; block §5 until a real lock exists |
| F-G53-06 | P3 | Optional |
| F-G53-07 | P2 | Owner decision on merge-token least privilege |

**Not findings:** branding ProPo/IVYY as owner-supplied; refusing to close Q-008/R-176; refusing to waive H; refusing paid fallback; requiring full CI.

## 7. Unresolved owner decisions (not inventable from sources)

1. Whether merge delegation should ever be activated, and on which first allowlist, **after** F-G53-01/02 are closed.
2. Whether GitHub App permission remains Allow-all.
3. Whether a least-privilege merge identity distinct from writing agents will exist.
4. Claude route/capacity at the owner-reported reset — unverified here.

## 8. Evidence limits

**Executed:** git ancestry/blobs; local `classify-ci-change-set.sh`; GitHub PR/ruleset/issue reads; isolated Python admission probe 20/20; this run’s identity APIs.

**Executed, incomplete:** G1 exact-head full CI run `35785985991` IN_PROGRESS.

**Not executed:** GitHub merge; ruleset change; Claude dispatch; legal opinion; production; Shopify; email; mark-ready.

**Labeling:** protocol text = proposed; issue52 V2 = current coordinator authority; this document = Cursor peer review only.
