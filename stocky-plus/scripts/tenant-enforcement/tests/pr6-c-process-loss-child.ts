/**
 * Child process for PR6-C session/process-loss evidence.
 * Invoked only by pr6-c-process-loss.test.ts. Not a vitest file.
 */
import { writeFileSync } from "node:fs";
import { applyOrderFacts } from "../../../app/lib/order-facts/apply";
import { allocateCatalogObservationGeneration } from "../../../app/lib/catalog-facts/observation-generation";
import { getRuntimeClient } from "../connection";
import {
  asQueryRaw,
  insertObservation,
  liveOrder,
  orderSnapshot,
  receiptFor,
  setTenant,
} from "./pr6-c-pg-harness";

type ChildMode = "kill-before-commit" | "kill-after-commit" | "uncertain-commit";

type Status = {
  stage: string;
  pid: number;
  backendPid?: number;
  error?: string;
};

const statusPath = process.env.PR6_C_CHILD_STATUS_PATH;
const mode = process.env.PR6_C_CHILD_MODE as ChildMode;
const shopId = process.env.PR6_C_CHILD_SHOP_ID;
const gid = process.env.PR6_C_CHILD_GID;
const key = process.env.PR6_C_CHILD_KEY;
const digest = process.env.PR6_C_CHILD_DIGEST;
const obsId = process.env.PR6_C_CHILD_OBS_ID;

function writeStatus(status: Status): void {
  if (!statusPath) return;
  writeFileSync(statusPath, `${JSON.stringify(status)}\n`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function main(): Promise<void> {
  if (!statusPath || !mode || !shopId || !gid || !key || !digest || !obsId) {
    throw new Error("pr6-c-process-loss-child missing required env");
  }
  writeStatus({ stage: "started", pid: process.pid });
  const client = await getRuntimeClient();
  try {
    await client.query("BEGIN");
    await setTenant(client, shopId);
    const backend = await client.query<{ pid: number }>(
      "SELECT pg_backend_pid() AS pid",
    );
    const backendPid = backend.rows[0]?.pid;
    writeStatus({ stage: "connected", pid: process.pid, backendPid });
    const db = asQueryRaw(client);
    const req = await allocateCatalogObservationGeneration(db);
    await insertObservation(client, {
      id: obsId,
      shopId,
      resourceKind: "Order",
      shopifyGid: gid,
      requestGen: req,
    });
    const resp = await allocateCatalogObservationGeneration(db);
    await applyOrderFacts(db, {
      shopId,
      receipt: receiptFor(key, digest),
      observations: [liveOrder(shopId, obsId, orderSnapshot(gid), req, resp)],
    });
    writeStatus({ stage: "applied", pid: process.pid, backendPid });
    if (mode === "kill-before-commit") {
      await sleep(120_000);
      throw new Error("parent did not kill child before commit");
    }
    if (mode === "uncertain-commit") {
      writeStatus({ stage: "committing", pid: process.pid, backendPid });
      await sleep(75);
    }
    await client.query("COMMIT");
    writeStatus({ stage: "committed", pid: process.pid, backendPid });
    if (mode === "kill-after-commit" || mode === "uncertain-commit") {
      await sleep(120_000);
    }
  } catch (error) {
    writeStatus({
      stage: "error",
      pid: process.pid,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    await client.end().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
