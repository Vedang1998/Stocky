import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { OrderFactsJsonlError } from "./errors";
import {
  createOwnedScratchDir,
  disposeOwnedScratch,
  inspectDScratchNamespace,
  measureDScratchTreeBytes,
  stageOrderFactsJsonl,
  writeStreamChunk,
  type ScratchOwnershipHandle,
} from "./source-stage";
import { hashFileSha256, verifyValidatedSourceManifest } from "./source-digest";
import { ORDER_FACTS_SCRATCH_MARKER } from "./constants";

const APP_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../..",
);
const TSX_BIN = path.join(APP_ROOT, "node_modules/.bin/tsx");
const PROCESS_LOSS_CHILD = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "source-stage-process-loss-child.ts",
);
const LIVE_WORKER_CHILD = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "source-stage-live-worker-child.ts",
);

function scratchRoot(): string {
  return path.join(
    os.tmpdir(),
    `stocky-pr6-d-test-${process.pid}-${Date.now()}-${Math.random()}`,
  );
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function inventoryFiles(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (!existsSync(full)) continue;
    const st = readFileSync(full);
    out[name] = sha256(st);
  }
  return out;
}

async function waitStatus(
  statusPath: string,
  stage: string,
  timeoutMs = 20_000,
): Promise<Record<string, unknown>> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (existsSync(statusPath)) {
      try {
        const parsed = JSON.parse(readFileSync(statusPath, "utf8").trim()) as {
          stage?: string;
        };
        if (parsed.stage === stage) return parsed;
      } catch {
        /* status file may be mid-write */
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`timed out waiting for ${stage} at ${statusPath}`);
}

describe("PR6-D source staging ownership", () => {
  it("refuses a symlink scratch root rather than following it", async () => {
    const root = scratchRoot();
    const target = path.join(root, "target");
    const link = path.join(root, "link");
    mkdirSync(target, { recursive: true });
    mkdirSync(root, { recursive: true });
    symlinkSync(target, link);
    await expect(
      createOwnedScratchDir({
        shopId: "shop",
        syncRunId: "run",
        scratchRoot: link,
      }),
    ).rejects.toMatchObject({ code: "scratch_symlink_refused" });
  });

  it("refuses to delete scratch from a caller-supplied path string", async () => {
    const outside = path.join(os.tmpdir(), `not-stocky-${process.pid}-${Date.now()}`);
    mkdirSync(outside, { recursive: true });
    const keep = path.join(outside, "keep.txt");
    writeFileSync(keep, "no");
    const before = sha256(readFileSync(keep, "utf8"));
    await expect(disposeOwnedScratch(outside)).rejects.toBeInstanceOf(
      OrderFactsJsonlError,
    );
    expect(existsSync(keep)).toBe(true);
    expect(sha256(readFileSync(keep, "utf8"))).toBe(before);
  });

  it("leaves markerless source.jsonl, sorted, and empty dirs untouched", async () => {
    const root = scratchRoot();
    const sourceOnly = path.join(root, "shop", "run-source");
    const sortedOnly = path.join(root, "shop", "run-sorted");
    const emptyDir = path.join(root, "shop", "run-empty");
    mkdirSync(sourceOnly, { recursive: true });
    mkdirSync(sortedOnly, { recursive: true });
    mkdirSync(emptyDir, { recursive: true });
    const sourceFile = path.join(sourceOnly, "source.jsonl");
    const sortedFile = path.join(sortedOnly, "ids.tsv.sorted");
    writeFileSync(sourceFile, '{"id":"gid://shopify/Order/keep"}\n');
    writeFileSync(sortedFile, "gid://shopify/Order/keep\n");
    const sourceHash = sha256(readFileSync(sourceFile));
    const sortedHash = sha256(readFileSync(sortedFile));
    const created = await createOwnedScratchDir({
      shopId: "shop",
      syncRunId: "run-source",
      scratchRoot: root,
    });
    expect(created.dir).not.toBe(sourceOnly);
    expect(existsSync(sourceFile)).toBe(true);
    expect(existsSync(sortedFile)).toBe(true);
    expect(existsSync(emptyDir)).toBe(true);
    expect(sha256(readFileSync(sourceFile))).toBe(sourceHash);
    expect(sha256(readFileSync(sortedFile))).toBe(sortedHash);
    expect(inventoryFiles(sourceOnly)).toEqual({
      "source.jsonl": sourceHash,
    });
    await disposeOwnedScratch(created, root);
    expect(existsSync(sourceFile)).toBe(true);
    expect(sha256(readFileSync(sourceFile))).toBe(sourceHash);
  });

  it("does not take over a live valid-marker directory from marker bytes alone", async () => {
    const root = scratchRoot();
    const first = await createOwnedScratchDir({
      shopId: "shop",
      syncRunId: "run",
      scratchRoot: root,
    });
    const keep = path.join(first.dir, "LIVE-MARKER.txt");
    writeFileSync(keep, "owned-live");
    const before = inventoryFiles(first.dir);
    const forged = {
      dir: first.dir,
      token: JSON.parse(readFileSync(path.join(first.dir, ORDER_FACTS_SCRATCH_MARKER), "utf8"))
        .token as string,
      shopId: "shop",
      syncRunId: "run",
      createdPid: process.pid,
      createdAt: new Date().toISOString(),
    } as ScratchOwnershipHandle;
    await expect(disposeOwnedScratch(forged, root)).rejects.toMatchObject({
      code: "scratch_unowned",
    });
    const second = await createOwnedScratchDir({
      shopId: "shop",
      syncRunId: "run",
      scratchRoot: root,
    });
    expect(second.dir).not.toBe(first.dir);
    expect(inventoryFiles(first.dir)).toEqual(before);
    expect(readFileSync(keep, "utf8")).toBe("owned-live");
    await disposeOwnedScratch(second, root);
    expect(existsSync(keep)).toBe(true);
    await disposeOwnedScratch(first, root);
  });

  it("keeps cross-shop and sanitized-name collisions on disjoint attempt dirs", async () => {
    const root = scratchRoot();
    const first = await createOwnedScratchDir({
      shopId: "shop/a",
      syncRunId: "run",
      scratchRoot: root,
    });
    const second = await createOwnedScratchDir({
      shopId: "shop_a",
      syncRunId: "run",
      scratchRoot: root,
    });
    expect(first.dir).not.toBe(second.dir);
    writeFileSync(path.join(first.dir, "source.jsonl"), "a\n");
    writeFileSync(path.join(second.dir, "source.jsonl"), "b\n");
    expect(readFileSync(path.join(first.dir, "source.jsonl"), "utf8")).toBe("a\n");
    expect(readFileSync(path.join(second.dir, "source.jsonl"), "utf8")).toBe("b\n");
    await disposeOwnedScratch(first, root);
    expect(existsSync(path.join(second.dir, "source.jsonl"))).toBe(true);
    await disposeOwnedScratch(second, root);
  });

  it("creates concurrent shop scratch directories without sharing files", async () => {
    const root = scratchRoot();
    const first = await createOwnedScratchDir({
      shopId: "shop-a",
      syncRunId: "run-a",
      scratchRoot: root,
    });
    const second = await createOwnedScratchDir({
      shopId: "shop-b",
      syncRunId: "run-b",
      scratchRoot: root,
    });
    expect(first.dir).not.toBe(second.dir);
    writeFileSync(path.join(first.dir, "source.jsonl"), "a\n");
    writeFileSync(path.join(second.dir, "source.jsonl"), "b\n");
    expect(readFileSync(path.join(first.dir, "source.jsonl"), "utf8")).toBe("a\n");
    expect(readFileSync(path.join(second.dir, "source.jsonl"), "utf8")).toBe("b\n");
    await disposeOwnedScratch(first, root);
    await disposeOwnedScratch(second, root);
    expect(existsSync(first.dir)).toBe(false);
    expect(existsSync(second.dir)).toBe(false);
  });

  it("two live processes keep LIVE-WORKER-BYTES after the second starts and exits", async () => {
    const root = scratchRoot();
    mkdirSync(root, { recursive: true });
    const firstStatus = path.join(root, "first.json");
    const secondStatus = path.join(root, "second.json");
    const first = spawn(TSX_BIN, [LIVE_WORKER_CHILD], {
      env: {
        ...process.env,
        PR6_D_LIVE_STATUS_PATH: firstStatus,
        PR6_D_LIVE_SCRATCH_ROOT: root,
        PR6_D_LIVE_SHOP_ID: "shop",
        PR6_D_LIVE_RUN_ID: "run",
        PR6_D_LIVE_PAYLOAD: "LIVE-WORKER-BYTES",
      },
      stdio: ["ignore", "ignore", "pipe"],
    });
    const parked = await waitStatus(firstStatus, "parked");
    const livePath = String(parked.livePath);
    expect(existsSync(livePath)).toBe(true);
    expect(readFileSync(livePath, "utf8")).toBe("LIVE-WORKER-BYTES");
    const before = sha256(readFileSync(livePath));
    const second = spawn(TSX_BIN, [LIVE_WORKER_CHILD], {
      env: {
        ...process.env,
        PR6_D_LIVE_STATUS_PATH: secondStatus,
        PR6_D_LIVE_SCRATCH_ROOT: root,
        PR6_D_LIVE_SHOP_ID: "shop",
        PR6_D_LIVE_RUN_ID: "run",
        PR6_D_LIVE_PAYLOAD: "SECOND-ATTEMPT",
        PR6_D_LIVE_HOLD_MS: "50",
      },
      stdio: ["ignore", "ignore", "pipe"],
    });
    await waitStatus(secondStatus, "exited");
    expect(second.exitCode === 0 || second.exitCode === null).toBe(true);
    expect(existsSync(livePath)).toBe(true);
    expect(readFileSync(livePath, "utf8")).toBe("LIVE-WORKER-BYTES");
    expect(sha256(readFileSync(livePath))).toBe(before);
    if (typeof parked.pid === "number") process.kill(parked.pid, "SIGKILL");
    first.kill("SIGKILL");
  }, 30_000);

  it("refuses symlink and marker substitution on dispose", async () => {
    const root = scratchRoot();
    const handle = await createOwnedScratchDir({
      shopId: "shop",
      syncRunId: "run",
      scratchRoot: root,
    });
    const keep = path.join(handle.dir, "keep.bin");
    writeFileSync(keep, "preserve-me");
    const before = sha256(readFileSync(keep));
    const foreign = path.join(root, "foreign");
    mkdirSync(foreign, { recursive: true });
    writeFileSync(path.join(foreign, "secret"), "secret");
    rmSync(path.join(handle.dir, ORDER_FACTS_SCRATCH_MARKER));
    symlinkSync(path.join(foreign, "secret"), path.join(handle.dir, ORDER_FACTS_SCRATCH_MARKER));
    await expect(disposeOwnedScratch(handle, root)).rejects.toMatchObject({
      code: "scratch_unowned",
    });
    expect(sha256(readFileSync(keep))).toBe(before);
    expect(readFileSync(path.join(foreign, "secret"), "utf8")).toBe("secret");
  });

  it("late cleanup of an older attempt cannot delete a newer attempt", async () => {
    const root = scratchRoot();
    const older = await createOwnedScratchDir({
      shopId: "shop",
      syncRunId: "run",
      scratchRoot: root,
    });
    writeFileSync(path.join(older.dir, "old.txt"), "old");
    const newer = await createOwnedScratchDir({
      shopId: "shop",
      syncRunId: "run",
      scratchRoot: root,
    });
    writeFileSync(path.join(newer.dir, "new.txt"), "new");
    await disposeOwnedScratch(older, root);
    expect(existsSync(older.dir)).toBe(false);
    expect(readFileSync(path.join(newer.dir, "new.txt"), "utf8")).toBe("new");
    await disposeOwnedScratch(newer, root);
  });

  it("repeated dispose of an authentic handle is safe after the directory is gone", async () => {
    const root = scratchRoot();
    const handle = await createOwnedScratchDir({
      shopId: "shop",
      syncRunId: "run",
      scratchRoot: root,
    });
    await disposeOwnedScratch(handle, root);
    await disposeOwnedScratch(handle, root);
    expect(existsSync(handle.dir)).toBe(false);
  });

  it("reports resource exhaustion without deleting unowned leftovers", async () => {
    const root = scratchRoot();
    const leftover = await createOwnedScratchDir({
      shopId: "shop",
      syncRunId: "run-1",
      scratchRoot: root,
    });
    writeFileSync(path.join(leftover.dir, "fat.bin"), "x".repeat(4096));
    const before = inventoryFiles(leftover.dir);
    await expect(
      createOwnedScratchDir({
        shopId: "shop",
        syncRunId: "run-2",
        scratchRoot: root,
        maxScratchBytes: 1024,
      }),
    ).rejects.toMatchObject({ code: "scratch_resource_exhausted" });
    expect(inventoryFiles(leftover.dir)).toEqual(before);
    const inspected = await inspectDScratchNamespace(root);
    expect(inspected.leftoverAttemptCount).toBeGreaterThanOrEqual(1);
    expect(inspected.leftoverBytes).toBeGreaterThan(0);
  });
});

describe("PR6-D scratch integrity and resource failure", () => {
  it("rejects a tampered source.jsonl via content digest", async () => {
    const root = scratchRoot();
    const staged = await stageOrderFactsJsonl(
      (async function* () {
        yield `${JSON.stringify({
          id: "gid://shopify/Order/digest",
          currentSubtotalLineItemsQuantity: 0,
        })}\n`;
      })(),
      {
        shopId: "digest-shop",
        syncRunId: "digest-run",
        scratchRoot: root,
        expectedObjectCount: "1",
        expectedRootObjectCount: "1",
      },
    );
    expect(staged.status).toBe("COMPLETE");
    if (staged.status !== "COMPLETE") return;
    const before = await hashFileSha256(staged.jsonlPath);
    writeFileSync(staged.jsonlPath, `${readFileSync(staged.jsonlPath, "utf8")}x`);
    expect(await hashFileSha256(staged.jsonlPath)).not.toBe(before);
    await expect(
      verifyValidatedSourceManifest({
        dir: staged.dir,
        jsonlPath: staged.jsonlPath,
        indexPath: staged.indexPath,
        idsPath: staged.idsPath,
        groupedPath: staged.groupedPath,
        emitPath: staged.emitPath,
        manifestPath: staged.manifestPath,
      }),
    ).rejects.toMatchObject({ code: "jsonl_source_digest_mismatch" });
    await disposeOwnedScratch(staged.ownership, root);
  });

  it("fails closed on ENOSPC from /dev/full", async () => {
    await expect(writeFile("/dev/full", "x".repeat(8192))).rejects.toMatchObject({
      code: "ENOSPC",
    });
    const { PassThrough } = await import("node:stream");
    const stream = new PassThrough({ highWaterMark: 8 });
    stream.destroy(Object.assign(new Error("no space left on device"), { code: "ENOSPC" }));
    await expect(writeStreamChunk(stream, "x".repeat(64))).rejects.toMatchObject({
      code: "ENOSPC",
    });
  });

  it("treats the scratch byte bound as a visible disk-full failure and disposes owned files only", async () => {
    const root = scratchRoot();
    const foreign = path.join(root, "foreign.jsonl");
    mkdirSync(root, { recursive: true });
    writeFileSync(foreign, "unowned");
    const before = sha256(readFileSync(foreign));
    const result = await stageOrderFactsJsonl(
      (async function* () {
        yield `${JSON.stringify({
          id: "gid://shopify/Order/disk",
          title: "x".repeat(200),
          currentSubtotalLineItemsQuantity: 0,
        })}\n`;
      })(),
      {
        shopId: "disk-shop",
        syncRunId: "disk-run",
        scratchRoot: root,
        maxScratchBytes: 50,
        expectedObjectCount: "1",
        expectedRootObjectCount: "1",
      },
    );
    expect(result.status).toBe("OPEN_PARENT_BOUND");
    expect(sha256(readFileSync(foreign))).toBe(before);
  });

  it("rebuilds after process loss on a fresh unique dir and leaves abandoned bytes", async () => {
    const root = scratchRoot();
    const statusPath = path.join(root, "status.json");
    mkdirSync(root, { recursive: true });
    const child = spawn(TSX_BIN, [PROCESS_LOSS_CHILD], {
      env: {
        ...process.env,
        PR6_D_CHILD_STATUS_PATH: statusPath,
        PR6_D_CHILD_SCRATCH_ROOT: root,
        PR6_D_CHILD_SHOP_ID: "pl-shop",
        PR6_D_CHILD_RUN_ID: "pl-run",
      },
      stdio: ["ignore", "ignore", "pipe"],
    });
    child.on("error", (error) => {
      writeFileSync(
        statusPath,
        `${JSON.stringify({ stage: "error", error: error.message })}\n`,
      );
    });
    const parked = await waitStatus(statusPath, "parked");
    const leftover = String(parked.dir);
    expect(existsSync(path.join(leftover, ORDER_FACTS_SCRATCH_MARKER))).toBe(true);
    const jsonlPath = path.join(leftover, "source.jsonl");
    expect(existsSync(jsonlPath)).toBe(true);
    const beforeHash = sha256(readFileSync(jsonlPath));
    const beforeInventory = inventoryFiles(leftover);
    const pid = parked.pid;
    expect(typeof pid).toBe("number");
    if (typeof pid === "number") {
      process.kill(pid, "SIGKILL");
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(existsSync(jsonlPath)).toBe(true);
    expect(sha256(readFileSync(jsonlPath))).toBe(beforeHash);
    const rebuilt = await createOwnedScratchDir({
      shopId: "pl-shop",
      syncRunId: "pl-run",
      scratchRoot: root,
    });
    expect(rebuilt.dir).not.toBe(leftover);
    expect(existsSync(jsonlPath)).toBe(true);
    expect(inventoryFiles(leftover)).toEqual(beforeInventory);
    const inspected = await inspectDScratchNamespace(root);
    expect(inspected.attemptDirs.some((row) => row.dir === leftover)).toBe(true);
    expect(await measureDScratchTreeBytes(leftover)).toBeGreaterThan(0);
    const restaged = await stageOrderFactsJsonl(
      (async function* () {
        yield `${JSON.stringify({
          id: "gid://shopify/Order/pl-rebuild",
          currentSubtotalLineItemsQuantity: 0,
        })}\n`;
      })(),
      {
        shopId: "pl-shop",
        syncRunId: "pl-run-2",
        scratchRoot: root,
        expectedObjectCount: "1",
        expectedRootObjectCount: "1",
      },
    );
    expect(restaged.status).toBe("COMPLETE");
    if (restaged.status === "COMPLETE") {
      await disposeOwnedScratch(restaged.ownership, root);
    }
    await disposeOwnedScratch(rebuilt, root);
    expect(inventoryFiles(leftover)).toEqual(beforeInventory);
  }, 30_000);
});
