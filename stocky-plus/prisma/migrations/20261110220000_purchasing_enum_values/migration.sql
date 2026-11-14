-- Purchasing ledger, stage 1: enum values.
--
-- PostgreSQL enum values must be committed before a later statement can use
-- them, so the additions live in their own migration. Additive only; existing
-- rows are unchanged.
--
-- Recovery: forward recovery only. PostgreSQL cannot drop enum values; unused
-- values are harmless.

ALTER TYPE "POStatus" ADD VALUE IF NOT EXISTS 'SENT';
ALTER TYPE "POStatus" ADD VALUE IF NOT EXISTS 'CLOSED';
ALTER TYPE "LandedCostMethod" ADD VALUE IF NOT EXISTS 'QUANTITY';
