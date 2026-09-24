import { isFullSha, resultErr, resultOk } from "./util.js";
import { detectStaleHead } from "./authority.js";

const PROVENANCE_KEYS = Object.freeze([
  "task_id",
  "attempt",
  "dispatch_key",
  "authority_comment_id",
  "head",
  "base",
  "pr",
  "max_probes",
  "max_sandbox_seconds",
]);

export function validateProvenance(claimed, fetched) {
  if (!claimed || !fetched) {
    return resultErr("missing_provenance", "claimed and fetched provenance are required");
  }
  const missing = PROVENANCE_KEYS.filter((k) => claimed[k] == null || claimed[k] === "");
  if (missing.length) {
    return resultErr("incomplete_provenance", "provenance fields missing", { missing });
  }
  if (!isFullSha(String(claimed.head)) || !isFullSha(String(claimed.base))) {
    return resultErr("invalid_provenance_sha", "head and base must be full SHAs");
  }
  const mismatches = [];
  for (const key of ["task_id", "attempt", "dispatch_key", "authority_comment_id", "head", "base", "pr"]) {
    if (String(claimed[key]) !== String(fetched[key])) mismatches.push(key);
  }
  if (mismatches.length) {
    return resultErr("provenance_mismatch", "execution provenance does not match the admitted task", {
      mismatches,
    });
  }
  const stale = detectStaleHead(String(claimed.head), String(fetched.live_head || fetched.head));
  if (!stale.ok) return stale;
  return resultOk({ provenance: claimed });
}

export function bindProbeRequest({ provenance, probe, probe_index, max_probes }) {
  if (!provenance?.task_id || !provenance?.attempt || !isFullSha(String(provenance.head))) {
    return resultErr("unbound_probe", "probe is not bound to task/attempt/head");
  }
  if (!Number.isInteger(probe_index) || probe_index < 1) {
    return resultErr("invalid_probe_index", "probe_index must be a positive integer");
  }
  if (probe_index > (max_probes ?? provenance.max_probes ?? 2)) {
    return resultErr("probe_quota", "probe exceeds bound budget");
  }
  if (!probe || typeof probe !== "object") {
    return resultErr("invalid_probe", "probe missing");
  }
  return resultOk({
    task_id: provenance.task_id,
    attempt: provenance.attempt,
    dispatch_key: provenance.dispatch_key,
    authority_comment_id: provenance.authority_comment_id,
    head: provenance.head,
    base: provenance.base,
    probe_index,
    probe,
  });
}
