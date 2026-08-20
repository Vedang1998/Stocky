import {
  APPROVED_INVENTORY_QUANTITY_NAMES,
  APPROVED_INVENTORY_QUANTITY_NAME_SET,
  type ApprovedInventoryQuantityName,
  type InventoryQuantitiesRead,
  type InventoryQuantityRead,
  type MalformedInventoryQuantityRow,
} from "./types";
import { optionalIsoTimestamp } from "./decimal";

export function isApprovedInventoryQuantityName(
  name: string,
): name is ApprovedInventoryQuantityName {
  return APPROVED_INVENTORY_QUANTITY_NAME_SET.has(name);
}

function isIntegerQuantity(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

function observedNameKind(name: unknown): string {
  if (name === null) return "null";
  if (name === "") return "empty_string";
  if (Array.isArray(name)) return "array";
  return typeof name;
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
  const malformedRows: MalformedInventoryQuantityRow[] = [];

  for (const row of raw ?? []) {
    if (typeof row.name !== "string" || row.name === "") {
      malformedRows.push({
        reason: "malformed_name",
        observedNameKind: observedNameKind(row.name),
      });
      continue;
    }

    if (!isApprovedInventoryQuantityName(row.name)) {
      unexpectedNames.push(row.name);
    }

    if (!isIntegerQuantity(row.quantity)) {
      malformedQuantityNames.push(row.name);
      continue;
    }

    const updatedAt = optionalIsoTimestamp(
      row.updatedAt,
      "inventoryQuantity.updatedAt",
    );
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

  return {
    byName,
    missingApprovedNames,
    unexpectedNames,
    malformedQuantityNames,
    malformedRows,
  };
}
