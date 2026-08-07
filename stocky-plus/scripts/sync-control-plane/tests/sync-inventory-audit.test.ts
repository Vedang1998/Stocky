/**
 * F-PR4-07 focused inventory audit gate (npm run test:sync-inventory-audit).
 * Must collect nonzero tests — do not leave as an empty re-export.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { SYNC_SURFACES } from "../manifest";

const APP_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

describe("test:sync-inventory-audit", () => {
  it("inventory check passes on clean tree", () => {
    execFileSync("npx", ["tsx", "scripts/sync-control-plane/inventory.ts"], {
      cwd: APP_ROOT,
      stdio: "pipe",
    });
    execFileSync(
      "npx",
      ["tsx", "scripts/sync-control-plane/inventory-check.ts"],
      {
        cwd: APP_ROOT,
        stdio: "pipe",
      },
    );
  });

  it("detects planted direct Queue constructor outside allowlist", () => {
    const planted = path.join(APP_ROOT, "app/sync/__planted_queue_shadow__.ts");
    fs.writeFileSync(
      planted,
      `import { Queue } from "bullmq";\nexport const q = new Queue("evil");\n`,
    );
    try {
      expect(() =>
        execFileSync(
          "npx",
          ["tsx", "scripts/sync-control-plane/inventory-check.ts"],
          {
            cwd: APP_ROOT,
            stdio: "pipe",
          },
        ),
      ).toThrow();
    } finally {
      fs.unlinkSync(planted);
    }
  });

  it("detects planted aliased control-plane client import", () => {
    const planted = path.join(
      APP_ROOT,
      "app/sync/__planted_cp_alias__.ts",
    );
    fs.writeFileSync(
      planted,
      `import { getControlPlanePrisma as cp } from "./control-plane-db.server";\nexport const evil = cp;\n`,
    );
    try {
      expect(() =>
        execFileSync(
          "npx",
          ["tsx", "scripts/sync-control-plane/inventory-check.ts"],
          {
            cwd: APP_ROOT,
            stdio: "pipe",
          },
        ),
      ).toThrow();
    } finally {
      fs.unlinkSync(planted);
    }
  });

  it("JobDispatch is inventoried", () => {
    expect(SYNC_SURFACES.some((s) => s.id === "table:JobDispatch")).toBe(true);
  });

  it("SyncApplicationReceipt is inventoried as merchant-domain", () => {
    expect(
      SYNC_SURFACES.some((s) => s.id === "table:SyncApplicationReceipt"),
    ).toBe(true);
  });
});
