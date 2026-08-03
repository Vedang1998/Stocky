import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "scripts/tenant-backfill/tests/**/*.test.ts",
      "scripts/tenant-indexes/tests/**/*.test.ts",
      "scripts/tenant-enforcement/tests/**/*.migration.test.ts",
    ],
    testTimeout: 180_000,
    hookTimeout: 180_000,
    fileParallelism: false,
  },
});
