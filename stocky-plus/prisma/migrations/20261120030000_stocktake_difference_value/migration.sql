-- Inventory control: value of a count's differences.
-- Additive only: two nullable columns on "StocktakeLineItem" that keep
-- Shopify's unit cost of an item at the moment its count was completed. No
-- existing column, row, constraint or index is changed. Counts completed
-- before this migration keep both columns null and show no value.
-- Rollback: DROP the two constraints, then the two columns.

-- AlterTable
ALTER TABLE "StocktakeLineItem"
    ADD COLUMN "unitCostAmount" DECIMAL(20,6),
    ADD COLUMN "unitCostCurrencyCode" VARCHAR(8);

-- A cost is an amount with its currency, and is never negative. Both columns
-- are null in every existing row, so there is nothing for these rules to
-- fail on; NOT VALID only spares the table scan under the migration's lock.
ALTER TABLE "StocktakeLineItem"
    ADD CONSTRAINT "StocktakeLineItem_unitCost_with_currency"
    CHECK (("unitCostAmount" IS NULL) = ("unitCostCurrencyCode" IS NULL)) NOT VALID;
ALTER TABLE "StocktakeLineItem"
    ADD CONSTRAINT "StocktakeLineItem_unitCost_nonnegative"
    CHECK ("unitCostAmount" IS NULL OR "unitCostAmount" >= 0) NOT VALID;
