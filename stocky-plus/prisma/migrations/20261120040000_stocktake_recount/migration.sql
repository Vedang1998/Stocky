-- Inventory control: recount requests for single lines of a count.
-- Additive only: three nullable columns on "StocktakeLineItem". No existing
-- column, row, constraint or index is changed, and no existing count waits
-- for a recount after this migration.
-- Rollback: DROP the two constraints, then the three columns.

-- AlterTable
ALTER TABLE "StocktakeLineItem"
    ADD COLUMN "recountRequestedAt" TIMESTAMP(3),
    ADD COLUMN "recountRequestedByUserId" VARCHAR(64),
    ADD COLUMN "recountFromQty" INTEGER;

-- Who asked is only recorded with a request, and the count a recount was
-- asked about is a count: never negative. All three columns are null in
-- every existing row; NOT VALID only spares the table scan under the lock.
ALTER TABLE "StocktakeLineItem"
    ADD CONSTRAINT "StocktakeLineItem_recount_requester_with_request"
    CHECK ("recountRequestedByUserId" IS NULL OR "recountRequestedAt" IS NOT NULL) NOT VALID;
ALTER TABLE "StocktakeLineItem"
    ADD CONSTRAINT "StocktakeLineItem_recountFromQty_nonnegative"
    CHECK ("recountFromQty" IS NULL OR "recountFromQty" >= 0) NOT VALID;
