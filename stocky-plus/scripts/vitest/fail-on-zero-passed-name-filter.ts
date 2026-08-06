/**
 * Fail closed when a Vitest name filter (`-t` / testNamePattern) matches
 * zero passing tests. Vitest otherwise exits 0 with all tests skipped
 * (P3-D046-01 / P3-NEW-D047-01). Wired into sync-integration and migrations
 * configs; activates only when a testNamePattern is present.
 */
import type { File, Reporter, Task, Vitest } from "vitest";

function countPassed(tasks: Task[]): number {
  let n = 0;
  for (const task of tasks) {
    if (task.type === "test") {
      if (task.result?.state === "pass") n += 1;
      continue;
    }
    if (task.type === "suite") {
      n += countPassed(task.tasks);
    }
  }
  return n;
}

export default function failOnZeroPassedNameFilter(): Reporter {
  let vitest: Vitest | undefined;

  return {
    onInit(ctx) {
      vitest = ctx;
    },
    onFinished(files: File[] = []) {
      const pattern = vitest?.config.testNamePattern;
      if (!pattern) return;

      const passed = files.reduce(
        (acc, file) => acc + countPassed(file.tasks ?? []),
        0,
      );
      if (passed > 0) return;

      const label =
        pattern instanceof RegExp ? pattern.toString() : String(pattern);
      // eslint-disable-next-line no-console
      console.error(
        `[ci-guard] testNamePattern ${label} matched zero passing tests — refusing vacuous success (P3-D046-01)`,
      );
      process.exitCode = 1;
    },
  };
}
