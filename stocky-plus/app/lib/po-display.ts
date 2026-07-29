/**
 * Pure display/math helpers safe for client and server bundles.
 * Keep Prisma/Shopify I/O out of this module.
 *
 * Money arithmetic here uses Number for characterization of current UI totals.
 * Phase 1+ must migrate display money paths to decimal-safe handling.
 */

export function poDisplayNumber(po: {
  poNumber: string | null;
  id: string;
}): string {
  return po.poNumber ?? `PO-${po.id.slice(-6).toUpperCase()}`;
}

export function poLineTotals(
  lineItems: Array<{
    orderedQty: number;
    receivedQty: number;
    unitCost: { toString(): string } | number;
    allocatedLandedCost: { toString(): string } | number | null;
  }>,
) {
  let orderedUnits = 0;
  let receivedUnits = 0;
  let merchandise = 0;
  let landed = 0;
  for (const li of lineItems) {
    orderedUnits += li.orderedQty;
    receivedUnits += li.receivedQty;
    const unit = Number(li.unitCost);
    const alloc = Number(li.allocatedLandedCost ?? 0);
    merchandise += unit * li.orderedQty;
    landed += (unit + alloc) * li.orderedQty;
  }
  return { orderedUnits, receivedUnits, merchandise, landed };
}
