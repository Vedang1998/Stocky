/**
 * Materialize / remove the pinned B admin-read tree for C overlay tests.
 * Files are never committed. Callers must remove owned scratch before inventory.
 *
 * Never deletes or replaces a tracked B `admin-read` directory. Pinned-reader
 * tests use an owned disposable scratch location under os.tmpdir().
 * Integrated-reader tests use the actual tracked files.
 */
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { B_TYPED_READ_CONTRACT_PIN } from "./pr6-c-b-compat-mapper";

const APP_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const REPO_ROOT = path.resolve(APP_ROOT, "..");
const TRACKED_ADMIN_READ_PREFIX = "stocky-plus/app/lib/order-facts/admin-read";
const OWNED_MARKER_NAME = ".pr6-c-owned-scratch";
const OWNED_SCRATCH_PREFIX = "pr6-c-owned-b-pin-";

export const B_ADMIN_READ_PRODUCTION_DIR = path.join(
  APP_ROOT,
  "app/lib/order-facts/admin-read",
);

/** @deprecated Use B_ADMIN_READ_PRODUCTION_DIR. Never a delete target. */
export const B_ADMIN_READ_OVERLAY_DIR = B_ADMIN_READ_PRODUCTION_DIR;

/** Git blobs of B production readers / test transport at pin 610ed050. */
export const PINNED_B_READER_BLOBS = {
  "stocky-plus/app/lib/order-facts/admin-read/orders.ts":
    "b5ce0d53cf29c8b370065330f1a3e84c55c7096d",
  "stocky-plus/app/lib/order-facts/admin-read/refunds.ts":
    "5324d33205f490a1a4c76d6b1011e0bef2e429f7",
  "stocky-plus/app/lib/order-facts/admin-read/index.ts":
    "85fc132817166b48771376ec3ae1b1b23758cc2c",
  "stocky-plus/app/lib/order-facts/admin-read/__tests__/fixtures.ts":
    "5981aef29f2d423a5907b8970d5684bf6878738b",
  "stocky-plus/app/lib/order-facts/admin-read/__tests__/order-store-admin.ts":
    "34a778f251ecaa3f6acc29498afd549791bef28a",
  "stocky-plus/app/lib/order-facts/admin-read/__tests__/mock-admin.ts":
    "34671adf9fdab380ac1bfb9d115cd90c8e82d6d5",
} as const;

export type PinOverlayEnv = {
  repoRoot: string;
  productionAdminReadDir: string;
};

export type BAdminReadSource = {
  mode: "integrated" | "pinned-scratch";
  dir: string;
  scratchRoot?: string;
};

export class UnownedAdminReadPathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnownedAdminReadPathError";
  }
}

export class TrackedAdminReadPresentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TrackedAdminReadPresentError";
  }
}

let defaultScratchRoot: string | undefined;

export function defaultPinOverlayEnv(): PinOverlayEnv {
  return {
    repoRoot: REPO_ROOT,
    productionAdminReadDir: B_ADMIN_READ_PRODUCTION_DIR,
  };
}

function git(args: string[], cwd: string): Buffer {
  return execFileSync("git", args, {
    cwd,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    maxBuffer: 32 * 1024 * 1024,
  });
}

export function readPinnedBBlob(repoPath: string): string {
  ensurePinnedBCommit();
  return git(["rev-parse", `${B_TYPED_READ_CONTRACT_PIN}:${repoPath}`], REPO_ROOT)
    .toString()
    .trim();
}

function pinAvailable(): boolean {
  try {
    git(["cat-file", "-t", B_TYPED_READ_CONTRACT_PIN], REPO_ROOT);
    return true;
  } catch {
    return false;
  }
}

export function ensurePinnedBCommit(): void {
  if (pinAvailable()) return;
  const fetchAttempts = [
    ["fetch", "--no-tags", "--depth=1", "origin", B_TYPED_READ_CONTRACT_PIN],
    [
      "fetch",
      "--no-tags",
      "--depth=1",
      "origin",
      `${B_TYPED_READ_CONTRACT_PIN}:refs/tmp/pr6-c-b-pin`,
    ],
    ["fetch", "--no-tags", "--depth=1", "origin", "pull/39/head"],
    [
      "fetch",
      "--no-tags",
      "origin",
      "phase-1/pr6-b-order-admin-read:refs/tmp/pr6-c-b-branch",
    ],
  ];
  let lastError: unknown;
  for (const args of fetchAttempts) {
    try {
      git(args, REPO_ROOT);
      if (pinAvailable()) return;
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(
    `Unable to materialize pinned B commit ${B_TYPED_READ_CONTRACT_PIN}: ${String(lastError)}`,
  );
}

export function listTrackedAdminReadPaths(env: PinOverlayEnv): string[] {
  const out = git(
    ["ls-files", "-z", "--", TRACKED_ADMIN_READ_PREFIX],
    env.repoRoot,
  )
    .toString()
    .split("\0")
    .filter(Boolean);
  return out;
}

export function listTrackedAdminReadBlobs(
  env: PinOverlayEnv,
): Record<string, string> {
  const blobs: Record<string, string> = {};
  for (const repoPath of listTrackedAdminReadPaths(env)) {
    blobs[repoPath] = git(["rev-parse", `HEAD:${repoPath}`], env.repoRoot)
      .toString()
      .trim();
  }
  return blobs;
}

export function listTrackedAdminReadStage(
  env: PinOverlayEnv,
): string {
  return git(
    ["ls-files", "-s", "--", TRACKED_ADMIN_READ_PREFIX],
    env.repoRoot,
  ).toString();
}

function assertPathNotSymlink(target: string, stopAt: string): void {
  let current = path.resolve(target);
  const root = path.resolve(stopAt);
  for (let remaining = 64; remaining > 0; remaining -= 1) {
    if (existsSync(current)) {
      const st = lstatSync(current);
      if (st.isSymbolicLink()) {
        throw new UnownedAdminReadPathError(
          `refusing symlink at ${current} while resolving ${target}`,
        );
      }
    }
    if (current === root) return;
    const parent = path.dirname(current);
    if (parent === current) return;
    current = parent;
  }
  throw new UnownedAdminReadPathError(
    `refusing unresolved path walk from ${target} toward ${stopAt}`,
  );
}

function isUnderDir(candidate: string, parent: string): boolean {
  const resolved = path.resolve(candidate);
  const root = path.resolve(parent);
  return resolved === root || resolved.startsWith(`${root}${path.sep}`);
}

function isDefaultProductionEnv(env: PinOverlayEnv): boolean {
  return (
    path.resolve(env.repoRoot) === path.resolve(REPO_ROOT) &&
    path.resolve(env.productionAdminReadDir) ===
      path.resolve(B_ADMIN_READ_PRODUCTION_DIR)
  );
}

export function assertAdminReadOwnership(env: PinOverlayEnv): void {
  assertPathNotSymlink(env.productionAdminReadDir, env.repoRoot);
  const tracked = listTrackedAdminReadPaths(env);
  if (tracked.length > 0) {
    if (!existsSync(env.productionAdminReadDir)) {
      throw new Error(
        `tracked admin-read paths exist but directory is missing: ${env.productionAdminReadDir}`,
      );
    }
    const st = lstatSync(env.productionAdminReadDir);
    if (st.isSymbolicLink() || !st.isDirectory()) {
      throw new UnownedAdminReadPathError(
        `tracked admin-read path is not a real directory: ${env.productionAdminReadDir}`,
      );
    }
    return;
  }
  if (existsSync(env.productionAdminReadDir)) {
    throw new UnownedAdminReadPathError(
      `pre-existing untracked admin-read at ${env.productionAdminReadDir} is not an owned C scratch; fail closed`,
    );
  }
}

function removeTestFiles(dir: string): void {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    if (entry === OWNED_MARKER_NAME) continue;
    const full = path.join(dir, entry);
    const stat = lstatSync(full);
    if (stat.isSymbolicLink()) {
      throw new UnownedAdminReadPathError(
        `refusing symlink inside owned scratch at ${full}`,
      );
    }
    if (stat.isDirectory()) {
      removeTestFiles(full);
      continue;
    }
    if (entry.endsWith(".test.ts")) {
      rmSync(full);
    }
  }
}

function writeOwnedMarker(scratchRoot: string): void {
  writeFileSync(
    path.join(scratchRoot, OWNED_MARKER_NAME),
    JSON.stringify({
      owner: "pr6-c-b-pin-overlay",
      pin: B_TYPED_READ_CONTRACT_PIN,
      pid: process.pid,
    }),
    "utf8",
  );
}

function isOwnedScratch(scratchRoot: string): boolean {
  const marker = path.join(scratchRoot, OWNED_MARKER_NAME);
  if (!existsSync(marker)) return false;
  try {
    const parsed = JSON.parse(readFileSync(marker, "utf8")) as {
      owner?: string;
    };
    return parsed.owner === "pr6-c-b-pin-overlay";
  } catch {
    return false;
  }
}

function isCOwnedScratchLocation(scratchRoot: string): boolean {
  const resolved = path.resolve(scratchRoot);
  const tmp = path.resolve(os.tmpdir());
  const name = path.basename(resolved);
  return (
    isUnderDir(resolved, tmp) &&
    name.startsWith(OWNED_SCRATCH_PREFIX) &&
    isOwnedScratch(scratchRoot)
  );
}

function forceRemoveCreatedScratch(scratchRoot: string): void {
  const resolved = path.resolve(scratchRoot);
  try {
    git(["worktree", "remove", "--force", resolved], REPO_ROOT);
  } catch {
    if (existsSync(resolved)) {
      rmSync(resolved, { recursive: true, force: true });
    }
    try {
      git(["worktree", "prune"], REPO_ROOT);
    } catch {
      // prune is best-effort after a failed worktree remove
    }
  }
}

function removeOwnedScratch(scratchRoot: string | undefined): void {
  if (!scratchRoot) return;
  if (!existsSync(scratchRoot)) return;
  const resolved = path.resolve(scratchRoot);
  if (isUnderDir(resolved, APP_ROOT) || isUnderDir(resolved, REPO_ROOT)) {
    throw new UnownedAdminReadPathError(
      `refusing to delete application or repository path ${scratchRoot}`,
    );
  }
  if (!isCOwnedScratchLocation(scratchRoot)) {
    throw new UnownedAdminReadPathError(
      `refusing to delete unowned path ${scratchRoot}`,
    );
  }
  try {
    git(["worktree", "remove", "--force", resolved], REPO_ROOT);
  } catch {
    rmSync(resolved, { recursive: true, force: false });
    try {
      git(["worktree", "prune"], REPO_ROOT);
    } catch {
      // prune is best-effort
    }
  }
}

/**
 * Materialize the pinned B tree into an owned disposable git worktree.
 * Relative B imports (tenant primitives, A types) resolve inside that worktree.
 * Throws if the env already has tracked B files (use those instead).
 */
export function materializePinnedBAdminReadOverlay(
  env: PinOverlayEnv = defaultPinOverlayEnv(),
): BAdminReadSource {
  ensurePinnedBCommit();
  assertAdminReadOwnership(env);
  const tracked = listTrackedAdminReadPaths(env);
  if (tracked.length > 0) {
    throw new TrackedAdminReadPresentError(
      `tracked B admin-read is present (${tracked.length} paths); will not overlay or delete ${env.productionAdminReadDir}`,
    );
  }
  const scratchRoot = path.join(
    os.tmpdir(),
    `${OWNED_SCRATCH_PREFIX}${process.pid}-${randomBytes(6).toString("hex")}`,
  );
  if (existsSync(scratchRoot)) {
    throw new Error(`owned scratch path already exists: ${scratchRoot}`);
  }
  try {
    git(
      ["worktree", "add", "--detach", scratchRoot, B_TYPED_READ_CONTRACT_PIN],
      REPO_ROOT,
    );
    writeOwnedMarker(scratchRoot);
    const dir = path.join(scratchRoot, TRACKED_ADMIN_READ_PREFIX);
    if (!existsSync(dir)) {
      throw new Error(
        `worktree of ${B_TYPED_READ_CONTRACT_PIN} did not create ${dir}`,
      );
    }
    removeTestFiles(dir);
    if (isDefaultProductionEnv(env)) {
      defaultScratchRoot = scratchRoot;
    }
    return { mode: "pinned-scratch", dir, scratchRoot };
  } catch (error) {
    forceRemoveCreatedScratch(scratchRoot);
    throw error;
  }
}

export function prepareBAdminReadForCTests(
  env: PinOverlayEnv = defaultPinOverlayEnv(),
): BAdminReadSource {
  assertAdminReadOwnership(env);
  const tracked = listTrackedAdminReadPaths(env);
  if (tracked.length > 0) {
    return {
      mode: "integrated",
      dir: env.productionAdminReadDir,
    };
  }
  return materializePinnedBAdminReadOverlay(env);
}

export function removePinnedBAdminReadOverlay(
  scratchRoot: string | undefined = defaultScratchRoot,
): void {
  if (!scratchRoot) {
    if (defaultScratchRoot) {
      removeOwnedScratch(defaultScratchRoot);
      defaultScratchRoot = undefined;
    }
    return;
  }
  removeOwnedScratch(scratchRoot);
  if (scratchRoot === defaultScratchRoot) defaultScratchRoot = undefined;
}

export function overlayPresent(): boolean {
  return Boolean(defaultScratchRoot && existsSync(defaultScratchRoot));
}

export function productionAdminReadExists(
  env: PinOverlayEnv = defaultPinOverlayEnv(),
): boolean {
  return existsSync(env.productionAdminReadDir);
}
