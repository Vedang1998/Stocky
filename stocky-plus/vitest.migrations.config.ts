import { defineConfig } from "vitest/config";
import failOnZeroPassedNameFilter from "./scripts/vitest/fail-on-zero-passed-name-filter";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "scripts/tenant-backfill/tests/**/*.test.ts",
      "scripts/tenant-indexes/tests/**/*.test.ts",
      // PR3 correction adversarial suites + original migration tests
      "scripts/tenant-enforcement/tests/**/*.test.ts",
      // P3-NEW-D047-01 skip/todo name-filter probes
      "scripts/vitest/migrations-name-filter-probes.test.ts",
    ],
    testTimeout: 180_000,
    hookTimeout: 180_000,
    fileParallelism: false,
    // P3-NEW-D047-01: -t filters that match nothing must not exit 0.
    reporters: ["default", failOnZeroPassedNameFilter()],
  },
});
