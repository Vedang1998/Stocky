-- PR6-A successor: order-domain existence-evidence coherence (F-CLAUDE-PR6A-01).
-- Additive CHECK only. Does not edit 20260907010000_pr6_a_order_refund_fact_foundation
-- or any previously merged migration. No new models, sequences, or data repair.
-- OrderFactObservationInFlight is not a canonical fact table; its lifecycle/lease
-- checks stay untouched.
--
-- Row CHECK protects representability, not the PR6-C/D transition protocol
-- (previous state, Shopify query completion, historical scope continuity,
-- two-confirmation revival). No wall-clock or external-table lookups.
--
-- State / kind / evidence matrix (adapted from PR5
-- ShopifyProductFact_existence_evidence_coherence_check):
-- LIVE_FULL_SYNC_PRESENT: LIVE; both gens NULL; deletedAt/deletionSource NULL.
--   Full-sync fence evidence remains on SyncRun; do not invent a direct refetch interval.
-- LIVE_REFETCH: LIVE; both gens non-null; requestGen < responseGen; no deletion columns.
-- ABSENT_CONFIRMED_QUERY: ABSENT; both gens non-null; requestGen < responseGen;
--   deletedAt NOT NULL; deletionSource IS NOT DISTINCT FROM CONFIRMED_QUERY.
-- INACCESSIBLE_HISTORY_WINDOW: last existenceState preserved (LIVE or ABSENT);
--   must NOT introduce deletedAt/deletionSource; gens NULL/NULL or a coherent pair.
-- ABSENT_SIGNALLED_DELETE_UNVERIFIED: ABSENT; deletedAt NOT NULL;
--   deletionSource IS NOT DISTINCT FROM WEBHOOK (accepted encoding of DELETE_WEBHOOK
--   sourceKind lineage). Do not require a confirmation interval.
-- Any represented request/response interval is a coherent pair: no half-null,
-- equal, or reversed endpoints. IS NULL / IS NOT NULL / IS NOT DISTINCT FROM
-- reject invalid NULL combinations definitively (SQL UNKNOWN must not pass).
--
-- Preservation (application-layer, not proven by this CHECK): an inaccessible later
-- observation must not erase a prior confirmed tombstone or reclassify it as
-- ordinary window uncertainty. Keep confirmed/unverified kind + deletion lineage;
-- record new access uncertainty on existing diagnostic/observation fields.
-- Do not "fix" an incompatible row by clearing evidence.
--
-- Constraint name suffix is `_existence_coherence_check` (NAMEDATALEN=63).
-- PR5 catalog used `_existence_evidence_coherence_check`; several order table
-- names exceed 63 characters with that suffix and would truncate.

SET lock_timeout = '5s';
SET statement_timeout = '30s';

ALTER TABLE "ShopifyOrderFact"
  ADD CONSTRAINT "ShopifyOrderFact_existence_coherence_check"
  CHECK (
    (
      (
        "existenceRequestGen" IS NULL
        AND "existenceResponseGen" IS NULL
      )
      OR (
        "existenceRequestGen" IS NOT NULL
        AND "existenceResponseGen" IS NOT NULL
        AND "existenceRequestGen" < "existenceResponseGen"
      )
    )
    AND (
      (
        "existenceKind" = 'LIVE_FULL_SYNC_PRESENT'
        AND "existenceState" = 'LIVE'
        AND "existenceRequestGen" IS NULL
        AND "existenceResponseGen" IS NULL
        AND "deletedAt" IS NULL
        AND "deletionSource" IS NULL
      )
      OR (
        "existenceKind" = 'LIVE_REFETCH'
        AND "existenceState" = 'LIVE'
        AND "existenceRequestGen" IS NOT NULL
        AND "existenceResponseGen" IS NOT NULL
        AND "existenceRequestGen" < "existenceResponseGen"
        AND "deletedAt" IS NULL
        AND "deletionSource" IS NULL
      )
      OR (
        "existenceKind" = 'ABSENT_CONFIRMED_QUERY'
        AND "existenceState" = 'ABSENT'
        AND "existenceRequestGen" IS NOT NULL
        AND "existenceResponseGen" IS NOT NULL
        AND "existenceRequestGen" < "existenceResponseGen"
        AND "deletedAt" IS NOT NULL
        AND "deletionSource" IS NOT DISTINCT FROM 'CONFIRMED_QUERY'
      )
      OR (
        "existenceKind" = 'INACCESSIBLE_HISTORY_WINDOW'
        AND ("existenceState" = 'LIVE' OR "existenceState" = 'ABSENT')
        AND "deletedAt" IS NULL
        AND "deletionSource" IS NULL
      )
      OR (
        "existenceKind" = 'ABSENT_SIGNALLED_DELETE_UNVERIFIED'
        AND "existenceState" = 'ABSENT'
        AND "deletedAt" IS NOT NULL
        AND "deletionSource" IS NOT DISTINCT FROM 'WEBHOOK'
      )
    )
  ) NOT VALID;

ALTER TABLE "ShopifyOrderLineFact"
  ADD CONSTRAINT "ShopifyOrderLineFact_existence_coherence_check"
  CHECK (
    (
      (
        "existenceRequestGen" IS NULL
        AND "existenceResponseGen" IS NULL
      )
      OR (
        "existenceRequestGen" IS NOT NULL
        AND "existenceResponseGen" IS NOT NULL
        AND "existenceRequestGen" < "existenceResponseGen"
      )
    )
    AND (
      (
        "existenceKind" = 'LIVE_FULL_SYNC_PRESENT'
        AND "existenceState" = 'LIVE'
        AND "existenceRequestGen" IS NULL
        AND "existenceResponseGen" IS NULL
        AND "deletedAt" IS NULL
        AND "deletionSource" IS NULL
      )
      OR (
        "existenceKind" = 'LIVE_REFETCH'
        AND "existenceState" = 'LIVE'
        AND "existenceRequestGen" IS NOT NULL
        AND "existenceResponseGen" IS NOT NULL
        AND "existenceRequestGen" < "existenceResponseGen"
        AND "deletedAt" IS NULL
        AND "deletionSource" IS NULL
      )
      OR (
        "existenceKind" = 'ABSENT_CONFIRMED_QUERY'
        AND "existenceState" = 'ABSENT'
        AND "existenceRequestGen" IS NOT NULL
        AND "existenceResponseGen" IS NOT NULL
        AND "existenceRequestGen" < "existenceResponseGen"
        AND "deletedAt" IS NOT NULL
        AND "deletionSource" IS NOT DISTINCT FROM 'CONFIRMED_QUERY'
      )
      OR (
        "existenceKind" = 'INACCESSIBLE_HISTORY_WINDOW'
        AND ("existenceState" = 'LIVE' OR "existenceState" = 'ABSENT')
        AND "deletedAt" IS NULL
        AND "deletionSource" IS NULL
      )
      OR (
        "existenceKind" = 'ABSENT_SIGNALLED_DELETE_UNVERIFIED'
        AND "existenceState" = 'ABSENT'
        AND "deletedAt" IS NOT NULL
        AND "deletionSource" IS NOT DISTINCT FROM 'WEBHOOK'
      )
    )
  ) NOT VALID;

ALTER TABLE "ShopifyOrderRefundFact"
  ADD CONSTRAINT "ShopifyOrderRefundFact_existence_coherence_check"
  CHECK (
    (
      (
        "existenceRequestGen" IS NULL
        AND "existenceResponseGen" IS NULL
      )
      OR (
        "existenceRequestGen" IS NOT NULL
        AND "existenceResponseGen" IS NOT NULL
        AND "existenceRequestGen" < "existenceResponseGen"
      )
    )
    AND (
      (
        "existenceKind" = 'LIVE_FULL_SYNC_PRESENT'
        AND "existenceState" = 'LIVE'
        AND "existenceRequestGen" IS NULL
        AND "existenceResponseGen" IS NULL
        AND "deletedAt" IS NULL
        AND "deletionSource" IS NULL
      )
      OR (
        "existenceKind" = 'LIVE_REFETCH'
        AND "existenceState" = 'LIVE'
        AND "existenceRequestGen" IS NOT NULL
        AND "existenceResponseGen" IS NOT NULL
        AND "existenceRequestGen" < "existenceResponseGen"
        AND "deletedAt" IS NULL
        AND "deletionSource" IS NULL
      )
      OR (
        "existenceKind" = 'ABSENT_CONFIRMED_QUERY'
        AND "existenceState" = 'ABSENT'
        AND "existenceRequestGen" IS NOT NULL
        AND "existenceResponseGen" IS NOT NULL
        AND "existenceRequestGen" < "existenceResponseGen"
        AND "deletedAt" IS NOT NULL
        AND "deletionSource" IS NOT DISTINCT FROM 'CONFIRMED_QUERY'
      )
      OR (
        "existenceKind" = 'INACCESSIBLE_HISTORY_WINDOW'
        AND ("existenceState" = 'LIVE' OR "existenceState" = 'ABSENT')
        AND "deletedAt" IS NULL
        AND "deletionSource" IS NULL
      )
      OR (
        "existenceKind" = 'ABSENT_SIGNALLED_DELETE_UNVERIFIED'
        AND "existenceState" = 'ABSENT'
        AND "deletedAt" IS NOT NULL
        AND "deletionSource" IS NOT DISTINCT FROM 'WEBHOOK'
      )
    )
  ) NOT VALID;

ALTER TABLE "ShopifyOrderRefundLineFact"
  ADD CONSTRAINT "ShopifyOrderRefundLineFact_existence_coherence_check"
  CHECK (
    (
      (
        "existenceRequestGen" IS NULL
        AND "existenceResponseGen" IS NULL
      )
      OR (
        "existenceRequestGen" IS NOT NULL
        AND "existenceResponseGen" IS NOT NULL
        AND "existenceRequestGen" < "existenceResponseGen"
      )
    )
    AND (
      (
        "existenceKind" = 'LIVE_FULL_SYNC_PRESENT'
        AND "existenceState" = 'LIVE'
        AND "existenceRequestGen" IS NULL
        AND "existenceResponseGen" IS NULL
        AND "deletedAt" IS NULL
        AND "deletionSource" IS NULL
      )
      OR (
        "existenceKind" = 'LIVE_REFETCH'
        AND "existenceState" = 'LIVE'
        AND "existenceRequestGen" IS NOT NULL
        AND "existenceResponseGen" IS NOT NULL
        AND "existenceRequestGen" < "existenceResponseGen"
        AND "deletedAt" IS NULL
        AND "deletionSource" IS NULL
      )
      OR (
        "existenceKind" = 'ABSENT_CONFIRMED_QUERY'
        AND "existenceState" = 'ABSENT'
        AND "existenceRequestGen" IS NOT NULL
        AND "existenceResponseGen" IS NOT NULL
        AND "existenceRequestGen" < "existenceResponseGen"
        AND "deletedAt" IS NOT NULL
        AND "deletionSource" IS NOT DISTINCT FROM 'CONFIRMED_QUERY'
      )
      OR (
        "existenceKind" = 'INACCESSIBLE_HISTORY_WINDOW'
        AND ("existenceState" = 'LIVE' OR "existenceState" = 'ABSENT')
        AND "deletedAt" IS NULL
        AND "deletionSource" IS NULL
      )
      OR (
        "existenceKind" = 'ABSENT_SIGNALLED_DELETE_UNVERIFIED'
        AND "existenceState" = 'ABSENT'
        AND "deletedAt" IS NOT NULL
        AND "deletionSource" IS NOT DISTINCT FROM 'WEBHOOK'
      )
    )
  ) NOT VALID;

ALTER TABLE "ShopifyOrderAdjustmentFact"
  ADD CONSTRAINT "ShopifyOrderAdjustmentFact_existence_coherence_check"
  CHECK (
    (
      (
        "existenceRequestGen" IS NULL
        AND "existenceResponseGen" IS NULL
      )
      OR (
        "existenceRequestGen" IS NOT NULL
        AND "existenceResponseGen" IS NOT NULL
        AND "existenceRequestGen" < "existenceResponseGen"
      )
    )
    AND (
      (
        "existenceKind" = 'LIVE_FULL_SYNC_PRESENT'
        AND "existenceState" = 'LIVE'
        AND "existenceRequestGen" IS NULL
        AND "existenceResponseGen" IS NULL
        AND "deletedAt" IS NULL
        AND "deletionSource" IS NULL
      )
      OR (
        "existenceKind" = 'LIVE_REFETCH'
        AND "existenceState" = 'LIVE'
        AND "existenceRequestGen" IS NOT NULL
        AND "existenceResponseGen" IS NOT NULL
        AND "existenceRequestGen" < "existenceResponseGen"
        AND "deletedAt" IS NULL
        AND "deletionSource" IS NULL
      )
      OR (
        "existenceKind" = 'ABSENT_CONFIRMED_QUERY'
        AND "existenceState" = 'ABSENT'
        AND "existenceRequestGen" IS NOT NULL
        AND "existenceResponseGen" IS NOT NULL
        AND "existenceRequestGen" < "existenceResponseGen"
        AND "deletedAt" IS NOT NULL
        AND "deletionSource" IS NOT DISTINCT FROM 'CONFIRMED_QUERY'
      )
      OR (
        "existenceKind" = 'INACCESSIBLE_HISTORY_WINDOW'
        AND ("existenceState" = 'LIVE' OR "existenceState" = 'ABSENT')
        AND "deletedAt" IS NULL
        AND "deletionSource" IS NULL
      )
      OR (
        "existenceKind" = 'ABSENT_SIGNALLED_DELETE_UNVERIFIED'
        AND "existenceState" = 'ABSENT'
        AND "deletedAt" IS NOT NULL
        AND "deletionSource" IS NOT DISTINCT FROM 'WEBHOOK'
      )
    )
  ) NOT VALID;

ALTER TABLE "ShopifyOrderAgreementFact"
  ADD CONSTRAINT "ShopifyOrderAgreementFact_existence_coherence_check"
  CHECK (
    (
      (
        "existenceRequestGen" IS NULL
        AND "existenceResponseGen" IS NULL
      )
      OR (
        "existenceRequestGen" IS NOT NULL
        AND "existenceResponseGen" IS NOT NULL
        AND "existenceRequestGen" < "existenceResponseGen"
      )
    )
    AND (
      (
        "existenceKind" = 'LIVE_FULL_SYNC_PRESENT'
        AND "existenceState" = 'LIVE'
        AND "existenceRequestGen" IS NULL
        AND "existenceResponseGen" IS NULL
        AND "deletedAt" IS NULL
        AND "deletionSource" IS NULL
      )
      OR (
        "existenceKind" = 'LIVE_REFETCH'
        AND "existenceState" = 'LIVE'
        AND "existenceRequestGen" IS NOT NULL
        AND "existenceResponseGen" IS NOT NULL
        AND "existenceRequestGen" < "existenceResponseGen"
        AND "deletedAt" IS NULL
        AND "deletionSource" IS NULL
      )
      OR (
        "existenceKind" = 'ABSENT_CONFIRMED_QUERY'
        AND "existenceState" = 'ABSENT'
        AND "existenceRequestGen" IS NOT NULL
        AND "existenceResponseGen" IS NOT NULL
        AND "existenceRequestGen" < "existenceResponseGen"
        AND "deletedAt" IS NOT NULL
        AND "deletionSource" IS NOT DISTINCT FROM 'CONFIRMED_QUERY'
      )
      OR (
        "existenceKind" = 'INACCESSIBLE_HISTORY_WINDOW'
        AND ("existenceState" = 'LIVE' OR "existenceState" = 'ABSENT')
        AND "deletedAt" IS NULL
        AND "deletionSource" IS NULL
      )
      OR (
        "existenceKind" = 'ABSENT_SIGNALLED_DELETE_UNVERIFIED'
        AND "existenceState" = 'ABSENT'
        AND "deletedAt" IS NOT NULL
        AND "deletionSource" IS NOT DISTINCT FROM 'WEBHOOK'
      )
    )
  ) NOT VALID;

ALTER TABLE "ShopifyOrderAgreementSaleFact"
  ADD CONSTRAINT "ShopifyOrderAgreementSaleFact_existence_coherence_check"
  CHECK (
    (
      (
        "existenceRequestGen" IS NULL
        AND "existenceResponseGen" IS NULL
      )
      OR (
        "existenceRequestGen" IS NOT NULL
        AND "existenceResponseGen" IS NOT NULL
        AND "existenceRequestGen" < "existenceResponseGen"
      )
    )
    AND (
      (
        "existenceKind" = 'LIVE_FULL_SYNC_PRESENT'
        AND "existenceState" = 'LIVE'
        AND "existenceRequestGen" IS NULL
        AND "existenceResponseGen" IS NULL
        AND "deletedAt" IS NULL
        AND "deletionSource" IS NULL
      )
      OR (
        "existenceKind" = 'LIVE_REFETCH'
        AND "existenceState" = 'LIVE'
        AND "existenceRequestGen" IS NOT NULL
        AND "existenceResponseGen" IS NOT NULL
        AND "existenceRequestGen" < "existenceResponseGen"
        AND "deletedAt" IS NULL
        AND "deletionSource" IS NULL
      )
      OR (
        "existenceKind" = 'ABSENT_CONFIRMED_QUERY'
        AND "existenceState" = 'ABSENT'
        AND "existenceRequestGen" IS NOT NULL
        AND "existenceResponseGen" IS NOT NULL
        AND "existenceRequestGen" < "existenceResponseGen"
        AND "deletedAt" IS NOT NULL
        AND "deletionSource" IS NOT DISTINCT FROM 'CONFIRMED_QUERY'
      )
      OR (
        "existenceKind" = 'INACCESSIBLE_HISTORY_WINDOW'
        AND ("existenceState" = 'LIVE' OR "existenceState" = 'ABSENT')
        AND "deletedAt" IS NULL
        AND "deletionSource" IS NULL
      )
      OR (
        "existenceKind" = 'ABSENT_SIGNALLED_DELETE_UNVERIFIED'
        AND "existenceState" = 'ABSENT'
        AND "deletedAt" IS NOT NULL
        AND "deletionSource" IS NOT DISTINCT FROM 'WEBHOOK'
      )
    )
  ) NOT VALID;

ALTER TABLE "ShopifyOrderRefundTransactionFact"
  ADD CONSTRAINT "ShopifyOrderRefundTransactionFact_existence_coherence_check"
  CHECK (
    (
      (
        "existenceRequestGen" IS NULL
        AND "existenceResponseGen" IS NULL
      )
      OR (
        "existenceRequestGen" IS NOT NULL
        AND "existenceResponseGen" IS NOT NULL
        AND "existenceRequestGen" < "existenceResponseGen"
      )
    )
    AND (
      (
        "existenceKind" = 'LIVE_FULL_SYNC_PRESENT'
        AND "existenceState" = 'LIVE'
        AND "existenceRequestGen" IS NULL
        AND "existenceResponseGen" IS NULL
        AND "deletedAt" IS NULL
        AND "deletionSource" IS NULL
      )
      OR (
        "existenceKind" = 'LIVE_REFETCH'
        AND "existenceState" = 'LIVE'
        AND "existenceRequestGen" IS NOT NULL
        AND "existenceResponseGen" IS NOT NULL
        AND "existenceRequestGen" < "existenceResponseGen"
        AND "deletedAt" IS NULL
        AND "deletionSource" IS NULL
      )
      OR (
        "existenceKind" = 'ABSENT_CONFIRMED_QUERY'
        AND "existenceState" = 'ABSENT'
        AND "existenceRequestGen" IS NOT NULL
        AND "existenceResponseGen" IS NOT NULL
        AND "existenceRequestGen" < "existenceResponseGen"
        AND "deletedAt" IS NOT NULL
        AND "deletionSource" IS NOT DISTINCT FROM 'CONFIRMED_QUERY'
      )
      OR (
        "existenceKind" = 'INACCESSIBLE_HISTORY_WINDOW'
        AND ("existenceState" = 'LIVE' OR "existenceState" = 'ABSENT')
        AND "deletedAt" IS NULL
        AND "deletionSource" IS NULL
      )
      OR (
        "existenceKind" = 'ABSENT_SIGNALLED_DELETE_UNVERIFIED'
        AND "existenceState" = 'ABSENT'
        AND "deletedAt" IS NOT NULL
        AND "deletionSource" IS NOT DISTINCT FROM 'WEBHOOK'
      )
    )
  ) NOT VALID;

ALTER TABLE "ShopifyOrderFact" VALIDATE CONSTRAINT "ShopifyOrderFact_existence_coherence_check";
ALTER TABLE "ShopifyOrderLineFact" VALIDATE CONSTRAINT "ShopifyOrderLineFact_existence_coherence_check";
ALTER TABLE "ShopifyOrderRefundFact" VALIDATE CONSTRAINT "ShopifyOrderRefundFact_existence_coherence_check";
ALTER TABLE "ShopifyOrderRefundLineFact" VALIDATE CONSTRAINT "ShopifyOrderRefundLineFact_existence_coherence_check";
ALTER TABLE "ShopifyOrderAdjustmentFact" VALIDATE CONSTRAINT "ShopifyOrderAdjustmentFact_existence_coherence_check";
ALTER TABLE "ShopifyOrderAgreementFact" VALIDATE CONSTRAINT "ShopifyOrderAgreementFact_existence_coherence_check";
ALTER TABLE "ShopifyOrderAgreementSaleFact" VALIDATE CONSTRAINT "ShopifyOrderAgreementSaleFact_existence_coherence_check";
ALTER TABLE "ShopifyOrderRefundTransactionFact" VALIDATE CONSTRAINT "ShopifyOrderRefundTransactionFact_existence_coherence_check";

RESET statement_timeout;
RESET lock_timeout;
