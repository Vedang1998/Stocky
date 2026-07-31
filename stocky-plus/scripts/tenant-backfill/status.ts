#!/usr/bin/env tsx
/**
 * Tenant backfill run status — Phase 1 PR 1.
 */
import { PrismaClient } from "@prisma/client";
import { getBackfillStatus } from "./engine";

function parseRunId(argv: string[]): string {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--run-id") return argv[++i] ?? "";
    if (arg.startsWith("--run-id=")) return arg.split("=")[1] ?? "";
  }
  throw new Error("Required: --run-id <id>");
}

async function main() {
  const runId = parseRunId(process.argv.slice(2));
  const prisma = new PrismaClient();
  try {
    const status = await getBackfillStatus(prisma, runId);
    console.log(
      JSON.stringify({ event: "tenant_backfill_status", ...status }, null, 2),
    );
    if (!status.run) process.exitCode = 1;
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "tenant_backfill_status_error",
        message: error instanceof Error ? error.message : String(error),
      }),
    );
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
