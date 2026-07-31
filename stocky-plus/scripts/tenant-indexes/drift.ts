#!/usr/bin/env tsx
import { getMaintenanceClient } from "./connection";
import { checkSchemaIndexDrift } from "./drift-lib";

async function main() {
  const client = await getMaintenanceClient();
  try {
    await checkSchemaIndexDrift(client);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
