/**
 * Versioned serialized-evidence budget for tenant-backfill starting evidence
 * (F-F02). Limits are configurable within documented safe bounds, deterministic,
 * recorded in run evidence, and part of resume compatibility validation.
 */

export const TENANT_EVIDENCE_BUDGET_VERSION = "phase1-evidence-budget-v1" as const;

export type TenantEvidenceBudget = {
  budgetVersion: typeof TENANT_EVIDENCE_BUDGET_VERSION;
  /** Ceiling for the complete valid normalized-domain set required by the run. */
  maxNormalizedDomains: number;
  /** Ceiling for canonical Shop rows supported by this maintenance operation. */
  maxShops: number;
  /** Ceiling for durable per-value discovery issue records in one run. */
  maxDiscoveryIssues: number;
  /** Ceiling for bounded redacted samples per evidence source. */
  maxSamplesPerSource: number;
  /** Ceiling for UTF-8 serialized starting-evidence/resume-metadata bytes. */
  maxSerializedEvidenceBytes: number;
};

type LimitSpec = {
  env: string;
  defaultValue: number;
  min: number;
  max: number;
};

const LIMIT_SPECS: Record<
  Exclude<keyof TenantEvidenceBudget, "budgetVersion">,
  LimitSpec
> = {
  maxNormalizedDomains: {
    env: "TENANT_EVIDENCE_MAX_NORMALIZED_DOMAINS",
    defaultValue: 5_000,
    min: 1,
    max: 100_000,
  },
  maxShops: {
    env: "TENANT_EVIDENCE_MAX_SHOPS",
    defaultValue: 10_000,
    min: 1,
    max: 100_000,
  },
  maxDiscoveryIssues: {
    env: "TENANT_EVIDENCE_MAX_DISCOVERY_ISSUES",
    defaultValue: 10_000,
    min: 10,
    max: 100_000,
  },
  maxSamplesPerSource: {
    env: "TENANT_EVIDENCE_MAX_SAMPLES_PER_SOURCE",
    defaultValue: 20,
    min: 0,
    max: 100,
  },
  maxSerializedEvidenceBytes: {
    env: "TENANT_EVIDENCE_MAX_SERIALIZED_BYTES",
    defaultValue: 1_000_000,
    min: 65_536,
    max: 16_000_000,
  },
};

function resolveLimit(spec: LimitSpec): number {
  const raw = process.env[spec.env]?.trim();
  if (raw === undefined || raw === "") {
    return spec.defaultValue;
  }
  if (!/^\d+$/.test(raw)) {
    throw new Error(
      `Invalid ${spec.env}=${JSON.stringify(raw)}: strict non-negative integer required`,
    );
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < spec.min || value > spec.max) {
    throw new Error(
      `Invalid ${spec.env}=${raw}: expected integer in [${spec.min}..${spec.max}]`,
    );
  }
  return value;
}

/** Resolve the active evidence budget from env within documented safe bounds. */
export function resolveEvidenceBudget(): TenantEvidenceBudget {
  return {
    budgetVersion: TENANT_EVIDENCE_BUDGET_VERSION,
    maxNormalizedDomains: resolveLimit(LIMIT_SPECS.maxNormalizedDomains),
    maxShops: resolveLimit(LIMIT_SPECS.maxShops),
    maxDiscoveryIssues: resolveLimit(LIMIT_SPECS.maxDiscoveryIssues),
    maxSamplesPerSource: resolveLimit(LIMIT_SPECS.maxSamplesPerSource),
    maxSerializedEvidenceBytes: resolveLimit(
      LIMIT_SPECS.maxSerializedEvidenceBytes,
    ),
  };
}

export type EvidenceCapacityKind =
  | "normalized_domains"
  | "shops"
  | "discovery_issues"
  | "serialized_bytes";

/**
 * Fail-closed evidence capacity failure raised before any merchant ownership
 * mutation. Marked on the run record with an explicit failure summary.
 */
export class EvidenceCapacityError extends Error {
  readonly kind: EvidenceCapacityKind;
  readonly ceiling: number;
  readonly detectedCount: number | null;

  constructor(args: {
    kind: EvidenceCapacityKind;
    ceiling: number;
    detectedCount?: number | null;
    detail: string;
  }) {
    super(
      `Evidence capacity exceeded (${args.kind}): ${args.detail} ` +
        `(ceiling=${args.ceiling}` +
        (args.detectedCount != null
          ? `, detected=${args.detectedCount}`
          : "") +
        `). Run failed closed before merchant ownership mutation.`,
    );
    this.name = "EvidenceCapacityError";
    this.kind = args.kind;
    this.ceiling = args.ceiling;
    this.detectedCount = args.detectedCount ?? null;
  }
}

/** UTF-8 serialized byte size of a JSON value. */
export function serializedEvidenceBytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

/**
 * Calculate and enforce the serialized byte budget BEFORE creating or updating
 * TenantBackfillRun. Never discover oversize only via a database JSON/TOAST
 * failure.
 */
export function assertSerializedWithinBudget(
  label: string,
  value: unknown,
  budget: TenantEvidenceBudget,
): number {
  const bytes = serializedEvidenceBytes(value);
  if (bytes > budget.maxSerializedEvidenceBytes) {
    throw new EvidenceCapacityError({
      kind: "serialized_bytes",
      ceiling: budget.maxSerializedEvidenceBytes,
      detectedCount: bytes,
      detail: `${label} serializes to ${bytes} UTF-8 bytes`,
    });
  }
  return bytes;
}

/**
 * Resume compatibility: the configured budget must exactly match the budget
 * recorded by the original run. Mismatched version or limits fail closed.
 */
export function assertEvidenceBudgetCompatible(
  original: unknown,
  current: TenantEvidenceBudget,
): asserts original is TenantEvidenceBudget {
  const o = original as TenantEvidenceBudget | null | undefined;
  if (!o || typeof o !== "object") {
    throw new Error(
      "Resume failed closed: startingEvidence.evidenceBudget missing or malformed",
    );
  }
  if (o.budgetVersion !== current.budgetVersion) {
    throw new Error(
      `Resume failed closed: evidence budget version ${String(o.budgetVersion)} does not match configured ${current.budgetVersion}`,
    );
  }
  for (const key of Object.keys(LIMIT_SPECS) as Array<
    Exclude<keyof TenantEvidenceBudget, "budgetVersion">
  >) {
    if (o[key] !== current[key]) {
      throw new Error(
        `Resume failed closed: evidence budget limit ${key} was ${String(o[key])} at capture but is configured ${current[key]} now; ` +
          `restore the original limits to resume this run`,
      );
    }
  }
}
