import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "scripts/tenant-backfill/tests/**/*.test.ts",
      "scripts/tenant-indexes/tests/**/*.test.ts",
      // PR3 correction adversarial suites + original migration tests
      "scripts/tenant-enforcement/tests/**/*.test.ts",
    ],
    testTimeout: 180_000,
    hookTimeout: 180_000,
    fileParallelism: false,
  },
});
