import type { TenantCompatibilityIndex } from "./manifest";
import type { InspectedIndex } from "./inspect";

export type IndexPlanStatus =
  | "missing"
  | "valid_exact"
  | "invalid"
  | "wrong_definition"
  | "wrong_table"
  | "wrong_uniqueness";

export type ClassifiedIndex = {
  entry: TenantCompatibilityIndex;
  status: IndexPlanStatus;
  inspected: InspectedIndex;
};

function columnsMatch(expected: string[], actual: string[]): boolean {
  if (expected.length !== actual.length) return false;
  return expected.every((col, i) => col === actual[i]);
}

export function classifyIndex(
  entry: TenantCompatibilityIndex,
  inspected: InspectedIndex,
): IndexPlanStatus {
  if (inspected.status === "missing") {
    return "missing";
  }

  if (!inspected.indisvalid || !inspected.indisready) {
    return "invalid";
  }

  if (inspected.table !== entry.table) {
    return "wrong_table";
  }

  if (inspected.unique !== entry.unique) {
    return "wrong_uniqueness";
  }

  if (!columnsMatch(entry.columns, inspected.columns)) {
    return "wrong_definition";
  }

  if (inspected.definitionNormalized !== entry.expectedDefNormalized) {
    return "wrong_definition";
  }

  return "valid_exact";
}

export function isExactMatch(status: IndexPlanStatus): boolean {
  return status === "valid_exact";
}
