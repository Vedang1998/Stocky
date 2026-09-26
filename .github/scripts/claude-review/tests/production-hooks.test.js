import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { assertNoProductionTestHooks, resolveProofMutation } from "../lib/production-hooks.js";
import { dockerNetworkCreateArgs } from "../lib/isolated-executor.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DISPATCH_BIN = path.resolve(HERE, "../bin/dispatch.mjs");

describe("production test hooks", () => {
  it("rejects mock GitHub and proof mutation environment on the production CLI", () => {
    assert.equal(assertNoProductionTestHooks({}).ok, true);
    const mock = assertNoProductionTestHooks({
      STOCKY_REVIEW_MOCK_GITHUB_URL: "http://127.0.0.1:9",
    });
    assert.equal(mock.ok, false);
    assert.equal(mock.code, "production_test_hook_denied");
    const proof = assertNoProductionTestHooks({ STOCKY_ISOLATION_PROOF: "1" });
    assert.equal(proof.ok, false);

    const spawned = spawnSync(process.execPath, [DISPATCH_BIN, "--phase", "validate"], {
      encoding: "utf8",
      env: {
        PATH: process.env.PATH,
        STOCKY_REVIEW_MOCK_GITHUB_URL: "http://127.0.0.1:9",
        GITHUB_TOKEN: "must-not-be-used",
      },
    });
    assert.equal(spawned.status, 2);
    assert.match(spawned.stderr, /production_test_hook_denied/);
  });

  it("ambient proof env cannot mutate production docker network args", () => {
    process.env.STOCKY_ISOLATION_PROOF = "1";
    process.env.STOCKY_ISOLATION_PROOF_MUTATION = "omit-gateway-isolated";
    try {
      assert.equal(resolveProofMutation({}).length, 0);
      const prod = dockerNetworkCreateArgs("srprod");
      assert.equal(prod.includes("--internal"), true);
      const mutated = dockerNetworkCreateArgs("srmut", {
        allowProofHooks: true,
        proofMutation: "omit-gateway-isolated",
      });
      assert.equal(mutated.includes("--internal"), false);
    } finally {
      delete process.env.STOCKY_ISOLATION_PROOF;
      delete process.env.STOCKY_ISOLATION_PROOF_MUTATION;
    }
  });
});
