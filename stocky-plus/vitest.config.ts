import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["app/**/*.test.ts"],
    // Tenant-access PostgreSQL integration tests run under vitest.tenant-access.config.ts
    exclude: ["app/tenant/**/*.test.ts", "**/node_modules/**"],
  },
});
