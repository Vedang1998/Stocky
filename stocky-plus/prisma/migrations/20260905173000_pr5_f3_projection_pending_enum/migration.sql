-- PR5-F3 compatibility projection honesty, stage 1.
--
-- PostgreSQL enum values must be committed before a later migration uses the
-- new value as a column default. Keep this additive enum step separate.
--
-- Recovery: forward recovery is preferred. Existing rows are unchanged.
-- PostgreSQL enum values are not removed during rollback; the later default
-- migration can be reverted to HEALTHY only after F3 writers are disabled.

ALTER TYPE "CatalogCompatibilityProjectionState"
  ADD VALUE IF NOT EXISTS 'PROJECTION_PENDING' BEFORE 'HEALTHY';
