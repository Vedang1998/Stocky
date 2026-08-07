import { defineConfig } from "vitest/config";

/** Focused reporter unit tests (P3-D047-R11). */
export default defineConfig({
  test: {
    environment: "node",
    include: ["scripts/vitest/fail-on-zero-passed-name-filter.test.ts"],
    testTimeout: 30_000,
  },
});
