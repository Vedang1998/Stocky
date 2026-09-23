# ProPo PR53 G2 correction — independent Cursor re-review

**Verdict:** `PEER REREVIEW — READY FOR ACTUAL CLAUDE AND OWNER DECISION`

This is a source-linked critique of pinned corrected head G2. It is **not** owner approval, **not** actual Claude review, **not** protocol activation, and **not** merge authority. A clean Cursor re-review does not replace actual Claude and does not authorize merge. Proposed rules in this checkout do not self-activate.

## 0. Review identity and independence admission

| Field | Value |
|---|---|
| Dispatch-Key | `propo:5786540932:PR53_R2_CORRECTION_REREVIEW_SESSION_ISOLATED:541ba6f5dc750813e5d173d36d7f09a11ad87596:cursor-review` |
| Authority | issue52 `5776903150`, `5784383528`, `5784696873`; routing-blocker `5786540932`; issue56 isolated-session contract + dispatch `5787052191` |
| Reviewer run | `bc-d4baf846-f573-4c65-b79d-a41ce4c665ff` |
| Reviewer URL | https://cursor.com/agents/bc-d4baf846-f573-4c65-b79d-a41ce4c665ff |
| Requested model | not evidence |
| Actual model | `cursor-grok-4.6-xhigh` (from `cursor-cloud-run-info`; requested labels are not evidence) |
| Effort | unknown (provider did not expose a separate effort meter) |
| Chat / source | NEW dedicated issue56 SCM run (`githubIssueId` 56). Not a continuation of PR53. |
| Independence | **ADMITTED.** Actual run id is distinct from correction-author `bc-ef95e065-7d2c-45c0-9eae-179005ae3e21` and original G1 reviewer `bc-b1f77326-9d0f-4dc3-bfa6-3ed67f6351ac`. A different branch name was not used as the independence proof. |
| Competing reviewer for this key | none observed (issue56 comments were only the dispatch and this run’s acknowledgement; no other RUNNING SCM agent bound to issue56) |
| Prior failed attempt | PR53 comment `5786507829` / issue52 `5786540932`: same correction-author run correctly **BLOCKED**; no artifact; not peer acceptance |
| Subject G2 | `541ba6f5dc750813e5d173d36d7f09a11ad87596` |
| Sole parent G1 | `6565e25b0266db440c91365c3e0a151cd7c0c479` |
| Main / base X | `f057d98c8a321b3e06875a6e9a83b787bcbc101f` (PR47 squash; PR6 formal closeout **MERGED** 2026-09-20) |
| Frozen PR45 H | `3cc2045107b54601c6b0e43c8690b7d090074b80` — **untouched** (not an ancestor of G2; PR45 remains OPEN/DRAFT/UNMERGED) |
| Original G1 review | commit `39a805a1e2b98a38f6e75ac3e0a22b7a04c3613e`, sole parent G1, path `stocky-plus/docs/agents/PROPO_DELIVERY_R2_CURSOR_REVIEW.md`, blob `6960ff99b61917cd3612aaf008b0ba3e7975d88b`; PR53 comment `5784523139`. **Not rewritten.** |
| This artifact branch | `cursor/pr53-r2-correction-rereview-65ff` |
| Sole parent of this commit | G2 (required) |
| Path | `stocky-plus/docs/agents/PROPO_DELIVERY_R2_CORRECTION_CURSOR_REREVIEW.md` |
| Publication PR | **none** (dispatch forbids self-integration) |

Preserve: PR6 CLOSED via PR47 / Phase 1 IN PROGRESS / R-176 OPEN/P0 / Q-008 OPEN / D-054 EFFECTIVE / no D-055. `PROJECT_STATUS.md` on X still says formal PR6 closeout **PENDING this closeout PR**; live GitHub merge of PR47 plus G2 bootstrap wording supersede that snapshot header. This re-review does **not** edit `PROJECT_STATUS.md`.

## 1. Path, parentage, and classification evidence

Executed `git cat-file` / `git diff --name-status` / `git merge-base --is-ancestor`.

G2 parentage: sole parent G1. X is an ancestor of G2. H is **not** an ancestor of G2.

X→G2 six paths (exclusive envelope; no other paths):

| Path | X blob | G1 blob | G2 blob |
|---|---|---|---|
| `AGENTS.md` | `abcce305860f0bef98676ba9f72dd73e091f1875` | `d289bfbdb207c30eaf8b231439497e17b04dfb0b` | `0a5afde661cf0f1a5707148de619287769cd8e51` |
| `CLAUDE.md` | `f7785f117f684215fb1c2d283c0f77325631a3df` | `62eda918623f02276413562339bdf3057ab6d411` | `62eda918623f02276413562339bdf3057ab6d411` (unchanged G1→G2) |
| `.cursor/rules/00-project-governance.mdc` | `2b7552ab69a2eb0761f2e13e29a0797735a232a8` | `b400311ab80684b6a5ff4e45cd3c9b367aaa6c28` | `ff5a96b2028452dd9dac382189dfb980e15cee09` |
| `.cursor/rules/10-phase-workflow.mdc` | `6898444c3c676ced8f41ea88949ff3c76a6a237c` | `150c455a19edf6f99d942f90fc9d64074f326da6` | `a3976b596ee1dbb433f4343cd240256c41cc3c8d` |
| `stocky-plus/docs/agents/PROPO_AUTONOMOUS_DELIVERY_PROTOCOL.md` | absent | `377622ecea175e9498fcf5e5e1306f4cce11e3d9` | `7c1cd2e9e9e38e4139bff29a0bc0495bb35f2300` |
| `stocky-plus/docs/agents/PROPO_PROJECT_BOOTSTRAP.md` | absent | `0e1a5da01ffd8702bc339072b2e779f425cfd257` | `da552b7da606b9c48ac8f486d647be833d71c720` |

G1→G2 changes **five** of those paths. `CLAUDE.md` is intentionally unchanged this successor (G1 blob reused). Tree of G2: `824433ea683de7e821e32b2f2ff136e7b39c732d`. `git diff --check` G1→G2 and X→G2: clean.

Local classifier (executed on this run, **not** an Actions rerun) X→G2:

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

This matches `CI_POLICY.md` allowlist. `.cursor/**` and root `CLAUDE.md` force full CI. Protocol §4 still refuses to amend the classifier. **Do not bypass full CI for PR53.**

Live PR53 at review time: OPEN / DRAFT / UNMERGED; `headRefOid` = G2; `baseRefOid` = X.

## 2. Exact-head CI (inspected, not retriggered)

| Run | Event | Head | Status |
|---|---|---|---|
| [35788986979](https://github.com/Vedang1998/Stocky/actions/runs/35788986979) | `pull_request` | `541ba6f5dc750813e5d173d36d7f09a11ad87596` | **completed / success**, `run_attempt=1` |
| [35785985991](https://github.com/Vedang1998/Stocky/actions/runs/35785985991) | `pull_request` | G1 `6565e25b…` | **cancelled** (superseded by G2; **not** G2 evidence) |
| [35742891581](https://github.com/Vedang1998/Stocky/actions/runs/35742891581) | `pull_request` | G0 `057bcf62…` | SUCCESS (historical; **not** G2 evidence) |

No other workflow run exists for G2. No `workflow_dispatch`. No Actions rerun by this reviewer.

Exact-head jobs on `35788986979`:

| Job | ID | Conclusion | Note |
|---|---|---|---|
| Classify change set | `106953178266` | SUCCESS | includes Classification self-test |
| Lint, typecheck, test, build, Prisma, GraphQL | `106953211079` | SUCCESS | **full Heavy**, not SKIPPED: ephemeral PostgreSQL/Redis, tenant/RLS/sync suites, lint, typecheck, GraphQL, unit tests, build |
| CI Gate | `106971619027` | SUCCESS | after Heavy |

This is Classify + full Heavy + CI Gate on the exact G2 SHA. Author comment `5784790443` recorded this run as IN_PROGRESS; that snapshot is superseded by the terminal success inspected here. Failed-independence comment `5786507829` already observed the same terminal success; this re-review **re-queried** the run rather than inheriting that claim.

## 3. Finding-by-finding disposition (owner package `5784696873`)

### F-G53-01 — P1 — Adapter contradiction — **RESOLVED at G2**

**Owner disposition:** ACCEPT. Remove always-apply adapter contradiction. Preserve ChatGPT-authorized frozen-contract parallel lanes; user-only merge remains current until a separately reviewed activation package is adopted.

**G1 defect:** `00-project-governance.mdc` still said “Never begin a later PR or phase early” and “The user alone authorizes merges” without stating that §5 is inactive, while `10-phase-workflow.mdc` already allowed authorized independent lanes and pointed session/merge rules at the protocol.

**G2 evidence:**

- `00` CURRENT merge = user after ChatGPT acceptance; §5 “is not active”; loading the protocol does not activate it; even after the introducing PR merges, §5 stays INACTIVE until a separately reviewed activation package is owner-approved.
- `00` parallel rule is no longer an absolute ban: later/dependent PRs and phases remain gated; ChatGPT may authorize only contract-frozen, dependency-independent lanes under `ACCELERATED_SAFE_DELIVERY.md`; future-phase runtime, migrations, Shopify configuration, production, and other dependent work remain gated.
- `10` step 14 restates CURRENT user-only merge; §5 cannot replace it; future activation must amend `10` together with `00`, `AGENTS.md`, and protocol §5.
- `AGENTS.md` repeats CURRENT user-only merge, INACTIVE §5, no inference from loading/text, PR53/PR54 are not first delegated-merge subjects, and ASD-bounded parallelism only.
- Protocol §5 requires those three adapters to stay consistent and to be amended **together** with §5 on any later activation.

**Contradiction hunt:** No remaining always-apply sentence tells an agent it may merge, or that it may start a future runtime phase, while another sentence forbids it. `CLAUDE.md` was not edited this successor; it still defers to protocol effectiveness/frozen-subject rules and does not assert a merge actor. Original F-G53-01’s file set for the contradiction was `00` vs `10` vs protocol §5 vs `AGENTS.md`. Leaving `CLAUDE.md` unchanged does not reintroduce the P1 split.

**Not a silent widening:** parallelism is explicitly bounded by existing `ACCELERATED_SAFE_DELIVERY.md` (ChatGPT-defined, contract-frozen, exclusive ownership, max 2–4). That document already existed on X; G2 cites it rather than inventing a new lane power.

### F-G53-02 — P1 — Exact-head merge capability unproven — **RESOLVED in text; §5 remains INACTIVE / checklist UNMET**

**Owner disposition:** ACCEPT. Keep bounded merge delegation INACTIVE. Add explicit activation-evidence checklist. Do not change ruleset/CI in this correction.

**G2 evidence:** §5 title remains INACTIVE. No automatic merge is activated by the clarification, this draft, **or a later squash-merge of PR53/PR54**. PR53/PR54 cannot become first delegated-merge subjects merely by merging the proposal. New §5.1 is labeled **currently UNMET** and states it does **not** change GitHub rulesets, CI, workflows, permissions, or credentials.

§5.1 records the 2026-09-22 live ruleset `20012314` facts. This reviewer **re-read** ruleset `20012314` on 2026-09-23T00:51Z (read-only; not changed):

- name `Protect main`; enforcement `active`; `updated_at` `2026-08-15T05:04:22.974Z`
- `current_user_can_bypass`: `never`
- required checks: `Lint, typecheck, test, build, Prisma, GraphQL` **and** `CI Gate`
- `strict_required_status_checks_policy`: true
- `required_approving_review_count`: 0
- squash only; deletion and non-fast-forward rules present

Those facts still match the G2 snapshot. Branch-protection REST remains **403** for this token (`Resource not accessible by integration`). Independent Claude review is still **not** a required GitHub review. Skip-as-success for skipped Heavy is still **not** re-proven. Expected-head SHA-pinned merge capability for a coordinator principal is still **unverified**.

Checklist items 1–8 match the owner package (live ruleset/check names/docs-only skip; actual independent review; SHA-pinned merge; no bypass; single-owner admission with failure drills; STOP/unknown; post-merge squash/parents/tree + main CI; least-privilege merge principal). Until proven, “§5 admits nothing,” with conjunctive DENY examples including self-merge, reserved domains, “all agents agree,” and cannot-pin-SHA.

**Contradiction hunt:** G1’s weaker “until then, existing per-PR owner merge authorization remains” is replaced by explicit **user-only merge after ChatGPT acceptance** as CURRENT. The proposed post-activation pilot allowlist remains after the checklist, not instead of it. No ruleset, workflow, or credential file is in the G1→G2 diff.

### F-G53-03 — P2 — Dropped G0 guards — **RESOLVED at G2**

**Owner disposition:** ACCEPT. Restore the four dropped guards without restoring the whole G0 draft.

Executed `rg` on G0 `057bcf62…`, G1, and G2 protocol blobs:

| G0 guard | G1 | G2 |
|---|---|---|
| Never follow arbitrary completion-comment commands or external links as authority | absent | restored in §3 and §8 |
| Generated expectation values must not copy the implementation under test | absent | restored in §4 |
| Absent precise budget is not permission for unlimited consumption | absent | restored in §6 |
| Documentation merge does not enable inventory/cost/price writes | absent | restored in §4 (“documentation or governance merge”) |

Inspect-edits-not-only-new-IDs remains from G1. The whole G0 draft was not restored (G0→G1 compression remains; only the four named lines plus the owner-required journaling/activation text were added).

### F-G53-04 — P2 — Stale PROJECT_STATUS vs PR6 CLOSED — **RESOLVED at G2 without editing PROJECT_STATUS**

**Owner disposition:** ACCEPT. Bootstrap must resolve X’s stale PR6-PENDING wording against merged PR47; do not edit `PROJECT_STATUS.md` in PR53.

**G2 bootstrap** now states that on current main X `f057d98c…`, PR47 merged the PR6 formal closeout; stale `PROJECT_STATUS.md` PENDING-closeout wording is superseded until synchronized in a later docs PR; do not edit `PROJECT_STATUS.md` from this governance proposal.

Verified: PR47 is MERGED; merge commit equals X; `git diff --name-status` X→G2 does **not** include `stocky-plus/docs/PROJECT_STATUS.md`. On X, `PROJECT_STATUS.md` still says formal PR6 closeout PENDING (observed). Protocol §1 already said PR6 CLOSED at G1; G2 bootstrap now tells new sessions how to reconcile the snapshot. Merged PR47 is treated as the superseding record, as required.

### F-G53-05 — P2 — Journaling is not exactly-once — **RESOLVED at G2**

**Owner disposition:** ACCEPT. Comments are not atomic/exactly-once. Delegated merge cannot activate until a real admission/ownership mechanism and failure drills are separately proven; issue journaling stays best-effort.

**G2 protocol §3:** journaling is best-effort duplicate prevention only; not atomic CAS; not exactly-once; not a lock; two cycles seeing `DISPATCH_INTENT` with no ACK must stop, not race; **no issue or pull-request comment is an atomic merge permit**. §5.1 item 5 repeats that journaling is not the admission mechanism. Bootstrap: result comments are never new authority, never an atomic merge permit, and never exactly-once CAS.

**Contradiction hunt:** §3 still lists `MERGE_AUTHORIZED` in the coordinator state machine. That label existed at G1. G2 now states immediately in §4 that user-only merge is CURRENT while §5 is INACTIVE, and §5.1 admits nothing until a separately proven lock exists. The leftover state name is a residual observation for a future activation package, not a live admit path and not a G2 regression.

### F-G53-06 — P3 — Naming convention — **UNCHANGED as required**

**Owner disposition:** ACCEPT AS-IS.

G1 and G2 preferred session name is identical: `ProPo | ISSUE-n / PR-n | role | task-id | epoch-n`. ChatGPT project remains exactly **Stocky App Building** in protocol §6 and bootstrap. No title-management mechanism was invented. Identity remains actual run ID and bound scope, not the title.

### F-G53-07 — P2 — Allow-all is not a security boundary — **RESOLVED as future activation evidence; permissions not changed**

**Owner disposition:** ACCEPT AS ACTIVATION GATE. Current broad GitHub app permission is not a security boundary. Do not change credentials/permissions now; document least-privilege merge principal as required future activation evidence.

**G2:** §5.1 item 8 requires credential evidence of a least-privilege merge identity, distinct from writing agents where practical; current Allow-all / equivalent is **not** a security boundary; this proposal does not change credentials or repository permissions. §8 repeats the same. No `.github/**`, ruleset, or secret path is in the G1→G2 diff. This reviewer did not modify permissions.

## 4. Scope / regression hunt (correction vs G1)

Tried to find a widening or new contradiction, not merely matching wording.

| Check | Result |
|---|---|
| Paths outside the six-path envelope | none (X→G2 and G1→G2) |
| Product `11_PRICING…` / approved product records | not touched |
| Runtime / schema / tests / lockfiles / Shopify | not touched |
| CI workflow / classifier | not touched; local classifier still `full_ci=true` |
| Ruleset / protection / credentials | not touched; live ruleset facts unchanged since 2026-08-15 |
| PR45 H / PR54 / main | not touched; H not ancestor of G2 |
| Original G1 review artifact | not rewritten |
| §5 activated by loading or by squash-merge | explicitly denied in `00`, `10`, `AGENTS.md`, protocol, bootstrap |
| Parallelism broader than ASD | no; G2 cites ASD and keeps future-phase runtime gated |
| Comment journaling promoted to CAS / merge permit | no; strengthened in the opposite direction |
| F-G53-06 drive-by rename | no |

Residual observations (not correction-required at G2):

1. Protocol §3 still uses the coordinator-flavored state name `MERGE_AUTHORIZED`. Harmless while §5 is INACTIVE; a later activation package should define that this state is not a comment and not agent consensus.
2. `CLAUDE.md` does not restate CURRENT user-only merge. It is not in the co-amendment list in protocol §5 (`00`/`10`/`AGENTS.md`/§5). Fine for this successor; include it if Claude-as-implementer ever needs a merge-actor sentence.
3. Bootstrap pins “current main X `f057d98c…`”. After a later main advance that SHA is historical, but the PR47-supersedes-PENDING fact remains. A later docs PR should sync `PROJECT_STATUS.md`.
4. Whether §5 should ever be activated, on which first allowlist, with which least-privilege merge principal, and whether GitHub App permission remains Allow-all, remain **owner decisions**. Not inventable here.

## 5. Synthetic merge-admission probe (not a coordinator)

Executed 2026-09-23T00:52:03Z on this run, isolated Python, no GitHub merge, no Shopify, no Actions. **25/25 expected outcomes.** Synthetic reviewer evidence only.

Current G2 `policy_active` is false, so even a fully-guarded docs happy path **DENY**s. Additional G2-specific cases: PR53 squash does not activate §5; a comment is not an atomic merge permit; author-as-reviewer / filename-as-Claude / “all agents agree” DENY. A hypothetical post-activation docs happy path ADMITs only when every other guard is true.

```python
RESERVED = {"governance","ci","inventory_write","legal","credentials",
            "auth","tenancy","schema","money","forecast","production"}
def admit(s):
    if (not s.get("policy_active") or s.get("owner_stop") or s.get("self_merge_governance")
        or s.get("domain") in RESERVED or s.get("live_head") != s.get("reviewed_head")
        or s.get("live_main") != s.get("reviewed_main")
        or not s.get("actual_independent_review") or s.get("filename_as_claude")
        or s.get("author_as_reviewer") or s.get("ci_status") != "success"
        or (s.get("full_ci_required") and s.get("heavy_conclusion") == "skipped")
        or not s.get("merge_tool_can_pin_sha") or s.get("comment_is_atomic_merge_permit")
        or s.get("pr53_squash_activates_s5") or s.get("unknown_outcome")
        or s.get("concurrent_coordinator") or s.get("duplicate_dispatch")
        or s.get("edited_result") or s.get("adapters_contradict")
        or s.get("current_user_can_bypass") not in (None, "never", False)):
        return "DENY"
    return "ADMIT"
```

Do not treat stdout as GitHub Actions or as deployed coordinator proof.

## 6. Required reading applied

Read on this run (main X unless noted as G2): `AGENTS.md`; `stocky-plus/docs/README.md`; `stocky-plus/docs/PROJECT_STATUS.md` (stale PENDING header observed); `stocky-plus/docs/CI_POLICY.md`; `stocky-plus/docs/ACCELERATED_SAFE_DELIVERY.md`; `stocky-plus/docs/phases/README.md`; `stocky-plus/docs/phases/phase-1/README.md`; `stocky-plus/docs/phases/phase-1/PHASE_BRIEF.md`; exact G2 six-path set; original review blob `6960ff99…`; owner dispositions `5784696873` / writer result `5784790443` / failed independence `5786507829` / blocker `5786540932`. Merged PR47 is treated as superseding stale PR6-PENDING snapshot wording.

## 7. Evidence classification

**Executed and passed:** independence identity APIs; git ancestry/blobs/diff-check; local `classify-ci-change-set.sh` X→G2 `full_ci=true`; exact-head Actions run inspect (no rerun); live ruleset `20012314` read-only; PR47/X identity; PR45 H identity; isolated admission probe 25/25.

**Executed, reused with re-query:** CI run `35788986979` (terminal success re-queried, not inherited).

**Reused, not rewritten:** original G1 review commit `39a805a1…` / blob `6960ff99…` / PR53 comment `5784523139`; owner package `5784696873`.

**Not executed:** actual Claude review; GitHub merge; mark-ready; ruleset/CI/credential changes; coordinator failure drills; legal review; production/Shopify; email; protocol activation; helper swarm; another agent dispatch.

## 8. Verdict and next gate

**Verdict:** `PEER REREVIEW — READY FOR ACTUAL CLAUDE AND OWNER DECISION`

Accepted findings F-G53-01/02/03/04/05/07 are correctly and narrowly resolved at G2. F-G53-06 is appropriately unchanged. Current user-only merge is unambiguous across `00`/`10`/`AGENTS.md`/protocol/bootstrap. Dependency-independent parallelism is bounded by Accelerated Safe Delivery. Protocol §5 remains INACTIVE. Comment journaling is not represented as atomic/exactly-once. Activation evidence and least-privilege merge-principal requirements are explicit. The correction did not silently widen product, security, phase, or runtime authority.

**Next gate:** actual Claude independent review of this same pinned G2 `541ba6f5dc750813e5d173d36d7f09a11ad87596`, then owner decision. No merge, mark-ready, self-integration, protocol activation, PR7 runtime, production, or Claude dispatch is authorized by this Cursor re-review.
