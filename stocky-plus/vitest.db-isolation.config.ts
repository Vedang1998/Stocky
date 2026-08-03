import { defineConfig } from "vitest/config";

// Test-only fixture defaults — never production secrets.
const TEST_ENVELOPE_SECRET =
  process.env.TENANT_JOB_ENVELOPE_SECRET ??
  "test-only-tenant-job-envelope-secret-32b!!"; // pragma: allowlist secret

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "app/tenant/__tests__/db-isolation/**/*.test.ts",
    ],
    testTimeout: 180_000,
    hookTimeout: 180_000,
    fileParallelism: false,
    env: {
      TENANT_JOB_ENVELOPE_SECRET: TEST_ENVELOPE_SECRET,
      REDIS_URL: process.env.REDIS_URL ?? "redis://127.0.0.1:6379", // pragma: allowlist secret
      STOCKY_REQUIRE_RUNTIME_DB_URL: "1",
      FEATURE_STOCKTAKE_INVENTORY_WRITES: "false",
      FEATURE_ADJUSTMENT_WRITES: "false",
      FEATURE_RECEIPT_WRITES: "false",
      FEATURE_COST_SYNC: "false",
      FEATURE_TRANSFER_WRITES: "false",
    },
  },
});
