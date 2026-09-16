import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
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
  stageOrderFactsJsonl,
  writeStreamChunk,
} from "./source-stage";
import { hashFileSha256, verifyValidatedSourceManifest } from "./source-digest";
import { ORDER_FACTS_SCRATCH_MARKER } from "./constants";

const APP_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../..",
);
const TSX_BIN = path.join(APP_ROOT, "node_modules/.bin/tsx");
const CHILD_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "source-stage-process-loss-child.ts",
);

function scratchRoot(): string {
  return path.join(os.tmpdir(), `stocky-pr6-d-test-${process.pid}-${Date.now()}-${Math.random()}`);
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

describe("PR6-D source staging ownership", () => {
  it("refuses a symlink scratch directory", async () => {
    const root = scratchRoot();
    const target = path.join(root, "target");
    const link = path.join(root, "shop", "run");
    mkdirSync(target, { recursive: true });
    mkdirSync(path.dirname(link), { recursive: true });
    symlinkSync(target, link);
    await expect(
      createOwnedScratchDir({
        shopId: "shop",
        syncRunId: "run",
        scratchRoot: root,
      }),
    ).rejects.toMatchObject({ code: "scratch_symlink_refused" });
  });

  it("refuses to delete scratch outside the D prefix", async () => {
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

  it("refuses to replace a pre-existing directory that contains foreign files", async () => {
    const root = scratchRoot();
    const dir = path.join(root, "shop", "run");
    mkdirSync(dir, { recursive: true });
    const keep = path.join(dir, "keep.txt");
    writeFileSync(keep, "pre-existing-unowned");
    const before = sha256(readFileSync(keep, "utf8"));
    await expect(
      createOwnedScratchDir({
        shopId: "shop",
        syncRunId: "run",
        scratchRoot: root,
      }),
    ).rejects.toMatchObject({ code: "scratch_unowned" });
    expect(sha256(readFileSync(keep, "utf8"))).toBe(before);
    expect(readFileSync(keep, "utf8")).toBe("pre-existing-unowned");
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
    expect(first).not.toBe(second);
    writeFileSync(path.join(first, "source.jsonl"), "a\n");
    writeFileSync(path.join(second, "source.jsonl"), "b\n");
    expect(readFileSync(path.join(first, "source.jsonl"), "utf8")).toBe("a\n");
    expect(readFileSync(path.join(second, "source.jsonl"), "utf8")).toBe("b\n");
    await disposeOwnedScratch(first, root);
    await disposeOwnedScratch(second, root);
    expect(existsSync(first)).toBe(false);
    expect(existsSync(second)).toBe(false);
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
    await disposeOwnedScratch(staged.dir, root);
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

  it("treats the scratch byte bound as a visible disk-full failure and disposes", async () => {
    const root = scratchRoot();
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
    expect(existsSync(path.join(root, "disk-shop", "disk-run"))).toBe(false);
  });

  it("rebuilds after process loss using ownership hashes, not HEAD ids", async () => {
    const root = scratchRoot();
    const statusPath = path.join(root, "status.json");
    mkdirSync(root, { recursive: true });
    const child = spawn(TSX_BIN, [CHILD_PATH], {
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
    const started = Date.now();
    let parked: { pid?: number; stage?: string } = {};
    while (Date.now() - started < 20_000) {
      if (existsSync(statusPath)) {
        try {
          parked = JSON.parse(readFileSync(statusPath, "utf8").trim()) as {
            pid?: number;
            stage?: string;
          };
          if (parked.stage === "parked") break;
        } catch {
          /* status file may be mid-write */
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    expect(parked.stage).toBe("parked");
    const leftover = path.join(root, "pl-shop", "pl-run");
    expect(existsSync(path.join(leftover, ORDER_FACTS_SCRATCH_MARKER))).toBe(true);
    const jsonlPath = path.join(leftover, "source.jsonl");
    expect(existsSync(jsonlPath)).toBe(true);
    const beforeHash = sha256(readFileSync(jsonlPath));
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
    expect(existsSync(jsonlPath)).toBe(false);
    expect(existsSync(path.join(rebuilt, ORDER_FACTS_SCRATCH_MARKER))).toBe(true);
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
      await disposeOwnedScratch(restaged.dir, root);
    }
    await disposeOwnedScratch(rebuilt, root);
  }, 30_000);
});
