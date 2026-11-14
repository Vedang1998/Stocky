-- Inventory control: transfer workflow (partial receipts, scan receiving,
-- rejected units, closing a transfer short, who did what).
-- Additive only: one enum and nullable or defaulted columns on "TransferOrder"
-- and "TransferLineItem". No existing column, row, constraint or index is
-- changed. A transfer received before this migration keeps "receivedQty"
-- equal to what was shipped, which is what a full receipt means here too.
-- Rollback: DROP the constraints and columns below, then the enum.

-- CreateEnum
CREATE TYPE "TransferShortResolution" AS ENUM ('RETURNED', 'WRITTEN_OFF');

-- AlterTable
ALTER TABLE "TransferOrder"
    ADD COLUMN "createdByUserId" VARCHAR(64),
    ADD COLUMN "shippedByUserId" VARCHAR(64),
    ADD COLUMN "receivedByUserId" VARCHAR(64),
    ADD COLUMN "shortResolution" "TransferShortResolution",
    ADD COLUMN "cancelledAt" TIMESTAMP(3),
    ADD COLUMN "cancelledByUserId" VARCHAR(64);

-- AlterTable
ALTER TABLE "TransferLineItem"
    ADD COLUMN "pendingReceiveQty" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "rejectedQty" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "rejectNote" VARCHAR(200),
    ADD COLUMN "returnedQty" INTEGER NOT NULL DEFAULT 0;

-- No quantity on a transfer line is negative. NOT VALID keeps the migration
-- from failing on rows written before this rule; new and updated rows are
-- checked.
ALTER TABLE "TransferLineItem"
    ADD CONSTRAINT "TransferLineItem_quantities_nonnegative"
    CHECK (
        "quantity" >= 0
        AND "pickedQty" >= 0
        AND "receivedQty" >= 0
        AND "pendingReceiveQty" >= 0
        AND "rejectedQty" >= 0
        AND "returnedQty" >= 0
    ) NOT VALID;
