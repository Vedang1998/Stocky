/**
 * Child process for D scratch process-loss evidence.
 * Invoked only by source-stage.test.ts. Not a vitest file.
 */
import { existsSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { stageOrderFactsJsonl } from "./source-stage";

const statusPath = process.env.PR6_D_CHILD_STATUS_PATH;
const scratchRoot = process.env.PR6_D_CHILD_SCRATCH_ROOT;
const shopId = process.env.PR6_D_CHILD_SHOP_ID;
const syncRunId = process.env.PR6_D_CHILD_RUN_ID;

function writeStatus(status: Record<string, unknown>): void {
  if (!statusPath) return;
  writeFileSync(statusPath, `${JSON.stringify(status)}\n`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * The stager's write streams open their files asynchronously, and the first
 * 40 lines can be produced before the open completes on a slow runner. Report
 * "parked" only once source.jsonl exists, as the test expects.
 */
async function waitForFile(file: string, timeoutMs = 10_000): Promise<void> {
  const started = Date.now();
  while (!existsSync(file) && Date.now() - started < timeoutMs) {
    await sleep(10);
  }
}

async function main(): Promise<void> {
  if (!statusPath || !scratchRoot || !shopId || !syncRunId) {
    throw new Error("pr6-d process-loss child missing required env");
  }
  writeStatus({ stage: "started", pid: process.pid });
  let emitted = 0;
  const result = await stageOrderFactsJsonl(
    (async function* () {
      for (let index = 1; index <= 400; index += 1) {
        yield `${JSON.stringify({
          id: `gid://shopify/Order/pl-${index}`,
          currentSubtotalLineItemsQuantity: 0,
        })}\n`;
        emitted += 1;
        if (index === 40) {
          const attempts = readdirSync(scratchRoot).filter((name) =>
            name.startsWith("att-"),
          );
          if (attempts[0]) {
            await waitForFile(
              path.join(scratchRoot, attempts[0], "source.jsonl"),
            );
          }
          writeStatus({
            stage: "parked",
            pid: process.pid,
            emitted,
            scratchRoot,
            shopId,
            syncRunId,
            dir: attempts[0] ? path.join(scratchRoot, attempts[0]) : null,
          });
          await sleep(120_000);
        }
      }
    })(),
    {
      shopId,
      syncRunId,
      scratchRoot,
      expectedObjectCount: "400",
      expectedRootObjectCount: "400",
      maxScratchBytes: Number(
        process.env.PR6_D_CHILD_MAX_SCRATCH_BYTES ?? 32 * 1024 * 1024,
      ),
    },
  );
  writeStatus({ stage: "completed", pid: process.pid, status: result.status });
}

main().catch((error: unknown) => {
  writeStatus({
    stage: "error",
    pid: process.pid,
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
