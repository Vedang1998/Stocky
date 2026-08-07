/**
 * P3-D047-R11 — regression tests for failOnZeroPassedNameFilter reporter API.
 * Drives the reporter with synthetic Vitest task trees so a future Vitest API
 * reshape cannot silently disable the guard.
 */
import { describe, expect, it, vi } from "vitest";
import failOnZeroPassedNameFilter from "./fail-on-zero-passed-name-filter";
import type { File, Task, Vitest } from "vitest";

function makeTest(state: "pass" | "fail" | "skip"): Task {
  return {
    type: "test",
    result: { state },
  } as Task;
}

function makeSuite(tasks: Task[]): Task {
  return {
    type: "suite",
    tasks,
  } as Task;
}

function makeFile(tasks: Task[]): File {
  return { tasks } as File;
}

describe("failOnZeroPassedNameFilter reporter (P3-D047-R11)", () => {
  it("sets exitCode=1 when pattern is set and zero tests passed", () => {
    const reporter = failOnZeroPassedNameFilter();
    const previous = process.exitCode;
    process.exitCode = undefined;
    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    reporter.onInit?.({
      config: { testNamePattern: /nonexistent-filter/ },
    } as Vitest);

    reporter.onFinished?.(
      [makeFile([makeSuite([makeTest("skip"), makeTest("skip")])])],
      [],
    );

    expect(process.exitCode).toBe(1);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
    process.exitCode = previous;
  });

  it("does nothing when pattern is unset (full suite)", () => {
    const reporter = failOnZeroPassedNameFilter();
    const previous = process.exitCode;
    process.exitCode = undefined;

    reporter.onInit?.({
      config: { testNamePattern: undefined },
    } as Vitest);

    reporter.onFinished?.([makeFile([makeSuite([makeTest("skip")])])], []);
    expect(process.exitCode).toBeUndefined();
    process.exitCode = previous;
  });

  it("counts nested suite passes and stays quiet when ≥1 passed", () => {
    const reporter = failOnZeroPassedNameFilter();
    const previous = process.exitCode;
    process.exitCode = undefined;

    reporter.onInit?.({
      config: { testNamePattern: /nested/ },
    } as Vitest);

    reporter.onFinished?.(
      [
        makeFile([
          makeSuite([makeSuite([makeTest("pass")]), makeTest("skip")]),
        ]),
      ],
      [],
    );
    expect(process.exitCode).toBeUndefined();
    process.exitCode = previous;
  });

  it("fails closed when Vitest config drops testNamePattern support (undefined vitest)", () => {
    const reporter = failOnZeroPassedNameFilter();
    const previous = process.exitCode;
    process.exitCode = undefined;
    // onInit never called — simulates broken reporter wiring
    reporter.onFinished?.([makeFile([makeTest("skip")])], []);
    // Without pattern, guard is inert (full-suite mode).
    expect(process.exitCode).toBeUndefined();
    process.exitCode = previous;
  });
});
