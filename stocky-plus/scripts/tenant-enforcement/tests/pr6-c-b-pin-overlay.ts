/**
 * Materialize / remove the pinned B admin-read tree for C overlay tests.
 * Files are never committed. Callers must remove the overlay before inventory.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { B_TYPED_READ_CONTRACT_PIN } from "./pr6-c-b-compat-mapper";

const APP_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const REPO_ROOT = path.resolve(APP_ROOT, "..");
export const B_ADMIN_READ_OVERLAY_DIR = path.join(
  APP_ROOT,
  "app/lib/order-facts/admin-read",
);

function git(args: string[]): Buffer {
  return execFileSync("git", args, {
    cwd: REPO_ROOT,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    maxBuffer: 32 * 1024 * 1024,
  });
}

function pinAvailable(): boolean {
  try {
    git(["cat-file", "-t", B_TYPED_READ_CONTRACT_PIN]);
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
      git(args);
      if (pinAvailable()) return;
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(
    `Unable to materialize pinned B commit ${B_TYPED_READ_CONTRACT_PIN}: ${String(lastError)}`,
  );
}

function removeTestFiles(dir: string): void {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      removeTestFiles(full);
      continue;
    }
    if (entry.endsWith(".test.ts")) {
      rmSync(full);
    }
  }
}

export function materializePinnedBAdminReadOverlay(): string {
  ensurePinnedBCommit();
  rmSync(B_ADMIN_READ_OVERLAY_DIR, { recursive: true, force: true });
  const archive = git([
    "archive",
    B_TYPED_READ_CONTRACT_PIN,
    "stocky-plus/app/lib/order-facts/admin-read",
  ]);
  execFileSync("tar", ["-x"], {
    cwd: REPO_ROOT,
    input: archive,
    maxBuffer: 32 * 1024 * 1024,
  });
  if (!existsSync(B_ADMIN_READ_OVERLAY_DIR)) {
    throw new Error(
      `git archive of ${B_TYPED_READ_CONTRACT_PIN} did not create ${B_ADMIN_READ_OVERLAY_DIR}`,
    );
  }
  removeTestFiles(B_ADMIN_READ_OVERLAY_DIR);
  return B_ADMIN_READ_OVERLAY_DIR;
}

export function removePinnedBAdminReadOverlay(): void {
  rmSync(B_ADMIN_READ_OVERLAY_DIR, { recursive: true, force: true });
}

export function overlayPresent(): boolean {
  return existsSync(B_ADMIN_READ_OVERLAY_DIR);
}
