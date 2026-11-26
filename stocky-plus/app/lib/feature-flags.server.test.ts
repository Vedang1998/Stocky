import { afterEach, describe, expect, it, vi } from "vitest";

import {
  assertInventoryWriteEnabled,
  isInventoryWriteEnabled,
  type InventoryWriteCapability,
} from "./feature-flags.server";

const SWITCHES: Array<{ capability: InventoryWriteCapability; env: string }> = [
  {
    capability: "stocktakeInventoryWrites",
    env: "FEATURE_STOCKTAKE_INVENTORY_WRITES",
  },
  { capability: "adjustmentWrites", env: "FEATURE_ADJUSTMENT_WRITES" },
  { capability: "receiptWrites", env: "FEATURE_RECEIPT_WRITES" },
  { capability: "costSync", env: "FEATURE_COST_SYNC" },
  { capability: "transferWrites", env: "FEATURE_TRANSFER_WRITES" },
];

describe("Inventory-write switches", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it.each(SWITCHES)(
    "refuses $capability while its switch is off, in words that fit an app-wide switch",
    ({ capability, env }) => {
      vi.stubEnv(env, "");
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

      expect(isInventoryWriteEnabled(capability)).toBe(false);
      let message = "";
      try {
        assertInventoryWriteEnabled(capability);
      } catch (error) {
        message = (error as Error).message;
      }

      // The merchant reads this. The switch is the app's, so the message
      // must not suggest it is a setting of their store, or name the switch.
      expect(message).toMatch(/ is switched off in this app for now\.$/);
      expect(message).not.toMatch(/store/i);
      expect(message).not.toContain(env);
      // The switch name is for whoever reads the server log.
      expect(warn).toHaveBeenCalledWith(expect.stringContaining(env));
    },
  );

  it.each(SWITCHES)(
    "lets $capability through when its switch is on",
    ({ capability, env }) => {
      vi.stubEnv(env, "true");

      expect(isInventoryWriteEnabled(capability)).toBe(true);
      expect(() => assertInventoryWriteEnabled(capability)).not.toThrow();
    },
  );

  it("reads anything but an explicit yes as off", () => {
    for (const value of ["0", "false", "off", "enabled", " true"]) {
      vi.stubEnv("FEATURE_TRANSFER_WRITES", value);
      expect(isInventoryWriteEnabled("transferWrites")).toBe(false);
    }
  });
});
