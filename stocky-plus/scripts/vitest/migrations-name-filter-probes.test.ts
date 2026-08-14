/**
 * Disposable probes for P3-NEW-D047-01: name-filter must fail closed when the
 * only matches are skip or todo (zero passed). Not part of product coverage.
 */
import { describe, it } from "vitest";

describe("P3-NEW-D047-01 migrations name-filter probes", () => {
  it.skip("skip-only probe — must not vacuous-pass under -t", () => {
    // intentionally skipped
  });

  it.todo("todo-only probe — must not vacuous-pass under -t");
});
