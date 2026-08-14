import { defineConfig } from "vitest/config";
import failOnZeroPassedNameFilter from "./scripts/vitest/fail-on-zero-passed-name-filter";

/**
 * Isolated config for skip/todo name-filter probes (P3-D047-R10).
 * Not included in the release `test:migrations` suite.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["scripts/vitest/migrations-name-filter-probes.test.ts"],
    testTimeout: 30_000,
    reporters: ["default", failOnZeroPassedNameFilter()],
  },
});
