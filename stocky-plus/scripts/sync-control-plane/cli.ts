#!/usr/bin/env tsx
import { getMigrationClient } from "../tenant-enforcement/connection";
import {
  provisionControlPlaneRole,
  verifyControlPlaneRole,
} from "./roles";

async function main() {
  const cmd = process.argv[2] ?? "verify";
  const apply = process.argv.includes("--apply");
  const client = await getMigrationClient({ requireExplicitMigrationUrl: false });
  try {
    if (cmd === "provision") {
      const r = await provisionControlPlaneRole(client, { apply });
      console.log(JSON.stringify(r, null, 2));
      if (!r.ok) process.exit(1);
      return;
    }
    if (cmd === "verify") {
      const r = await verifyControlPlaneRole(client);
      console.log(JSON.stringify(r, null, 2));
      if (!r.ok) process.exit(1);
      return;
    }
    console.error(`Unknown command ${cmd}`);
    process.exit(2);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
