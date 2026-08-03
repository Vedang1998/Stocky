import { defineConfig } from "vitest/config";

const TEST_ENVELOPE_SECRET =
  process.env.TENANT_JOB_ENVELOPE_SECRET ??
  "test-only-tenant-job-envelope-secret-32b!!";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "app/tenant/**/*.test.ts",
      "scripts/tenant-access/**/*.test.ts",
    ],
    testTimeout: 120_000,
    hookTimeout: 120_000,
    fileParallelism: false,
    env: {
      TENANT_JOB_ENVELOPE_SECRET: TEST_ENVELOPE_SECRET,
      REDIS_URL: process.env.REDIS_URL ?? "redis://localhost:6379",
      FEATURE_STOCKTAKE_INVENTORY_WRITES: "false",
      FEATURE_ADJUSTMENT_WRITES: "false",
      FEATURE_RECEIPT_WRITES: "false",
      FEATURE_COST_SYNC: "false",
      FEATURE_TRANSFER_WRITES: "false",
    },
  },
});
