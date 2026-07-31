import type { Client } from "pg";
import { isExactMatch } from "./classify";
import { planIndexes } from "./plan";

export type VerifyResult = {
  ok: boolean;
  mismatches: { name: string; status: string }[];
};

export async function verifyIndexes(client: Client): Promise<VerifyResult> {
  const plan = await planIndexes(client);
  const mismatches = plan
    .filter((row) => !isExactMatch(row.status))
    .map((row) => ({ name: row.entry.name, status: row.status }));

  return { ok: mismatches.length === 0, mismatches };
}

export async function assertAllIndexesExact(client: Client): Promise<void> {
  const result = await verifyIndexes(client);
  if (!result.ok) {
    const detail = result.mismatches
      .map((m) => `${m.name}: ${m.status}`)
      .join("\n");
    throw new Error(`Tenant compatibility indexes are not ready:\n${detail}`);
  }
}
