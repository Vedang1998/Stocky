# Emergency Continuity Sprint — Control Packet

**Recorded:** 2026-09-01
**Current-state addendum:** 2026-09-05
**Status:** DURABLE CONTROL PACKET — synchronized onto current `main` after PR #32 merged; pending ChatGPT review of PR #33; **does not authorize F3 runtime**
**Authority recorded here:** ChatGPT operational control for an INTERNAL / CONTROLLED rescue
**Product-rule authority:** unchanged. Approved product documents remain source of truth.
**Implementation authority:** **D-054 remains EFFECTIVE.** This packet does **not** create D-055.
**Operating model:** `ACCELERATED_SAFE_DELIVERY.md` (calendar execution only; safety gates unchanged)
**This PR / lane:** documentation only. No runtime. No schema. No migration. No Shopify configuration. No inventory-write flag change.

This is the durable Emergency Continuity Sprint control packet for the Stocky sunset. It does **not** start or authorize a future runtime lane, including F3. ChatGPT must separately define any Cursor lanes after reviewing this packet.

Readers must separate:

- **enduring emergency operating principles** (safety gates, Shopify authority, inventory-write flags DEFAULT OFF, maximum four lanes, exact-head CI, independent review);
- **historical targets/deadlines** recorded on 2026-09-01 (Monday 7 September 2026 internal/controlled rescue);
- **already-completed prerequisites** now on `main` (F2A, F2B, F2C, PR #32 remaining-integration planning);
- **still-future work** (F3 runtime, PR6 runtime, production, inventory writes).

---

## 1. Incident and target

Stocky became unavailable after **31 August 2026**.

Emergency operational target recorded on 2026-09-01: **Monday 7 September 2026**.

That Monday target is an **INTERNAL / CONTROLLED operational rescue**. It is **not** full public App Store parity, Built for Shopify certification, or commercial launch by 7 September 2026. Recording the target does **not** prove that rescue work occurred, and it does **not** convert this packet into F3 implementation authorization.

Full commercial launch remains subject to the normal phase and release gates in `product/06_ROADMAP_AND_RELEASE_GATES.md` and the approved product documents.

---

## 2. Product scope is unchanged

The approved **132-feature** product scope is unchanged.

- `product/00_READ_ME_FIRST.md`
- `product/09_FEATURE_MATRIX.md`
- `product/feature_matrix.csv`

This packet does **not**:

- shrink the 132-feature backlog;
- change Stocky Parity formulas;
- change Smart Forecast labeling or backtesting rules;
- change pricing, entitlement, or AI cost-control rules;
- replace Shopify authority for products, variants, orders, refunds, locations, or sellable inventory;
- authorize production, merchant production data, production backfill, ownership repair, or inventory mutation.

Unfinished later-phase work remains unfinished. The Monday rescue is a **prioritized operational subset**, not a new product definition.

---

## 3. Safety gates are not relaxed

Accelerated Safe Delivery changes calendar execution, not acceptance standards.

These gates remain mandatory:

- tenant / RLS controls;
- server-side authorization;
- additive migrations and recovery;
- decimal-safe money handling;
- inventory-write safety (stable operation ID, actor, location and permission checks, idempotency, line-level results, partial-failure handling, audit, reconciliation, recovery/reversal, kill switch, tests);
- Shopify authority;
- reconciliation;
- **exact-head CI**;
- independent review;
- feature flags;
- kill switches;
- production authorization.

A faster calendar is not a reason to skip a gate, shrink a required test, merge a whole phase in one PR, or treat a polished interface as completion.

---

## 4. Delivery method

Use **Accelerated Safe Delivery v1** with **at most four** independent Cursor lanes.

Mandatory lane rules:

- ChatGPT defines each lane (objective, owned files, prohibited files, exact base SHA).
- Cursor must **not** invent a parallel lane.
- One writer per branch / PR.
- One focused objective per lane.
- No overlapping schema / migration / shared-transaction ownership.
- No whole-phase giant PR.
- Shared frozen contracts remain the dependency boundary.
- Claude Code remains the **independent reviewer for Tier A**.
- Independent review cannot be replaced by another Cursor lane.
- Exact-head CI remains mandatory for every open implementation PR.
- Docs-only PRs use the lightweight classification / docs-integrity gate in `CI_POLICY.md`.

This documentation lane does **not** name, start, or staff those runtime lanes.

---

## 5. Inventory writes and Shopify authority

Every inventory-write flag remains **DEFAULT OFF**.

Shopify remains authoritative for products, variants, orders, refunds, locations, and sellable inventory.

App-owned receiving, adjustment, stocktake, cost-sync, and transfer writes remain unauthorized until they separately pass their later safety gates. This packet does **not** enable those writes.

**Emergency bridge until equivalent app writes pass those later gates:**

Shopify-native purchase orders, receiving, transfers, and adjustments are the operational bridge. Merchants use Shopify’s own inventory-mutation surfaces for writes the app must not perform while flags remain off and write-safety gates remain unmet.

This bridge:

- does **not** rewrite the approved product rule that the public stable Admin API does not currently offer a full Inventory Purchase Order API (`product/04_ARCHITECTURE_AND_BFS_PLAN.md`, source S22);
- does **not** make an unstable/preview Shopify PO API a production-parity dependency;
- does **not** authorize the app to mutate Shopify inventory;
- is a **temporary operational path**, not a substitute for later app-owned ledgers, receiving integrity, or write-safety evidence.

---

## 6. Monday 7 September 2026 rescue priorities

The internal / controlled rescue prioritizes a **reliable operational core**:

1. **Reliable inventory facts** — Shopify-authoritative catalog, location, and inventory quantities the merchant can trust.
2. **Replenishment** — deterministic Stocky Parity replenishment the merchant can act on.
3. **ABC/U** — documented Stocky ABC/U classification, not a silent Smart Forecast substitute.
4. **Low-stock** — merchant-visible low-stock / exception visibility grounded in those facts.
5. **Editable quantities** — merchants can edit suggested order quantities without hidden MOQ, pack-size, lead-time, safety-stock, or case-rounding coercion.
6. **Shopify-compatible ordering / export flow** — an ordering or export path the merchant can take into Shopify-native purchasing / receiving / transfer / adjustment workflows.

Out of Monday rescue scope unless ChatGPT later authorizes a specific lane:

- full public App Store listing and review package;
- Built for Shopify certification;
- app-owned inventory writes with flags on;
- complete 132-feature parity;
- Smart Forecast production enablement;
- billing/entitlement commercial launch;
- AI features;
- production backfill / ownership repair;
- Partner Dashboard / environment-separation closure (Q-002);
- legal privacy-policy production closure (Q-008).

---

## 7. Current repository identity at packet recording

Recorded from live Git / GitHub at the start of this documentation lane. These are **not** this PR’s future head.

| Field | Value |
|---|---|
| `origin/main` / authorized starting SHA | `f65ab4b906f53b3a1c72cdd7b29cdc0cbde6a7d7` |
| PR5-F1 foundation | **ACCEPTED / MERGED / FROZEN** (PR [#27](https://github.com/Vedang1998/Stocky/pull/27)) |
| PR5-F2A admin-read boundary | **MERGED** — PR [#29](https://github.com/Vedang1998/Stocky/pull/29) |
| PR #29 squash merge | `f65ab4b906f53b3a1c72cdd7b29cdc0cbde6a7d7` |
| PR #29 merge timestamp | `2026-08-20T11:04:26Z` |
| Previous main before PR #29 | `5129707ee684e66cadcf96b976e16eb57385a7cb` |
| Accepted F2A implementation head | `bfbe369f590e38f36de8165e366dd7e84449ecd7` |
| Final F2A independent verdict | `APPROVE PR5-F2A ADMIN READ S01 CORRECTION` |
| ChatGPT F2A technical acceptance | **ACCEPT PR5-F2A ADMIN READ BOUNDARY** |
| Post-merge main CI | run [`32362021387`](https://github.com/Vedang1998/Stocky/actions/runs/32362021387), event `push`, head `f65ab4b…`, **SUCCESS** |
| Classify job | `96403425899` SUCCESS |
| Heavy job | `96403462492` SUCCESS |
| CI Gate job | `96415720267` SUCCESS |
| Production | **NOT AUTHORIZED** |
| Inventory-write flags | **DEFAULT OFF** |

PR 5 remains **IN PROGRESS**. Phase 1 remains **IN PROGRESS**. At the time this packet was first recorded, F2B / F2C / F3 / PR 6 remained **not started by this packet**. Later merged `main` identities are in §10 and do not retroactively authorize F3.

---

## 8. What this packet authorizes — and what it does not

**Authorizes (documentation / control only):**

- recording the emergency operational target and internal/controlled rescue framing;
- recording F2A post-merge identity and post-merge CI `32362021387`;
- applying Accelerated Safe Delivery to this incident with a maximum of four Cursor lanes **once ChatGPT defines them**;
- recording that the F2A admin-read sub-lane satisfied **its own** R-163 scanner obligation, while **R-163 remains globally OPEN** until F3 proves both scanner roots.

**Does not authorize:**

- runtime code in this lane;
- a whole-phase PR;
- enabling inventory-write flags;
- enabling `FEATURE_PR5_ABSENCE_TOMBSTONE`;
- Shopify inventory mutations by the app;
- production access or production data;
- starting F3 or PR 6 runtime from this file;
- creating D-055;
- claiming Phase 1 complete, PR 5 complete, or App Store readiness;
- changing approved product behavior;
- converting F2A lane-specific R-163 satisfaction into global R-163 closure;
- splitting JSONL bulk ingestion into an earlier runtime PR than the accepted one-F3 architecture.

---

## 9. Next action after this packet

1. ChatGPT reviews this control packet on the synchronized PR #33 head.
2. If accepted, ChatGPT may define exclusive Cursor lanes with exact base SHA and file ownership. F3 remains a later, separately authorized runtime lane.
3. Cursor implements only those authorized lanes.
4. Claude independently reviews Tier A work at exact heads.
5. Exact-head CI remains the automatic evidence for each open implementation PR.
6. The user alone authorizes merges.

**This documentation PR starts none of those runtime lanes.**

---

## 10. Current repository state addendum (2026-09-05)

This addendum updates live current-state after later merges. It does **not** rewrite the 2026-09-01 recording identities in §7.

| Field | Value |
|---|---|
| Current `origin/main` | `f1201f853b8a42f40e4d3e5565b6406410360c8a` |
| That SHA | PR [#32](https://github.com/Vedang1998/Stocky/pull/32) remaining-integration planning squash merge |
| PR #32 merge timestamp | `2026-09-05T13:01:09Z` |
| Post-merge PR #32 CI | run [`33967677166`](https://github.com/Vedang1998/Stocky/actions/runs/33967677166) SUCCESS |
| PR5-F2A | **MERGED** (historical squash `f65ab4b906f53b3a1c72cdd7b29cdc0cbde6a7d7`) |
| PR5-F2B | **MERGED** (squash `0284b66c776bbfa0ce7b8c7d9e579a365d7dfe26`; post-merge CI `33619969867` SUCCESS) |
| PR5-F2C | **MERGED** (squash `f9841691307583381695973600df3546dd1b9ee4`; post-merge CI `33816908539` SUCCESS) |
| F3 runtime | **NOT STARTED** and **not authorized** by this packet or by merged PR #32 planning |
| One-F3 architecture | **RETAINED** — JSONL bulk ingestion; authoritative webhook/refetch; absence nomination/reconcile; compatibility-projection integration; v1 legacy-authority fencing; two-root scanner; health-state integration. Do **not** split JSONL into an earlier runtime PR. |
| Carry-forwards retained | `NEW-CLAUDE-F2CCM-01`; `F-CLAUDE-PR5F3EC-01`; `F-CLAUDE-PR5F3EC-02`; `F-CLAUDE-PR5F3DUR-01` remains non-blocking P3 |
| R-163 | **OPEN globally** until F3 proves both scanner roots |
| PR6 runtime | **NOT AUTHORIZED** until PR 5 closes |
| Production | **NOT AUTHORIZED** |
| Inventory-write flags | **DEFAULT OFF** |
| `FEATURE_PR5_ABSENCE_TOMBSTONE` | **DEFAULT OFF** |
| D-055 | **Not created** |
| PR #34 | Untouched by this packet |

Already-completed prerequisites on `main` are F2A, F2B, F2C, and PR #32 planning. Still-future work includes F3 runtime, PR6 runtime, production, and inventory writes. This addendum does **not** imply that Monday rescue priorities were completed.
