import { createHash } from "node:crypto";
import {
  closeSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { spawn as spawnProcess, type ChildProcess } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeFile } from "node:fs/promises";
import { afterEach, describe, expect, it } from "vitest";
import { OrderFactsJsonlError } from "./errors";
import {
  createOwnedScratchDir,
  disposeOwnedScratch,
  inspectDScratchNamespace,
  inspectDScratchOccupancy,
  measureDScratchTreeBytes,
  reclaimOperatorSelectedDScratch,
  reinitializeDScratchReservationLedgerAfterQuiescence,
  sanitizeDScratchOccupancy,
  stageOrderFactsJsonl,
  writeStreamChunk,
  type ScratchOwnershipHandle,
} from "./source-stage";
import { hashFileSha256, verifyValidatedSourceManifest } from "./source-digest";
import {
  ORDER_FACTS_SCRATCH_ATTEMPT_PREFIX,
  ORDER_FACTS_SCRATCH_MARKER,
  ORDER_FACTS_SCRATCH_QUOTA_LOCK,
  ORDER_FACTS_SCRATCH_RESERVATION,
  ORDER_FACTS_SCRATCH_RESERVATION_TMP_PREFIX,
} from "./constants";
import { ORDER_FACTS_SCRATCH_QUOTA_VERSION } from "./scratch-quota";

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
const QUOTA_CHILD = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "source-stage-quota-child.ts",
);

const trackedScratchChildren: ChildProcess[] = [];

function spawn(...args: Parameters<typeof spawnProcess>): ChildProcess {
  const child = spawnProcess(...args);
  trackedScratchChildren.push(child);
  child.once("exit", () => {
    const index = trackedScratchChildren.indexOf(child);
    if (index >= 0) trackedScratchChildren.splice(index, 1);
  });
  return child;
}

afterEach(() => {
  delete process.env.PR6_D_QUOTA_FAIL_SAVE;
  delete process.env.PR6_D_QUOTA_CRASH;
  for (const child of trackedScratchChildren.splice(0)) {
    child.kill("SIGKILL");
  }
});

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

function tryOwnedNonemptySourceJsonl(
  root: string,
): { dir: string; jsonlPath: string; bytes: Buffer } | null {
  if (!existsSync(root)) return null;
  let names: string[];
  try {
    names = readdirSync(root);
  } catch {
    return null;
  }
  for (const name of names) {
    if (!name.startsWith(ORDER_FACTS_SCRATCH_ATTEMPT_PREFIX)) continue;
    const dir = path.join(root, name);
    try {
      const dirSt = lstatSync(dir);
      if (dirSt.isSymbolicLink() || !dirSt.isDirectory()) continue;
      const markerSt = lstatSync(path.join(dir, ORDER_FACTS_SCRATCH_MARKER));
      if (markerSt.isSymbolicLink() || !markerSt.isFile()) continue;
      const jsonlPath = path.join(dir, "source.jsonl");
      const jsonlSt = lstatSync(jsonlPath);
      if (jsonlSt.isSymbolicLink() || !jsonlSt.isFile()) continue;
      const fd = openSync(jsonlPath, "r");
      try {
        const length = Math.max(1, jsonlSt.size);
        const buf = Buffer.alloc(length);
        const n = readSync(fd, buf, 0, buf.length, 0);
        if (n <= 0) continue;
        return { dir, jsonlPath, bytes: buf.subarray(0, n) };
      } finally {
        closeSync(fd);
      }
    } catch {
      continue;
    }
  }
  return null;
}

async function waitOwnedNonemptySourceJsonl(
  root: string,
  timeoutMs = 20_000,
): Promise<{ dir: string; jsonlPath: string; bytes: Buffer }> {
  const started = Date.now();
  let lastLen = -1;
  while (Date.now() - started < timeoutMs) {
    const found = tryOwnedNonemptySourceJsonl(root);
    if (found && found.bytes.length > 0) {
      if (found.bytes.length === lastLen) return found;
      lastLen = found.bytes.length;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`timed out waiting for nonempty source.jsonl under ${root}`);
}

function readStatusFile(statusPath: string): Record<string, unknown> | null {
  if (!existsSync(statusPath)) return null;
  try {
    return JSON.parse(readFileSync(statusPath, "utf8").trim()) as Record<
      string,
      unknown
    >;
  } catch {
    return null;
  }
}

async function waitProcessLossReady(
  statusPath: string,
  root: string,
  timeoutMs = 20_000,
): Promise<{
  status: Record<string, unknown>;
  dir: string;
  jsonlPath: string;
  bytes: Buffer;
}> {
  const started = Date.now();
  let lastLen = -1;
  while (Date.now() - started < timeoutMs) {
    const parsed = readStatusFile(statusPath);
    if (parsed?.stage === "error") {
      throw new Error(
        `process-loss child error: ${String(parsed.error ?? "unknown")}`,
      );
    }
    if (parsed?.stage === "completed") {
      throw new Error(
        "process-loss child completed staging before the kill window",
      );
    }
    const found = tryOwnedNonemptySourceJsonl(root);
    if (parsed?.stage === "parked" && found && found.bytes.length > 0) {
      if (found.bytes.length === lastLen) {
        return { status: parsed, ...found };
      }
      lastLen = found.bytes.length;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(
    `timed out waiting for parked child and nonempty source.jsonl under ${root}`,
  );
}

type OwnedProcessLoss = {
  wrapper: ChildProcess;
  wrapperPid: number;
  innerPid: number;
};

function readPpid(pid: number): number | null {
  try {
    const raw = readFileSync(`/proc/${pid}/stat`, "utf8");
    const endComm = raw.lastIndexOf(")");
    if (endComm < 0) return null;
    const parts = raw.slice(endComm + 2).split(" ");
    const ppid = Number(parts[1]);
    return Number.isInteger(ppid) && ppid >= 0 ? ppid : null;
  } catch {
    return null;
  }
}

function pidIsDescendantOf(candidate: number, ancestor: number): boolean {
  let current = candidate;
  const seen = new Set<number>();
  while (current > 1 && !seen.has(current)) {
    if (current === ancestor) return true;
    seen.add(current);
    const ppid = readPpid(current);
    if (ppid === null) return false;
    current = ppid;
  }
  return current === ancestor;
}

function processLossCmdline(pid: number): string | null {
  try {
    return readFileSync(`/proc/${pid}/cmdline`, "utf8");
  } catch {
    return null;
  }
}

function assertOwnedProcessLoss(
  wrapper: ChildProcess,
  statusPid: unknown,
): OwnedProcessLoss {
  if (typeof wrapper.pid !== "number") {
    throw new Error("process-loss wrapper has no pid");
  }
  if (typeof statusPid !== "number") {
    throw new Error(`process-loss status pid is not a number: ${String(statusPid)}`);
  }
  if (statusPid !== wrapper.pid && !pidIsDescendantOf(statusPid, wrapper.pid)) {
    throw new Error(
      `status.pid ${statusPid} is not this test's spawned process ${wrapper.pid} or a descendant`,
    );
  }
  const cmdline = processLossCmdline(statusPid);
  if (!cmdline || !cmdline.includes("source-stage-process-loss-child")) {
    throw new Error(
      `status.pid ${statusPid} cmdline is not this test's process-loss child`,
    );
  }
  return { wrapper, wrapperPid: wrapper.pid, innerPid: statusPid };
}

async function waitObservedExit(
  child: ChildProcess,
  ownedWrapperPid: number,
  timeoutMs = 20_000,
): Promise<{ code: number | null; signal: NodeJS.Signals | null }> {
  if (child.pid !== ownedWrapperPid) {
    throw new Error(
      `refusing to wait on a pid that is not this test's wrapper (child.pid=${child.pid} owned=${ownedWrapperPid})`,
    );
  }
  if (child.exitCode !== null || child.signalCode !== null) {
    return { code: child.exitCode, signal: child.signalCode };
  }
  return await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new Error(`timed out waiting for observed exit of pid ${ownedWrapperPid}`),
      );
    }, timeoutMs);
    child.once("exit", (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal });
    });
  });
}

async function waitPidGone(pid: number, timeoutMs = 20_000): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      process.kill(pid, 0);
    } catch {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`timed out waiting for pid ${pid} to disappear`);
}

function killOwnedProcessLoss(owned: OwnedProcessLoss): void {
  if (owned.wrapper.pid !== owned.wrapperPid) {
    throw new Error("refusing to signal a wrapper pid that is not this test's child");
  }
  try {
    process.kill(owned.innerPid, "SIGKILL");
  } catch {
    /* already gone */
  }
  if (owned.wrapper.exitCode === null && owned.wrapper.signalCode === null) {
    owned.wrapper.kill("SIGKILL");
  }
}

async function stopOwnedProcessLoss(
  wrapper: ChildProcess,
  owned: OwnedProcessLoss | undefined,
): Promise<void> {
  if (owned) {
    killOwnedProcessLoss(owned);
    await waitObservedExit(owned.wrapper, owned.wrapperPid).catch(() => undefined);
    await waitPidGone(owned.innerPid).catch(() => undefined);
    return;
  }
  if (typeof wrapper.pid === "number") {
    wrapper.kill("SIGKILL");
    await waitObservedExit(wrapper, wrapper.pid).catch(() => undefined);
  }
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
        reservedBytes: 262144,
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
      reservedBytes: 262144,
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
      reservedBytes: 262144,
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
      reservedBytes: 262144,
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
      reservedBytes: 262144,
    });
    const second = await createOwnedScratchDir({
      shopId: "shop_a",
      syncRunId: "run",
      scratchRoot: root,
      reservedBytes: 262144,
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
      reservedBytes: 262144,
    });
    const second = await createOwnedScratchDir({
      shopId: "shop-b",
      syncRunId: "run-b",
      scratchRoot: root,
      reservedBytes: 262144,
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
      reservedBytes: 262144,
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
      reservedBytes: 262144,
    });
    writeFileSync(path.join(older.dir, "old.txt"), "old");
    const newer = await createOwnedScratchDir({
      shopId: "shop",
      syncRunId: "run",
      scratchRoot: root,
      reservedBytes: 262144,
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
      reservedBytes: 262144,
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
      reservedBytes: 262144,
    });
    writeFileSync(path.join(leftover.dir, "fat.bin"), "x".repeat(4096));
    const before = inventoryFiles(leftover.dir);
    await expect(
      createOwnedScratchDir({
        shopId: "shop",
        syncRunId: "run-2",
        scratchRoot: root,
        maxScratchBytes: 1024,
        reservedBytes: 262144,
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
    expect(result.status).toBe("SCRATCH_RESOURCE");
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
    let owned: OwnedProcessLoss | undefined;
    try {
      const ready = await waitProcessLossReady(statusPath, root);
      expect(ready.status.stage).toBe("parked");
      expect(ready.status.stage).not.toBe("completed");
      expect(ready.status.readiness).toBe("generator_only");
      expect(ready.bytes.length).toBeGreaterThan(0);
      const leftover = ready.dir;
      expect(existsSync(path.join(leftover, ORDER_FACTS_SCRATCH_MARKER))).toBe(
        true,
      );
      const jsonlPath = ready.jsonlPath;
      const beforeHash = sha256(readFileSync(jsonlPath));
      const beforeInventory = inventoryFiles(leftover);
      owned = assertOwnedProcessLoss(child, ready.status.pid);
      killOwnedProcessLoss(owned);
      await waitObservedExit(owned.wrapper, owned.wrapperPid);
      await waitPidGone(owned.innerPid);
      expect(existsSync(jsonlPath)).toBe(true);
      expect(sha256(readFileSync(jsonlPath))).toBe(beforeHash);
      const rebuilt = await createOwnedScratchDir({
        shopId: "pl-shop",
        syncRunId: "pl-run",
        scratchRoot: root,
        reservedBytes: 262144,
      });
      expect(rebuilt.dir).not.toBe(leftover);
      expect(existsSync(jsonlPath)).toBe(true);
      expect(inventoryFiles(leftover)).toEqual(beforeInventory);
      const inspected = await inspectDScratchNamespace(root);
      expect(inspected.attemptDirs.some((row) => row.dir === leftover)).toBe(
        true,
      );
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
      const occupancy = await inspectDScratchOccupancy({
        scratchRoot: root,
        maxScratchBytes: 32 * 1024 * 1024,
      });
      expect(
        occupancy.activeAttemptCount + occupancy.unknownAttemptCount,
      ).toBeGreaterThan(0);
    } finally {
      await stopOwnedProcessLoss(child, owned);
    }
  }, 30_000);

  it("SC-R-08 confirmatory: SIGKILL during staging leaves bytes and does not complete the killed attempt", async () => {
    const root = scratchRoot();
    const statusPath = path.join(root, "scr08.json");
    mkdirSync(root, { recursive: true });
    const child = spawn(TSX_BIN, [PROCESS_LOSS_CHILD], {
      env: {
        ...process.env,
        PR6_D_CHILD_STATUS_PATH: statusPath,
        PR6_D_CHILD_SCRATCH_ROOT: root,
        PR6_D_CHILD_SHOP_ID: "scr08-shop",
        PR6_D_CHILD_RUN_ID: "scr08-run",
      },
      stdio: ["ignore", "ignore", "pipe"],
    });
    let owned: OwnedProcessLoss | undefined;
    try {
      const ready = await waitProcessLossReady(statusPath, root);
      expect(ready.status.stage).toBe("parked");
      expect(ready.status.stage).not.toBe("completed");
      expect(ready.status.readiness).toBe("generator_only");
      expect(ready.bytes.length).toBeGreaterThan(0);
      const jsonlPath = ready.jsonlPath;
      const before = sha256(readFileSync(jsonlPath));
      owned = assertOwnedProcessLoss(child, ready.status.pid);
      killOwnedProcessLoss(owned);
      await waitObservedExit(owned.wrapper, owned.wrapperPid);
      await waitPidGone(owned.innerPid);
      expect(existsSync(jsonlPath)).toBe(true);
      expect(sha256(readFileSync(jsonlPath))).toBe(before);
      const occupancy = sanitizeDScratchOccupancy(
        await inspectDScratchOccupancy({ scratchRoot: root }),
      );
      expect(occupancy.leftoverAttemptCount).toBeGreaterThan(0);
      expect(occupancy.observedBytes).toBeGreaterThan(0);
      expect(occupancy.reservedBytes).toBeGreaterThan(0);
    } finally {
      await stopOwnedProcessLoss(child, owned);
    }
  }, 30_000);

  it("DISPOSABLE NEGATIVE: delayed source.jsonl creation — parked is premature; repaired wait observes nonempty bytes", async () => {
    const root = scratchRoot();
    const statusPath = path.join(root, "delayed.json");
    const releasePath = path.join(root, "release.json");
    mkdirSync(root, { recursive: true });
    const child = spawn(TSX_BIN, [PROCESS_LOSS_CHILD], {
      env: {
        ...process.env,
        PR6_D_CHILD_MODE: "delayed-write",
        PR6_D_CHILD_STATUS_PATH: statusPath,
        PR6_D_CHILD_SCRATCH_ROOT: root,
        PR6_D_CHILD_SHOP_ID: "delayed-shop",
        PR6_D_CHILD_RUN_ID: "delayed-run",
        PR6_D_CHILD_RELEASE_PATH: releasePath,
      },
      stdio: ["ignore", "ignore", "pipe"],
    });
    let owned: OwnedProcessLoss | undefined;
    try {
      const parked = await waitStatus(statusPath, "parked");
      expect(parked.stage).toBe("parked");
      expect(parked.readiness).toBe("generator_only");
      expect(parked.dir).toBe(null);
      expect(tryOwnedNonemptySourceJsonl(root)).toBeNull();
      owned = assertOwnedProcessLoss(child, parked.pid);
      const readyPromise = waitOwnedNonemptySourceJsonl(root);
      expect(tryOwnedNonemptySourceJsonl(root)).toBeNull();
      writeFileSync(releasePath, "go\n");
      const ready = await readyPromise;
      expect(ready.bytes.length).toBeGreaterThan(0);
      expect(readFileSync(ready.jsonlPath).length).toBeGreaterThan(0);
      killOwnedProcessLoss(owned);
      await waitObservedExit(owned.wrapper, owned.wrapperPid);
      await waitPidGone(owned.innerPid);
    } finally {
      await stopOwnedProcessLoss(child, owned);
    }
  }, 30_000);

  it("DISPOSABLE NEGATIVE: never-ready source.jsonl fails within the existing 20s bound", async () => {
    const root = scratchRoot();
    const statusPath = path.join(root, "never-ready.json");
    mkdirSync(root, { recursive: true });
    const child = spawn(TSX_BIN, [PROCESS_LOSS_CHILD], {
      env: {
        ...process.env,
        PR6_D_CHILD_MODE: "never-ready",
        PR6_D_CHILD_STATUS_PATH: statusPath,
        PR6_D_CHILD_SCRATCH_ROOT: root,
        PR6_D_CHILD_SHOP_ID: "never-shop",
        PR6_D_CHILD_RUN_ID: "never-run",
      },
      stdio: ["ignore", "ignore", "pipe"],
    });
    let owned: OwnedProcessLoss | undefined;
    try {
      const parked = await waitStatus(statusPath, "parked");
      expect(parked.readiness).toBe("generator_only");
      expect(tryOwnedNonemptySourceJsonl(root)).toBeNull();
      owned = assertOwnedProcessLoss(child, parked.pid);
      const started = Date.now();
      await expect(waitOwnedNonemptySourceJsonl(root)).rejects.toThrow(
        /timed out waiting for nonempty source.jsonl/,
      );
      const elapsed = Date.now() - started;
      expect(elapsed).toBeGreaterThanOrEqual(20_000);
      expect(elapsed).toBeLessThan(30_000);
      expect(tryOwnedNonemptySourceJsonl(root)).toBeNull();
    } finally {
      await stopOwnedProcessLoss(child, owned);
    }
  }, 30_000);

  it("DISPOSABLE NEGATIVE: child-error fails within the existing bound rather than hanging or passing", async () => {
    const root = scratchRoot();
    const statusPath = path.join(root, "child-error.json");
    mkdirSync(root, { recursive: true });
    const child = spawn(TSX_BIN, [PROCESS_LOSS_CHILD], {
      env: {
        ...process.env,
        PR6_D_CHILD_MODE: "error",
        PR6_D_CHILD_STATUS_PATH: statusPath,
        PR6_D_CHILD_SCRATCH_ROOT: root,
        PR6_D_CHILD_SHOP_ID: "error-shop",
        PR6_D_CHILD_RUN_ID: "error-run",
      },
      stdio: ["ignore", "ignore", "pipe"],
    });
    try {
      const started = Date.now();
      await expect(waitProcessLossReady(statusPath, root)).rejects.toThrow(
        /process-loss child error: injected process-loss child error/,
      );
      const elapsed = Date.now() - started;
      expect(elapsed).toBeLessThan(20_000);
      expect(tryOwnedNonemptySourceJsonl(root)).toBeNull();
      if (typeof child.pid === "number") {
        const exited = await waitObservedExit(child, child.pid);
        expect(exited.code).toBe(1);
      }
    } finally {
      await stopOwnedProcessLoss(child, undefined);
    }
  }, 30_000);
});

describe("PR6-D SC-R-02/03 quota admission and occupancy", () => {
  it("admits two under-cap reservations and refuses a combined over-cap pair", async () => {
    const root = scratchRoot();
    mkdirSync(root, { recursive: true });
    const first = await createOwnedScratchDir({
      shopId: "shop-a",
      syncRunId: "run-a",
      scratchRoot: root,
      maxScratchBytes: 10_000,
      reservedBytes: 3_000,
    });
    const second = await createOwnedScratchDir({
      shopId: "shop-b",
      syncRunId: "run-b",
      scratchRoot: root,
      maxScratchBytes: 10_000,
      reservedBytes: 3_000,
    });
    expect(first.dir).not.toBe(second.dir);
    await expect(
      createOwnedScratchDir({
        shopId: "shop-c",
        syncRunId: "run-c",
        scratchRoot: root,
        maxScratchBytes: 10_000,
        reservedBytes: 5_000,
      }),
    ).rejects.toMatchObject({ code: "scratch_resource_exhausted" });
    await disposeOwnedScratch(first, root);
    await disposeOwnedScratch(second, root);
  });

  it("default remaining reservation is exclusive for a large import", async () => {
    const root = scratchRoot();
    const first = await createOwnedScratchDir({
      shopId: "shop",
      syncRunId: "run-1",
      scratchRoot: root,
      maxScratchBytes: 1_000_000,
    });
    await expect(
      createOwnedScratchDir({
        shopId: "other",
        syncRunId: "run-2",
        scratchRoot: root,
        maxScratchBytes: 1_000_000,
      }),
    ).rejects.toMatchObject({ code: "scratch_resource_exhausted" });
    await disposeOwnedScratch(first, root);
    const after = await createOwnedScratchDir({
      shopId: "other",
      syncRunId: "run-2",
      scratchRoot: root,
      maxScratchBytes: 1_000_000,
    });
    await disposeOwnedScratch(after, root);
  });

  it("two processes cannot both admit when requested capacity exceeds the cap", async () => {
    const root = scratchRoot();
    mkdirSync(root, { recursive: true });
    const barrier = path.join(root, "go");
    const firstStatus = path.join(root, "one.json");
    const secondStatus = path.join(root, "two.json");
    const spawnQuota = (status: string, shop: string, run: string) =>
      spawn(TSX_BIN, [QUOTA_CHILD], {
        env: {
          ...process.env,
          PR6_D_QUOTA_STATUS_PATH: status,
          PR6_D_QUOTA_SCRATCH_ROOT: root,
          PR6_D_QUOTA_SHOP_ID: shop,
          PR6_D_QUOTA_RUN_ID: run,
          PR6_D_QUOTA_BARRIER_PATH: barrier,
          PR6_D_QUOTA_RESERVED_BYTES: "8000",
          PR6_D_QUOTA_MAX_BYTES: "10000",
        },
        stdio: ["ignore", "ignore", "pipe"],
      });
    const one = spawnQuota(firstStatus, "shop-a", "run-a");
    const two = spawnQuota(secondStatus, "shop-b", "run-b");
    await waitStatus(firstStatus, "ready");
    await waitStatus(secondStatus, "ready");
    writeFileSync(barrier, "go\n");
    const firstResult = await Promise.race([
      waitStatus(firstStatus, "admitted"),
      waitStatus(firstStatus, "rejected"),
    ]);
    const secondResult = await Promise.race([
      waitStatus(secondStatus, "admitted"),
      waitStatus(secondStatus, "rejected"),
    ]);
    const stages = [String(firstResult.stage), String(secondResult.stage)].sort();
    expect(stages).toEqual(["admitted", "rejected"]);
    const rejected = firstResult.stage === "rejected" ? firstResult : secondResult;
    expect(rejected.code).toBe("scratch_resource_exhausted");
    one.kill("SIGKILL");
    two.kill("SIGKILL");
  }, 30_000);

  it("crash after reservation still occupies capacity until operator reclaim", async () => {
    const root = scratchRoot();
    mkdirSync(root, { recursive: true });
    const statusPath = path.join(root, "crash.json");
    const child = spawn(TSX_BIN, [QUOTA_CHILD], {
      env: {
        ...process.env,
        PR6_D_QUOTA_STATUS_PATH: statusPath,
        PR6_D_QUOTA_SCRATCH_ROOT: root,
        PR6_D_QUOTA_SHOP_ID: "crash-shop",
        PR6_D_QUOTA_RUN_ID: "crash-run",
        PR6_D_QUOTA_RESERVED_BYTES: "9000",
        PR6_D_QUOTA_MAX_BYTES: "10000",
      },
      stdio: ["ignore", "ignore", "pipe"],
    });
    const admitted = await waitStatus(statusPath, "admitted");
    if (typeof admitted.pid === "number") {
      try {
        process.kill(admitted.pid, "SIGKILL");
      } catch (error) {
        const code =
          error && typeof error === "object" && "code" in error
            ? String((error as { code?: string }).code)
            : "";
        if (code !== "ESRCH") throw error;
      }
    }
    child.kill("SIGKILL");
    await new Promise((resolve) => setTimeout(resolve, 50));
    await expect(
      createOwnedScratchDir({
        shopId: "next",
        syncRunId: "next",
        scratchRoot: root,
        maxScratchBytes: 10_000,
        reservedBytes: 2_000,
      }),
    ).rejects.toMatchObject({ code: "scratch_resource_exhausted" });
    const occupancy = sanitizeDScratchOccupancy(
      await inspectDScratchOccupancy({
        scratchRoot: root,
        maxScratchBytes: 10_000,
      }),
    );
    expect(occupancy.reasonCode).toBe("order_facts_scratch_resource");
    expect(JSON.stringify(occupancy)).not.toMatch(/crash-shop|att-/);
    expect(occupancy.reservedBytes).toBeGreaterThan(0);
    const attempts = readdirSync(root).filter((name) => name.startsWith("att-"));
    const reclaim = await reclaimOperatorSelectedDScratch({
      scratchRoot: root,
      attemptBasenames: attempts,
      quiescenceConfirmed: true,
    });
    expect(reclaim.reclaimed.length).toBeGreaterThan(0);
    const restored = await createOwnedScratchDir({
      shopId: "next",
      syncRunId: "next",
      scratchRoot: root,
      maxScratchBytes: 10_000,
      reservedBytes: 2_000,
    });
    await disposeOwnedScratch(restored, root);
  }, 30_000);

  it("does not reclaim live, foreign, markerless, or symlink paths", async () => {
    const root = scratchRoot();
    const live = await createOwnedScratchDir({
      shopId: "shop",
      syncRunId: "run",
      scratchRoot: root,
      reservedBytes: 4096,
    });
    const foreign = path.join(root, "foreign-dir");
    mkdirSync(foreign, { recursive: true });
    writeFileSync(path.join(foreign, "secret"), "secret");
    const markerless = path.join(root, "att-markerless");
    mkdirSync(markerless, { recursive: true });
    writeFileSync(path.join(markerless, "source.jsonl"), "keep\n");
    const link = path.join(root, "att-link");
    symlinkSync(foreign, link);
    const result = await reclaimOperatorSelectedDScratch({
      scratchRoot: root,
      attemptBasenames: [
        path.basename(live.dir),
        "foreign-dir",
        "att-markerless",
        "att-link",
      ],
      quiescenceConfirmed: true,
    });
    expect(result.skipped.map((row) => row.reason).sort()).toEqual(
      ["live_writer", "not_an_attempt_basename", "not_verified_d_resource", "symlink_refused"].sort(),
    );
    expect(existsSync(path.join(foreign, "secret"))).toBe(true);
    expect(existsSync(path.join(markerless, "source.jsonl"))).toBe(true);
    expect(existsSync(live.dir)).toBe(true);
    await disposeOwnedScratch(live, root);
  });

  it("refuses a second attempt when the attempt cap is already filled", async () => {
    const root = scratchRoot();
    const first = await createOwnedScratchDir({
      shopId: "shop",
      syncRunId: "run-1",
      scratchRoot: root,
      maxScratchAttempts: 1,
      reservedBytes: 1024,
      maxScratchBytes: 10_000,
    });
    await expect(
      createOwnedScratchDir({
        shopId: "other",
        syncRunId: "run-2",
        scratchRoot: root,
        maxScratchAttempts: 1,
        reservedBytes: 1024,
        maxScratchBytes: 10_000,
      }),
    ).rejects.toMatchObject({ code: "scratch_resource_exhausted" });
    await disposeOwnedScratch(first, root);
  });

  it("does not count the namespace marker as leftover bytes after dispose", async () => {
    const root = scratchRoot();
    const handle = await createOwnedScratchDir({
      shopId: "shop",
      syncRunId: "run",
      scratchRoot: root,
      reservedBytes: 4096,
    });
    await disposeOwnedScratch(handle, root);
    const inspected = await inspectDScratchNamespace(root);
    expect(inspected.leftoverAttemptCount).toBe(0);
    expect(inspected.leftoverBytes).toBe(0);
  });

  it("live under-cap reservation does not require operator intervention", async () => {
    const root = scratchRoot();
    const live = await createOwnedScratchDir({
      shopId: "shop",
      syncRunId: "run",
      scratchRoot: root,
      maxScratchBytes: 1_000_000,
      reservedBytes: 4096,
    });
    const occupancy = await inspectDScratchOccupancy({
      scratchRoot: root,
      maxScratchBytes: 1_000_000,
    });
    expect(occupancy.operatorInterventionRequired).toBe(false);
    expect(occupancy.activeAttemptCount).toBe(1);
    expect(JSON.stringify(sanitizeDScratchOccupancy(occupancy))).not.toMatch(/shop|att-/);
    await disposeOwnedScratch(live, root);
  });

  it("two processes can both admit when combined reservations stay under the cap", async () => {
    const root = scratchRoot();
    mkdirSync(root, { recursive: true });
    const barrier = path.join(root, "go");
    const firstStatus = path.join(root, "one.json");
    const secondStatus = path.join(root, "two.json");
    const spawnQuota = (status: string, shop: string, run: string) =>
      spawn(TSX_BIN, [QUOTA_CHILD], {
        env: {
          ...process.env,
          PR6_D_QUOTA_STATUS_PATH: status,
          PR6_D_QUOTA_SCRATCH_ROOT: root,
          PR6_D_QUOTA_SHOP_ID: shop,
          PR6_D_QUOTA_RUN_ID: run,
          PR6_D_QUOTA_BARRIER_PATH: barrier,
          PR6_D_QUOTA_RESERVED_BYTES: "3000",
          PR6_D_QUOTA_MAX_BYTES: "10000",
        },
        stdio: ["ignore", "ignore", "pipe"],
      });
    const one = spawnQuota(firstStatus, "shop-a", "run-a");
    const two = spawnQuota(secondStatus, "shop-b", "run-b");
    await waitStatus(firstStatus, "ready");
    await waitStatus(secondStatus, "ready");
    writeFileSync(barrier, "go\n");
    const firstResult = await Promise.race([
      waitStatus(firstStatus, "admitted"),
      waitStatus(firstStatus, "rejected"),
    ]);
    const secondResult = await Promise.race([
      waitStatus(secondStatus, "admitted"),
      waitStatus(secondStatus, "rejected"),
    ]);
    expect([firstResult.stage, secondResult.stage].sort()).toEqual([
      "admitted",
      "admitted",
    ]);
    one.kill("SIGKILL");
    two.kill("SIGKILL");
  }, 30_000);
});

describe("PR6-D NEW-SCQ-01 reservation-evidence integrity", () => {
  const LIVE_RESERVED = 33_554_432;
  const LIVE_CAP = 41_943_040;

  async function spawnLiveReservation(root: string): Promise<{
    child: ReturnType<typeof spawn>;
    admitted: Record<string, unknown>;
  }> {
    mkdirSync(root, { recursive: true });
    const statusPath = path.join(root, "live.json");
    const child = spawn(TSX_BIN, [QUOTA_CHILD], {
      env: {
        ...process.env,
        PR6_D_QUOTA_STATUS_PATH: statusPath,
        PR6_D_QUOTA_SCRATCH_ROOT: root,
        PR6_D_QUOTA_SHOP_ID: "live-shop",
        PR6_D_QUOTA_RUN_ID: "live-run",
        PR6_D_QUOTA_RESERVED_BYTES: String(LIVE_RESERVED),
        PR6_D_QUOTA_MAX_BYTES: String(LIVE_CAP),
        PR6_D_QUOTA_HOLD_MS: "120000",
      },
      stdio: ["ignore", "ignore", "pipe"],
    });
    const admitted = await waitStatus(statusPath, "admitted");
    writeFileSync(
      path.join(String(admitted.dir), "partial.bin"),
      "x".repeat(4096),
    );
    return { child, admitted };
  }

  function ledgerPath(root: string): string {
    return path.join(root, ORDER_FACTS_SCRATCH_RESERVATION);
  }

  function damageLedger(
    root: string,
    mode: "corrupt" | "truncated" | "deleted" | "wrong_version",
  ): void {
    const dest = ledgerPath(root);
    const current = existsSync(dest) ? readFileSync(dest, "utf8") : "";
    if (mode === "corrupt") {
      writeFileSync(dest, "{not-json");
      return;
    }
    if (mode === "truncated") {
      writeFileSync(dest, current.slice(0, Math.max(1, Math.floor(current.length / 2))));
      return;
    }
    if (mode === "deleted") {
      unlinkSync(dest);
      return;
    }
    writeFileSync(
      dest,
      `${JSON.stringify({
        version: "order-facts-d-quota-v0",
        reservations: JSON.parse(current).reservations,
      })}\n`,
    );
  }

  for (const mode of ["corrupt", "truncated", "deleted", "wrong_version"] as const) {
    it(`refuses admission after ${mode} reservation evidence while a live child holds unused reservation`, async () => {
      const root = scratchRoot();
      const { child, admitted } = await spawnLiveReservation(root);
      try {
        const keep = path.join(String(admitted.dir), "partial.bin");
        const before = sha256(readFileSync(keep));
        expect(existsSync(keep)).toBe(true);
        damageLedger(root, mode);
        await expect(
          createOwnedScratchDir({
            shopId: "second",
            syncRunId: "second",
            scratchRoot: root,
            reservedBytes: LIVE_RESERVED,
            maxScratchBytes: LIVE_CAP,
          }),
        ).rejects.toMatchObject({ code: "scratch_resource_exhausted" });
        expect(existsSync(keep)).toBe(true);
        expect(sha256(readFileSync(keep))).toBe(before);
        expect(existsSync(String(admitted.dir))).toBe(true);
        const occupancy = sanitizeDScratchOccupancy(
          await inspectDScratchOccupancy({
            scratchRoot: root,
            maxScratchBytes: LIVE_CAP,
          }),
        );
        expect(occupancy.operatorInterventionRequired).toBe(true);
        expect(occupancy.ledgerIntegrity).not.toBe("ok");
        expect(JSON.stringify(occupancy)).not.toMatch(/live-shop|att-/);
      } finally {
        child.kill("SIGKILL");
      }
    }, 30_000);
  }

  it("refuses a partially invalid ledger instead of dropping the bad row", async () => {
    const root = scratchRoot();
    const first = await createOwnedScratchDir({
      shopId: "shop",
      syncRunId: "run",
      scratchRoot: root,
      reservedBytes: 3000,
      maxScratchBytes: 10_000,
    });
    const parsed = JSON.parse(readFileSync(ledgerPath(root), "utf8")) as {
      reservations: Record<string, unknown>;
    };
    parsed.reservations["att-bad"] = { reservedBytes: "no", createdAt: 1, pid: "x" };
    writeFileSync(
      ledgerPath(root),
      `${JSON.stringify({ version: ORDER_FACTS_SCRATCH_QUOTA_VERSION, reservations: parsed.reservations })}\n`,
    );
    await expect(
      createOwnedScratchDir({
        shopId: "other",
        syncRunId: "other",
        scratchRoot: root,
        reservedBytes: 3000,
        maxScratchBytes: 10_000,
      }),
    ).rejects.toMatchObject({ code: "scratch_resource_exhausted" });
    expect(existsSync(first.dir)).toBe(true);
    const occupancy = await inspectDScratchOccupancy({ scratchRoot: root });
    expect(occupancy.ledgerIntegrity).toBe("malformed_entry");
    await disposeOwnedScratch(first, root).catch(() => undefined);
  });

  it("treats a non-file reservation path as unreadable and does not admit", async () => {
    const root = scratchRoot();
    const first = await createOwnedScratchDir({
      shopId: "shop",
      syncRunId: "run",
      scratchRoot: root,
      reservedBytes: 3000,
      maxScratchBytes: 10_000,
    });
    unlinkSync(ledgerPath(root));
    mkdirSync(ledgerPath(root));
    await expect(
      createOwnedScratchDir({
        shopId: "other",
        syncRunId: "other",
        scratchRoot: root,
        reservedBytes: 3000,
        maxScratchBytes: 10_000,
      }),
    ).rejects.toMatchObject({ code: "scratch_resource_exhausted" });
    expect(
      (await inspectDScratchOccupancy({ scratchRoot: root })).ledgerIntegrity,
    ).toBe("unreadable");
    rmSync(ledgerPath(root), { recursive: true, force: true });
    await disposeOwnedScratch(first, root).catch(() => undefined);
  });

  it("initializes an empty ledger only on genuine first admission", async () => {
    const root = scratchRoot();
    expect(existsSync(ledgerPath(root))).toBe(false);
    const first = await createOwnedScratchDir({
      shopId: "shop",
      syncRunId: "run",
      scratchRoot: root,
      reservedBytes: 4096,
      maxScratchBytes: 10_000,
    });
    expect(existsSync(ledgerPath(root))).toBe(true);
    const parsed = JSON.parse(readFileSync(ledgerPath(root), "utf8")) as {
      version: string;
      reservations: Record<string, { reservedBytes: number }>;
    };
    expect(parsed.version).toBe(ORDER_FACTS_SCRATCH_QUOTA_VERSION);
    expect(Object.keys(parsed.reservations)).toHaveLength(1);
    await disposeOwnedScratch(first, root);
  });

  it("does not treat a missing ledger in an initialized namespace as first init", async () => {
    const root = scratchRoot();
    const first = await createOwnedScratchDir({
      shopId: "shop",
      syncRunId: "run",
      scratchRoot: root,
      reservedBytes: 4096,
      maxScratchBytes: 10_000,
    });
    await disposeOwnedScratch(first, root);
    unlinkSync(ledgerPath(root));
    await expect(
      createOwnedScratchDir({
        shopId: "next",
        syncRunId: "next",
        scratchRoot: root,
        reservedBytes: 4096,
        maxScratchBytes: 10_000,
      }),
    ).rejects.toMatchObject({ code: "scratch_resource_exhausted" });
    const occupancy = await inspectDScratchOccupancy({ scratchRoot: root });
    expect(occupancy.ledgerIntegrity).toBe("missing");
    await reinitializeDScratchReservationLedgerAfterQuiescence({
      scratchRoot: root,
      quiescenceConfirmed: true,
    });
    const restored = await createOwnedScratchDir({
      shopId: "next",
      syncRunId: "next",
      scratchRoot: root,
      reservedBytes: 4096,
      maxScratchBytes: 10_000,
    });
    await disposeOwnedScratch(restored, root);
  });

  it("failed persist during admission leaves the live child's reservation intact", async () => {
    const root = scratchRoot();
    const first = await createOwnedScratchDir({
      shopId: "shop",
      syncRunId: "run",
      scratchRoot: root,
      reservedBytes: 3000,
      maxScratchBytes: 10_000,
    });
    const before = readFileSync(ledgerPath(root), "utf8");
    process.env.PR6_D_QUOTA_FAIL_SAVE = "after-temp-write";
    try {
      await expect(
        createOwnedScratchDir({
          shopId: "other",
          syncRunId: "other",
          scratchRoot: root,
          reservedBytes: 3000,
          maxScratchBytes: 10_000,
        }),
      ).rejects.toThrow(/persist failure/);
    } finally {
      delete process.env.PR6_D_QUOTA_FAIL_SAVE;
    }
    expect(readFileSync(ledgerPath(root), "utf8")).toBe(before);
    expect(existsSync(first.dir)).toBe(true);
    await disposeOwnedScratch(first, root);
  });

  it("failed persist during release keeps capacity over-reserved after files are gone", async () => {
    const root = scratchRoot();
    const handle = await createOwnedScratchDir({
      shopId: "shop",
      syncRunId: "run",
      scratchRoot: root,
      reservedBytes: 3000,
      maxScratchBytes: 10_000,
    });
    const dir = handle.dir;
    process.env.PR6_D_QUOTA_FAIL_SAVE = "before-replace";
    try {
      await expect(disposeOwnedScratch(handle, root)).rejects.toThrow(/persist failure/);
    } finally {
      delete process.env.PR6_D_QUOTA_FAIL_SAVE;
    }
    expect(existsSync(dir)).toBe(false);
    const occupancy = await inspectDScratchOccupancy({
      scratchRoot: root,
      maxScratchBytes: 10_000,
    });
    expect(occupancy.reservedBytes).toBe(3000);
    expect(occupancy.unknownAttemptCount).toBeGreaterThan(0);
    await expect(
      createOwnedScratchDir({
        shopId: "next",
        syncRunId: "next",
        scratchRoot: root,
        reservedBytes: 3000,
        maxScratchBytes: 10_000,
      }),
    ).rejects.toMatchObject({ code: "scratch_resource_exhausted" });
  });

  it("process death during temp write is not an injected exception and blocks the next admission", async () => {
    const root = scratchRoot();
    mkdirSync(root, { recursive: true });
    const statusPath = path.join(root, "crash-temp.json");
    const child = spawn(TSX_BIN, [QUOTA_CHILD], {
      env: {
        ...process.env,
        PR6_D_QUOTA_STATUS_PATH: statusPath,
        PR6_D_QUOTA_SCRATCH_ROOT: root,
        PR6_D_QUOTA_SHOP_ID: "crash-temp",
        PR6_D_QUOTA_RUN_ID: "crash-temp",
        PR6_D_QUOTA_RESERVED_BYTES: "3000",
        PR6_D_QUOTA_MAX_BYTES: "10000",
        PR6_D_QUOTA_CRASH: "after-temp-write",
      },
      stdio: ["ignore", "ignore", "pipe"],
    });
    await new Promise<void>((resolve) => {
      child.once("exit", () => resolve());
    });
    await expect(
      createOwnedScratchDir({
        shopId: "next",
        syncRunId: "next",
        scratchRoot: root,
        reservedBytes: 3000,
        maxScratchBytes: 10_000,
      }),
    ).rejects.toMatchObject({ code: "scratch_resource_exhausted" });
    const occupancy = await inspectDScratchOccupancy({ scratchRoot: root });
    expect(occupancy.operatorInterventionRequired).toBe(true);
    await reclaimOperatorSelectedDScratch({
      scratchRoot: root,
      attemptBasenames: ["quota.lock"],
      quiescenceConfirmed: true,
    });
    const attempts = readdirSync(root).filter((name) => name.startsWith("att-"));
    expect(attempts.length).toBeGreaterThan(0);
    await expect(
      reinitializeDScratchReservationLedgerAfterQuiescence({
        scratchRoot: root,
        quiescenceConfirmed: true,
      }),
    ).rejects.toMatchObject({ code: "scratch_resource_exhausted" });
    await expect(
      createOwnedScratchDir({
        shopId: "next",
        syncRunId: "next",
        scratchRoot: root,
        reservedBytes: 3000,
        maxScratchBytes: 10_000,
      }),
    ).rejects.toMatchObject({ code: "scratch_resource_exhausted" });
  }, 30_000);

  const PERSIST_STAGES = [
    "after-temp-write",
    "after-temp-sync",
    "before-replace",
    "after-replace",
  ] as const;

  for (const stage of PERSIST_STAGES) {
    it(`injected persist exception at ${stage} is not process death and leaves the live ledger`, async () => {
      const root = scratchRoot();
      const first = await createOwnedScratchDir({
        shopId: "shop",
        syncRunId: "run",
        scratchRoot: root,
        reservedBytes: 3000,
        maxScratchBytes: 10_000,
      });
      const keep = path.join(first.dir, "keep.bin");
      writeFileSync(keep, "keep-bytes");
      const beforeHash = sha256(readFileSync(keep));
      const beforeLedger = readFileSync(ledgerPath(root), "utf8");
      process.env.PR6_D_QUOTA_FAIL_SAVE = stage;
      try {
        await expect(
          createOwnedScratchDir({
            shopId: "other",
            syncRunId: "other",
            scratchRoot: root,
            reservedBytes: 3000,
            maxScratchBytes: 10_000,
          }),
        ).rejects.toThrow(/persist failure/);
      } finally {
        delete process.env.PR6_D_QUOTA_FAIL_SAVE;
      }
      expect(existsSync(first.dir)).toBe(true);
      expect(sha256(readFileSync(keep))).toBe(beforeHash);
      if (stage === "after-replace") {
        const occupancy = await inspectDScratchOccupancy({
          scratchRoot: root,
          maxScratchBytes: 10_000,
        });
        expect(occupancy.unknownAttemptCount).toBeGreaterThan(0);
        expect(occupancy.operatorInterventionRequired).toBe(true);
        await expect(
          createOwnedScratchDir({
            shopId: "other",
            syncRunId: "other",
            scratchRoot: root,
            reservedBytes: 3000,
            maxScratchBytes: 10_000,
          }),
        ).rejects.toMatchObject({ code: "scratch_resource_exhausted" });
      } else {
        expect(readFileSync(ledgerPath(root), "utf8")).toBe(beforeLedger);
        const recovered = await createOwnedScratchDir({
          shopId: "other",
          syncRunId: "other",
          scratchRoot: root,
          reservedBytes: 3000,
          maxScratchBytes: 10_000,
        });
        await disposeOwnedScratch(recovered, root);
      }
      await disposeOwnedScratch(first, root).catch(() => undefined);
    });

    it(`SIGKILL at ${stage} is process death, not an injected exception, and blocks admission`, async () => {
      const root = scratchRoot();
      mkdirSync(root, { recursive: true });
      const statusPath = path.join(root, `crash-${stage}.json`);
      const child = spawn(TSX_BIN, [QUOTA_CHILD], {
        env: {
          ...process.env,
          PR6_D_QUOTA_STATUS_PATH: statusPath,
          PR6_D_QUOTA_SCRATCH_ROOT: root,
          PR6_D_QUOTA_SHOP_ID: `crash-${stage}`,
          PR6_D_QUOTA_RUN_ID: `crash-${stage}`,
          PR6_D_QUOTA_RESERVED_BYTES: "3000",
          PR6_D_QUOTA_MAX_BYTES: "10000",
          PR6_D_QUOTA_CRASH: stage,
        },
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stderr = "";
      child.stderr?.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf8");
      });
      const exitCode = await new Promise<number | null>((resolve) => {
        child.once("exit", (code) => resolve(code));
      });
      expect(exitCode).not.toBe(0);
      expect(stderr).not.toMatch(/persist failure/);
      await expect(
        createOwnedScratchDir({
          shopId: "next",
          syncRunId: "next",
          scratchRoot: root,
          reservedBytes: 3000,
          maxScratchBytes: 10_000,
        }),
      ).rejects.toMatchObject({ code: "scratch_resource_exhausted" });
      const lockPath = path.join(root, ORDER_FACTS_SCRATCH_QUOTA_LOCK);
      expect(existsSync(lockPath)).toBe(true);
      await reclaimOperatorSelectedDScratch({
        scratchRoot: root,
        attemptBasenames: [ORDER_FACTS_SCRATCH_QUOTA_LOCK],
        quiescenceConfirmed: true,
      });
      expect(existsSync(lockPath)).toBe(false);
      const leftoverAttempts = readdirSync(root).filter((name) =>
        name.startsWith("att-"),
      );
      expect(leftoverAttempts.length).toBeGreaterThan(0);
      if (stage === "after-replace") {
        await expect(
          createOwnedScratchDir({
            shopId: "next",
            syncRunId: "next",
            scratchRoot: root,
            reservedBytes: 8000,
            maxScratchBytes: 10_000,
          }),
        ).rejects.toMatchObject({ code: "scratch_resource_exhausted" });
      } else {
        await expect(
          createOwnedScratchDir({
            shopId: "next",
            syncRunId: "next",
            scratchRoot: root,
            reservedBytes: 3000,
            maxScratchBytes: 10_000,
          }),
        ).rejects.toMatchObject({ code: "scratch_resource_exhausted" });
      }
      expect(
        leftoverAttempts.every((name) => existsSync(path.join(root, name))),
      ).toBe(true);
    }, 30_000);
  }

  it("does not steal a leftover quota.lock during admission", async () => {
    const root = scratchRoot();
    const first = await createOwnedScratchDir({
      shopId: "shop",
      syncRunId: "run",
      scratchRoot: root,
      reservedBytes: 3000,
      maxScratchBytes: 10_000,
    });
    await disposeOwnedScratch(first, root);
    const lockPath = path.join(root, ORDER_FACTS_SCRATCH_QUOTA_LOCK);
    mkdirSync(lockPath);
    await expect(
      createOwnedScratchDir({
        shopId: "next",
        syncRunId: "next",
        scratchRoot: root,
        reservedBytes: 3000,
        maxScratchBytes: 10_000,
      }),
    ).rejects.toMatchObject({ code: "scratch_resource_exhausted" });
    expect(existsSync(lockPath)).toBe(true);
    await reclaimOperatorSelectedDScratch({
      scratchRoot: root,
      attemptBasenames: [ORDER_FACTS_SCRATCH_QUOTA_LOCK],
      quiescenceConfirmed: true,
    });
    const restored = await createOwnedScratchDir({
      shopId: "next",
      syncRunId: "next",
      scratchRoot: root,
      reservedBytes: 3000,
      maxScratchBytes: 10_000,
    });
    await disposeOwnedScratch(restored, root);
  });

  it("refuses admission while orphan reservation temp metadata remains", async () => {
    const root = scratchRoot();
    const first = await createOwnedScratchDir({
      shopId: "shop",
      syncRunId: "run",
      scratchRoot: root,
      reservedBytes: 3000,
      maxScratchBytes: 10_000,
    });
    await disposeOwnedScratch(first, root);
    const tmp = path.join(root, `${ORDER_FACTS_SCRATCH_RESERVATION_TMP_PREFIX}1.deadbeef`);
    writeFileSync(tmp, "{not-a-live-ledger}\n");
    const before = sha256(readFileSync(tmp));
    await expect(
      createOwnedScratchDir({
        shopId: "next",
        syncRunId: "next",
        scratchRoot: root,
        reservedBytes: 3000,
        maxScratchBytes: 10_000,
      }),
    ).rejects.toMatchObject({ code: "scratch_resource_exhausted" });
    expect(existsSync(tmp)).toBe(true);
    expect(sha256(readFileSync(tmp))).toBe(before);
    const occupancy = sanitizeDScratchOccupancy(
      await inspectDScratchOccupancy({ scratchRoot: root, maxScratchBytes: 10_000 }),
    );
    expect(occupancy.orphanMetadataPresent).toBe(true);
    expect(occupancy.operatorInterventionRequired).toBe(true);
    expect(JSON.stringify(occupancy)).not.toMatch(/shop|att-/);
  });
});
