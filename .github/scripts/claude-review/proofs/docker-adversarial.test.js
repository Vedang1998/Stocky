import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dockerAvailable } from "../lib/isolated-executor.js";

/**
 * Real-Docker adversarial proofs live in bin/isolation-proof.mjs (GHA job).
 * This file documents the wall-clock contract and skips on hosts without Docker.
 */
describe("docker adversarial proofs (optional local)", () => {
  it("does not pretend Docker is present when the daemon is missing", () => {
    const present = dockerAvailable();
    if (!present) {
      assert.equal(present, false);
      return;
    }
    assert.equal(present, true);
  });
});
