/**
 * Child process for D scratch process-loss evidence.
 * Invoked only by source-stage.test.ts. Not a vitest file.
 *
 * Default mode runs real stageOrderFactsJsonl and parks the generator after
 * record 40. `stage: "parked"` is generator progress only — it does not mean
 * the asynchronous consumer has created or flushed source.jsonl. Sampled
 * parent readiness is a test observation, not fsync or production drain.
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ORDER_FACTS_SCRATCH_MARKER } from "./constants";
import { stageOrderFactsJsonl } from "./source-stage";

const statusPath = process.env.PR6_D_CHILD_STATUS_PATH;
const scratchRoot = process.env.PR6_D_CHILD_SCRATCH_ROOT;
const shopId = process.env.PR6_D_CHILD_SHOP_ID;
const syncRunId = process.env.PR6_D_CHILD_RUN_ID;
const childMode = process.env.PR6_D_CHILD_MODE ?? "real";

function writeStatus(status: Record<string, unknown>): void {
  if (!statusPath) return;
  writeFileSync(statusPath, `${JSON.stringify(status)}\n`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForReleaseFile(releasePath: string): Promise<void> {
  while (!existsSync(releasePath)) {
    await sleep(25);
  }
}

async function runDelayedWrite(): Promise<void> {
  const releasePath = process.env.PR6_D_CHILD_RELEASE_PATH;
  if (!releasePath || !scratchRoot || !shopId || !syncRunId) {
    throw new Error("pr6-d delayed-write child missing required env");
  }
  writeStatus({
    stage: "parked",
    pid: process.pid,
    readiness: "generator_only",
    emitted: 0,
    scratchRoot,
    shopId,
    syncRunId,
    dir: null,
  });
  await waitForReleaseFile(releasePath);
  const dir = path.join(scratchRoot, `att-delayed-${process.pid}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    path.join(dir, ORDER_FACTS_SCRATCH_MARKER),
    `${JSON.stringify({ shopId, syncRunId, disposable: true })}\n`,
  );
  writeFileSync(
    path.join(dir, "source.jsonl"),
    `${JSON.stringify({
      id: "gid://shopify/Order/delayed-1",
      currentSubtotalLineItemsQuantity: 0,
    })}\n`,
  );
  writeStatus({
    stage: "parked",
    pid: process.pid,
    readiness: "bytes_visible",
    emitted: 1,
    scratchRoot,
    shopId,
    syncRunId,
    dir,
  });
  await sleep(120_000);
}

async function runNeverReady(): Promise<void> {
  if (!scratchRoot || !shopId || !syncRunId) {
    throw new Error("pr6-d never-ready child missing required env");
  }
  writeStatus({
    stage: "parked",
    pid: process.pid,
    readiness: "generator_only",
    emitted: 0,
    scratchRoot,
    shopId,
    syncRunId,
    dir: null,
  });
  await sleep(120_000);
}

async function runChildError(): Promise<void> {
  writeStatus({
    stage: "error",
    pid: process.pid,
    error: "injected process-loss child error",
  });
  process.exit(1);
}

async function runRealStaging(): Promise<void> {
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
          writeStatus({
            stage: "parked",
            pid: process.pid,
            readiness: "generator_only",
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
      maxScratchBytes: Number(process.env.PR6_D_CHILD_MAX_SCRATCH_BYTES ?? 32 * 1024 * 1024),
    },
  );
  writeStatus({ stage: "completed", pid: process.pid, status: result.status });
}

async function main(): Promise<void> {
  if (!statusPath || !scratchRoot || !shopId || !syncRunId) {
    throw new Error("pr6-d process-loss child missing required env");
  }
  if (childMode === "delayed-write") {
    await runDelayedWrite();
    return;
  }
  if (childMode === "never-ready") {
    await runNeverReady();
    return;
  }
  if (childMode === "error") {
    await runChildError();
    return;
  }
  await runRealStaging();
}

main().catch((error: unknown) => {
  writeStatus({
    stage: "error",
    pid: process.pid,
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
