/**
 * Sync control-plane errors (Phase 1 PR 4).
 * Fail closed — never treat unknown states as success.
 */

export const SYNC_CONTROL_PLANE_ERROR_CODES = [
  "shop_missing",
  "shop_processing_disabled",
  "api_version_unsupported",
  "api_version_missing",
  "topic_unsupported",
  "sanitize_failed",
  "illegal_job_transition",
  "job_not_found",
  "job_lease_conflict",
  "attempt_conflict",
  "max_attempts_exceeded",
  "dead_letter_not_found",
  "dead_letter_not_open",
  "dead_letter_shop_mismatch",
  "replay_denied_disabled_shop",
  "payload_digest_mismatch",
  "envelope_durable_job_mismatch",
  "control_plane_url_missing",
  "uninstall_shop_missing",
  "reinstall_denied",
  "durable_job_create_denied",
] as const;

export type SyncControlPlaneErrorCode =
  (typeof SYNC_CONTROL_PLANE_ERROR_CODES)[number];

export class SyncControlPlaneError extends Error {
  readonly code: SyncControlPlaneErrorCode;

  constructor(code: SyncControlPlaneErrorCode, message: string) {
    super(message);
    this.name = "SyncControlPlaneError";
    this.code = code;
  }
}
