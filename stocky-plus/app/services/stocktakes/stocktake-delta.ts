/**
 * The change a counted line stands for. A line counted after stock moved is
 * measured from the quantity Shopify showed when the movement was found.
 */
export function stocktakeLineDelta(line: {
  expectedQty: number;
  countedQty: number | null;
  movementBaselineQty: number | null;
}): number | null {
  if (line.countedQty === null) return null;
  return line.countedQty - (line.movementBaselineQty ?? line.expectedQty);
}
