/**
 * PR6-C B-reader overlay isolation: never delete/replace tracked B files.
 */
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { B_TYPED_READ_CONTRACT_PIN } from "./pr6-c-b-compat-mapper";
import {
  TrackedAdminReadPresentError,
  UnownedAdminReadPathError,
  defaultPinOverlayEnv,
  listTrackedAdminReadBlobs,
  listTrackedAdminReadPaths,
  listTrackedAdminReadStage,
  materializePinnedBAdminReadOverlay,
  prepareBAdminReadForCTests,
  productionAdminReadExists,
  removePinnedBAdminReadOverlay,
  type PinOverlayEnv,
} from "./pr6-c-b-pin-overlay";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../..",
);

const scratchRoots: string[] = [];

afterEach(() => {
  for (const root of scratchRoots.splice(0)) {
    try {
      removePinnedBAdminReadOverlay(root);
    } catch {
      // already gone or unowned
    }
  }
});

function git(args: string[], cwd: string): Buffer {
  return execFileSync("git", args, {
    cwd,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    maxBuffer: 32 * 1024 * 1024,
  });
}

function initTempRepo(): string {
  const root = mkdtempSync(path.join(os.tmpdir(), "pr6-c-overlay-repo-"));
  git(["init"], root);
  git(["config", "user.email", "pr6-c-overlay@example.test"], root);
  git(["config", "user.name", "pr6-c-overlay"], root);
  return root;
}

function commitTrackedAdminRead(root: string): PinOverlayEnv {
  const archive = git(
    ["archive", B_TYPED_READ_CONTRACT_PIN, "stocky-plus/app/lib/order-facts/admin-read"],
    REPO_ROOT,
  );
  execFileSync("tar", ["-x"], { cwd: root, input: archive, maxBuffer: 32 * 1024 * 1024 });
  git(["add", "stocky-plus/app/lib/order-facts/admin-read"], root);
  git(["commit", "-m", "tracked B admin-read"], root);
  return {
    repoRoot: root,
    productionAdminReadDir: path.join(
      root,
      "stocky-plus/app/lib/order-facts/admin-read",
    ),
  };
}

function listOwnedScratchDirs(): string[] {
  return readdirSync(os.tmpdir())
    .filter((name) => name.startsWith("pr6-c-owned-b-pin-"))
    .map((name) => path.join(os.tmpdir(), name));
}

function hashObject(filePath: string, cwd: string): string {
  return git(["hash-object", filePath], cwd).toString().trim();
}

describe("PR6-C B-reader overlay isolation", () => {
  it("C-only pinned-reader uses owned scratch and never creates production admin-read", () => {
    const env: PinOverlayEnv = {
      repoRoot: REPO_ROOT,
      productionAdminReadDir: path.join(
        mkdtempSync(path.join(os.tmpdir(), "pr6-c-prod-absent-")),
        "admin-read",
      ),
    };
    expect(listTrackedAdminReadPaths(env).length).toBe(0);
    const source = prepareBAdminReadForCTests(env);
    if (source.scratchRoot) scratchRoots.push(source.scratchRoot);
    expect(source.mode).toBe("pinned-scratch");
    expect(source.dir.startsWith(os.tmpdir() + path.sep)).toBe(true);
    expect(existsSync(source.dir)).toBe(true);
    expect(existsSync(path.join(source.dir, "orders.ts"))).toBe(true);
    expect(existsSync(env.productionAdminReadDir)).toBe(false);
    removePinnedBAdminReadOverlay(source.scratchRoot);
    expect(existsSync(source.dir)).toBe(false);
    expect(existsSync(env.productionAdminReadDir)).toBe(false);
  });

  it("repeated pinned materialize stays on owned scratch", () => {
    const env: PinOverlayEnv = {
      repoRoot: REPO_ROOT,
      productionAdminReadDir: path.join(
        mkdtempSync(path.join(os.tmpdir(), "pr6-c-prod-repeat-")),
        "admin-read",
      ),
    };
    const first = materializePinnedBAdminReadOverlay(env);
    if (first.scratchRoot) scratchRoots.push(first.scratchRoot);
    const firstOrders = readFileSync(path.join(first.dir, "orders.ts"), "utf8");
    const second = materializePinnedBAdminReadOverlay(env);
    if (second.scratchRoot) scratchRoots.push(second.scratchRoot);
    expect(second.mode).toBe("pinned-scratch");
    expect(second.scratchRoot).not.toBe(first.scratchRoot);
    expect(existsSync(first.dir)).toBe(true);
    expect(readFileSync(path.join(second.dir, "orders.ts"), "utf8")).toBe(
      firstOrders,
    );
    expect(existsSync(env.productionAdminReadDir)).toBe(false);
    removePinnedBAdminReadOverlay(first.scratchRoot);
    removePinnedBAdminReadOverlay(second.scratchRoot);
    expect(existsSync(first.dir)).toBe(false);
    expect(existsSync(second.dir)).toBe(false);
  });

  it("existing tracked B reader is used in place and blobs are preserved", () => {
    const root = initTempRepo();
    const env = commitTrackedAdminRead(root);
    const beforeBlobs = listTrackedAdminReadBlobs(env);
    const beforeStage = listTrackedAdminReadStage(env);
    const beforeStatus = git(["status", "--porcelain"], root).toString();
    const ordersPath = path.join(env.productionAdminReadDir, "orders.ts");
    const beforeHash = hashObject(ordersPath, root);
    expect(Object.keys(beforeBlobs).length).toBeGreaterThan(0);
    expect(() => materializePinnedBAdminReadOverlay(env)).toThrow(
      TrackedAdminReadPresentError,
    );
    const prepared = prepareBAdminReadForCTests(env);
    expect(prepared.mode).toBe("integrated");
    expect(prepared.dir).toBe(env.productionAdminReadDir);
    expect(prepared.scratchRoot).toBeUndefined();
    expect(existsSync(path.join(prepared.dir, "orders.ts"))).toBe(true);
    removePinnedBAdminReadOverlay(prepared.scratchRoot);
    expect(listTrackedAdminReadBlobs(env)).toEqual(beforeBlobs);
    expect(listTrackedAdminReadStage(env)).toBe(beforeStage);
    expect(git(["status", "--porcelain"], root).toString()).toBe(beforeStatus);
    expect(hashObject(ordersPath, root)).toBe(beforeHash);
    expect(productionAdminReadExists(env)).toBe(true);
  });

  it("pre-existing unowned production path fails closed and is not deleted", () => {
    const root = initTempRepo();
    git(["commit", "--allow-empty", "-m", "empty"], root);
    const production = path.join(
      root,
      "stocky-plus/app/lib/order-facts/admin-read",
    );
    mkdirSync(production, { recursive: true });
    const sentinel = path.join(production, "unowned.txt");
    writeFileSync(sentinel, "do-not-delete");
    const env: PinOverlayEnv = { repoRoot: root, productionAdminReadDir: production };
    const beforeScratch = new Set(listOwnedScratchDirs());
    expect(() => prepareBAdminReadForCTests(env)).toThrow(
      UnownedAdminReadPathError,
    );
    expect(readFileSync(sentinel, "utf8")).toBe("do-not-delete");
    expect(existsSync(production)).toBe(true);
    const created = listOwnedScratchDirs().filter((dir) => !beforeScratch.has(dir));
    expect(created).toEqual([]);
  });

  it("refuses a symlink production path and does not follow it", () => {
    const root = initTempRepo();
    git(["commit", "--allow-empty", "-m", "empty"], root);
    const real = mkdtempSync(path.join(os.tmpdir(), "pr6-c-symlink-target-"));
    writeFileSync(path.join(real, "orders.ts"), "not-owned");
    const production = path.join(
      root,
      "stocky-plus/app/lib/order-facts/admin-read",
    );
    mkdirSync(path.dirname(production), { recursive: true });
    symlinkSync(real, production);
    const env: PinOverlayEnv = { repoRoot: root, productionAdminReadDir: production };
    expect(() => prepareBAdminReadForCTests(env)).toThrow(
      UnownedAdminReadPathError,
    );
    expect(readFileSync(path.join(real, "orders.ts"), "utf8")).toBe("not-owned");
  });

  it("cleanup after setup failure does not touch production or unowned paths", () => {
    const env: PinOverlayEnv = {
      repoRoot: REPO_ROOT,
      productionAdminReadDir: path.join(
        mkdtempSync(path.join(os.tmpdir(), "pr6-c-prod-fail-")),
        "admin-read",
      ),
    };
    const source = materializePinnedBAdminReadOverlay(env);
    expect(source.scratchRoot).toBeTruthy();
    const foreign = mkdtempSync(path.join(os.tmpdir(), "pr6-c-foreign-"));
    writeFileSync(path.join(foreign, "keep.txt"), "keep");
    expect(() => removePinnedBAdminReadOverlay(foreign)).toThrow(
      UnownedAdminReadPathError,
    );
    expect(readFileSync(path.join(foreign, "keep.txt"), "utf8")).toBe("keep");
    expect(existsSync(env.productionAdminReadDir)).toBe(false);
    const markedForeign = mkdtempSync(path.join(os.tmpdir(), "pr6-c-marked-"));
    writeFileSync(
      path.join(markedForeign, ".pr6-c-owned-scratch"),
      JSON.stringify({ owner: "pr6-c-b-pin-overlay" }),
    );
    writeFileSync(path.join(markedForeign, "keep.txt"), "keep-marked");
    expect(() => removePinnedBAdminReadOverlay(markedForeign)).toThrow(
      UnownedAdminReadPathError,
    );
    expect(readFileSync(path.join(markedForeign, "keep.txt"), "utf8")).toBe(
      "keep-marked",
    );
    removePinnedBAdminReadOverlay(source.scratchRoot);
    expect(existsSync(source.dir)).toBe(false);
  });

  it("refuses to delete a repository path even when a marker is planted", () => {
    const planted = path.join(REPO_ROOT, "stocky-plus/app/lib/order-facts");
    expect(() => removePinnedBAdminReadOverlay(planted)).toThrow(
      UnownedAdminReadPathError,
    );
    expect(existsSync(planted)).toBe(true);
  });

  it("live C-only prepare/cleanup preserves tracked tree and does not create production admin-read", () => {
    const env = defaultPinOverlayEnv();
    const beforeBlobs = listTrackedAdminReadBlobs(env);
    const beforeStage = listTrackedAdminReadStage(env);
    const beforeLs = git(
      ["ls-files", "--", "stocky-plus/app/lib/order-facts/admin-read"],
      REPO_ROOT,
    ).toString();
    expect(beforeBlobs).toEqual({});
    expect(beforeStage).toBe("");
    expect(productionAdminReadExists(env)).toBe(false);
    const first = prepareBAdminReadForCTests(env);
    if (first.scratchRoot) scratchRoots.push(first.scratchRoot);
    expect(first.mode).toBe("pinned-scratch");
    expect(existsSync(first.dir)).toBe(true);
    expect(productionAdminReadExists(env)).toBe(false);
    removePinnedBAdminReadOverlay(first.scratchRoot);
    const second = prepareBAdminReadForCTests(env);
    if (second.scratchRoot) scratchRoots.push(second.scratchRoot);
    expect(second.mode).toBe("pinned-scratch");
    removePinnedBAdminReadOverlay(second.scratchRoot);
    expect(listTrackedAdminReadBlobs(env)).toEqual(beforeBlobs);
    expect(listTrackedAdminReadStage(env)).toBe(beforeStage);
    expect(
      git(
        ["ls-files", "--", "stocky-plus/app/lib/order-facts/admin-read"],
        REPO_ROOT,
      ).toString(),
    ).toBe(beforeLs);
    expect(productionAdminReadExists(env)).toBe(false);
  });

  it("C tree currently has no tracked admin-read and production path is absent", () => {
    const env = defaultPinOverlayEnv();
    expect(listTrackedAdminReadPaths(env)).toEqual([]);
    expect(listTrackedAdminReadBlobs(env)).toEqual({});
    expect(productionAdminReadExists(env)).toBe(false);
  });
});
