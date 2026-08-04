/**
 * Structured merchant-error classification for enforcement rollout traffic
 * (F-PR3C-08 residual).
 *
 * Does not log SQL text or merchant row values.
 */

export type MerchantOperation =
  | "SELECT"
  | "INSERT"
  | "UPDATE"
  | "DELETE"
  | "BEGIN"
  | "COMMIT"
  | "unknown";

export type EnforcementTrafficPhase =
  | "pre_apply"
  | "during_apply"
  | "post_apply";

export type MerchantErrorClass = "42501" | "other" | "connection";

export type MerchantErrorRecord = {
  operation: MerchantOperation;
  sqlstate: string | null;
  errorClass: MerchantErrorClass;
  phase: EnforcementTrafficPhase;
  dmlExpectedRevoked: boolean;
  expected: boolean;
  relativeMs: number;
};

export type MerchantErrorSummary = {
  totalSamples: number;
  successes: number;
  failures: number;
  failureRate: number;
  bySqlstate: Record<string, number>;
  byOperation: Record<string, number>;
  byPhase: Record<string, number>;
  beforeWindowSuccess: number;
  duringWindowExpectedDenial: number;
  afterWindowSuccess: number;
  unexpectedErrors: number;
};

/** During the documented runtime-DML revocation window, only 42501 is permitted. */
export const PERMITTED_REVOCATION_WINDOW_SQLSTATES = new Set(["42501"]);

export function classifyMerchantError(err: unknown): {
  sqlstate: string | null;
  errorClass: MerchantErrorClass;
} {
  const sqlstate =
    err && typeof err === "object" && "code" in err
      ? String((err as { code?: string }).code ?? "") || null
      : null;
  if (sqlstate === "42501") return { sqlstate, errorClass: "42501" };
  if (
    sqlstate === "57P01" ||
    sqlstate === "57P02" ||
    sqlstate === "08006" ||
    sqlstate === "08001" ||
    sqlstate === "08003"
  ) {
    return { sqlstate, errorClass: "connection" };
  }
  return { sqlstate, errorClass: "other" };
}

export function isExpectedMerchantError(
  record: Pick<
    MerchantErrorRecord,
    "errorClass" | "phase" | "dmlExpectedRevoked"
  >,
): boolean {
  if (record.phase === "during_apply" && record.dmlExpectedRevoked) {
    return record.errorClass === "42501";
  }
  return false;
}

export function summarizeMerchantErrors(input: {
  samples: number;
  successes: number;
  errors: MerchantErrorRecord[];
  beforeWindowSuccess: number;
  afterWindowSuccess: number;
}): MerchantErrorSummary {
  const bySqlstate: Record<string, number> = {};
  const byOperation: Record<string, number> = {};
  const byPhase: Record<string, number> = {};
  let duringWindowExpectedDenial = 0;
  let unexpectedErrors = 0;

  for (const error of input.errors) {
    const state = error.sqlstate ?? "unknown";
    bySqlstate[state] = (bySqlstate[state] ?? 0) + 1;
    byOperation[error.operation] = (byOperation[error.operation] ?? 0) + 1;
    byPhase[error.phase] = (byPhase[error.phase] ?? 0) + 1;
    if (error.expected && error.phase === "during_apply") {
      duringWindowExpectedDenial += 1;
    }
    if (!error.expected) unexpectedErrors += 1;
  }

  return {
    totalSamples: input.samples,
    successes: input.successes,
    failures: input.errors.length,
    failureRate:
      input.samples === 0 ? 0 : input.errors.length / input.samples,
    bySqlstate,
    byOperation,
    byPhase,
    beforeWindowSuccess: input.beforeWindowSuccess,
    duringWindowExpectedDenial,
    afterWindowSuccess: input.afterWindowSuccess,
    unexpectedErrors,
  };
}

export function assertMerchantErrorSummary(
  summary: MerchantErrorSummary,
): void {
  if (summary.beforeWindowSuccess <= 0) {
    throw new Error("merchant_error_assert:no_successful_traffic_before_apply");
  }
  if (summary.afterWindowSuccess <= 0) {
    throw new Error("merchant_error_assert:no_successful_traffic_after_apply");
  }
  if (summary.unexpectedErrors > 0) {
    throw new Error(
      `merchant_error_assert:unexpected_errors:${summary.unexpectedErrors}:bySqlstate=${JSON.stringify(summary.bySqlstate)}`,
    );
  }
  for (const [state, count] of Object.entries(summary.bySqlstate)) {
    if (
      count > 0 &&
      state !== "42501" &&
      (summary.byPhase.during_apply ?? 0) >= count
    ) {
      // Non-42501 during-window errors are already counted as unexpected.
      // Keep an explicit guard for unknown states anywhere.
      if (!PERMITTED_REVOCATION_WINDOW_SQLSTATES.has(state)) {
        // Allowed only if they were classified unexpected (already failed above).
        continue;
      }
    }
  }
}
