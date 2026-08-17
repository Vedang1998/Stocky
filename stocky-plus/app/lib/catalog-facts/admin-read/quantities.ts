import {
  APPROVED_INVENTORY_QUANTITY_NAMES,
  APPROVED_INVENTORY_QUANTITY_NAME_SET,
  type ApprovedInventoryQuantityName,
  type InventoryQuantitiesRead,
  type InventoryQuantityRead,
} from "./types";

export function isApprovedInventoryQuantityName(
  name: string,
): name is ApprovedInventoryQuantityName {
  return APPROVED_INVENTORY_QUANTITY_NAME_SET.has(name);
}

export function mapInventoryQuantities(
  raw: ReadonlyArray<{
    name?: unknown;
    quantity?: unknown;
    updatedAt?: unknown;
  }> | null | undefined,
): InventoryQuantitiesRead {
  const byName: InventoryQuantitiesRead["byName"] = {};
  const unexpectedNames: string[] = [];

  for (const row of raw ?? []) {
    if (typeof row.name !== "string" || row.name === "") continue;
    const quantity =
      typeof row.quantity === "number" && Number.isInteger(row.quantity)
        ? row.quantity
        : null;
    if (quantity == null) continue;
    const updatedAt = row.updatedAt == null ? null : String(row.updatedAt);
    const mapped: InventoryQuantityRead = {
      name: row.name,
      quantity,
      updatedAt,
    };
    if (isApprovedInventoryQuantityName(row.name)) {
      byName[row.name] = mapped;
    } else {
      unexpectedNames.push(row.name);
    }
  }

  const missingApprovedNames = APPROVED_INVENTORY_QUANTITY_NAMES.filter(
    (name) => byName[name] == undefined,
  );

  return { byName, missingApprovedNames, unexpectedNames };
}
