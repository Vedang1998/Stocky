-- Inventory control: a transfer that leaves the source in several shipments
-- (PRD 3.12, "multiple shipments").
-- Additive only: one defaulted column on "TransferOrder", one nullable column
-- on "TransferLineItem" and one check constraint. No existing column, row,
-- constraint or index is changed.
--
-- "TransferOrder"."shipsInParts" is false for every existing transfer, which
-- keeps them shipping in one go as before.
-- "TransferLineItem"."shippedQty" is null for every existing line. A line with
-- null there is read as before: a shipped line's units are its "pickedQty", or
-- its whole "quantity" when that is 0. Lines shipped from now on carry the
-- units that left the source in "shippedQty", so that a line of which nothing
-- has shipped yet can say 0.
--
-- Rollback: DROP the constraint and the two columns. Do that only while no
-- transfer has "shipsInParts" true: the earlier code reads a line's shipped
-- units from "pickedQty", which a transfer shipping in parts uses for the
-- units picked for its next shipment. Transfers that ship in one go are
-- written exactly as before ("pickedQty" holds the shipped units), and so is
-- a transfer that shipped in parts once its last unit has shipped or it has
-- been closed, with one exception: a line of which no unit ever shipped, on a
-- transfer closed with units still to ship, has "shippedQty" 0 and
-- "pickedQty" 0, and the earlier code reads "pickedQty" 0 as the whole
-- "quantity". Before dropping the columns, list those lines
-- ("shippedQty" = 0 on a transfer with status RECEIVED) and keep the list:
-- the earlier code would show their units as shipped and written off. No
-- stock moves either way; the ledger is the record of what left.

-- AlterTable
ALTER TABLE "TransferOrder"
    ADD COLUMN "shipsInParts" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "TransferLineItem"
    ADD COLUMN "shippedQty" INTEGER;

-- A line never ships a negative number of units, or more than it asks for.
-- NOT VALID: every existing row has null here, so there is nothing to check,
-- and the table is not scanned under the lock; new and updated rows are
-- checked.
ALTER TABLE "TransferLineItem"
    ADD CONSTRAINT "TransferLineItem_shippedQty_within_quantity"
    CHECK (
        "shippedQty" IS NULL
        OR ("shippedQty" >= 0 AND "shippedQty" <= "quantity")
    ) NOT VALID;
