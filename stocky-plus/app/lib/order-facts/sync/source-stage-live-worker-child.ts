/**
 * Child process for SC-01 live same-shop/run scratch isolation.
 * Invoked only by source-stage.test.ts. Not a vitest file.
 */
import { writeFileSync } from "node:fs";
import { createOwnedScratchDir } from "./source-stage";

const statusPath = process.env.PR6_D_LIVE_STATUS_PATH;
const scratchRoot = process.env.PR6_D_LIVE_SCRATCH_ROOT;
const shopId = process.env.PR6_D_LIVE_SHOP_ID;
const syncRunId = process.env.PR6_D_LIVE_RUN_ID;
const payload = process.env.PR6_D_LIVE_PAYLOAD ?? "LIVE-WORKER-BYTES";
const holdMs = Number(process.env.PR6_D_LIVE_HOLD_MS ?? "120000");

function writeStatus(status: Record<string, unknown>): void {
  if (!statusPath) return;
  writeFileSync(statusPath, `${JSON.stringify(status)}\n`);
}

async function main(): Promise<void> {
  if (!statusPath || !scratchRoot || !shopId || !syncRunId) {
    throw new Error("pr6-d live-scratch child missing required env");
  }
  const handle = await createOwnedScratchDir({
    shopId,
    syncRunId,
    scratchRoot,
    reservedBytes: Number(process.env.PR6_D_LIVE_RESERVED_BYTES ?? 1_048_576),
  });
  const livePath = `${handle.dir}/LIVE-WORKER-BYTES`;
  writeFileSync(livePath, payload);
  writeStatus({
    stage: "parked",
    pid: process.pid,
    dir: handle.dir,
    livePath,
    tokenPrefix: handle.token.slice(0, 8),
  });
  await new Promise((resolve) => {
    setTimeout(resolve, holdMs);
  });
  writeStatus({ stage: "exited", pid: process.pid, dir: handle.dir });
}

main().catch((error: unknown) => {
  writeStatus({
    stage: "error",
    pid: process.pid,
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
