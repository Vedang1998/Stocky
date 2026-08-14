import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["app/**/*.test.ts"],
    // Tenant-access PostgreSQL integration tests run under vitest.tenant-access.config.ts
    // Sync control-plane integration tests run under vitest.sync-integration.config.ts
    // (fileParallelism: false — must not share disposable DB with default unit suite).
    exclude: [
      "app/tenant/**/*.test.ts",
      "app/sync/__tests__/**/*.test.ts",
      "**/node_modules/**",
    ],
  },
});
