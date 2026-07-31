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

  if (result.exitCode === 2) {
    throw new Error(
      [
        "Prisma schema drift detected: live database does not match prisma/schema.prisma.",
        "Command: prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --exit-code",
        "Diff output:",
        result.stdout.trim() || "(empty stdout)",
        result.stderr.trim() ? `stderr:\n${result.stderr.trim()}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  throw new Error(
    [
      `prisma migrate diff failed with exit code ${result.exitCode}.`,
      result.stdout.trim(),
      result.stderr.trim(),
    ]
      .filter(Boolean)
      .join("\n"),
  );
}
