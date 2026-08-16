# Phase Tracking Workflow

Each phase follows the same simple loop:

1. **ChatGPT plans** the phase and approves `PHASE_BRIEF.md`.
2. **Cursor builds** focused tasks on named branches and writes `IMPLEMENTATION_REPORT.md`.
3. **Claude reviews** the pull request and writes `REVIEW_REPORT.md`.
4. **ChatGPT decides** whether corrections are required or the phase is accepted.
5. The approved pull request is merged and `PROJECT_STATUS.md` is updated.

## Required files per phase

```text
phase-N/
├── PHASE_BRIEF.md
├── IMPLEMENTATION_REPORT.md
└── REVIEW_REPORT.md
```

Additional files such as `CORRECTION_BACKLOG.md`, migration plans, or test evidence may be added when useful.

## Allowed status values

- `DRAFT`
- `APPROVED`
- `IN PROGRESS`
- `IN REVIEW`
- `BLOCKED`
- `ACCEPTED`
- `CLOSED`

## Starting a phase

A phase cannot begin until:

- its brief is approved;
- its scope and non-goals are written;
- acceptance criteria are testable;
- safety and migration requirements are identified;
- the branch and pull-request plan is clear.

## Closing a phase

A phase is not complete merely because code was merged. It closes only when:

- implementation evidence is recorded;
- Claude's independent review is recorded;
- mandatory corrections are resolved or explicitly deferred by decision;
- `PROJECT_STATUS.md`, risks, decisions, and open questions are updated;
- the next phase is not silently started early.

“The next phase is not silently started early” means:

- no unauthorized future-phase **runtime** implementation, migration, Shopify configuration, or production action;
- approved **one-dependency-level-ahead** planning / research is permitted under `stocky-plus/docs/ACCELERATED_SAFE_DELIVERY.md` when ChatGPT expressly authorizes it, and must be marked speculative / non-authoritative until its own phase gate.

Planning ahead is not implementation authorization. Safety gates do not change.

## Chat organization

- One ChatGPT planning/decision chat per phase.
- One fresh Cursor chat per focused implementation task or pull request.
- One fresh Claude chat per important pull request review.

Chats may be closed after their results are stored in GitHub.

## Templates

Copy the files from `_templates/` into the new phase folder and remove `_TEMPLATE` from each filename.
