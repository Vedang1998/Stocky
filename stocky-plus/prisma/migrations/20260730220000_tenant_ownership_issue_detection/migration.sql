-- Additive: durable per-run ownership-issue detection history (R6).
-- Does not remove firstDetectedRunId / lastDetectedRunId current-state pointers.

CREATE TABLE "TenantOwnershipIssueDetection" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "ownershipIssueId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "detectedStatus" "TenantOwnershipIssueStatus" NOT NULL,
    "tableName" TEXT NOT NULL,
    "rowId" TEXT NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "wasOpenAfterDetection" BOOLEAN NOT NULL,
    "reopenedIssue" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "TenantOwnershipIssueDetection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TenantOwnershipIssueDetection_runId_fingerprint_key"
  ON "TenantOwnershipIssueDetection"("runId", "fingerprint");

CREATE INDEX "TenantOwnershipIssueDetection_runId_detectedAt_idx"
  ON "TenantOwnershipIssueDetection"("runId", "detectedAt");

CREATE INDEX "TenantOwnershipIssueDetection_ownershipIssueId_idx"
  ON "TenantOwnershipIssueDetection"("ownershipIssueId");

CREATE INDEX "TenantOwnershipIssueDetection_tableName_reasonCode_idx"
  ON "TenantOwnershipIssueDetection"("tableName", "reasonCode");

ALTER TABLE "TenantOwnershipIssueDetection"
  ADD CONSTRAINT "TenantOwnershipIssueDetection_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "TenantBackfillRun"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TenantOwnershipIssueDetection"
  ADD CONSTRAINT "TenantOwnershipIssueDetection_ownershipIssueId_fkey"
  FOREIGN KEY ("ownershipIssueId") REFERENCES "TenantOwnershipIssue"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
