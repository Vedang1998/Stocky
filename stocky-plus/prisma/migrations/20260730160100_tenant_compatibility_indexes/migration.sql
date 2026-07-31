-- Phase 1 PR 1 correction — compatibility indexes are NOT created by Prisma Migrate.
--
-- Decision D-024: ordinary CREATE INDEX / CREATE UNIQUE INDEX / IF NOT EXISTS on
-- populated merchant tables is rejected. Concurrent index creation must run
-- outside an incompatible Prisma migration transaction via:
--
--   npm run tenant:indexes:plan
--   npm run tenant:indexes:apply -- --apply
--   npm run tenant:indexes:verify
--
-- This migration is a no-op marker so `prisma migrate deploy` cannot perform
-- blocking index builds. A fresh database is PR-1-ready only after migrations
-- plus successful tenant:indexes:apply and tenant:indexes:verify.
--
-- Historical note: an earlier revision of this migration directory performed
-- ordinary CREATE INDEX IF NOT EXISTS statements. That approach was rejected
-- by independent review (F-PR1-05, F-PR1-06) and product-owner decision.
-- Because PR #11 is unmerged, this file was rewritten in place.

SELECT 1;
