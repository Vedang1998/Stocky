import type { Client } from "pg";
import { classifyIndex, isExactMatch } from "./classify";
import { inspectIndex } from "./inspect";
import type { TenantCompatibilityIndex } from "./manifest";
import { TENANT_COMPATIBILITY_INDEXES } from "./manifest";
export function recoveryInstruction(indexName: string): string {
  return (
    `Index "${indexName}" exists but is invalid or mismatched. ` +
    `The tool does not silently repair or drop it. ` +
    `Recovery requires an explicitly authorized ` +
    `DROP INDEX CONCURRENTLY IF EXISTS "${indexName}"; ` +
    `then re-run npm run tenant:indexes:apply -- --apply`
  );
}

function buildCreateStatement(entry: TenantCompatibilityIndex): string {
  const columnList = entry.columns.map((c) => `"${c}"`).join(", ");
  const uniquePrefix = entry.unique ? "UNIQUE " : "";
  return `CREATE ${uniquePrefix}INDEX CONCURRENTLY "${entry.name}" ON "${entry.table}" (${columnList})`;
}

async function assertExactAfterCreate(
  client: Client,
  entry: TenantCompatibilityIndex,
): Promise<void> {
  const inspected = await inspectIndex(client, entry.name);
  if (inspected.status === "missing") {
    throw new Error(`Index "${entry.name}" missing after CREATE CONCURRENTLY`);
  }
  const status = classifyIndex(entry, inspected);
  if (!isExactMatch(status)) {
    throw new Error(
      `Index "${entry.name}" failed post-create verification (${status}). ${recoveryInstruction(entry.name)}`,
    );
  }
}

export type ApplyResult = {
  created: string[];
  skipped: string[];
  failed: { name: string; error: string }[];
};

export async function applyIndexes(
  client: Client,
  options: { apply: boolean },
): Promise<ApplyResult> {
  if (!options.apply) {
    throw new Error("applyIndexes requires options.apply === true");
  }

  const result: ApplyResult = { created: [], skipped: [], failed: [] };

  for (const entry of TENANT_COMPATIBILITY_INDEXES) {
    try {
      const inspected = await inspectIndex(client, entry.name);
      const status = classifyIndex(entry, inspected);

      if (isExactMatch(status)) {
        result.skipped.push(entry.name);
        continue;
      }

      if (status !== "missing") {
        throw new Error(recoveryInstruction(entry.name));
      }

      const sql = buildCreateStatement(entry);
      await client.query(sql);
      await assertExactAfterCreate(client, entry);
      result.created.push(entry.name);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.failed.push({ name: entry.name, error: message });
      throw error;
    }
  }

  return result;
}

export async function runApplyWithPlan(client: Client): Promise<ApplyResult> {
  return applyIndexes(client, { apply: true });
}
