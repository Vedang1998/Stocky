import { mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { OrderFactsJsonlError } from "./errors";
import { createOwnedScratchDir, disposeOwnedScratch } from "./source-stage";

describe("PR6-D source staging ownership", () => {
  it("refuses a symlink scratch directory", async () => {
    const root = path.join(
      os.tmpdir(),
      `stocky-pr6-d-symlink-${process.pid}-${Date.now()}`,
    );
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
    const outside = path.join(os.tmpdir(), `not-stocky-${process.pid}`);
    mkdirSync(outside, { recursive: true });
    writeFileSync(path.join(outside, "keep.txt"), "no");
    await expect(disposeOwnedScratch(outside)).rejects.toBeInstanceOf(
      OrderFactsJsonlError,
    );
  });
});
