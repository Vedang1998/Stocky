import type { Client } from "pg";
import { classifyIndex, type ClassifiedIndex } from "./classify";
import { inspectIndex } from "./inspect";
import { TENANT_COMPATIBILITY_INDEXES } from "./manifest";

export async function planIndexes(client: Client): Promise<ClassifiedIndex[]> {
  const results: ClassifiedIndex[] = [];
  for (const entry of TENANT_COMPATIBILITY_INDEXES) {
    const inspected = await inspectIndex(client, entry.name);
    const status = classifyIndex(entry, inspected);
    results.push({ entry, status, inspected });
  }
  return results;
}

export function formatPlanReport(classified: ClassifiedIndex[]): string {
  const lines = classified.map(({ entry, status, inspected }) => {
    const base = `${entry.name} (${entry.purpose}): ${status}`;
    if (status === "invalid" && inspected.status === "present") {
      return `${base} indisvalid=${inspected.indisvalid} indisready=${inspected.indisready}`;
    }
    if (status === "wrong_definition" && inspected.status === "present") {
      return `${base} expected=${entry.expectedDefNormalized} actual=${inspected.definitionNormalized}`;
    }
    if (status === "wrong_table" && inspected.status === "present") {
      return `${base} expected_table=${entry.table} actual_table=${inspected.table}`;
    }
    if (status === "wrong_uniqueness" && inspected.status === "present") {
      return `${base} expected_unique=${entry.unique} actual_unique=${inspected.unique}`;
    }
    return base;
  });
  return lines.join("\n");
}

export function summarizePlan(classified: ClassifiedIndex[]): Record<
  string,
  number
> {
  const counts: Record<string, number> = {};
  for (const { status } of classified) {
    counts[status] = (counts[status] ?? 0) + 1;
  }
  return counts;
}
