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
      // D-048 claim-index concurrent rollout tests
      "scripts/sync-control-plane/tests/claim-indexes*.test.ts",
      // Reporter unit regression (P3-D047-R11) — no skip/todo probes here
      "scripts/vitest/fail-on-zero-passed-name-filter.test.ts",
    ],
    // Probes live in vitest.migrations-name-filter-probes.config.ts (P3-D047-R10).
    testTimeout: 180_000,
    hookTimeout: 180_000,
    fileParallelism: false,
    // P3-NEW-D047-01: -t filters that match nothing must not exit 0.
    reporters: ["default", failOnZeroPassedNameFilter()],
  },
});
