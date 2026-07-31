import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const APP_ROOT = join(__dirname, "..", "..");
export const PRISMA_SCHEMA_PATH = join(__dirname, "..", "..", "prisma", "schema.prisma");

export type PrismaMigrateDiffResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

/**
 * Redact credentials, hosts, ports, and URL fragments from Prisma/tool stderr.
 * Safe Prisma migrate-diff structural output (exit 2) may be retained after sanitization.
 */
export function redactPrismaDiagnosticText(text: string): string {
  let out = text;
  // Full URLs (postgresql://user:pass@host:port/db?params)
  out = out.replace(
    /[a-z][a-z0-9+.-]*:\/\/[^\s"'`]+/gi,
    "[REDACTED_URL]",
  );
  // user:password@host patterns without scheme
  out = out.replace(
    /\b[A-Za-z0-9._%+-]+:[^@\s]{1,128}@[A-Za-z0-9.-]+(?::\d{2,5})?\b/g,
    "[REDACTED_USERINFO_HOST]",
  );
  // Explicit password / credential assignments
  out = out.replace(
    /\b(password|pwd|pass|secret|token|api[_-]?key)\s*[=:]\s*\S+/gi,
    "$1=[REDACTED]",
  );
  // Host:port pairs (avoid revealing hostname or port)
  out = out.replace(
    /\b(?:(?:\d{1,3}\.){3}\d{1,3}|localhost|[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+):\d{2,5}\b/g,
    "[REDACTED_HOST_PORT]",
  );
  // Remaining IPv4 addresses
  out = out.replace(
    /\b(?:(?:\d{1,3}\.){3}\d{1,3})\b/g,
    "[REDACTED_IP]",
  );
  // DATABASE_URL / maintenance URL env echoes
  out = out.replace(
    /\b(DATABASE_URL|TENANT_MAINTENANCE_DATABASE_URL)\s*[=:]\s*\S+/gi,
    "$1=[REDACTED]",
  );
  return out;
}

export type SafeDriftFailure = {
  commandClass: "prisma_migrate_diff";
  exitCode: number;
  errorCategory: "schema_drift" | "command_error" | "runtime_error";
  redactedSummary: string;
  /** Sanitized diff body retained only for exit code 2. */
  sanitizedDiff?: string;
};

export function classifyDriftFailure(
  result: PrismaMigrateDiffResult,
): SafeDriftFailure {
  if (result.exitCode === 2) {
    const sanitizedDiff = redactPrismaDiagnosticText(
      [result.stdout, result.stderr].filter(Boolean).join("\n"),
    );
    return {
      commandClass: "prisma_migrate_diff",
      exitCode: 2,
      errorCategory: "schema_drift",
      redactedSummary:
        "Prisma schema drift detected: live database does not match prisma/schema.prisma.",
      sanitizedDiff,
    };
  }

  const combined = `${result.stdout}\n${result.stderr}`;
  let errorCategory: SafeDriftFailure["errorCategory"] = "command_error";
  if (/P1001|Can't reach database|ECONNREFUSED|connection/i.test(combined)) {
    errorCategory = "runtime_error";
  }

  return {
    commandClass: "prisma_migrate_diff",
    exitCode: result.exitCode,
    errorCategory,
    redactedSummary: redactPrismaDiagnosticText(
      combined.trim() || `prisma migrate diff failed with exit code ${result.exitCode}`,
    ).slice(0, 1500),
  };
}

/**
 * Compare the live PostgreSQL database (via schema datasource + DATABASE_URL env)
 * to prisma/schema.prisma using Prisma 6.16.3 `migrate diff --exit-code`.
 *
 * Preferred form avoids placing the connection URL in process argv:
 *   prisma migrate diff
 *     --from-schema-datasource prisma/schema.prisma
 *     --to-schema-datamodel prisma/schema.prisma
 *     --exit-code
 *
 * Exit codes: 0 empty, 1 error, 2 non-empty drift.
 * Independent of `tenant:indexes:verify`.
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
      stderr: err.stderr ?? err.message ?? String(error),
    };
  }
}

/**
 * Fail closed unless the live database matches prisma/schema.prisma with an empty diff.
 */
export function assertNoPrismaSchemaDrift(databaseUrl?: string): void {
  const result = runPrismaSchemaDriftDiff(databaseUrl);
  if (result.exitCode === 0) {
    console.log(
      JSON.stringify({
        event: "tenant_prisma_schema_drift_ok",
        command:
          "prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --exit-code",
        note: "DATABASE_URL supplied via child-process environment (not argv). Independent of tenant:indexes:verify.",
      }),
    );
    return;
  }

  const failure = classifyDriftFailure(result);
  if (failure.errorCategory === "schema_drift") {
    throw new Error(
      [
        failure.redactedSummary,
        "Command class: prisma_migrate_diff",
        `Exit code: ${failure.exitCode}`,
        "Diff output (sanitized):",
        failure.sanitizedDiff?.trim() || "(empty)",
      ].join("\n"),
    );
  }

  throw new Error(
    [
      `prisma migrate diff failed (command class: ${failure.commandClass}).`,
      `Exit code: ${failure.exitCode}`,
      `Error category: ${failure.errorCategory}`,
      `Redacted diagnostic summary: ${failure.redactedSummary}`,
    ].join("\n"),
  );
}
