import {
  MAX_PROBE_OUTPUT_BYTES,
  NODE_VERSION,
  SYNTHETIC_PG,
  SYNTHETIC_REDIS,
} from "./constants.js";
import { resultErr, resultOk, sha256Hex } from "./util.js";

const EVIDENCE_STATES = Object.freeze([
  "planned",
  "executed",
  "reused",
  "expected_failure",
  "skipped",
  "blocked",
]);

export function classifyExecutorResult(probe, executor) {
  if (!executor) {
    return {
      evidence_state: "blocked",
      verdict: "BLOCKED",
      reason: "missing_executor_metadata",
    };
  }
  if (executor.timed_out) {
    return {
      evidence_state: "blocked",
      verdict: "UNKNOWN",
      reason: "timeout",
    };
  }
  if (executor.provisioning_failed) {
    return {
      evidence_state: "blocked",
      verdict: "BLOCKED",
      reason: "failed_provisioning",
    };
  }
  if (executor.malformed_output) {
    return {
      evidence_state: "blocked",
      verdict: "BLOCKED",
      reason: "malformed_output",
    };
  }
  if (executor.output_truncated || executor.output_bytes > MAX_PROBE_OUTPUT_BYTES) {
    return {
      evidence_state: "blocked",
      verdict: "BLOCKED",
      reason: "oversized_output",
    };
  }
  if (probe.kind === "zero_test_control" || executor.tests_run === 0) {
    const expectedZeroFail =
      probe.kind === "zero_test_control" || probe.expect?.outcome === "fail";
    if (expectedZeroFail) {
      return {
        evidence_state: "expected_failure",
        verdict: "EXPECTED_FAILURE",
        reason: "zero_test_selection",
      };
    }
    return {
      evidence_state: "executed",
      verdict: "REJECTED",
      reason: "zero_test_selection",
    };
  }
  const failed = executor.exit_code !== 0;
  if (probe.expect?.outcome === "fail") {
    if (failed) {
      return {
        evidence_state: "expected_failure",
        verdict: "EXPECTED_FAILURE",
        reason: "negative_control_failed_as_intended",
      };
    }
    return {
      evidence_state: "executed",
      verdict: "REJECTED",
      reason: "negative_control_did_not_fail",
    };
  }
  if (failed) {
    return {
      evidence_state: "executed",
      verdict: "REJECTED",
      reason: "probe_failed",
    };
  }
  return {
    evidence_state: "executed",
    verdict: "COMPLETED_NO_VERDICT",
    reason: "probe_executed",
  };
}

export function combineTaskVerdict({ activation, staleHead, lease, probes, modelClaimsPass }) {
  if (!activation) {
    return { status: "REJECTED", reason: "runner_not_admitted" };
  }
  if (lease?.status === "stopped") {
    return { status: "REJECTED", reason: "stopped" };
  }
  if (staleHead) {
    return { status: "UNKNOWN", reason: "stale_head" };
  }
  if (!probes?.length) {
    return { status: "REJECTED", reason: "zero_test_selection" };
  }
  if (probes.some((p) => p.verdict === "BLOCKED")) {
    return { status: "BLOCKED", reason: "probe_blocked" };
  }
  if (probes.some((p) => p.verdict === "UNKNOWN")) {
    return { status: "UNKNOWN", reason: "probe_unknown" };
  }
  if (probes.some((p) => p.verdict === "REJECTED")) {
    return { status: "REJECTED", reason: "probe_rejected" };
  }
  if (modelClaimsPass) {
    return {
      status: "COMPLETED_NO_VERDICT",
      reason: "model_pass_ignored_executor_is_source",
    };
  }
  return { status: "COMPLETED_NO_VERDICT", reason: "complete_no_app_pass" };
}

export function profileRecord({ node, npm, postgres, redis }) {
  return {
    id: "node22-pg16-redis7",
    required: {
      node: NODE_VERSION,
      npm: "11.5.2",
      postgres_major: "16",
      redis_major: "7",
    },
    observed: { node, npm, postgres, redis },
  };
}

export function outputHash(stdout, stderr) {
  return sha256Hex(`${stdout ?? ""}\n--stderr--\n${stderr ?? ""}`);
}

export { EVIDENCE_STATES };
