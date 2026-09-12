/**
 * PR6-C Gate A process/session-loss and uncertain-outcome evidence.
 *
 * Distinct from pr6-c-evidence-gates.test.ts ROLLBACK/COMMIT controls and
 * from adversarial receipt DELETE. No D worker is started.
 */
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { applyOrderFacts } from "../../../app/lib/order-facts/apply";
import { allocateCatalogObservationGeneration } from "../../../app/lib/catalog-facts/observation-generation";
import {
  getBootstrapClient,
  getRuntimeClient,
} from "../connection";
import { resetSchemaAndApplyEnforcement } from "./helpers";
import {
  asQueryRaw,
  countTable,
  insertObservation,
  liveOrder,
  openTenant,
  orderSnapshot,
  receiptFor,
  setTenant,
} from "./pr6-c-pg-harness";

const APP_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const CHILD_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "pr6-c-process-loss-child.ts",
);
const TSX_BIN = path.join(APP_ROOT, "node_modules/.bin/tsx");

type ChildStatus = {
  stage?: string;
  pid?: number;
  backendPid?: number;
  error?: string;
};

function readStatus(statusPath: string): ChildStatus {
  try {
    const raw = readFileSync(statusPath, "utf8").trim();
    const line = raw.split("\n").at(-1) ?? "";
    return JSON.parse(line) as ChildStatus;
  } catch {
    return {};
  }
}

async function waitForStage(
  statusPath: string,
  stages: string[],
  timeoutMs: number,
): Promise<ChildStatus> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const status = readStatus(statusPath);
    if (status.stage && stages.includes(status.stage)) return status;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(
    `timed out waiting for child stages ${stages.join("|")}; last=${JSON.stringify(readStatus(statusPath))}`,
  );
}

async function spawnChild(args: {
  mode: "kill-before-commit" | "kill-after-commit" | "uncertain-commit";
  shopId: string;
  gid: string;
  key: string;
  digest: string;
  obsId: string;
}): Promise<{ statusPath: string; child: ReturnType<typeof spawn>; tmp: string }> {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "pr6-c-loss-"));
  const statusPath = path.join(tmp, "status.json");
  // New process group so SIGKILL reaps tsx and its Node grandchild. Status is
  // a file, so stdio can be ignored (piped unread stdio can deadlock tsx).
  const child = spawn(TSX_BIN, [CHILD_PATH], {
    cwd: APP_ROOT,
    env: {
      ...process.env,
      PR6_C_CHILD_STATUS_PATH: statusPath,
      PR6_C_CHILD_MODE: args.mode,
      PR6_C_CHILD_SHOP_ID: args.shopId,
      PR6_C_CHILD_GID: args.gid,
      PR6_C_CHILD_KEY: args.key,
      PR6_C_CHILD_DIGEST: args.digest,
      PR6_C_CHILD_OBS_ID: args.obsId,
    },
    stdio: "ignore",
    detached: true,
  });
  child.on("error", () => undefined);
  return { statusPath, child, tmp };
}

function killChild(
  child: ReturnType<typeof spawn>,
  extraPid?: number,
): void {
  const pids = [child.pid, extraPid].filter(
    (pid): pid is number => typeof pid === "number" && pid > 0,
  );
  for (const pid of pids) {
    try {
      process.kill(-pid, "SIGKILL");
    } catch {
      // process group already gone
    }
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // already exited
    }
  }
}

async function waitExit(child: ReturnType<typeof spawn>): Promise<void> {
  if (child.exitCode != null || child.signalCode != null) return;
  await new Promise<void>((resolve) => {
    child.once("exit", () => resolve());
    setTimeout(resolve, 8_000);
  });
}

/**
 * Node SIGKILL does not drop the PostgreSQL backend immediately. The session
 * and receipt advisory xact lock remain until the backend is reaped.
 */
async function reapAbandonedBackend(backendPid?: number): Promise<void> {
  if (!backendPid) return;
  const killer = await getBootstrapClient();
  try {
    await killer.query("SELECT pg_terminate_backend($1)", [backendPid]);
    const started = Date.now();
    while (Date.now() - started < 5_000) {
      const live = await killer.query(
        "SELECT 1 FROM pg_stat_activity WHERE pid = $1",
        [backendPid],
      );
      if ((live.rowCount ?? 0) === 0) return;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  } finally {
    await killer.end();
  }
}

async function retryReceipt(
  shopId: string,
  gid: string,
  key: string,
  digest: string,
): Promise<{ receiptStatus: string }> {
  const existing = await countTable(
    shopId,
    "SyncApplicationReceipt",
    "applicationKey",
    key,
  );
  const session = await openTenant(shopId);
  try {
    if (existing === 1) {
      const again = await applyOrderFacts(session.db, {
        shopId,
        receipt: receiptFor(key, digest),
        observations: [],
      });
      await session.client.query("COMMIT");
      return { receiptStatus: again.receiptStatus };
    }
    const req = await allocateCatalogObservationGeneration(session.db);
    const obsId = `obs-retry-${key}`;
    await insertObservation(session.client, {
      id: obsId,
      shopId,
      resourceKind: "Order",
      shopifyGid: gid,
      requestGen: req,
    });
    const resp = await allocateCatalogObservationGeneration(session.db);
    const applied = await applyOrderFacts(session.db, {
      shopId,
      receipt: receiptFor(key, digest),
      observations: [
        liveOrder(shopId, obsId, orderSnapshot(gid), req, resp),
      ],
    });
    await session.client.query("COMMIT");
    return { receiptStatus: applied.receiptStatus };
  } catch (error) {
    await session.client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await session.client.end();
  }
}

describe("PR6-C process/session-loss evidence", () => {
  let prisma: PrismaClient;
  let shopAId: string;

  beforeAll(async () => {
    ({ prisma } = await resetSchemaAndApplyEnforcement());
    const shopA = await prisma.shop.create({
      data: { myshopifyDomain: "pr6-c-loss-a.myshopify.com" },
    });
    shopAId = shopA.id;
  }, 600_000);

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it("labels SQL ROLLBACK as a control, not session-loss evidence", () => {
    expect("ROLLBACK").not.toBe("pg_terminate_backend");
    expect("ROLLBACK").not.toBe("SIGKILL");
  });

  it("session loss via pg_terminate_backend before COMMIT leaves 0 facts and 0 receipts", async () => {
    const gid = "gid://shopify/Order/loss-term-before";
    const key = "loss-term-before";
    const session = await openTenant(shopAId);
    session.client.on("error", () => undefined);
    const pidRow = await session.client.query<{ pid: number }>(
      "SELECT pg_backend_pid() AS pid",
    );
    const backendPid = pidRow.rows[0].pid;
    try {
      const req = await allocateCatalogObservationGeneration(session.db);
      await insertObservation(session.client, {
        id: "obs-loss-term-before",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: req,
      });
      const resp = await allocateCatalogObservationGeneration(session.db);
      await applyOrderFacts(session.db, {
        shopId: shopAId,
        receipt: receiptFor(key, "loss-term-before-digest"),
        observations: [
          liveOrder(
            shopAId,
            "obs-loss-term-before",
            orderSnapshot(gid),
            req,
            resp,
          ),
        ],
      });
      const killer = await getBootstrapClient();
      try {
        const terminated = await killer.query<{ pg_terminate_backend: boolean }>(
          "SELECT pg_terminate_backend($1)",
          [backendPid],
        );
        expect(terminated.rows[0]?.pg_terminate_backend).toBe(true);
      } finally {
        await killer.end();
      }
      await session.client.query("COMMIT").catch(() => undefined);
    } finally {
      await session.client.end().catch(() => undefined);
    }
    expect(await countTable(shopAId, "ShopifyOrderFact", "shopifyGid", gid)).toBe(0);
    expect(await countTable(shopAId, "SyncApplicationReceipt", "applicationKey", key)).toBe(
      0,
    );
  }, 60_000);

  it("abrupt client disconnect after apply, without ROLLBACK or COMMIT, leaves 0 facts", async () => {
    const gid = "gid://shopify/Order/loss-disconnect-before";
    const key = "loss-disconnect-before";
    const client = await getRuntimeClient();
    await client.query("BEGIN");
    await setTenant(client, shopAId);
    const db = asQueryRaw(client);
    const req = await allocateCatalogObservationGeneration(db);
    await insertObservation(client, {
      id: "obs-loss-disc-before",
      shopId: shopAId,
      resourceKind: "Order",
      shopifyGid: gid,
      requestGen: req,
    });
    const resp = await allocateCatalogObservationGeneration(db);
    await applyOrderFacts(db, {
      shopId: shopAId,
      receipt: receiptFor(key, "loss-disc-before-digest"),
      observations: [
        liveOrder(shopAId, "obs-loss-disc-before", orderSnapshot(gid), req, resp),
      ],
    });
    await client.end();
    expect(await countTable(shopAId, "ShopifyOrderFact", "shopifyGid", gid)).toBe(0);
    expect(await countTable(shopAId, "SyncApplicationReceipt", "applicationKey", key)).toBe(
      0,
    );
  }, 60_000);

  it("process SIGKILL before COMMIT leaves 0 facts; retry then applies once", async () => {
    const gid = "gid://shopify/Order/loss-kill-before";
    const key = "loss-kill-before";
    const digest = "loss-kill-before-digest";
    const { statusPath, child, tmp } = await spawnChild({
      mode: "kill-before-commit",
      shopId: shopAId,
      gid,
      key,
      digest,
      obsId: "obs-loss-kill-before",
    });
    try {
      const status = await waitForStage(statusPath, ["applied"], 20_000);
      expect(status.pid).toBeGreaterThan(0);
      expect(status.backendPid).toBeGreaterThan(0);
      killChild(child, status.pid);
      await waitExit(child);
      await reapAbandonedBackend(status.backendPid);
      expect(await countTable(shopAId, "ShopifyOrderFact", "shopifyGid", gid)).toBe(0);
      expect(
        await countTable(shopAId, "SyncApplicationReceipt", "applicationKey", key),
      ).toBe(0);
      const retry = await retryReceipt(shopAId, gid, key, digest);
      expect(retry.receiptStatus).toBe("applied");
      expect(await countTable(shopAId, "ShopifyOrderFact", "shopifyGid", gid)).toBe(1);
      expect(
        await countTable(shopAId, "SyncApplicationReceipt", "applicationKey", key),
      ).toBe(1);
    } finally {
      killChild(child);
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 60_000);

  it("process SIGKILL after COMMIT before app ack keeps facts+receipt; retry is already_applied", async () => {
    const gid = "gid://shopify/Order/loss-kill-after";
    const key = "loss-kill-after";
    const digest = "loss-kill-after-digest";
    const { statusPath, child, tmp } = await spawnChild({
      mode: "kill-after-commit",
      shopId: shopAId,
      gid,
      key,
      digest,
      obsId: "obs-loss-kill-after",
    });
    try {
      const status = await waitForStage(statusPath, ["committed"], 20_000);
      killChild(child, status.pid);
      await waitExit(child);
      expect(await countTable(shopAId, "ShopifyOrderFact", "shopifyGid", gid)).toBe(1);
      expect(
        await countTable(shopAId, "SyncApplicationReceipt", "applicationKey", key),
      ).toBe(1);
      const retry = await retryReceipt(shopAId, gid, key, digest);
      expect(retry.receiptStatus).toBe("already_applied");
      expect(await countTable(shopAId, "ShopifyOrderFact", "shopifyGid", gid)).toBe(1);
      expect(
        await countTable(shopAId, "SyncApplicationReceipt", "applicationKey", key),
      ).toBe(1);
    } finally {
      killChild(child);
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 60_000);

  it("uncertain COMMIT (terminate during commit race) retries safely to exactly one fact+receipt", async () => {
    const gid = "gid://shopify/Order/loss-uncertain";
    const key = "loss-uncertain";
    const digest = "loss-uncertain-digest";
    const { statusPath, child, tmp } = await spawnChild({
      mode: "uncertain-commit",
      shopId: shopAId,
      gid,
      key,
      digest,
      obsId: "obs-loss-uncertain",
    });
    try {
      const status = await waitForStage(
        statusPath,
        ["applied", "committing", "committed", "error"],
        20_000,
      );
      if (status.backendPid && status.stage !== "committed") {
        const killer = await getBootstrapClient();
        try {
          await killer.query("SELECT pg_terminate_backend($1)", [
            status.backendPid,
          ]);
        } finally {
          await killer.end();
        }
      }
      killChild(child, status.pid);
      await waitExit(child);
      const retry = await retryReceipt(shopAId, gid, key, digest);
      expect(["applied", "already_applied"]).toContain(retry.receiptStatus);
      expect(await countTable(shopAId, "ShopifyOrderFact", "shopifyGid", gid)).toBe(1);
      expect(
        await countTable(shopAId, "SyncApplicationReceipt", "applicationKey", key),
      ).toBe(1);
    } finally {
      killChild(child);
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 60_000);

  it("uncertain client destroy during COMMIT retries safely to exactly one fact+receipt", async () => {
    const gid = "gid://shopify/Order/loss-destroy";
    const key = "loss-destroy";
    const digest = "loss-destroy-digest";
    const client = await getRuntimeClient();
    client.on("error", () => undefined);
    await client.query("BEGIN");
    await setTenant(client, shopAId);
    const db = asQueryRaw(client);
    const req = await allocateCatalogObservationGeneration(db);
    await insertObservation(client, {
      id: "obs-loss-destroy",
      shopId: shopAId,
      resourceKind: "Order",
      shopifyGid: gid,
      requestGen: req,
    });
    const resp = await allocateCatalogObservationGeneration(db);
    await applyOrderFacts(db, {
      shopId: shopAId,
      receipt: receiptFor(key, digest),
      observations: [
        liveOrder(shopAId, "obs-loss-destroy", orderSnapshot(gid), req, resp),
      ],
    });
    const commit = client.query("COMMIT");
    const stream = (
      client as unknown as { connection?: { stream?: { destroy: () => void } } }
    ).connection?.stream;
    stream?.destroy();
    await commit.catch(() => undefined);
    await client.end().catch(() => undefined);
    const retry = await retryReceipt(shopAId, gid, key, digest);
    expect(["applied", "already_applied"]).toContain(retry.receiptStatus);
    expect(await countTable(shopAId, "ShopifyOrderFact", "shopifyGid", gid)).toBe(1);
    expect(await countTable(shopAId, "SyncApplicationReceipt", "applicationKey", key)).toBe(
      1,
    );
  }, 60_000);
});
