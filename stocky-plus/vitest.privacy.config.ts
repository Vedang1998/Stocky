import { defineConfig } from "vitest/config";
import type { File, Reporter, Task } from "vitest";
import failOnZeroPassedNameFilter from "./scripts/vitest/fail-on-zero-passed-name-filter";

function countCollected(tasks: Task[] = []): number {
  let n = 0;
  for (const task of tasks) {
    if (task.type === "test") {
      n += 1;
      continue;
    }
    if (task.type === "suite") {
      n += countCollected(task.tasks);
    }
  }
  return n;
}

function failOnZeroCollected(): Reporter {
  return {
    onFinished(files: File[] = []) {
      const collected = files.reduce(
        (acc, file) => acc + countCollected(file.tasks ?? []),
        0,
      );
      if (collected > 0) return;
      // eslint-disable-next-line no-console
      console.error(
        "[ci-guard] test:privacy collected zero tests — refusing vacuous success",
      );
      process.exitCode = 1;
    },
  };
}

export default defineConfig({
  test: {
    environment: "node",
    include: ["app/rbac/**/*.test.ts"],
    exclude: ["**/node_modules/**"],
    passWithNoTests: false,
    setupFiles: ["app/rbac/__tests__/setup-fetch-mock.ts"],
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    reporters: ["default", failOnZeroPassedNameFilter(), failOnZeroCollected()],
    env: {
      SHOPIFY_API_KEY: "pr7-a-test-api-key",
      SHOPIFY_API_SECRET: "pr7-a-test-api-secret",
      SHOPIFY_APP_URL: "https://example.com",
    },
  },
});
