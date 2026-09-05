# PR5-F3 planning correction review — exact-byte archive manifest

This file is packaging/control evidence for PR #32. It is **not** a modified independent review and does **not** change the review verdict or F3 architecture.

## Canonical source (immutable)

| Field | Value |
|---|---|
| Canonical source branch | `claude/pr5-f3-planning-correction-review-vzjfw0` |
| Canonical source commit | `96b3f1a9649ffb14a22f731fd79e271060e8c44d` |
| Canonical source path | `stocky-plus/docs/phases/phase-1/PR5_EMERGENCY_REMAINING_INTEGRATION_PLAN_CORRECTION_INDEPENDENT_REVIEW.md` |
| Immutable Git blob | `00e8307e3aaf83b032fbcc1e2d0258beab47a864` |
| Verdict | `APPROVE PR5-F3 PLANNING CORRECTION` |
| Counts | P0 **0** / P1 **0** / P2 **0** / P3 **2** (`F-CLAUDE-PR5F3EC-01`, `F-CLAUDE-PR5F3EC-02`) |
| Original findings corrected | **25 / 25** |
| One-F3-runtime-PR architecture | **RETAINED** |

**NEVER EDIT** the canonical source artifact. Do **not** change one byte of it. Do **not** copy a modified Markdown file to the canonical path.

## Why the canonical Markdown file is not on the PR #32 tip

The immutable source blob contains historical trailing whitespace. Restoring that Markdown file to its canonical path on the live PR tip causes repository `git diff --check` against current `main` to fail. CI Classify therefore fails. The canonical Markdown path is **intentionally absent** from the live tip.

This archive does **not** weaken `git diff --check`, change the classifier, add `.gitattributes`, or normalize the review.

## Exact-byte archive

| Field | Value |
|---|---|
| Archive path | `stocky-plus/docs/phases/phase-1/PR5_EMERGENCY_REMAINING_INTEGRATION_PLAN_CORRECTION_INDEPENDENT_REVIEW.EXACT_BYTES.base64` |
| Encoding | Base64, 76-column wrap (`base64 --wrap=76`) |
| Meaning | Lossless evidence storage of the **exact** canonical bytes. Not a rewritten review. |

A squash merge of PR #32 onto `main` carries this archive in the main-tree diff. Decoding it reconstructs Git blob `00e8307e3aaf83b032fbcc1e2d0258beab47a864`.

## Deterministic reconstruction / verification

From a checkout that contains the archive (after PR #32 merge, the source commit is not required):

```bash
base64 --decode \
  stocky-plus/docs/phases/phase-1/PR5_EMERGENCY_REMAINING_INTEGRATION_PLAN_CORRECTION_INDEPENDENT_REVIEW.EXACT_BYTES.base64 \
  | git hash-object --stdin
# required: 00e8307e3aaf83b032fbcc1e2d0258beab47a864
```

When the canonical source commit is still reachable, also prove byte identity against that commit:

```bash
CANON=96b3f1a9649ffb14a22f731fd79e271060e8c44d:stocky-plus/docs/phases/phase-1/PR5_EMERGENCY_REMAINING_INTEGRATION_PLAN_CORRECTION_INDEPENDENT_REVIEW.md

git rev-parse "${CANON}"
# required: 00e8307e3aaf83b032fbcc1e2d0258beab47a864

cmp -s \
  <(git show "${CANON}") \
  <(base64 --decode stocky-plus/docs/phases/phase-1/PR5_EMERGENCY_REMAINING_INTEGRATION_PLAN_CORRECTION_INDEPENDENT_REVIEW.EXACT_BYTES.base64)
# required: exit 0 (IDENTICAL)
```

Do not treat SHA-256 or ordinary file hashes as the required identity. The required identity is the Git blob `00e8307e3aaf83b032fbcc1e2d0258beab47a864`.
