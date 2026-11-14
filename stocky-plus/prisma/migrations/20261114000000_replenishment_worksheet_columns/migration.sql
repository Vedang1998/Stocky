-- The worksheet columns a shop chooses to show.
-- Additive only: one column with a default on ReplenishmentSettings, so
-- existing rows read as the default column set and no row is rewritten by
-- the application. Recovery: dropping the column returns every shop to the
-- default columns; nothing else depends on it.

-- AlterTable
ALTER TABLE "ReplenishmentSettings" ADD COLUMN "worksheetColumns" TEXT[] DEFAULT ARRAY['sku', 'supplier', 'abc', 'available', 'incoming', 'netUnits', 'unitsPerDay', 'daysOfStock']::TEXT[];
