/**
 * Child process for SC-R-02 two-process quota admission.
 * Invoked only by source-stage.test.ts. Not a vitest file.
 */
import { writeFileSync, existsSync } from "node:fs";
import { createOwnedScratchDir } from "./source-stage";

const statusPath = process.env.PR6_D_QUOTA_STATUS_PATH;
const scratchRoot = process.env.PR6_D_QUOTA_SCRATCH_ROOT;
const shopId = process.env.PR6_D_QUOTA_SHOP_ID;
const syncRunId = process.env.PR6_D_QUOTA_RUN_ID;
const barrierPath = process.env.PR6_D_QUOTA_BARRIER_PATH;
const reservedBytes = Number(process.env.PR6_D_QUOTA_RESERVED_BYTES ?? "0");
const maxScratchBytes = Number(process.env.PR6_D_QUOTA_MAX_BYTES ?? "0");

function writeStatus(status: Record<string, unknown>): void {
  if (!statusPath) return;
  writeFileSync(statusPath, `${JSON.stringify(status)}\n`);
}

async function waitForBarrier(): Promise<void> {
  if (!barrierPath) return;
  const started = Date.now();
  while (!existsSync(barrierPath)) {
    if (Date.now() - started > 20_000) {
      throw new Error("quota child timed out waiting for barrier");
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

async function main(): Promise<void> {
  if (!statusPath || !scratchRoot || !shopId || !syncRunId) {
    throw new Error("pr6-d quota child missing required env");
  }
  writeStatus({ stage: "ready", pid: process.pid });
  await waitForBarrier();
  const handle = await createOwnedScratchDir({
    shopId,
    syncRunId,
    scratchRoot,
    reservedBytes: reservedBytes > 0 ? reservedBytes : undefined,
    maxScratchBytes: maxScratchBytes > 0 ? maxScratchBytes : undefined,
  });
  writeStatus({
    stage: "admitted",
    pid: process.pid,
    dir: handle.dir,
    reservedBytes: handle.reservedBytes,
  });
  const holdMs = Number(process.env.PR6_D_QUOTA_HOLD_MS ?? "120000");
  if (holdMs > 0) {
    await new Promise((resolve) => {
      setTimeout(resolve, holdMs);
    });
  }
}

main().catch((error: unknown) => {
  writeStatus({
    stage: "rejected",
    pid: process.pid,
    error: error instanceof Error ? error.message : String(error),
    code:
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: string }).code)
        : null,
  });
  process.exit(0);
});
