import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { featureFlags } from "../feature-flags.server";
import { ORDER_CANONICAL_LOCK_VERSION, ORDER_OBSERVATION_GEN_SEQ } from "./constants";

const DIR = path.dirname(fileURLToPath(import.meta.url));

describe("PR6-A order-facts foundation safety", () => {
  it("does not change inventory-write or absence-tombstone defaults", () => {
    expect(featureFlags.stocktakeInventoryWrites()).toBe(false);
    expect(featureFlags.adjustmentWrites()).toBe(false);
    expect(featureFlags.receiptWrites()).toBe(false);
    expect(featureFlags.costSync()).toBe(false);
    expect(featureFlags.transferWrites()).toBe(false);
    expect(featureFlags.pr5AbsenceTombstone()).toBe(false);
  });

  it("does not introduce parseFloat / Number money helpers", () => {
    const files = readdirSync(DIR).filter(
      (name) => name.endsWith(".ts") && !name.endsWith(".test.ts"),
    );
    expect(files.length).toBeGreaterThan(0);
    for (const name of files) {
      const text = readFileSync(path.join(DIR, name), "utf8");
      expect(text, name).not.toMatch(/\bparseFloat\s*\(/);
      expect(text, name).not.toMatch(/\bNumber\s*\(\s*amount/);
    }
  });

  it("uses the frozen PR6 lock version and platform observation sequence", () => {
    expect(ORDER_CANONICAL_LOCK_VERSION).toBe("stocky-pr6-canonical-lock-v1");
    expect(ORDER_OBSERVATION_GEN_SEQ).toBe("stocky_catalog_observation_gen_seq");
    const constants = readFileSync(path.join(DIR, "constants.ts"), "utf8");
    expect(constants).not.toMatch(/CREATE SEQUENCE/);
    expect(constants).not.toMatch(/catalogObservationGen/);
  });

  it("does not import Prisma or GraphQL-generated types in the A modules", () => {
    for (const name of [
      "constants.ts",
      "lock-key.ts",
      "advisory-lock.ts",
      "types.ts",
    ]) {
      const text = readFileSync(path.join(DIR, name), "utf8");
      expect(text, name).not.toMatch(/from ["']@prisma\/client["']/);
      expect(text, name).not.toMatch(/app\/types/);
    }
  });
});
