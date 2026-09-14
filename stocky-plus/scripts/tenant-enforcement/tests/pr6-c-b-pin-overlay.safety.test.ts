/**
 * PR6-C B-reader overlay isolation: never delete/replace tracked B files.
 *
 * C-only scenarios use an isolated git fixture with no tracked admin-read.
 * Tracked-B scenarios use a separate committed fixture with a non-empty inventory.
 * Neither scenario is derived from the live checkout accidentally lacking B.
 */
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { B_TYPED_READ_CONTRACT_PIN } from "./pr6-c-b-compat-mapper";
import {
  ACCEPTED_B_ADMIN_READ_TREE,
  TRACKED_ADMIN_READ_PREFIX,
  TrackedAdminReadPresentError,
  UnownedAdminReadPathError,
  archiveAcceptedBAdminRead,
  captureAdminReadWorkingTree,
  defaultPinOverlayEnv,
  ensureGitCommit,
  ensurePinnedBCommit,
  gitCommitAvailable,
  listGitWorktreePaths,
  listTrackedAdminReadPaths,
  materializePinnedBAdminReadOverlay,
  prepareBAdminReadForCTests,
  productionAdminReadExists,
  removePinnedBAdminReadOverlay,
  type AdminReadWorkingTreeEvidence,
  type PinOverlayEnv,
} from "./pr6-c-b-pin-overlay";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../..",
);

const scratchRoots: string[] = [];
const disposableGitRoots: string[] = [];

afterEach(() => {
  for (const root of scratchRoots.splice(0)) {
    try {
      removePinnedBAdminReadOverlay(root);
    } catch {
      // already gone or unowned
    }
  }
  for (const root of disposableGitRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
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
  git(["init", "-b", "main"], root);
  git(["config", "user.email", "pr6-c-overlay@example.test"], root);
  git(["config", "user.name", "pr6-c-overlay"], root);
  return root;
}

function isolatedCOnlyEnv(): PinOverlayEnv {
  const root = initTempRepo();
  git(["commit", "--allow-empty", "-m", "c-only no admin-read"], root);
  return {
    repoRoot: root,
    productionAdminReadDir: path.join(root, TRACKED_ADMIN_READ_PREFIX),
  };
}

function isolatedTrackedBEnv(): PinOverlayEnv {
  const root = initTempRepo();
  const archive = archiveAcceptedBAdminRead();
  execFileSync("tar", ["-x"], {
    cwd: root,
    input: archive,
    maxBuffer: 32 * 1024 * 1024,
  });
  git(["add", TRACKED_ADMIN_READ_PREFIX], root);
  git(["commit", "-m", "tracked B admin-read"], root);
  return {
    repoRoot: root,
    productionAdminReadDir: path.join(root, TRACKED_ADMIN_READ_PREFIX),
  };
}

/** Depth-1 clone of current HEAD only. Does not contain unrelated B SHAs. */
function isolatedShallowCCheckout(): string {
  const root = mkdtempSync(path.join(os.tmpdir(), "pr6-c-shallow-c-"));
  disposableGitRoots.push(root);
  git(["init", "-b", "main"], root);
  git(["remote", "add", "origin", REPO_ROOT], root);
  git(["fetch", "--depth=1", "origin", "HEAD"], root);
  return root;
}

function listOwnedScratchDirs(): string[] {
  return readdirSync(os.tmpdir())
    .filter((name) => name.startsWith("pr6-c-owned-b-pin-"))
    .map((name) => path.join(os.tmpdir(), name));
}

function expectWorkingTreeUnchanged(
  before: AdminReadWorkingTreeEvidence,
  env: PinOverlayEnv,
): void {
  const after = captureAdminReadWorkingTree(env);
  expect(after.paths).toEqual(before.paths);
  expect(after.indexStage).toBe(before.indexStage);
  expect(after.indexBlobs).toEqual(before.indexBlobs);
  expect(after.diskHashes).toEqual(before.diskHashes);
  expect(after.status).toBe(before.status);
  expect(after.diff).toBe(before.diff);
  expect(after.cachedDiff).toBe(before.cachedDiff);
}

describe("PR6-C B-reader overlay isolation", () => {
  it("C-only isolated fixture has no tracked B reader and pins into owned scratch", () => {
    const env = isolatedCOnlyEnv();
    const before = captureAdminReadWorkingTree(env);
    expect(before.paths).toEqual([]);
    expect(before.indexBlobs).toEqual({});
    expect(before.diskHashes).toEqual({});
    expect(productionAdminReadExists(env)).toBe(false);
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
    expectWorkingTreeUnchanged(before, env);
  });

  it("repeated pinned materialize on a C-only fixture stays on owned scratch", () => {
    const env = isolatedCOnlyEnv();
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

  it("isolated tracked-B fixture is used in place with non-empty on-disk preservation", () => {
    const env = isolatedTrackedBEnv();
    const before = captureAdminReadWorkingTree(env);
    expect(before.paths.length).toBeGreaterThan(0);
    expect(Object.keys(before.indexBlobs).length).toBe(before.paths.length);
    expect(Object.keys(before.diskHashes).length).toBe(before.paths.length);
    expect(before.diskHashes).toEqual(before.indexBlobs);
    expect(before.status).toBe("");
    expect(before.diff).toBe("");
    expect(before.cachedDiff).toBe("");
    expect(productionAdminReadExists(env)).toBe(true);
    const ordersPath = path.join(env.productionAdminReadDir, "orders.ts");
    expect(existsSync(ordersPath)).toBe(true);
    expect(() => materializePinnedBAdminReadOverlay(env)).toThrow(
      TrackedAdminReadPresentError,
    );
    expectWorkingTreeUnchanged(before, env);
    const prepared = prepareBAdminReadForCTests(env);
    expect(prepared.mode).toBe("integrated");
    expect(prepared.dir).toBe(env.productionAdminReadDir);
    expect(prepared.scratchRoot).toBeUndefined();
    expect(existsSync(path.join(prepared.dir, "orders.ts"))).toBe(true);
    removePinnedBAdminReadOverlay(prepared.scratchRoot);
    expectWorkingTreeUnchanged(before, env);
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

  it("partial setup failure after the owned worktree exists cleans only that scratch", () => {
    const env = isolatedCOnlyEnv();
    const before = captureAdminReadWorkingTree(env);
    const unowned = mkdtempSync(path.join(os.tmpdir(), "pr6-c-unowned-keep-"));
    const unownedFile = path.join(unowned, "keep.txt");
    writeFileSync(unownedFile, "pre-existing-unowned");
    const beforeWorktrees = new Set(listGitWorktreePaths());
    const beforeScratch = new Set(listOwnedScratchDirs());
    let created: string | undefined;
    expect(() =>
      materializePinnedBAdminReadOverlay(env, {
        afterScratchCreated: (scratchRoot) => {
          created = scratchRoot;
          expect(existsSync(scratchRoot)).toBe(true);
          expect(existsSync(path.join(scratchRoot, ".pr6-c-owned-scratch"))).toBe(
            true,
          );
          const listed = listGitWorktreePaths().map((p) => path.resolve(p));
          expect(listed).toContain(path.resolve(scratchRoot));
          throw new Error("induced partial setup failure");
        },
      }),
    ).toThrow(/induced partial setup failure/);
    expect(created).toBeTruthy();
    expect(existsSync(created as string)).toBe(false);
    const afterWorktrees = listGitWorktreePaths().map((p) => path.resolve(p));
    expect(afterWorktrees).not.toContain(path.resolve(created as string));
    for (const listed of afterWorktrees) {
      if (!beforeWorktrees.has(listed)) {
        throw new Error(`orphaned worktree left behind: ${listed}`);
      }
    }
    const createdScratch = listOwnedScratchDirs().filter(
      (dir) => !beforeScratch.has(dir),
    );
    expect(createdScratch).toEqual([]);
    expect(readFileSync(unownedFile, "utf8")).toBe("pre-existing-unowned");
    expect(existsSync(env.productionAdminReadDir)).toBe(false);
    expectWorkingTreeUnchanged(before, env);
  });

  it("cleanup refuses foreign and planted-marker paths after a real C-only setup", () => {
    const env = isolatedCOnlyEnv();
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

  it("live checkout prepare/cleanup preserves working-tree inventory in either mode", () => {
    const env = defaultPinOverlayEnv();
    const before = captureAdminReadWorkingTree(env);
    const beforeRepoStatus = git(["status", "--porcelain"], REPO_ROOT).toString();
    const source = prepareBAdminReadForCTests(env);
    if (source.scratchRoot) scratchRoots.push(source.scratchRoot);
    if (before.paths.length === 0) {
      expect(source.mode).toBe("pinned-scratch");
      expect(source.scratchRoot).toBeTruthy();
      expect(productionAdminReadExists(env)).toBe(false);
      expect(before.indexBlobs).toEqual({});
      expect(before.diskHashes).toEqual({});
    } else {
      expect(source.mode).toBe("integrated");
      expect(source.dir).toBe(env.productionAdminReadDir);
      expect(source.scratchRoot).toBeUndefined();
      expect(productionAdminReadExists(env)).toBe(true);
      expect(Object.keys(before.diskHashes).length).toBe(before.paths.length);
      expect(before.diskHashes).toEqual(before.indexBlobs);
    }
    removePinnedBAdminReadOverlay(source.scratchRoot);
    expectWorkingTreeUnchanged(before, env);
    expect(git(["status", "--porcelain"], REPO_ROOT).toString()).toBe(
      beforeRepoStatus,
    );
    const second = prepareBAdminReadForCTests(env);
    if (second.scratchRoot) scratchRoots.push(second.scratchRoot);
    expect(second.mode).toBe(source.mode);
    removePinnedBAdminReadOverlay(second.scratchRoot);
    expectWorkingTreeUnchanged(before, env);
  });

  it("C-only absence empty map is valid only on an isolated fixture without B", () => {
    const env = isolatedCOnlyEnv();
    expect(listTrackedAdminReadPaths(env)).toEqual([]);
    expect(captureAdminReadWorkingTree(env).diskHashes).toEqual({});
    expect(productionAdminReadExists(env)).toBe(false);
  });

  it("tracked-B fixture empty map is rejected; inventory is non-empty", () => {
    const env = isolatedTrackedBEnv();
    const evidence = captureAdminReadWorkingTree(env);
    expect(evidence.paths.length).toBeGreaterThan(0);
    expect(Object.keys(evidence.diskHashes).length).toBeGreaterThan(0);
    expect(evidence.indexBlobs).not.toEqual({});
    expect(productionAdminReadExists(env)).toBe(true);
  });

  it("accepted B archive fails closed when the object is absent from a shallow C checkout", () => {
    expect(ACCEPTED_B_ADMIN_READ_TREE).toBe(
      "7338aaa45294c28526330aa259779308bd6d851e",
    );
    expect(ACCEPTED_B_ADMIN_READ_TREE).not.toBe(B_TYPED_READ_CONTRACT_PIN);
    const shallow = isolatedShallowCCheckout();
    expect(gitCommitAvailable(ACCEPTED_B_ADMIN_READ_TREE, shallow)).toBe(false);
    expect(() =>
      git(
        ["archive", ACCEPTED_B_ADMIN_READ_TREE, TRACKED_ADMIN_READ_PREFIX],
        shallow,
      ),
    ).toThrow(/not a tree object/);
  });

  it("pin fetch is not a substitute for the accepted B SHA", () => {
    const shallow = isolatedShallowCCheckout();
    ensurePinnedBCommit(shallow);
    expect(gitCommitAvailable(B_TYPED_READ_CONTRACT_PIN, shallow)).toBe(true);
    expect(gitCommitAvailable(ACCEPTED_B_ADMIN_READ_TREE, shallow)).toBe(false);
    expect(() =>
      git(
        ["archive", ACCEPTED_B_ADMIN_READ_TREE, TRACKED_ADMIN_READ_PREFIX],
        shallow,
      ),
    ).toThrow(/not a tree object/);
  });

  it("ensureGitCommit then archive of accepted B yields a non-empty tree", () => {
    const shallow = isolatedShallowCCheckout();
    const archive = archiveAcceptedBAdminRead(shallow);
    expect(gitCommitAvailable(ACCEPTED_B_ADMIN_READ_TREE, shallow)).toBe(true);
    expect(
      git(["rev-parse", ACCEPTED_B_ADMIN_READ_TREE], shallow).toString().trim(),
    ).toBe(ACCEPTED_B_ADMIN_READ_TREE);
    expect(archive.length).toBeGreaterThan(0);
    const listing = execFileSync("tar", ["-t"], {
      input: archive,
      maxBuffer: 32 * 1024 * 1024,
    })
      .toString()
      .split("\n")
      .filter(Boolean);
    expect(listing.length).toBeGreaterThan(0);
    expect(
      listing.some((entry) => entry.endsWith("admin-read/orders.ts")),
    ).toBe(true);
  });

  it("ensureGitCommit rejects an unknown SHA without substituting an empty archive", () => {
    const shallow = isolatedShallowCCheckout();
    const unknown = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    expect(() => ensureGitCommit(unknown, shallow)).toThrow(
      /Unable to materialize git commit/,
    );
    expect(gitCommitAvailable(unknown, shallow)).toBe(false);
    expect(gitCommitAvailable(ACCEPTED_B_ADMIN_READ_TREE, shallow)).toBe(false);
  });
});
