/**
 * Fail-closed Prisma schema-drift diagnostics (F-F05).
 *
 * Primary guarantee: no raw stdout/stderr/exception text reaches logs or
 * thrown messages. Regex redaction is defence-in-depth only.
 */
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const APP_ROOT = join(__dirname, "..", "..");
export const PRISMA_SCHEMA_PATH = join(APP_ROOT, "prisma", "schema.prisma");

export type PrismaMigrateDiffResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export type SafeDriftSuccess = {
  event: "tenant_prisma_schema_drift_ok";
  commandClass: "prisma_migrate_diff";
  exitCode: 0;
};

export type SafeDriftDifference = {
  objectType: "table" | "index" | "column" | "constraint" | "enum" | "other";
  identifier: string;
  changeCategory:
    | "create"
    | "drop"
    | "alter"
    | "rename"
    | "unknown";
};

export type SafeDriftFailure = {
  commandClass: "prisma_migrate_diff";
  exitCode: number;
  errorCategory: "schema_drift" | "command_error" | "runtime_error";
  /** Fixed generic summary — never raw tool output. */
  summary: string;
  /** Allowlisted, bounded differences retained only for exit code 2. */
  differences?: SafeDriftDifference[];
  differencesTruncated?: boolean;
  /** Optional recognized Prisma error code (e.g. P1001). */
  prismaErrorCode?: string | null;
};

export const MAX_REPORTED_DRIFT_DIFFERENCES = 25;

/**
 * Defence-in-depth redaction. Must never be the primary guarantee that
 * sensitive material is absent from diagnostics.
 */
export function redactPrismaDiagnosticText(text: string): string {
  let out = text;
  // Full URLs (any scheme).
  out = out.replace(/[a-z][a-z0-9+.-]*:\/\/[^\s"'`]+/gi, "[REDACTED_URL]");
  // Schemeless user:pass@host(:port).
  out = out.replace(
    /\b[A-Za-z0-9._%+-]+:[^@\s]{1,128}@[A-Za-z0-9.-]+(?::\d{2,5})?\b/g,
    "[REDACTED_USERINFO_HOST]",
  );
  // libpq keyword connection strings and unexpected credential labels.
  out = out.replace(
    /\b(host|hostaddr|user|password|passfile|dbname|port|sslcert|sslkey|sslrootcert|connect_timeout)\s*=\s*[^\s'"]+/gi,
    "$1=[REDACTED]",
  );
  out = out.replace(
    /\b(password|pwd|pass|secret|token|api[_-]?key|passwd|credential)\s*[=:]\s*\S+/gi,
    "$1=[REDACTED]",
  );
  // Unix socket paths.
  out = out.replace(
    /(?:\/(?:var|tmp|private|run)\/(?:[^\s"'`]*)postgres(?:ql)?[^\s"'`]*)/gi,
    "[REDACTED_UNIX_SOCKET]",
  );
  out = out.replace(/\bunix:\/\/[^\s"'`]+/gi, "[REDACTED_UNIX_SOCKET]");
  // IPv6 (bracketed or bare compressed forms).
  out = out.replace(/\[[0-9a-fA-F:]+\](?::\d{1,5})?/g, "[REDACTED_IPV6]");
  out = out.replace(
    /\b(?:[0-9a-fA-F]{1,4}:){2,7}[0-9a-fA-F]{0,4}\b/g,
    "[REDACTED_IPV6]",
  );
  // host:port including bare hostnames and localhost.
  out = out.replace(
    /\b(?:(?:\d{1,3}\.){3}\d{1,3}|localhost|[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+):\d{2,5}\b/g,
    "[REDACTED_HOST_PORT]",
  );
  // Bare IPv4.
  out = out.replace(/\b(?:(?:\d{1,3}\.){3}\d{1,3})\b/g, "[REDACTED_IP]");
  // Bare hostname with at least one dot (defence in depth).
  out = out.replace(
    /\b(?:[A-Za-z0-9-]+\.)+(?:internal|local|example|com|net|org|io|dev|test)\b/gi,
    "[REDACTED_HOSTNAME]",
  );
  out = out.replace(
    /\b(DATABASE_URL|TENANT_MAINTENANCE_DATABASE_URL)\s*[=:]\s*\S+/gi,
    "$1=[REDACTED]",
  );
  return out;
}

const ALLOWED_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_."]*$/;

/**
 * Parse only recognized schema-diff statement classes from Prisma migrate-diff
 * output. Unrecognized text is discarded. Identifiers must match a safe
 * pattern; the number of retained differences is capped.
 */
export function parseAllowlistedDriftDifferences(
  stdout: string,
): { differences: SafeDriftDifference[]; truncated: boolean } {
  const differences: SafeDriftDifference[] = [];
  let truncated = false;
  const lines = stdout.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    let match: RegExpMatchArray | null;

    match = line.match(
      /^CREATE\s+(UNIQUE\s+)?INDEX\s+(?:CONCURRENTLY\s+)?(?:"?([A-Za-z_][A-Za-z0-9_]*)"?)/i,
    );
    if (match) {
      pushDiff(differences, {
        objectType: "index",
        identifier: match[2]!,
        changeCategory: "create",
      });
      continue;
    }

    match = line.match(
      /^DROP\s+INDEX\s+(?:CONCURRENTLY\s+)?(?:"?([A-Za-z_][A-Za-z0-9_]*)"?)/i,
    );
    if (match) {
      pushDiff(differences, {
        objectType: "index",
        identifier: match[1]!,
        changeCategory: "drop",
      });
      continue;
    }

    match = line.match(
      /^ALTER\s+TABLE\s+(?:"?([A-Za-z_][A-Za-z0-9_]*)"?)\s+(ADD|DROP|ALTER|RENAME)\b/i,
    );
    if (match) {
      const verb = match[2]!.toUpperCase();
      pushDiff(differences, {
        objectType: "table",
        identifier: match[1]!,
        changeCategory:
          verb === "ADD"
            ? "create"
            : verb === "DROP"
              ? "drop"
              : verb === "RENAME"
                ? "rename"
                : "alter",
      });
      continue;
    }

    match = line.match(
      /^CREATE\s+TABLE\s+(?:"?([A-Za-z_][A-Za-z0-9_]*)"?)/i,
    );
    if (match) {
      pushDiff(differences, {
        objectType: "table",
        identifier: match[1]!,
        changeCategory: "create",
      });
      continue;
    }

    match = line.match(/^DROP\s+TABLE\s+(?:"?([A-Za-z_][A-Za-z0-9_]*)"?)/i);
    if (match) {
      pushDiff(differences, {
        objectType: "table",
        identifier: match[1]!,
        changeCategory: "drop",
      });
      continue;
    }

    match = line.match(
      /^(CREATE|DROP|ALTER)\s+TYPE\s+(?:"?([A-Za-z_][A-Za-z0-9_]*)"?)/i,
    );
    if (match) {
      pushDiff(differences, {
        objectType: "enum",
        identifier: match[2]!,
        changeCategory:
          match[1]!.toUpperCase() === "CREATE"
            ? "create"
            : match[1]!.toUpperCase() === "DROP"
              ? "drop"
              : "alter",
      });
      continue;
    }

    // Unrecognized text — discarded (fail closed).
  }

  if (differences.length > MAX_REPORTED_DRIFT_DIFFERENCES) {
    truncated = true;
    differences.length = MAX_REPORTED_DRIFT_DIFFERENCES;
  }
  return { differences, truncated };
}

function pushDiff(
  out: SafeDriftDifference[],
  candidate: SafeDriftDifference,
): void {
  if (!ALLOWED_IDENTIFIER.test(candidate.identifier)) return;
  out.push(candidate);
}

function extractRecognizedPrismaCode(text: string): string | null {
  const match = text.match(/\b(P\d{4})\b/);
  return match?.[1] ?? null;
}

/**
 * Classify a migrate-diff result into a fixed, fail-closed diagnostic.
 * Raw stdout/stderr are never retained on the returned object for error paths
 * that surface to operators.
 */
export function classifyDriftFailure(
  result: PrismaMigrateDiffResult,
): SafeDriftFailure {
  if (result.exitCode === 2) {
    const { differences, truncated } = parseAllowlistedDriftDifferences(
      result.stdout,
    );
    return {
      commandClass: "prisma_migrate_diff",
      exitCode: 2,
      errorCategory: "schema_drift",
      summary:
        "Prisma schema drift detected: live database does not match prisma/schema.prisma.",
      differences,
      differencesTruncated: truncated,
      prismaErrorCode: null,
    };
  }

  const combined = `${result.stdout}\n${result.stderr}`;
  const prismaErrorCode = extractRecognizedPrismaCode(combined);
  let errorCategory: SafeDriftFailure["errorCategory"] = "command_error";
  if (
    prismaErrorCode === "P1001" ||
    /Can't reach database|ECONNREFUSED|connection/i.test(combined)
  ) {
    errorCategory = "runtime_error";
  }

  return {
    commandClass: "prisma_migrate_diff",
    exitCode: result.exitCode,
    errorCategory,
    summary:
      "prisma migrate diff failed. Raw tool output discarded for confidentiality.",
    prismaErrorCode,
  };
}

/**
 * Format a SafeDriftFailure into an operator-facing Error message that
 * contains only fixed fields and allowlisted differences.
 */
export function formatSafeDriftFailure(failure: SafeDriftFailure): string {
  const parts = [
    failure.summary,
    `Command class: ${failure.commandClass}`,
    `Exit code: ${failure.exitCode}`,
    `Error category: ${failure.errorCategory}`,
  ];
  if (failure.prismaErrorCode) {
    parts.push(`Prisma error code: ${failure.prismaErrorCode}`);
  }
  if (failure.errorCategory === "schema_drift") {
    const diffs = failure.differences ?? [];
    parts.push(`Reported differences (allowlisted, max ${MAX_REPORTED_DRIFT_DIFFERENCES}):`);
    if (diffs.length === 0) {
      parts.push("(none recognized)");
    } else {
      for (const d of diffs) {
        parts.push(
          `- ${d.changeCategory} ${d.objectType} ${d.identifier}`,
        );
      }
    }
    if (failure.differencesTruncated) {
      parts.push("(truncated)");
    }
  }
  return parts.join("\n");
}

/**
 * Compare the live PostgreSQL database (via schema datasource + DATABASE_URL env)
 * to prisma/schema.prisma using Prisma `migrate diff --exit-code`.
 *
 * Preferred form avoids placing the connection URL in process argv.
 * Exit codes: 0 empty, 1 error, 2 non-empty drift.
 */
export function runPrismaSchemaDriftDiff(
  databaseUrl?: string,
): PrismaMigrateDiffResult {
  const url =
    databaseUrl?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    process.env.TENANT_MAINTENANCE_DATABASE_URL?.trim() ||
    "";
  if (!url) {
    return {
      exitCode: 1,
      stdout: "",
      stderr:
        "DATABASE_URL (or explicit databaseUrl argument for tests) is required for prisma schema drift via --from-schema-datasource",
    };
  }

  try {
    const stdout = execFileSync(
      "npx",
      [
        "prisma",
        "migrate",
        "diff",
        "--from-schema-datasource",
        PRISMA_SCHEMA_PATH,
        "--to-schema-datamodel",
        PRISMA_SCHEMA_PATH,
        "--exit-code",
      ],
      {
        cwd: APP_ROOT,
        encoding: "utf8",
        env: { ...process.env, DATABASE_URL: url },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    return { exitCode: 0, stdout: stdout ?? "", stderr: "" };
  } catch (error) {
    const err = error as {
      status?: number | null;
      stdout?: string;
      stderr?: string;
      message?: string;
    };
    return {
      exitCode: typeof err.status === "number" ? err.status : 1,
      stdout: err.stdout ?? "",
      stderr: err.stderr ?? "",
    };
  }
}

/**
 * Fail closed unless the live database matches prisma/schema.prisma with an empty diff.
 * Never surfaces raw stdout, stderr, or unsanitized exception text.
 */
export function assertNoPrismaSchemaDrift(databaseUrl?: string): void {
  const result = runPrismaSchemaDriftDiff(databaseUrl);
  if (result.exitCode === 0) {
    const ok: SafeDriftSuccess = {
      event: "tenant_prisma_schema_drift_ok",
      commandClass: "prisma_migrate_diff",
      exitCode: 0,
    };
    console.log(JSON.stringify(ok));
    return;
  }

  throw new Error(formatSafeDriftFailure(classifyDriftFailure(result)));
}

/**
 * Architecture assertion helper: confirm that assertNoPrismaSchemaDrift's
 * thrown message never embeds the supplied sensitive markers. Used by tests.
 */
export function thrownDriftMessageContainsSensitive(
  message: string,
  markers: string[],
): string[] {
  return markers.filter((m) => m.length > 0 && message.includes(m));
}
