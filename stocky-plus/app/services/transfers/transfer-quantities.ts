export const MAX_TRANSFER_LINE_QUANTITY = 1_000_000;

/** Units of a line that leave the source: what was picked, or all of it when nothing was picked. */
export function transferShipQuantity(line: {
  quantity: number;
  pickedQty: number;
}): number {
  return line.pickedQty > 0 ? line.pickedQty : line.quantity;
}
