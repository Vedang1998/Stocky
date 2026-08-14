import { defineConfig } from "vitest/config";
import failOnZeroPassedNameFilter from "./scripts/vitest/fail-on-zero-passed-name-filter";

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
    // P3-D046-01: -t filters that match nothing must not exit 0.
    reporters: ["default", failOnZeroPassedNameFilter()],
  },
});
