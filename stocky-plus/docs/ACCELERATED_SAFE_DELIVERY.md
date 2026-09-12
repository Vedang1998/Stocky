# Accelerated Safe Delivery v1

- **Status:** Permanent repository governance from Phase 1 PR 5 implementation onward
- **Authority:** ChatGPT product-owner decision recorded with D-054
- **Applies to:** ChatGPT, Cursor, and Claude Code
- **This document is canonical.** Agent prompts carry concise mandatory summaries and must link here. Do not copy this entire document into every agent file.

This operating model changes **calendar execution**, not acceptance standards.

**Current authority:** D-054 is **EFFECTIVE**. Implementation-entry PR [#26](https://github.com/Vedang1998/Stocky/pull/26) merged previously. The PR5-F1 foundation is **ACCEPTED / MERGED / FROZEN** after PR [#27](https://github.com/Vedang1998/Stocky/pull/27). PR5-F2A, PR5-F2B, and PR5-F2C are **ACCEPTED / MERGED** after PRs [#29](https://github.com/Vedang1998/Stocky/pull/29), [#31](https://github.com/Vedang1998/Stocky/pull/31), and [#30](https://github.com/Vedang1998/Stocky/pull/30). PR [#32](https://github.com/Vedang1998/Stocky/pull/32) remaining-integration planning and PR [#33](https://github.com/Vedang1998/Stocky/pull/33) control packet are **MERGED**. PR [#35](https://github.com/Vedang1998/Stocky/pull/35) PR5-F3 remaining-integration runtime is **CLOSED / MERGED** as squash `36365e2535a2394fa53b0642db4dbf90a438316f` (`2026-09-06T01:33:34Z`); independent exact-head verdict `APPROVE PR5-F3 EXACT-HEAD IMPLEMENTATION`. **ChatGPT disposition: ACCEPT PHASE 1 PR5 REPOSITORY IMPLEMENTATION.** Formal PR5 repository-implementation closure is **effective** as of PR [#36](https://github.com/Vedang1998/Stocky/pull/36) squash `58bf62b4d1c5f51dac70ee96fed4ece0a109b25f`. This is **not D-055**. Phase 1 remains **IN PROGRESS**. PR6 planning is **ACCEPTED / MERGED** via PR [#34](https://github.com/Vedang1998/Stocky/pull/34) squash `09feffd3f36eb4698f2ed8a152efe414cd9b77bd`. PR [#37](https://github.com/Vedang1998/Stocky/pull/37) PR6-A foundation is **CLOSED / MERGED** as squash **M** `bdbb5bba91ac8af82e49a99e36cce5db8b401c68`; independent correction verdict `APPROVE PR6-A FOUNDATION CORRECTION`. **ChatGPT disposition: ACCEPT PR6-A FOUNDATION.** PR6-B and PR6-C complete-module work is **AUTHORIZED** after that admission on separate branches from **M**: Cursor B is the sole shared-control writer (`PR6_A_CLOSURE_REPORT.md`, `PR6_BC_EXECUTION_BRIEF.md`, later admin-read runtime); Cursor C owns apply only and starts from M, never from B's runtime branch. **PR6-D runtime remains NOT AUTHORIZED.** Safety gates in this document are **not** relaxed. The Monday 7 September 2026 internal/controlled target is **missed** and is not re-dated. Emergency Continuity Sprint calendar control is recorded in `EMERGENCY_DELIVERY_DIRECTIVE_2026-09-01.md` and does **not** relax any gate in this document. D-054 does **not** authorize production, merchant production data, inventory-write flags, Shopify inventory mutations, `read_all_orders`, `write_orders`, or PR6-D runtime.

**Historical (implementation-entry PR, while open):** D-054 was **CONDITIONAL** while the implementation-entry PR was open. Recording this document did **not** by itself authorize PR 5 runtime implementation, production, inventory writes, or any later phase.

---

## 1. Safety gates do not change

Acceleration must not weaken:

- tenant / RLS controls;
- authorization;
- additive migration and recovery rules;
- money correctness;
- inventory-write safety;
- Shopify authority;
- reconciliation;
- exact-head CI;
- independent review;
- feature flags;
- kill switches;
- production authorization.

A faster schedule is not a reason to skip a gate, shrink a required test, or treat a polished interface as proof of completion.

---

## 2. Parallelize work, not uncertainty

Runtime dependencies still merge in **dependency order**.

Shared schema, interfaces, security boundaries, and transaction primitives must be **frozen and merged** before dependent runtime lanes start.

Do not let multiple Cursor writers independently redesign the same contract.

---

## 3. One dependency level ahead

Planning and research may proceed **one dependency level ahead** while the current runtime unit is being implemented.

Allowed ahead of runtime authority:

- research;
- architecture drafts;
- UX flows;
- acceptance criteria;
- fixtures;
- reconciliation examples;
- test matrices;
- official Shopify / API research;
- pricing / commercial research.

Not allowed early:

- future-phase runtime code merged to `main`;
- future-phase migrations;
- future-phase Shopify configuration;
- future-phase production actions.

Planning ahead is **not** implementation authorization.

Cursor may do one-level-ahead planning only when ChatGPT **expressly authorizes** that planning unit. Cursor must not start adjacent runtime work on its own.

---

## 4. Parallel Cursor lanes

After the shared contracts required by the lanes are frozen and merged, ChatGPT may authorize **up to 2–4** concurrent Cursor implementation lanes.

Each lane requires:

- a separate branch;
- a separate Cursor chat;
- one focused objective;
- explicit owned files / modules;
- explicit prohibited files / modules;
- no overlapping schema / migration ownership;
- no overlapping writer ownership;
- an exact base SHA;
- its own tests and evidence;
- its own pull request.

One writer per branch / PR.

Never have two agents modifying the same migration, schema, or shared transaction contract concurrently.

Parallel lanes are authorized **only when ChatGPT defines them**. Cursor must not invent a parallel lane.

---

## 5. Foundation first

For a high-dependency runtime unit, first land the narrow shared foundation:

- schema;
- migration;
- interfaces;
- transaction / identity primitives;
- security boundaries.

Only after that foundation is frozen may independent downstream lanes widen.

---

## 6. Small PRs, not giant phase PRs

Do **not** implement an entire phase in one huge PR merely because AI can produce it quickly.

Use focused, reversible, independently reviewable PRs.

Stacked / dependent work is allowed only when the dependency and base relationship is explicit.

Merge to `main` in dependency order.

---

## 7. Risk tiers

### Tier A — highest scrutiny

- authentication / authorization;
- tenancy / RLS;
- migrations;
- canonical identity;
- deletion;
- concurrency;
- money / costs;
- forecasting formulas;
- inventory writes;
- reconciliation;
- billing / entitlements;
- AI spending controls;
- security / privacy.

Tier A requires:

- an explicit architecture / acceptance contract;
- independent Claude review;
- exact-head full CI;
- adversarial failure / race testing where relevant.

### Tier B

- read-only merchant workflows;
- reports;
- derived analytics;
- ordinary UI tied to already-approved contracts.

Standard independent review and applicable CI.

### Tier C

- documentation;
- copy;
- non-behavioral presentation.

Docs / lightweight gates may be sufficient where classification proves no runtime effect.

**Risk tier does not override an explicit phase gate.**

---

## 8. Claude early red team

For new Tier-A architecture, Claude should receive an **early** adversarial review before substantial implementation.

Claude must attempt to enumerate all material issues in **one pass**, including:

- first create;
- last delete;
- concurrent workers;
- overlapping requests;
- crash boundaries;
- rollback;
- retry;
- timeout;
- missing row;
- duplicate delivery;
- stale worker;
- cross-tenant access;
- permission failure;
- clock behavior where relevant;
- partial Shopify failure;
- recovery / reconciliation.

Claude must not intentionally stop after discovering the first blocker.

Final exact-head review remains required.

Independent review cannot be replaced by another Cursor lane.

---

## 9. Consolidated corrections

ChatGPT processes all valid findings and should issue **one consolidated Cursor correction package** where practical.

Do not make serial one-finding correction loops the default.

A new serious issue discovered later still reopens the gate.

---

## 10. Durable GitHub handoffs

GitHub is authoritative.

Implementation and review evidence must be stored in the appropriate durable report.

The user should not be required to manually relay enormous agent transcripts when ChatGPT can inspect GitHub evidence directly.

Chat summaries are convenience only.

---

## 11. CI

Do not delete test coverage to improve speed.

Independent suites may later be sharded or parallelized.

Any CI sharding change requires its own tooling review and must preserve the stable final CI Gate.

This document does **not** authorize a CI workflow change by itself.

---

## 12. Phase boundary

Future-phase **implementation** may not start early.

Future-phase **planning** one dependency level ahead is permitted under this document and must be clearly marked speculative / non-authoritative until its own phase gate.

“The next phase is not silently started early” means:

- no unauthorized future runtime implementation;
- approved one-level-ahead planning / research is permitted when expressly authorized and labeled.

---

## Cursor mandatory summary

- Parallel lanes exist only when ChatGPT defines them.
- One branch, one chat, one objective per lane.
- File ownership is exclusive.
- Do not start adjacent runtime work on your own.
- Planning one dependency ahead is allowed only when expressly authorized.
- Shared foundations must freeze before dependent parallel lanes.

## Claude mandatory summary

- Perform early exhaustive red-team review for new Tier-A architecture.
- Try to discover the whole material finding set in one pass.
- Final exact-head review remains mandatory.
- Independent review cannot be replaced by another Cursor lane.

## ChatGPT mandatory summary

- Own lane definitions, file ownership, and one-level-ahead planning authorization.
- Issue one consolidated correction package where practical.
- Keep GitHub as the durable handoff.
- Do not weaken safety gates to accelerate calendar delivery.
