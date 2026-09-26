import { resultErr, resultOk } from "./util.js";

export const PRODUCTION_TEST_HOOK_KEYS = Object.freeze([
  "STOCKY_REVIEW_MOCK_GITHUB_URL",
  "STOCKY_ISOLATION_PROOF",
  "STOCKY_ISOLATION_PROOF_MUTATION",
  "STOCKY_REVIEW_ALLOW_PROOF_HOOKS",
]);

/**
 * Production CLI/workflow entry points must not treat ambient env as a
 * mock-GitHub or isolation-proof authority switch.
 */
export function assertNoProductionTestHooks(env = process.env) {
  const hits = PRODUCTION_TEST_HOOK_KEYS.filter((key) => {
    const v = env?.[key];
    return v != null && String(v) !== "";
  });
  if (hits.length) {
    return resultErr(
      "production_test_hook_denied",
      "production entry rejects mock/proof environment hooks",
      { hits },
    );
  }
  return resultOk({});
}

/**
 * Mutations are explicit DI only. An ambient STOCKY_ISOLATION_PROOF=1
 * variable is never production authority.
 */
export function resolveProofMutation(options = {}) {
  if (options.allowProofHooks !== true) return "";
  return String(options.proofMutation || "");
}
