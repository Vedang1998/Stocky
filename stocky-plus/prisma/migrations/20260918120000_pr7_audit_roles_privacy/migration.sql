-- PR7 audit / roles / privacy / admission tables.
-- Additive only. Helpers, FORCE RLS extras, and privacy policies are applied
-- by tenant-enforcement (do not change existing runtime tenant predicates).
-- Recovery: retain tables unused; drop only with a separately authorized
-- reverse migration after proving no PR7 writer remains active.

SET lock_timeout = '5s';
SET statement_timeout = '120s';

-- Merchant append-only audit
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "actorKind" TEXT NOT NULL DEFAULT 'system',
    "actorId" TEXT,
    "action" TEXT NOT NULL DEFAULT 'recorded',
    "decision" TEXT NOT NULL DEFAULT 'recorded',
    "resourceType" TEXT,
    "resourceId" TEXT,
    "customerRestId" TEXT,
    "correlationId" TEXT,
    "emitIdempotency" TEXT,
    "outcome" TEXT NOT NULL DEFAULT 'recorded',
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AuditEvent_shopId_id_key" ON "AuditEvent"("shopId", "id");
CREATE UNIQUE INDEX "AuditEvent_shopId_emitIdempotency_key" ON "AuditEvent"("shopId", "emitIdempotency");
CREATE INDEX "AuditEvent_shopId_createdAt_idx" ON "AuditEvent"("shopId", "createdAt");
CREATE INDEX "AuditEvent_shopId_customerRestId_idx" ON "AuditEvent"("shopId", "customerRestId");

ALTER TABLE "AuditEvent"
  ADD CONSTRAINT "AuditEvent_shopId_fkey"
  FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- Staff assignments (no Shop FK so verifier rows can outlive a deleted root
-- until generation-scoped cleanup). Runtime DML is granted after CP revoke.
CREATE TABLE "ShopRoleAssignment" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "shopifyUserId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "grantedBy" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "revokedBy" TEXT,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ShopRoleAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ShopRoleAssignment_shopId_shopifyUserId_role_key"
  ON "ShopRoleAssignment"("shopId", "shopifyUserId", "role");
CREATE INDEX "ShopRoleAssignment_shopId_shopifyUserId_idx"
  ON "ShopRoleAssignment"("shopId", "shopifyUserId");

CREATE TABLE "ShopInstallGeneration" (
    "id" TEXT NOT NULL,
    "canonicalDomain" TEXT NOT NULL,
    "targetShopId" TEXT NOT NULL,
    "shopRowId" TEXT,
    "fence" TEXT NOT NULL,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uninstalledAt" TIMESTAMP(3),
    "erasedAt" TIMESTAMP(3),
    "rowVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ShopInstallGeneration_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ShopInstallGeneration_canonicalDomain_fence_idx"
  ON "ShopInstallGeneration"("canonicalDomain", "fence");
CREATE INDEX "ShopInstallGeneration_targetShopId_idx"
  ON "ShopInstallGeneration"("targetShopId");
CREATE UNIQUE INDEX "ShopInstallGeneration_live_domain_key"
  ON "ShopInstallGeneration"("canonicalDomain")
  WHERE fence = 'LIVE';

ALTER TABLE "ShopInstallGeneration"
  ADD CONSTRAINT "ShopInstallGeneration_shopRowId_fkey"
  FOREIGN KEY ("shopRowId") REFERENCES "Shop"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

CREATE TABLE "PrivacyRequest" (
    "id" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "targetShopId" TEXT NOT NULL,
    "generationId" TEXT NOT NULL,
    "shopRowId" TEXT,
    "canonicalDomain" TEXT NOT NULL,
    "lookupCustomerRestId" TEXT,
    "lookupOrderLegacyIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "enumerationComplete" BOOLEAN NOT NULL DEFAULT false,
    "missingLinkages" INTEGER NOT NULL DEFAULT 0,
    "activeAttemptId" TEXT,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    "publicationRevision" BIGINT NOT NULL DEFAULT 0,
    "completeRetryCount" INTEGER NOT NULL DEFAULT 0,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deadlineAt" TIMESTAMP(3) NOT NULL,
    "duplicateCount" INTEGER NOT NULL DEFAULT 0,
    "payloadDigest" TEXT,
    "deliveryId" TEXT,
    "workId" TEXT NOT NULL,
    "shopifyWebhookId" TEXT,
    "shopifyEventId" TEXT,
    "pauseHonored" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PrivacyRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PrivacyRequest_workId_key" ON "PrivacyRequest"("workId");
CREATE INDEX "PrivacyRequest_targetShopId_state_idx" ON "PrivacyRequest"("targetShopId", "state");
CREATE INDEX "PrivacyRequest_generationId_idx" ON "PrivacyRequest"("generationId");
CREATE INDEX "PrivacyRequest_canonicalDomain_topic_state_idx"
  ON "PrivacyRequest"("canonicalDomain", "topic", "state");

ALTER TABLE "PrivacyRequest"
  ADD CONSTRAINT "PrivacyRequest_shopRowId_fkey"
  FOREIGN KEY ("shopRowId") REFERENCES "Shop"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

CREATE TABLE "PrivacyAttempt" (
    "id" TEXT NOT NULL,
    "privacyRequestId" TEXT NOT NULL,
    "epoch" INTEGER NOT NULL,
    "state" TEXT NOT NULL,
    "leaseUntil" TIMESTAMP(3),
    "worker" TEXT,
    "checkpoint" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrivacyAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PrivacyAttempt_privacyRequestId_epoch_key"
  ON "PrivacyAttempt"("privacyRequestId", "epoch");

ALTER TABLE "PrivacyAttempt"
  ADD CONSTRAINT "PrivacyAttempt_privacyRequestId_fkey"
  FOREIGN KEY ("privacyRequestId") REFERENCES "PrivacyRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "PrivacyTargetKey" (
    "id" BIGSERIAL NOT NULL,
    "requestId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "surface" TEXT NOT NULL,
    "rowId" TEXT NOT NULL,

    CONSTRAINT "PrivacyTargetKey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PrivacyTargetKey_requestId_surface_rowId_key"
  ON "PrivacyTargetKey"("requestId", "surface", "rowId");
CREATE INDEX "PrivacyTargetKey_requestId_shopId_idx"
  ON "PrivacyTargetKey"("requestId", "shopId");

CREATE TABLE "PrivacyCustomerTargetBarrier" (
    "id" BIGSERIAL NOT NULL,
    "shopId" TEXT NOT NULL,
    "generationId" TEXT NOT NULL,
    "targetKind" TEXT NOT NULL,
    "targetValue" TEXT NOT NULL,
    "privacyRequestId" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "publicationRevision" BIGINT NOT NULL DEFAULT 0,
    "state" TEXT NOT NULL,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMP(3),

    CONSTRAINT "PrivacyCustomerTargetBarrier_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PrivacyCustomerTargetBarrier_privacyRequestId_state_idx"
  ON "PrivacyCustomerTargetBarrier"("privacyRequestId", "state");
CREATE INDEX "PrivacyCustomerTargetBarrier_shopId_generationId_targetKind_targetValue_idx"
  ON "PrivacyCustomerTargetBarrier"("shopId", "generationId", "targetKind", "targetValue");
CREATE UNIQUE INDEX privacy_customer_barrier_active
  ON "PrivacyCustomerTargetBarrier" ("shopId", "generationId", "targetKind", "targetValue")
  WHERE state = 'ACTIVE';

CREATE TABLE "PrivacyCompletedTarget" (
    "shopId" TEXT NOT NULL,
    "generationId" TEXT NOT NULL,
    "targetKind" TEXT NOT NULL,
    "targetValue" TEXT NOT NULL,
    "privacyRequestId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrivacyCompletedTarget_pkey" PRIMARY KEY ("shopId", "generationId", "targetKind", "targetValue", "privacyRequestId")
);

CREATE TABLE "PrivacyCoordinatorEvent" (
    "id" BIGSERIAL NOT NULL,
    "privacyRequestId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "detail" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrivacyCoordinatorEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PrivacyCoordinatorEvent_privacyRequestId_at_idx"
  ON "PrivacyCoordinatorEvent"("privacyRequestId", "at");

ALTER TABLE "PrivacyCoordinatorEvent"
  ADD CONSTRAINT "PrivacyCoordinatorEvent_privacyRequestId_fkey"
  FOREIGN KEY ("privacyRequestId") REFERENCES "PrivacyRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "PrivacyCompletionReceipt" (
    "id" TEXT NOT NULL,
    "privacyRequestId" TEXT NOT NULL,
    "generationId" TEXT NOT NULL,
    "targetShopIdHmac" TEXT NOT NULL,
    "shopDomainHmac" TEXT,
    "manifestDigest" TEXT,
    "topic" TEXT,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrivacyCompletionReceipt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PrivacyCompletionReceipt_privacyRequestId_key"
  ON "PrivacyCompletionReceipt"("privacyRequestId");

CREATE TABLE "PrivacyDeliveryBinding" (
    "id" TEXT NOT NULL,
    "canonicalDomain" TEXT NOT NULL,
    "shopifyWebhookId" TEXT,
    "shopifyEventId" TEXT,
    "topic" TEXT NOT NULL,
    "payloadDigest" TEXT NOT NULL,
    "privacyRequestId" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrivacyDeliveryBinding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PrivacyDeliveryBinding_shopifyWebhookId_key"
  ON "PrivacyDeliveryBinding"("shopifyWebhookId");
CREATE INDEX "PrivacyDeliveryBinding_canonicalDomain_payloadDigest_idx"
  ON "PrivacyDeliveryBinding"("canonicalDomain", "payloadDigest");

CREATE TABLE "PrivacyDeliveryTombstone" (
    "shopifyWebhookId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "privacyRequestId" TEXT NOT NULL,
    "generationId" TEXT NOT NULL,
    "resultState" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrivacyDeliveryTombstone_pkey" PRIMARY KEY ("shopifyWebhookId")
);

CREATE INDEX "PrivacyDeliveryTombstone_expiresAt_idx"
  ON "PrivacyDeliveryTombstone"("expiresAt");

CREATE TABLE "PrivacyDeletionManifest" (
    "id" TEXT NOT NULL,
    "privacyRequestId" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "surface" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "digest" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrivacyDeletionManifest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PrivacyDeletionManifest_privacyRequestId_attemptId_surface_key"
  ON "PrivacyDeletionManifest"("privacyRequestId", "attemptId", "surface");

CREATE TABLE "PrivacyDataRequestArtifact" (
    "id" TEXT NOT NULL,
    "privacyRequestId" TEXT NOT NULL,
    "ciphertext" BYTEA NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "downloadedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrivacyDataRequestArtifact_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PrivacyDataRequestArtifact_privacyRequestId_key"
  ON "PrivacyDataRequestArtifact"("privacyRequestId");

ALTER TABLE "PrivacyDataRequestArtifact"
  ADD CONSTRAINT "PrivacyDataRequestArtifact_privacyRequestId_fkey"
  FOREIGN KEY ("privacyRequestId") REFERENCES "PrivacyRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "PlatformReplayCommand" (
    "commandId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "deadLetterId" TEXT NOT NULL,
    "originalJobId" TEXT NOT NULL,
    "requestDigest" TEXT NOT NULL,
    "newJobId" TEXT,
    "replayId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformReplayCommand_pkey" PRIMARY KEY ("shopId", "commandId")
);

CREATE INDEX "PlatformReplayCommand_shopId_actorId_idx"
  ON "PlatformReplayCommand"("shopId", "actorId");

CREATE TABLE "WriterAdmissionOrigin" (
    "id" TEXT NOT NULL,
    "canonicalDomain" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "sourceKind" TEXT NOT NULL,
    "sourceIdentity" TEXT NOT NULL,
    "originalAdmissionId" TEXT NOT NULL,
    "originalAdmittedAt" TIMESTAMP(3),
    "formatPolicyVersion" TEXT NOT NULL,
    "sourceContentDigest" TEXT NOT NULL,
    "originGenerationId" TEXT,
    "originStatus" TEXT NOT NULL,
    "parentWorkId" TEXT,
    "durableJobId" TEXT,
    "acked" BOOLEAN NOT NULL DEFAULT false,
    "originalCaptureId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WriterAdmissionOrigin_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WriterAdmissionOrigin_canonicalDomain_workId_key"
  ON "WriterAdmissionOrigin"("canonicalDomain", "workId");
CREATE UNIQUE INDEX "writer_admission_source_digest"
  ON "WriterAdmissionOrigin"("canonicalDomain", "sourceKind", "sourceIdentity", "sourceContentDigest");
CREATE UNIQUE INDEX writer_admission_root_digest
  ON "WriterAdmissionOrigin" ("canonicalDomain", "sourceContentDigest")
  WHERE "parentWorkId" IS NULL;
CREATE INDEX "WriterAdmissionOrigin_canonicalDomain_sourceContentDigest_idx"
  ON "WriterAdmissionOrigin"("canonicalDomain", "sourceContentDigest");

ALTER TABLE "WriterAdmissionOrigin"
  ADD CONSTRAINT "WriterAdmissionOrigin_shopId_fkey"
  FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

CREATE TABLE "WriterAdmissionOriginTarget" (
    "originId" TEXT NOT NULL,
    "targetKind" TEXT NOT NULL,
    "targetValue" TEXT NOT NULL,

    CONSTRAINT "WriterAdmissionOriginTarget_pkey" PRIMARY KEY ("originId", "targetKind", "targetValue")
);

ALTER TABLE "WriterAdmissionOriginTarget"
  ADD CONSTRAINT "WriterAdmissionOriginTarget_originId_fkey"
  FOREIGN KEY ("originId") REFERENCES "WriterAdmissionOrigin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "OriginalAdminSession" (
    "id" TEXT NOT NULL,
    "canonicalDomain" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "actorIdentity" TEXT NOT NULL,
    "establishedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OriginalAdminSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OriginalAdminSession_canonicalDomain_shopId_idx"
  ON "OriginalAdminSession"("canonicalDomain", "shopId");

ALTER TABLE "OriginalAdminSession"
  ADD CONSTRAINT "OriginalAdminSession_shopId_fkey"
  FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

CREATE TABLE "OriginalAdminCapture" (
    "id" TEXT NOT NULL,
    "canonicalDomain" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "commandId" TEXT NOT NULL,
    "sourceKind" TEXT NOT NULL,
    "sourceIdentity" TEXT NOT NULL,
    "sourceContentDigest" TEXT NOT NULL,
    "actorIdentity" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "liveGenerationId" TEXT NOT NULL,
    "targetKind" TEXT,
    "targetValue" TEXT,
    "consumedAt" TIMESTAMP(3),
    "boundWorkId" TEXT,
    "contradictedAt" TIMESTAMP(3),
    "contradictionClass" TEXT,
    "formatPolicyVersion" TEXT NOT NULL DEFAULT 'pr7-origin-v1',

    CONSTRAINT "OriginalAdminCapture_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OriginalAdminCapture_canonicalDomain_commandId_key"
  ON "OriginalAdminCapture"("canonicalDomain", "commandId");
CREATE UNIQUE INDEX "OriginalAdminCapture_canonicalDomain_sourceKind_sourceIdentity_sourceContentDigest_key"
  ON "OriginalAdminCapture"("canonicalDomain", "sourceKind", "sourceIdentity", "sourceContentDigest");

ALTER TABLE "OriginalAdminCapture"
  ADD CONSTRAINT "OriginalAdminCapture_shopId_fkey"
  FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

CREATE TABLE "QueuedWorkSighting" (
    "canonicalDomain" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "sourceKind" TEXT NOT NULL,
    "sourceIdentity" TEXT NOT NULL,
    "sourceContentDigest" TEXT NOT NULL,
    "sightedClass" TEXT NOT NULL,
    "sightedAt" TIMESTAMP(3) NOT NULL,
    "parentWorkId" TEXT,
    "correlatedCaptureId" TEXT,

    CONSTRAINT "QueuedWorkSighting_pkey" PRIMARY KEY ("canonicalDomain", "sourceContentDigest", "sightedClass", "sourceIdentity")
);

CREATE TABLE "SourceEffectLink" (
    "canonicalDomain" TEXT NOT NULL,
    "sourceContentDigest" TEXT NOT NULL,
    "effectCommitment" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "effectId" TEXT NOT NULL,
    "writtenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceEffectLink_pkey" PRIMARY KEY ("canonicalDomain", "effectCommitment")
);

CREATE UNIQUE INDEX "SourceEffectLink_canonicalDomain_workId_key"
  ON "SourceEffectLink"("canonicalDomain", "workId");
CREATE UNIQUE INDEX "SourceEffectLink_canonicalDomain_sourceContentDigest_key"
  ON "SourceEffectLink"("canonicalDomain", "sourceContentDigest");
