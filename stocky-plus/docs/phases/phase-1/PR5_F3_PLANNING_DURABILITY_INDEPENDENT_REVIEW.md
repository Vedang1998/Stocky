# PR5-F3 planning correction-review durability — independent chain-of-custody review

Independent adversarial review. Narrow scope: chain of custody and squash-merge durability of the
independently approved PR5-F3 planning correction review carried by PR #32. This is **not** a
re-review of the F3 planning architecture, which was approved separately.

This artifact is **immutable evidence**. Do **not** edit it.

## 1. Identity gate

| Field | Required | Observed | Result |
|---|---|---|---|
| `origin/main` | `f9841691307583381695973600df3546dd1b9ee4` | `f9841691307583381695973600df3546dd1b9ee4` | **MATCH** |
| PR #32 exact head | `04d6dc73c105328b62a248d23f9914f76ba333d7` | `04d6dc73c105328b62a248d23f9914f76ba333d7` | **MATCH** |
| PR #32 state | OPEN / DRAFT / UNMERGED | `state=open`, `draft=true`, `merged=false`, `mergeable_state=clean` | **MATCH** |
| Commits behind main | 0 | 0 behind / 9 ahead; merge base is current `main` | **MATCH** |
| Push after exact-head CI | none | latest branch CI run is `33936927268` on `04d6dc73…`; no later run or head | **CONFIRMED** |

Verification:

```bash
git rev-parse origin/main
git rev-parse origin/cursor/pr5-emergency-remaining-integration-plan-b53e
git rev-list --left-right --count f9841691...04d6dc73
# 0	9
git merge-base f9841691307583381695973600df3546dd1b9ee4 04d6dc73c105328b62a248d23f9914f76ba333d7
# f9841691307583381695973600df3546dd1b9ee4
```

## 2. Complete changed-path set vs current main

`git diff --name-status f9841691… 04d6dc73…` yields exactly **7** paths:

| # | Status | Path |
|---|---|---|
| 1 | M | `stocky-plus/docs/PROJECT_STATUS.md` |
| 2 | A | `stocky-plus/docs/phases/phase-1/PR5_EMERGENCY_REMAINING_INTEGRATION_PLAN.md` |
| 3 | A | `stocky-plus/docs/phases/phase-1/PR5_EMERGENCY_REMAINING_INTEGRATION_PLAN_CORRECTION_INDEPENDENT_REVIEW.EXACT_BYTES.base64` |
| 4 | A | `stocky-plus/docs/phases/phase-1/PR5_EMERGENCY_REMAINING_INTEGRATION_PLAN_CORRECTION_INDEPENDENT_REVIEW_ARCHIVE_MANIFEST.md` |
| 5 | A | `stocky-plus/docs/phases/phase-1/PR5_EMERGENCY_REMAINING_INTEGRATION_PLAN_INDEPENDENT_REVIEW.md` |
| 6 | A | `stocky-plus/docs/phases/phase-1/PR5_F2C_CURRENT_MAIN_INDEPENDENT_REVIEW.md` |
| 7 | M | `stocky-plus/docs/phases/phase-1/README.md` |

This is exactly the required seven-path set. Nothing extra, nothing missing.

### Docs-only determination

Every changed path is under `stocky-plus/docs/**`, which is the `CI_POLICY.md` docs allowlist.

| Category | Present in diff |
|---|---|
| Runtime (`stocky-plus/app/**`) | **NO** |
| Prisma / schema | **NO** |
| Migration | **NO** |
| Test | **NO** |
| CI workflow (`.github/**`) | **NO** |
| Shopify config | **NO** |
| GraphQL operation | **NO** |
| `.gitattributes` | **NO** |

**Result: DOCS-ONLY CONFIRMED.**

## 3. Canonical review byte verification

### 3.1 Canonical source blob

```bash
git rev-parse 96b3f1a9649ffb14a22f731fd79e271060e8c44d:stocky-plus/docs/phases/phase-1/PR5_EMERGENCY_REMAINING_INTEGRATION_PLAN_CORRECTION_INDEPENDENT_REVIEW.md
# 00e8307e3aaf83b032fbcc1e2d0258beab47a864
```

Required `00e8307e3aaf83b032fbcc1e2d0258beab47a864` — **MATCH**.

The canonical source commit is reachable on `origin` at
`refs/heads/claude/pr5-f3-planning-correction-review-vzjfw0` =
`96b3f1a9649ffb14a22f731fd79e271060e8c44d`. The canonical source artifact is **unmodified**.

### 3.2 Decoded archive Git blob

```bash
git show 04d6dc73…:stocky-plus/docs/phases/phase-1/PR5_EMERGENCY_REMAINING_INTEGRATION_PLAN_CORRECTION_INDEPENDENT_REVIEW.EXACT_BYTES.base64 \
  | base64 --decode | git hash-object --stdin
# 00e8307e3aaf83b032fbcc1e2d0258beab47a864
```

Required `00e8307e3aaf83b032fbcc1e2d0258beab47a864` — **MATCH**.

### 3.3 Byte-for-byte comparison

```bash
cmp -s <(git show 96b3f1a9…:…_CORRECTION_INDEPENDENT_REVIEW.md) \
       <(git show 04d6dc73…:…EXACT_BYTES.base64 | base64 --decode)
# exit 0
```

**exit 0 — BYTE-IDENTICAL.** Decoded length 39816 bytes equals canonical blob size 39816 bytes.

### 3.4 Independent re-encode round trip

```bash
diff <(git cat-file blob 00e8307e3aaf83b032fbcc1e2d0258beab47a864 | base64 --wrap=76) \
     <(git show 04d6dc73…:…EXACT_BYTES.base64)
# identical
```

Line-length distribution of the archive: 698 lines of 76 columns plus a final 40-column line —
consistent with the manifest's declared `base64 --wrap=76` encoding.

**Conclusion: the archive is a lossless exact-byte encoding of the canonical review. A squash
merge of PR #32 onto `main` carries the archive into the main tree and therefore preserves the
canonical review bytes and the canonical Git blob identity.**

## 4. Live-tip path check

| Check | Result |
|---|---|
| `…_CORRECTION_INDEPENDENT_REVIEW.md` present at `04d6dc73…` | **ABSENT** (intentional) |
| Control docs falsely claim the canonical Markdown exists on the live tip | **NO** |
| Archive described as replacement / modified review | **NO** — described as lossless evidence storage |

`PROJECT_STATUS.md`, `phases/phase-1/README.md`, the plan document, the archive manifest, and the
PR body each state that the canonical Markdown path is **intentionally absent** from the live tip
and that PR #32 carries a lossless exact-byte archive that reconstructs the canonical blob. None
asserts the Markdown path exists at the tip.

### Absence rationale independently verified

The stated rationale is that the immutable source blob contains historical trailing whitespace
which fails repository `git diff --check`. Independently confirmed: the canonical blob contains
**31** lines with trailing whitespace. Restoring it at the canonical path would therefore fail the
Classify job's `git diff --check`. The rationale is truthful, and the chosen remedy does **not**
weaken `git diff --check`, alter the classifier, add `.gitattributes`, or normalize the review.

## 5. Other immutable blob checks at exact head

| Artifact | Required blob | Observed | Result |
|---|---|---|---|
| `PR5_EMERGENCY_REMAINING_INTEGRATION_PLAN_INDEPENDENT_REVIEW.md` | `ebf2e87bf108bbd5eaa7d31a323842de13ae53ca` | `ebf2e87bf108bbd5eaa7d31a323842de13ae53ca` | **MATCH** |
| `PR5_F2C_CURRENT_MAIN_INDEPENDENT_REVIEW.md` | `e14fc21efbe2cee874df6c1bd2e35647669c5445` | `e14fc21efbe2cee874df6c1bd2e35647669c5445` | **MATCH** |

Both immutable review artifacts are byte-exact at the reviewed head.

## 6. Architecture-drift check (`8a28c9ee…` → `04d6dc73…`)

The durability correction changes exactly five files, +769 / -6 lines:

| Path | Change |
|---|---|
| `PR5_…CORRECTION_INDEPENDENT_REVIEW.EXACT_BYTES.base64` | added (699 lines, encoded evidence) |
| `PR5_…CORRECTION_INDEPENDENT_REVIEW_ARCHIVE_MANIFEST.md` | added (61 lines, packaging manifest) |
| `PROJECT_STATUS.md` | 2 lines rewritten — archive/durability wording only |
| `PR5_EMERGENCY_REMAINING_INTEGRATION_PLAN.md` | 3 packaging table rows added; 2 paragraphs rewritten — archive/durability wording only |
| `phases/phase-1/README.md` | 2 lines rewritten — archive/durability wording only |

Every textual change describes where the canonical review lives and how it is packaged for
durability. No F3 architectural statement is added, removed, or altered.

Confirmed unchanged at `04d6dc73…`:

| Architecture element | State |
|---|---|
| One-F3-runtime-PR merge boundary | **RETAINED** — "Do **not** split JSONL into an earlier runtime PR" |
| JSONL / webhook / absence / reconcile / projection integration boundaries | **UNCHANGED** — all inside one F3 boundary |
| F2C terminal Product revival rule (`NEW-CLAUDE-F2CCM-01`) | **UNCHANGED** — two non-overlapping LIVE confirmations; ≥ two observation cycles |
| `F-CLAUDE-PR5F3EC-01` | **UNCHANGED** — `D * max(B, Σ worker concurrency)` or fail closed |
| `F-CLAUDE-PR5F3EC-02` | **UNCHANGED** — `^[0-9]+$` count-token gate, fail closed |
| R-163 two-root requirement | **UNCHANGED** — globally OPEN until both scanner roots proven |
| Risk ownership (R-157..R-165 F3-owned; R-142 / R-145 / R-156) | **UNCHANGED** |
| Feature-flag posture | **UNCHANGED** — `FEATURE_PR5_ABSENCE_TOMBSTONE` DEFAULT OFF |
| Production / inventory-write authorization | **UNCHANGED** — NOT AUTHORIZED |

**Result: NO MATERIAL ARCHITECTURE DRIFT.**

## 7. Safety and governance state at exact head

| Required statement | Observed | Result |
|---|---|---|
| F3 runtime NOT STARTED | stated in `PROJECT_STATUS.md` and `phases/phase-1/README.md` | **ACCURATE** |
| F3 runtime not authorized by the packet | stated | **ACCURATE** |
| One F3 runtime PR retained | stated | **ACCURATE** |
| `FEATURE_PR5_ABSENCE_TOMBSTONE` DEFAULT OFF | stated; not enabled anywhere in the diff | **ACCURATE** |
| Production NOT AUTHORIZED | stated | **ACCURATE** |
| Inventory writes NOT AUTHORIZED | stated | **ACCURATE** |
| Every inventory-write flag DEFAULT OFF | stated | **ACCURATE** |
| PR6 runtime NOT AUTHORIZED until PR5 closes | stated | **ACCURATE** |
| R-163 globally OPEN until both scanner roots proven | stated | **ACCURATE** |
| PR5 itself is not complete | stated ("Do **not** state PR 5 is complete") | **ACCURATE** |
| No D-055 | stated ("Do **not** create D-055"); no D-055 introduced | **ACCURATE** |

**Result: SAFETY AND GOVERNANCE STATE PRESERVED. No weakening observed.**

## 8. Local validation

```bash
git diff --check f9841691307583381695973600df3546dd1b9ee4 04d6dc73c105328b62a248d23f9914f76ba333d7
# exit 0, no output
```

**PASS.**

Repository classifier, run independently (not accepted from pasted output):

```bash
bash .github/scripts/classify-ci-change-set.sh --from-git f9841691… 04d6dc73…
```

```
range_usable=true
changed_path_count=7
changed_path [docs] stocky-plus/docs/PROJECT_STATUS.md
changed_path [docs] stocky-plus/docs/phases/phase-1/PR5_EMERGENCY_REMAINING_INTEGRATION_PLAN.md
changed_path [docs] stocky-plus/docs/phases/phase-1/PR5_EMERGENCY_REMAINING_INTEGRATION_PLAN_CORRECTION_INDEPENDENT_REVIEW.EXACT_BYTES.base64
changed_path [docs] stocky-plus/docs/phases/phase-1/PR5_EMERGENCY_REMAINING_INTEGRATION_PLAN_CORRECTION_INDEPENDENT_REVIEW_ARCHIVE_MANIFEST.md
changed_path [docs] stocky-plus/docs/phases/phase-1/PR5_EMERGENCY_REMAINING_INTEGRATION_PLAN_INDEPENDENT_REVIEW.md
changed_path [docs] stocky-plus/docs/phases/phase-1/PR5_F2C_CURRENT_MAIN_INDEPENDENT_REVIEW.md
changed_path [docs] stocky-plus/docs/phases/phase-1/README.md
classification_reason=every_changed_path_is_docs_allowlist
docs_only=true
full_ci=false
```

Required `docs_only=true` / `full_ci=false` / `changed_path_count=7` — **MATCH**. Exit status 0.

## 9. Exact-head CI

GitHub Actions run [`33936927268`](https://github.com/Vedang1998/Stocky/actions/runs/33936927268),
inspected independently via the GitHub API:

| Field | Required | Observed | Result |
|---|---|---|---|
| Event | `pull_request` | `pull_request` | **MATCH** |
| Head SHA | `04d6dc73c105328b62a248d23f9914f76ba333d7` | `04d6dc73c105328b62a248d23f9914f76ba333d7` | **MATCH** |
| Overall conclusion | SUCCESS | `success` | **MATCH** |
| Classify `101226562547` | SUCCESS | `success` | **MATCH** |
| Heavy `101226660128` | SKIPPED | `skipped` | **MATCH** |
| CI Gate `101226659591` | SUCCESS | `success` | **MATCH** |

Run number 386, attempt 1, workflow `.github/workflows/ci.yml`, started `2026-09-05T01:41:44Z`.
The heavy job skip is correct under `CI_POLICY.md` because the change set classified `docs_only`;
CI Gate therefore returns SUCCESS on the docs-only path rather than on a skipped runtime check.

**No later push superseded this evidence.** Run `33936927268` is the newest CI run on branch
`cursor/pr5-emergency-remaining-integration-plan-b53e`, and the PR head still equals its head SHA.

## 10. Findings

| Severity | Count |
|---|---|
| P0 | **0** |
| P1 | **0** |
| P2 | **0** |
| P3 | **1** |

### P3 — observations (non-blocking)

**`F-CLAUDE-PR5F3DUR-01` (P3) — post-merge discoverability of the canonical review text.**

*File:* `stocky-plus/docs/phases/phase-1/PR5_EMERGENCY_REMAINING_INTEGRATION_PLAN_CORRECTION_INDEPENDENT_REVIEW.EXACT_BYTES.base64`

*Evidence:* After a squash merge onto `main`, the approved correction review exists on `main` only
as a Base64 payload. A reader browsing `main` cannot read the verdict text without running a decode
step, and repository search will not match the review's prose.

*Impact:* Support and audit friction only. Durability, immutability, and blob identity are fully
preserved, and the archive manifest documents the exact deterministic reconstruction commands, so
no evidence is lost.

*Expected behavior:* Evidence is recoverable and correctly identified — satisfied.

*Recommended correction (optional, not required for this approval):* When the trailing-whitespace
constraint is addressed by a future explicitly authorized decision, the canonical Markdown may be
restored at its canonical path alongside the archive. Do not normalize the canonical bytes to
achieve this, and do not weaken `git diff --check`.

*Missing test:* None required for a docs-only packaging change; the manifest's reconstruction
commands serve as the executable check and were independently exercised in §3.

No finding meets the P0/P1/P2 bar. Specifically, none of the following could be demonstrated:
the archive failing to reconstruct the canonical blob; a failed byte comparison; modification of
the canonical source; control documents misrepresenting the archive; a changed immutable blob;
non-docs scope entering the PR; material architecture drift; weakened safety or governance state;
CI evidence not corresponding to the exact head; or a failing `git diff --check` or classifier.

## 11. Verdict

PR #32 at exact head `04d6dc73c105328b62a248d23f9914f76ba333d7` safely preserves the independently
approved PR5-F3 planning correction review through a future squash merge. The exact canonical
review bytes are preserved and reconstruct Git blob `00e8307e3aaf83b032fbcc1e2d0258beab47a864`; the
canonical review remains immutable at its source commit; `git diff --check` is clean; the local
classifier returns `docs_only=true` / `full_ci=false` / `changed_path_count=7`; no material F3
architecture change was introduced; the PR remains docs-only; the other immutable review artifacts
are byte-exact; and current-main, safety, and governance state are accurately stated.

**APPROVE PR32 DURABILITY AND CHAIN OF CUSTODY**

---

## Review provenance

| Field | Value |
|---|---|
| Reviewed PR | [#32](https://github.com/Vedang1998/Stocky/pull/32) |
| Reviewed exact head | `04d6dc73c105328b62a248d23f9914f76ba333d7` |
| Verified current `main` | `f9841691307583381695973600df3546dd1b9ee4` |
| Canonical source commit | `96b3f1a9649ffb14a22f731fd79e271060e8c44d` |
| Canonical source path | `stocky-plus/docs/phases/phase-1/PR5_EMERGENCY_REMAINING_INTEGRATION_PLAN_CORRECTION_INDEPENDENT_REVIEW.md` |
| Canonical Git blob | `00e8307e3aaf83b032fbcc1e2d0258beab47a864` |
| Exact-head CI run | `33936927268` SUCCESS |
| Review branch | `claude/pr32-durability-review-r6tjf6`, based exactly on `04d6dc73…` |
| PR #32 modified by this review | **NO** |

This review artifact is immutable. Do **not** edit it.
