import type { Client } from "pg";
import { assertAllIndexesExact } from "./verify";
import { TENANT_COMPATIBILITY_INDEXES } from "./manifest";

/**
 * After migrations + apply + verify, ensure catalog matches manifest.
 * Prisma schema declares the same indexes; migrate deploy does not create them (D-024).
 */
export async function checkSchemaIndexDrift(client: Client): Promise<void> {
  await assertAllIndexesExact(client);

  console.log(
    JSON.stringify({
      event: "tenant_schema_index_drift_ok",
      manifestCount: TENANT_COMPATIBILITY_INDEXES.length,
      note: "Prisma schema declares these indexes; they are created via tenant:indexes:apply CONCURRENTLY.",
    }),
  );
}
