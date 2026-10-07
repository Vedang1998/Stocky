-- PR7 schema alignment: TIMESTAMP(3) → TIMESTAMPTZ(3) and truncated index names.
-- Additive. Does not rewrite 20260918120000_pr7_audit_roles_privacy.
-- Naive UTC wall times are interpreted as UTC instants. PrivacyAttempt.updatedAt
-- stays TIMESTAMP(3) to match Prisma @updatedAt without @db.Timestamptz(3).
-- Recovery: unused type/name alignment may remain; reverse only with a
-- separately authorized migration after proving no PR7 writer depends on tz.

SET lock_timeout = '5s';
SET statement_timeout = '120s';

ALTER TABLE "AuditEvent"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3)
  USING "createdAt" AT TIME ZONE 'UTC';

ALTER TABLE "ShopRoleAssignment"
  ALTER COLUMN "grantedAt" TYPE TIMESTAMPTZ(3)
  USING "grantedAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "revokedAt" TYPE TIMESTAMPTZ(3)
  USING "revokedAt" AT TIME ZONE 'UTC';

ALTER TABLE "ShopInstallGeneration"
  ALTER COLUMN "installedAt" TYPE TIMESTAMPTZ(3)
  USING "installedAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "uninstalledAt" TYPE TIMESTAMPTZ(3)
  USING "uninstalledAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "erasedAt" TYPE TIMESTAMPTZ(3)
  USING "erasedAt" AT TIME ZONE 'UTC';

ALTER TABLE "PrivacyRequest"
  ALTER COLUMN "receivedAt" TYPE TIMESTAMPTZ(3)
  USING "receivedAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "deadlineAt" TYPE TIMESTAMPTZ(3)
  USING "deadlineAt" AT TIME ZONE 'UTC';

ALTER TABLE "PrivacyAttempt"
  ALTER COLUMN "leaseUntil" TYPE TIMESTAMPTZ(3)
  USING "leaseUntil" AT TIME ZONE 'UTC',
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3)
  USING "createdAt" AT TIME ZONE 'UTC';

ALTER TABLE "PrivacyCustomerTargetBarrier"
  ALTER COLUMN "installedAt" TYPE TIMESTAMPTZ(3)
  USING "installedAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "releasedAt" TYPE TIMESTAMPTZ(3)
  USING "releasedAt" AT TIME ZONE 'UTC';

ALTER TABLE "PrivacyCompletedTarget"
  ALTER COLUMN "completedAt" TYPE TIMESTAMPTZ(3)
  USING "completedAt" AT TIME ZONE 'UTC';

ALTER TABLE "PrivacyCoordinatorEvent"
  ALTER COLUMN "at" TYPE TIMESTAMPTZ(3)
  USING "at" AT TIME ZONE 'UTC';

ALTER TABLE "PrivacyCompletionReceipt"
  ALTER COLUMN "completedAt" TYPE TIMESTAMPTZ(3)
  USING "completedAt" AT TIME ZONE 'UTC';

ALTER TABLE "PrivacyDeliveryBinding"
  ALTER COLUMN "receivedAt" TYPE TIMESTAMPTZ(3)
  USING "receivedAt" AT TIME ZONE 'UTC';

ALTER TABLE "PrivacyDeliveryTombstone"
  ALTER COLUMN "expiresAt" TYPE TIMESTAMPTZ(3)
  USING "expiresAt" AT TIME ZONE 'UTC';

ALTER TABLE "PrivacyDeletionManifest"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3)
  USING "createdAt" AT TIME ZONE 'UTC';

ALTER TABLE "PrivacyDataRequestArtifact"
  ALTER COLUMN "expiresAt" TYPE TIMESTAMPTZ(3)
  USING "expiresAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "downloadedAt" TYPE TIMESTAMPTZ(3)
  USING "downloadedAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3)
  USING "createdAt" AT TIME ZONE 'UTC';

ALTER TABLE "PlatformReplayCommand"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3)
  USING "createdAt" AT TIME ZONE 'UTC';

ALTER TABLE "WriterAdmissionOrigin"
  ALTER COLUMN "originalAdmittedAt" TYPE TIMESTAMPTZ(3)
  USING "originalAdmittedAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3)
  USING "createdAt" AT TIME ZONE 'UTC';

ALTER TABLE "OriginalAdminSession"
  ALTER COLUMN "establishedAt" TYPE TIMESTAMPTZ(3)
  USING "establishedAt" AT TIME ZONE 'UTC';

ALTER TABLE "OriginalAdminCapture"
  ALTER COLUMN "capturedAt" TYPE TIMESTAMPTZ(3)
  USING "capturedAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "consumedAt" TYPE TIMESTAMPTZ(3)
  USING "consumedAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "contradictedAt" TYPE TIMESTAMPTZ(3)
  USING "contradictedAt" AT TIME ZONE 'UTC';

ALTER TABLE "QueuedWorkSighting"
  ALTER COLUMN "sightedAt" TYPE TIMESTAMPTZ(3)
  USING "sightedAt" AT TIME ZONE 'UTC';

ALTER TABLE "SourceEffectLink"
  ALTER COLUMN "writtenAt" TYPE TIMESTAMPTZ(3)
  USING "writtenAt" AT TIME ZONE 'UTC';

-- PostgreSQL NAMEDATALEN-1 (63) truncated the original CREATE INDEX identifiers.
ALTER INDEX "OriginalAdminCapture_canonicalDomain_sourceKind_sourceIdentity_"
  RENAME TO "OriginalAdminCapture_canonicalDomain_sourceKind_sourceIdent_key";

ALTER INDEX "PrivacyCustomerTargetBarrier_shopId_generationId_targetKind_tar"
  RENAME TO "PrivacyCustomerTargetBarrier_shopId_generationId_targetKind_idx";
