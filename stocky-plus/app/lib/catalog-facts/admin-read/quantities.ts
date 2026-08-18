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

function isIntegerQuantity(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
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
  const malformedQuantityNames: string[] = [];

  for (const row of raw ?? []) {
    if (typeof row.name !== "string" || row.name === "") continue;

    if (!isApprovedInventoryQuantityName(row.name)) {
      unexpectedNames.push(row.name);
    }

    if (!isIntegerQuantity(row.quantity)) {
      malformedQuantityNames.push(row.name);
      continue;
    }

    const updatedAt = row.updatedAt == null ? null : String(row.updatedAt);
    const mapped: InventoryQuantityRead = {
      name: row.name,
      quantity: row.quantity,
      updatedAt,
    };
    if (isApprovedInventoryQuantityName(row.name)) {
      byName[row.name] = mapped;
    }
  }

  const missingApprovedNames = APPROVED_INVENTORY_QUANTITY_NAMES.filter(
    (name) => byName[name] == undefined && !malformedQuantityNames.includes(name),
  );

  return { byName, missingApprovedNames, unexpectedNames, malformedQuantityNames };
}
