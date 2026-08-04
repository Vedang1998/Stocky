import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "app/sync/__tests__/**/*.test.ts",
      "scripts/sync-control-plane/tests/**/*.test.ts",
    ],
    testTimeout: 120_000,
    hookTimeout: 120_000,
    fileParallelism: false,
  },
});
