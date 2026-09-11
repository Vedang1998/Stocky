# PR6-D Integration Readiness — Correction and Owner-Disposition Addendum

**PLANNING ONLY — NOT IMPLEMENTATION APPROVAL. NOT AN ADMISSION RECORD.**

This artifact is an **additive** correction to the provisional readiness package. It is authorized by
the explicit narrow prep authorization in PR #37 comment
[5639320213](https://github.com/Vedang1998/Stocky/pull/37#issuecomment-5639320213)
("Claude may perform this DOCUMENTATION-ONLY correction preparation immediately, even before M
exists"). It is **not**:

- an admission record, or any claim that the admission gate has passed;
- approval of PR6-B, PR6-C or PR6-D;
- a competing source of product authority — the owner disposition governs;
- a claim that any B/C/D runtime exists, was implemented, or was tested.

| Field | Value |
|---|---|
| Correction date | 2026-09-11 |
| Branch | `claude/pr6-d-integration-readiness-8vs1ar` |
| Governing adjudication | PR #37 comment `5639320213` (supplements decision `5638553192`) |
| Original artifact | `stocky-plus/docs/phases/phase-1/PR6_D_INTEGRATION_READINESS_REVIEW.md` |
| Original commit | `1820485df3bcb4df8c1245042e1ad6f757d7abeb` |
| **Original blob — unchanged** | **`7e8bc701d94bd322b692629522063930ffa08f32`** |
| Content source read | `f7a39c3664a8a45b7a7cd3055079b4ebc888bb02` (accepted PR6-A head, read-only) |
| M | **still UNRESOLVED** — PR #37 not merged; `origin/main` still `09feffd3…` |

## 0. Preservation statement

The original readiness artifact is preserved **byte-for-byte**. Nothing in it was edited, reordered,
re-severitised or deleted. Its original severity labels stand exactly as issued. Every correction
below is recorded **here**, in a separate file, and states plainly what the original said, why it was
wrong, and what replaces it.

Where this addendum and the original conflict, **this addendum governs**, and the owner disposition
in `5639320213` governs both.

No immutable prior review was touched. No shared control document was created or edited —
`PR6_A_CLOSURE_REPORT.md` and `PR6_BC_EXECUTION_BRIEF.md` remain B's to write.

---

## 1. Corrections

Nine corrections. Seven are the categories named in the work order; C-08 and C-09 record ownership
reassignments the adjudication makes that also invalidate text in the original.

### C-01 — Out-of-window unverified delete **does** set `deletedAt`. Original was wrong.

**What the original said.** §4.1 row D-07, §4.2 fixture `T43b`, and §10 row 7 all asserted that the
out-of-window `orders/delete` branch results in `ABSENT_SIGNALLED_DELETE_UNVERIFIED` with
**"`deletedAt` NOT set"**, and that `deletedAt` is "set only in-window".

**Why that is wrong.** It contradicts the accepted PR6-A SQL. Transcribed verbatim from
`prisma/migrations/20260907020000_pr6_a_order_refund_existence_coherence/migration.sql` at
`f7a39c36…`:

```sql
OR (
  "existenceKind" = 'ABSENT_SIGNALLED_DELETE_UNVERIFIED'
  AND "existenceState" = 'ABSENT'
  AND "deletedAt" IS NOT NULL
  AND "deletionSource" IS NOT DISTINCT FROM 'WEBHOOK'
)
```

Verified: the migration adds **8** constraints and this branch appears **8** times — once per
canonical order fact table — with identical shape (`deletedAt IS NOT NULL` ×8,
`deletionSource IS NOT DISTINCT FROM 'WEBHOOK'` ×8, `existenceState = 'ABSENT'` ×8). The migration
header states the rule in prose too, including *"Do not require a confirmation interval."*

A row written to the original artifact's expectation would **violate the accepted CHECK constraint**
and be rejected by PostgreSQL. A C or D test written against that fixture would fail at the database
layer, and the failure would be the constraint doing its job.

**Corrected contract.**

| Branch | `existenceState` | `deletedAt` | `deletionSource` | Gen interval |
|---|---|---|---|---|
| `ABSENT_SIGNALLED_DELETE_UNVERIFIED` | `ABSENT` | **NOT NULL** | `WEBHOOK` | **not required**; a coherent pair is also accepted |
| `ABSENT_CONFIRMED_QUERY` | `ABSENT` | NOT NULL | `CONFIRMED_QUERY` | **required**, coherent (`requestGen < responseGen`) |
| `INACCESSIBLE_HISTORY_WINDOW` | last state preserved (`LIVE` or `ABSENT`) | **NULL** | **NULL** | NULL/NULL or a coherent pair |

The distinction the original blurred: **only ordinary window inaccessibility must not create deletion
lineage.** An out-of-window delete *signal* is a narrow, deliberate derogation — it records deletion
lineage (`deletedAt` + `WEBHOOK`) as **unverified**, distinct from confirmed absence, while **rows
are retained**. "Unverified lineage" ≠ "no lineage".

**A's CHECK is correct and must not be changed to fit the bad fixture.**

**Executed proof.** I transcribed all five CHECK branches into an untracked oracle script and tested
the original expectation against it.

```
node <scratchpad>/pr6d-existence-check-oracle.mjs      → 12/12 assertions consistent, exit 0
```

| Assertion | Oracle verdict |
|---|---|
| `ORIG-T43b` — original expectation, `deletedAt` NULL + `WEBHOOK` | **REJECTED** |
| `ORIG-T43b-b` — original variant, `deletedAt` NULL + source NULL | **REJECTED** |
| `CORR-T43b` — corrected, `deletedAt` NOT NULL + `WEBHOOK` | ACCEPTED (`ABSENT_SIGNALLED_DELETE_UNVERIFIED`) |
| `CORR-T43b-noint` — no confirmation interval | ACCEPTED |
| `CORR-T43b-int` — coherent interval also permitted | ACCEPTED |
| `CORR-T43b-src` — `CONFIRMED_QUERY` source on this kind | REJECTED |
| `T41-window` — `INACCESSIBLE_HISTORY_WINDOW`, no deletion lineage | ACCEPTED |
| `T41-window-bad` — same kind carrying `deletedAt` | REJECTED |
| `T42-confirmed` — confirmed absence with interval | ACCEPTED |
| `T42-noint` — confirmed absence **without** interval | REJECTED |
| `gen-reversed`, `gen-equal` | REJECTED |

This is **synthetic constraint-logic arithmetic against a transcription**, not a PostgreSQL
execution. It is not a substitute for C's adversarial database suite, which must exercise the real
constraint.

**Superseded rows:** original §4.1 D-07, §4.2 `T43b`, §10 row 7. The original §4.2 `T43b` line in the
executed 23-case run encoded `deletedAt: false`; that case is **withdrawn as an oracle** and replaced
by the table above.

---

### C-02 — CB-05 is not a normal crash boundary. Canonical writes and the receipt share one transaction.

**What the original said.** §5 row CB-05 described "Canonical rows committed, **receipt not
written**" as an ordinary crash boundary of the write protocol.

**Why that is wrong.** Under the approved `ATOMIC_APPLICATION_RECEIPT` strategy the merchant effect
and its receipt commit or roll back **together**. Verified at
`app/jobs/workers/webhook-processor.ts:462-479`:

```ts
// Atomic merchant application: all writes + receipt in one tenant tx.
const applyResult = await ctx.db.$transaction(async (tx) => {
  return applyWithApplicationReceipt(
    tx,
    { applicationKey, sourceJobType: durable.jobType, /* … */ },
    async (tdb) => { await runLegacyWebhookHandler(topic, tdb, handlerPayload); return { applied: true }; },
  );
});
```

`applyWithApplicationReceipt` is defined at `app/sync/application-receipt.server.ts:128` and runs the
merchant work **inside** the caller's transaction. "Committed rows without a receipt" is therefore
not a state the normal protocol can reach by interruption.

**Corrected crash boundaries.**

| ID | Boundary | Required outcome | Proof obligation |
|---|---|---|---|
| CB-05a | Interrupt **before** the tenant transaction commits | **neither** effect: no canonical rows, no receipt | assert zero canonical rows **and** no `SyncApplicationReceipt` for that application key; assert the retry applies cleanly exactly once |
| CB-05b | Interrupt **after** commit, **before** control-plane acknowledgement | **both** persisted; recovery is idempotent | assert canonical rows **and** receipt both present; assert the retry short-circuits on the receipt and does **not** re-apply; assert row counts and derived magnitudes unchanged |
| CB-05c *(adversarial, separately labelled)* | Artificially deleted receipt, **or** a genuinely uncertain DB outcome | **not** a silent re-apply | existing precedents: `NEW-PR4-SC01: missing receipt dead-letters uncertain`, `digest mismatch dead-letters conflict`, and `finalizeApplicationAfterRollback` (`app/sync/application-finalize.server.ts:36`) verifying the receipt in a **new** transaction rather than trusting an error code |

CB-05c is an **adversarial recovery case**, not the normal write protocol, and must be labelled as
such wherever it appears. The original's citation of `NEW-PR4-SC01` was correct evidence attached to
the wrong category.

**Superseded row:** original §5 CB-05.

---

### C-03 — The targeted-refetch recommendation is unsupported. The quarantine record stores no order identity.

**What the original said.** `F-CLAUDE-PR6DR-02` recommendation **(b)**: "have the reconciler treat a
`projection_bounds_exceeded` `DataIssue` on an order topic as a **targeted** refetch trigger for that
order id, so recovery does not wait for a full sweep."

**Why that is wrong.** No order identity survives into the quarantine branch. Verified at
`app/sync/intake.server.ts:259-282` — the entire persisted record is:

```ts
tx.webhookDelivery.create({ data: {
  shopId, shopifyWebhookId: webhookId, topic: input.topic, apiVersionReceived,
  payloadSchemaVersion: "quarantine-projection-bounds-v1",
  sanitizedPayload: { _quarantine: true, reason: err.code },
  payloadDigest: digestCanonicalJson({ reason: err.code }),
  correlationId, state: "QUARANTINED", quarantineReason: err.code, firstSeenAt, lastSeenAt,
}});
createDataIssue(tx, { shopId, reasonCode: err.code.slice(0, 64),
                      redactedEvidence: { topic: input.topic, deliveryId: created.id } });
```

Grepping the whole branch for any order reference returns nothing. `shopifyWebhookId` is the webhook
delivery header id, **not** an order GID. There is no `order_id`, no `admin_graphql_api_id`, and the
raw payload is deliberately not retained.

**Corrected recovery contract** (per owner disposition item 2):

- Mandatory recovery is a **bounded, complete, in-window canonical sweep**. The reconciler **may**
  schedule or coalesce it **shop-wide** when these quarantine diagnostics exist.
- The sweep **must include missed orders that predate the current incremental high-water mark**. A
  forward-only cursor **cannot certify recovery** — an order quarantined before the watermark moved
  would never be revisited by a forward-only read.
- **Do not**: infer an Order ID from the delivery ID; persist raw payload or PII to enable targeting;
  raise `PROJECTION_BOUNDS.maxLineItems`; truncate or empty the v1 line arrays.
- Preserve the quarantine evidence and **record coverage**. Do **not** claim per-delivery resolution,
  and do **not** claim historical or out-of-window healing, without matching identity evidence.
- An identity-preserving quarantine redesign is **separate D design and authorization work**. It is
  not silently added now, and this addendum does not propose it.

**D's proof obligation:** quarantine → sweep → complete canonical snapshot for a >250-line synthetic
order, **plus** a cursor-ahead case (order quarantined behind the watermark) and an out-of-window
case. B supplies complete reader pagination; C supplies atomic apply.

**Superseded text:** original §7 `F-CLAUDE-PR6DR-02` recommendation (b), and the `Recovery` cell of
§4.1 row D-23 insofar as it implies per-order targeting. The finding's **P1 severity and its core
claim stand** — a >250-line order still produces no canonical facts from the webhook path.

---

### C-04 — FK ordering was the wrong frame. Whole-snapshot atomicity and bounded assembly are the contract.

**What the original said.** `F-CLAUDE-PR6DR-04` and §5 CB-12 framed the import problem as "a batch
boundary that separates a parent order from its line rows will fail the line insert", recommending
that "the JSONL applicator batches by parent order".

**Why that is inadequate.** It conflates two different boundaries and understates the rule. Per owner
disposition item 4:

- **Physical JSONL chunks and canonical transaction boundaries are different things.** A chunk
  boundary is a streaming artifact; it does not by itself determine what is applied. An
  **already committed** parent does not cause an FK failure for children applied later.
- The real requirement is **bounded assembly and validation**, then **whole accepted parent-snapshot
  application with its required children**. The failure mode to prevent is not "FK ordering" but
  **exposing an incomplete parent snapshot as complete**.
- Exceeding approved assembly or request bounds must produce an **explicit non-success outcome** —
  not unbounded buffering, not new staging schema, not partial canonical success.

**Corrected parent/child contract** (per owner disposition item 4):

| Situation | Required behavior |
|---|---|
| Inaccessible-order signal, no complete authoritative Order snapshot, no stored parent | **Never fabricate** an Order, Agreement or Sale. Retain observation / signal / diagnostic evidence **outside** the nonexistent canonical rows. No partial agreement apply. **No successful canonical-apply claim.** |
| Complete, independently fetched **Refund** snapshot, no local Order | **May** be stored without a local Order, under its **own Clock A**. (A's schema permits this: `ShopifyOrderRefundFact.shopifyOrderGid` is an indexed column with **no** FK — verified at `f7a39c36…`.) |
| Inaccessible **refund signal** (not a fetched snapshot) | **Not** a complete snapshot. Does not qualify for the row above. |
| Import assembly exceeding bounds | explicit non-success outcome; no unbounded buffering, no staging schema, no partial success |

**A's schema is unchanged and was not criticised.** The original finding correctly observed the FK
asymmetry; it drew the wrong operational conclusion from it.

**Superseded text:** original §7 `F-CLAUDE-PR6DR-04` "Recommended correction" clause (b), and §5
CB-12. The observed FK asymmetry itself is accurate and stands.

---

### C-05 — GraphQL schema validity is not bulk execution eligibility. The existing gate cannot satisfy T53.

**What the original said.** §9.2 checklist row: "Bulk C | Three-level document **rejected** by the
schema gate (T53)."

**Why that is wrong — and a genuine new discovery.** The repository's bulk gate performs **pure
GraphQL specification validation** against the Admin 2026-07 schema and nothing else. Verified at
`app/lib/catalog-facts/admin-read/bulk-query-schema.ts`:

```ts
export const bulkQueryValidationRules = specifiedRules;          // line 38 — graphql-js spec rules

export function validateBulkQueryAgainstAdminSchema(schema, document) {   // line 92
  return validate(schema, parse(document), specifiedRules);
}
export function assertBulkQuerySchemaValid(schema, document, label) { … }  // line 99
```

A repository-wide grep for bulk **eligibility** logic — connection counting, nesting depth, or
`Node`-interface checking — returns **no implementation**. The only hits are a prose comment in
`bulk-query-documents.ts:26` and the hardcoded `groupObjects: false` at
`ingest/bulk-operation-submitter.ts:46`.

Consequence: **`orders { agreements { sales } }` (Bulk C) is schema-valid and would PASS
`assertBulkQuerySchemaValid`.** Shopify's three-connection-level prohibition is an execution-time
rule the validator does not model.

**Corrected contract.**

- **Separate the two gates.** Schema validity answers "is this a legal GraphQL document against Admin
  2026-07". Bulk eligibility answers "will Shopify accept this as a bulk operation" — max five total
  connections, max two nested connection levels, connections must implement `Node`, no top-level
  `node`/`nodes`.
- **T53 requires a bulk-rule validator that PR6-B must build.** It is *not* satisfied by the existing
  schema gate. A reviewer who sees `assertBulkQuerySchemaValid` pass on a Bulk C document and records
  T53 as met would be accepting a falsely-passing test.
- **Bulk B remains disabled / unverified for execution**, with the costed per-order refund-refetch
  fallback. Schema validity cannot settle it: Shopify's bulk documentation does not address
  connections nested under non-connection LIST fields (re-confirmed 2026-09-11).
- **No store submission and no bulk mutation is authorized** to resolve either question.

**Superseded text:** original §9.2 "Bulk C" row. The original §6.2 entry correctly recorded Bulk B as
unverified; this correction adds that *schema validation cannot verify it*.

---

### C-06 — Executed scratch arithmetic is not integration coverage. Label discipline.

**What the original said.** The original did distinguish executed from designed (§8), but its §4.2
heading "Executed expected-outcome arithmetic" and the 23/23 result sit adjacent to the 27-case
fixture matrix in a way that invites reading the run as fixture validation.

**Corrected labelling — binding for any downstream reader.**

| Evidence class | Count | What it is | What it is **not** |
|---|---|---|---|
| **Executed synthetic arithmetic** | 23 cases (original run) + 12 CHECK-oracle assertions (this addendum) | Node scripts over in-memory values, encoding the frozen money/unit/window contract and the transcribed A CHECK. Untracked, disposable, no database, no network, no repository import. | **Not** repository integration coverage. **Not** a PostgreSQL execution. **Not** evidence about any B/C/D module. |
| **Designed, NOT executed** | 27 transition fixtures (§4.1 D-01…D-27) | Specifications for future D tests. | **No** implementation exists. **None** has ever run. |
| **Designed, NOT executed** | 12 crash boundaries (§5 CB-01…CB-12, as corrected by C-02) | Specifications for future adversarial tests. | **None** has run. |
| **Not executed at all** | entire repository test suite | `node_modules` absent; PostgreSQL installed but not running (`pg_isready` → no response). No dependency install, no Prisma generate/migrate, no lint, typecheck, build or codegen. | — |

**No B or C test was run, because no B or C code exists.** No such claim is made anywhere in the
original or in this addendum.

The 23-case run and the 12 CHECK-oracle assertions establish only that the **fixture expectations are
internally consistent with the transcribed contract**. C-01 demonstrates the limit of that: the
original run passed 23/23 while carrying an expectation that the real constraint rejects, because the
original oracle encoded my prose rather than A's SQL. **A self-consistent fixture set is not a
correct one.** Oracles must be derived from accepted source.

---

### C-07 — Exported identifier and citation audit.

Per the instruction to correct any exported identifier claim that does not match source, I re-checked
**every** identifier the original cited. Method: `grep` for the definition site across `app/` and
`scripts/`.

**Result: 25 of 25 identifiers exist as named.** No invented names.

`ingestAuthenticatedWebhook` · `applyWithApplicationReceipt` · `runLegacyWebhookHandler` ·
`isCatalogFactAtomicWebhookTopic` · `sanitizeOrderProjection` · `sanitizeRefundProjection` ·
`assertScalarId` · `isSanitizedWebhookTopic` · `executionStrategyForJobType` ·
`webhookApplicationKey` · `streamJsonlBatches` · `acknowledgeJsonlBatch` ·
`markSyncRunPartialFailure` · `completeSyncRunAndCursor` · `fullSyncCursorValue` ·
`persistBulkSubmitIntentAndFence` · `persistFullSyncFence` · `attachBulkOperationGid` ·
`assertPolledBulkOperationMatches` · `persistBulkCounts` · `computeSyncHealth` · `jobDomainFilter` ·
`applyCatalogFactWebhookRefetch` · `createDataIssue` · `finalizeApplicationAfterRollback`

A's constants likewise verified at `f7a39c36…`: `ORDER_CANONICAL_LOCK_VERSION`,
`ORDER_OBSERVATION_GEN_SEQ`, `ORDER_RESOURCE_KINDS`, `ORDER_OBSERVATION_TERMINAL_OUTCOMES`,
`FROZEN_ORDER_NUMERIC_PRECISION`, `FROZEN_ORDER_NUMERIC_SCALE`, `ORDER_LOCK_BEFORE_FIRST_INSERT`,
`PR6_CANONICAL_ADVISORY_LOCK_TIMEOUT_MS`, `ORDER_HISTORY_ACCESS_DIAGNOSTICS`. File
`app/lib/catalog-facts/ingest/ingest-batch-id.ts` exists as named.

**Citation corrections (line numbers only, no claim changed):**

| Original citation | Actual | Note |
|---|---|---|
| `webhook-processor.ts:255-272` (`runLegacyWebhookHandler`) | definition begins **:254** | off-by-one on the function signature |
| `createDataIssue` implied imported | **defined** at `intake.server.ts:75` | local definition, not an import |

Newly cited in this addendum and verified: `applyWithApplicationReceipt`
(`application-receipt.server.ts:128`), `finalizeApplicationAfterRollback`
(`application-finalize.server.ts:36`), `bulkQueryValidationRules` /
`validateBulkQueryAgainstAdminSchema` / `assertBulkQuerySchemaValid`
(`bulk-query-schema.ts:38, 92, 99`).

---

### C-08 — Effective-scope provenance: **B** owns the granted-scope read, not D.

**What the original said.** `F-CLAUDE-PR6DR-10` said the scope source was "unnamed in D's file
ownership" and implied D should own it.

**Corrected ownership** (per owner disposition item 10 — this freezes the provenance now):

| Role | Owner | Obligation |
|---|---|---|
| Granted-scope **read** | **B** | Minimal **QUERY-only** read using `currentAppInstallation { accessScopes { handle } }`, through the **same trusted installed-app token/client context** as the resource read. Schema validation, synthetic transport tests, request-cost accounting. |
| Orchestration + future `app/scopes_update` integration | **D** | wires the scope evidence into observation lifecycle |
| Consumption | **C** | persists observation/fact lineage; **denies absence** if grant continuity is missing, stale, or downgraded relative to the last valid confirmation |

Not absence evidence, in any lane: static TOML **requested** scopes; client-supplied arrays;
unknown or stale session data. The existing authenticated scope-update route and `Session.scope` are
a **revocation/invalidation input**, not a licence to infer current grants from TOML.

**Verification status of the named query.** Official Admin GraphQL 2026-07 `AppInstallation`
(retrieved 2026-09-11) documents `accessScopes: [AccessScope!]!` and a root `currentAppInstallation`
returning `AppInstallation`. The `AccessScope` field list — specifically `handle` — was **not**
enumerated on that page, and `app/types/` is gitignored codegen output absent from this checkout, so
**I did not verify the `handle` selection against the schema artifact.** B must schema-validate the
exact selection; this addendum records the owner-specified shape, not an independent confirmation.

**No live merchant or store call is authorized by this instruction.** No A schema, types or privilege
change is authorized.

**Superseded text:** original §7 `F-CLAUDE-PR6DR-10` ownership clause. The underlying risk — absence
authority collapsing if provenance is wrong — stands at **P2**.

---

### C-09 — Test homes are assigned; no CI redesign.

**What the original said.** §7.1 listed `.github/workflows/ci.yml` owner as **"unassigned"**, and
§9.1 told reviewers to confirm "a CI step runs that config" — together inviting a lane to edit CI.

**Corrected assignment** (per owner disposition item 3):

| Suite | Location | Config | Note |
|---|---|---|---|
| C PostgreSQL suites | `stocky-plus/scripts/tenant-enforcement/tests/pr6-c-*.test.ts` | existing serialized `vitest.migrations.config.ts` | already permitted by C's issued work order |
| D PostgreSQL suites (future) | `stocky-plus/scripts/tenant-enforcement/tests/pr6-d-*.test.ts` | same | |
| B/C/D pure unit, transport, mock | `app/lib/order-facts/**/*.test.ts` | default `vitest.config.ts` | **keep pure** — no database client |

**No CI redesign is authorized.** `.github/workflows/ci.yml` is **not** "unassigned and available" —
it is out of scope for B, C and D, and **B/C must not concurrently edit global test configs or
workflows**. The existing bare `npm run test:migrations` step already discovers
`scripts/tenant-enforcement/tests/**/*.test.ts`, so correctly located suites need no workflow change.

Reviewers must still **verify actual discovery and CI execution** of each new suite — by confirming
which config's `include` matches the file, not by assuming.

**Superseded text:** original §7.1 `.github/workflows/ci.yml` row.

---

## 2. Disposition of all ten original findings

Severities are **unchanged from the original issue**. "Owner disposition" is the ruling in
`5639320213`; "status" is what remains to be done.

| ID | Original severity | Owner disposition | Status after adjudication |
|---|---|---|---|
| **-01** unmerged PR / M unresolved | **P1** | Expected **unmet dependency gate**, not a new defect in A. Resolve via owner merge → exact-M push CI → B control record. Pre-merge CI is not a substitute. | **OPEN — blocked on owner.** Do not claim resolved until those events occur. Not a finding against PR6-A. |
| **-02** >250-line orders quarantined, no canonical facts | **P1** | **Retained as a D recovery acceptance obligation.** Targeted per-order refetch is impossible (C-03). Mandatory recovery is a bounded complete in-window sweep, shop-wide coalescable, including orders predating the watermark. No limit raise, no v1 truncation, no PII retention, no ID inference. | **OPEN — D obligation.** Core claim upheld. Recommendation (b) **corrected** by C-03. Proof: quarantine → sweep → complete snapshot, plus cursor-ahead and out-of-window cases. |
| **-03** no serialized test home for C/D | **P2** | **Make ownership explicit; no CI redesign.** `pr6-c-*.test.ts` / `pr6-d-*.test.ts` under the existing serialized config. Keep `app/lib/order-facts/**` pure unit. | **RESOLVED by assignment** (C-09). B records it in the execution brief. Reviewers verify actual discovery. |
| **-04** FK asymmetry unspecified for out-of-window parents | **P2** | **Clarify authoritative parent-snapshot handling; A schema unchanged.** Never fabricate Order/Agreement/Sale. Complete independent Refund snapshot may be stored without a local Order under its own Clock A. Bounded assembly; whole-snapshot application; explicit non-success on bound exhaustion. | **RESOLVED by clarification** (C-04). Original operational conclusion **corrected**. Observed asymmetry accurate. |
| **-05** post-edit `ordered_units` | **P2** | **Accepted clarification of the existing raw-source rule — not a new arithmetic authority.** `ordered_units` is `LineItem.quantity` from the **same current, complete post-edit snapshot**, not a cached original checkout value. B preserves it as Shopify reports it; C does **not** synthesize a replacement by summing ledger events. Exchanges onto a **different** line are evaluated by each line's own identity, never merged by SKU. | **ACCEPTED.** Fixture stands: ordered 6 / current 3 / returned 3 / removed 0 is clean; substituting stale ordered 5 must detect inconsistency. T54/T58 and the negative control preserved — **and explicitly not a live-store reproduction**. |
| **-06** version fence must not be copied | **P2** | **D-owned obligation, already consistent with the approved contract.** Keep persisted-version **dispatch** for the three frozen v1 legacy topics; do not copy the retired `catalog-sync` hard fence. | **OPEN — D obligation.** Unchanged. |
| **-07** `orders/delete` sample divergence | **P3** | **Sample/provenance note.** An official sample is not blanket permission to accept every payload shape. Preserve version-pinned, tested, **fail-closed** identity parsing; do not require or trust undocumented optional fields. | **NOTED.** No scope or config change is authorized by the sample. Fail-closed unchanged. |
| **-08** three registration points must move atomically | **P2** | **D-owned obligation.** Routes, sanitizer map **and** switch, execution strategy, envelope validation where applicable, subscriptions and worker handling arrive coherently in the **single D integration boundary**. **No partial topic activation.** B/C do not edit these files. | **OPEN — D obligation.** Strengthened: explicitly no partial activation. |
| **-09** no B/C branches or control records | **P2** | **Expected unmet dependency gate**, paired with -01. | **OPEN — blocked on owner merge and B's control commit.** |
| **-10** effective-scope provenance | **P2** | **Freeze provenance now.** **B** owns the QUERY-only `currentAppInstallation { accessScopes { handle } }` read through the trusted installed-app context, with schema validation, synthetic transport tests and request-cost accounting. D owns orchestration and future `app/scopes_update`. C consumes and **denies absence** on missing/stale/downgraded continuity. | **RESOLVED by ownership freeze** (C-08). Ownership **corrected**. B records the contract in the execution brief. No live store call authorized. |

**Totals unchanged: P0=0 · P1=2 · P2=7 · P3=1.** No severity was raised or lowered.

**No finding in the original, and nothing in this addendum, revokes or qualifies PR6-A's exact-head
approval.** Every correction here is to *my own* readiness draft. Where I checked A's accepted
artifacts — the existence CHECK (C-01), the schema FK shape (C-04), the constants (C-07) — A was
correct and my draft was not.

---

## 3. Commands executed for this correction

| Command | Result |
|---|---|
| `git rev-parse 1820485d…:…/PR6_D_INTEGRATION_READINESS_REVIEW.md` | `7e8bc701d94bd322b692629522063930ffa08f32` — original blob **unchanged** |
| `git show f7a39c36:…/20260907020000_pr6_a_order_refund_existence_coherence/migration.sql` | read in full; 8 `ADD CONSTRAINT`; 8 identical `ABSENT_SIGNALLED_DELETE_UNVERIFIED` branches, each `deletedAt IS NOT NULL` + `deletionSource IS NOT DISTINCT FROM 'WEBHOOK'` + `existenceState = 'ABSENT'` |
| `node <scratchpad>/pr6d-existence-check-oracle.mjs` | **12/12 consistent**, exit 0 — original T43b row REJECTED, corrected row ACCEPTED |
| `sed -n '455,500p' app/jobs/workers/webhook-processor.ts` | confirmed "all writes + receipt in one tenant tx" at :462-479 |
| `sed -n '259,282p' app/sync/intake.server.ts` + grep for order identity in the branch | confirmed **no** order identity persisted in the quarantine record |
| grep definition sites for 25 cited identifiers | **25/25 exist**; two line-number citations corrected |
| grep A constants at `f7a39c36` | 9/9 exist |
| grep bulk eligibility rules across `app/lib/catalog-facts/` | **no** connection-count / nesting-depth / `Node`-interface implementation; gate is `specifiedRules` only |
| WebFetch Admin GraphQL 2026-07 `AppInstallation` (2026-09-11) | `accessScopes: [AccessScope!]!` and root `currentAppInstallation` documented; `AccessScope.handle` **not** enumerated on that page |

### Not executed

- **No repository test suite.** `node_modules` absent; PostgreSQL installed but not running.
- No Prisma generate/migrate, lint, typecheck, build, codegen.
- **No PostgreSQL execution of the real CHECK constraint** — C-01's proof is synthetic transcription
  logic, and C must exercise the actual constraint.
- No B/C/D runtime test — none exists.
- No Shopify store call, no bulk submission, no mutation.
- `AccessScope.handle` not validated against the codegen schema artifact (B's deliverable).

---

## 4. Remaining genuine blockers

| # | Blocker | Owner | Resolves when |
|---|---|---|---|
| **B-1** | **PR #37 unmerged; M does not exist.** `origin/main` still `09feffd3…`. Gate items 1–5 unmet; exact-M **push** CI cannot exist. | Owner | owner executes squash merge; B/C independently resolve M and verify parent/tree/immutable-review identities and exact-M push Classify/Heavy/CI Gate SUCCESS |
| **B-2** | No B/C control records; `PR6_BC_EXECUTION_BRIEF.md` unpublished. This package remains **unreconciled** against it. | B | B publishes the docs-only control commit incorporating disposition `5639320213`, then `PR6_BC_ADMISSION_READY` |
| **B-3** | **Bulk eligibility is unvalidated and unimplemented.** The existing gate is schema-only; T53 needs a bulk-rule validator that does not yet exist. Bulk B stays disabled/unverified. | B | B builds the bulk-rule validator and records the Bulk B legality verdict with the costed fallback (R-185) |
| **B-4** | `orders/delete`, `orders/edited`, `order_transactions/create` payload contracts unverified. | — | remains fail-closed; no shape may be assumed |
| **B-5** | `read_all_orders` not granted; out-of-window refunds/edits permanently unobservable. | Owner / Partner | Q-016 |
| **B-6** | `AccessScope.handle` selection not schema-validated in this checkout. | B | B validates against the codegen artifact with synthetic transport tests |

**B-3 is the one blocker this correction newly establishes with direct evidence.** It is a gap in
**B's future lane**, not a defect in merged PR6-A, and it does not affect A's approval.

---

## 5. Safety confirmations

- Original artifact preserved **byte-for-byte**; blob `7e8bc701d94bd322b692629522063930ffa08f32`
  unchanged. No severity silently altered. No claim made that any B/C test ran.
- This addendum is **not** an admission record and **not** a D implementation approval.
- Exactly one file created. **No** runtime, schema, migration, CI, workflow, Shopify config or
  package change. No shared control document created or edited. No B/C branch touched — neither
  exists. No immutable prior review altered.
- No merge, no mark-ready, no runtime PR.
- No production, merchant production data, deployment, Shopify write, inventory write, scope
  addition or flag enablement.
- Scripts executed were untracked scratchpad files over synthetic in-memory values only — no
  database, no network, no repository import.
- **R-176 remains OPEN / P0.** C-01 sharpens one of its obligations (unverified deletion lineage is
  recorded, not omitted) but closes nothing. **R-164 unchanged.** Phase 1 **IN PROGRESS**. **D-054**
  remains the lane authority. **No D-055.** PR6-D runtime remains **NOT AUTHORIZED**.
- ChatGPT's disposition governs. This document is preparation evidence, not product authority.
