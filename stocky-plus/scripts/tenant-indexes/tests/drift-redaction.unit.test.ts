/**
 * Fail-closed drift diagnostics (F-F05) and defence-in-depth redaction tests.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  classifyDriftFailure,
  formatSafeDriftFailure,
  MAX_REPORTED_DRIFT_DIFFERENCES,
  parseAllowlistedDriftDifferences,
  redactPrismaDiagnosticText,
  thrownDriftMessageContainsSensitive,
} from "../drift-lib";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("drift fail-closed diagnostics (F-F05)", () => {
  describe("defence-in-depth redaction", () => {
    it("redacts URL connection strings with credentials", () => {
      const raw =
        "Error: P1001: Can't reach database server at `postgresql://stocky:s3cret@db.internal:5432/stocky_plus_ci?sslmode=require`";
      const out = redactPrismaDiagnosticText(raw);
      expect(out).not.toMatch(/s3cret/);
      expect(out).not.toMatch(/db\.internal/);
      expect(out).not.toMatch(/5432/);
      expect(out).not.toMatch(/postgresql:\/\//);
      expect(out).toMatch(/REDACTED/);
    });

    it("redacts schemeless user:pass@host", () => {
      const raw = "connection failed for stocky:hunter2@pgbouncer.example.com:6432";
      const out = redactPrismaDiagnosticText(raw);
      expect(out).not.toMatch(/hunter2/);
      expect(out).not.toMatch(/pgbouncer\.example\.com/);
    });

    it("redacts bare hostname with port", () => {
      const raw =
        "Can't reach database server at `db.prod.internal:5432`. Please make sure your database server is running.";
      const out = redactPrismaDiagnosticText(raw);
      expect(out).not.toMatch(/db\.prod\.internal/);
      expect(out).not.toMatch(/5432/);
    });

    it("redacts IPv4 addresses", () => {
      const raw =
        "Can't reach database server at `127.0.0.1:5432`. Please make sure your database server is running.";
      const out = redactPrismaDiagnosticText(raw);
      expect(out).not.toMatch(/127\.0\.0\.1/);
      expect(out).toMatch(/REDACTED/);
    });

    it("redacts IPv6 addresses", () => {
      const raw =
        "Can't reach database server at `[2001:db8::1]:5432` or 2001:db8:85a3::8a2e:370:7334";
      const out = redactPrismaDiagnosticText(raw);
      expect(out).not.toMatch(/2001:db8/);
      expect(out).toMatch(/REDACTED_IPV6/);
    });

    it("redacts Unix socket paths", () => {
      const raw =
        "connect via /var/run/postgresql/.s.PGSQL.5432 unix:///tmp/postgresql.sock";
      const out = redactPrismaDiagnosticText(raw);
      expect(out).not.toMatch(/\/var\/run\/postgresql/);
      expect(out).not.toMatch(/unix:\/\//);
      expect(out).toMatch(/REDACTED_UNIX_SOCKET/);
    });

    it("redacts libpq keyword connection strings", () => {
      const raw =
        "host=db.internal port=5432 user=stocky password=s3cret dbname=stocky_plus";
      const out = redactPrismaDiagnosticText(raw);
      expect(out).not.toMatch(/s3cret/);
      expect(out).not.toMatch(/db\.internal/);
      expect(out).toMatch(/password=\[REDACTED\]/);
      expect(out).toMatch(/host=\[REDACTED\]/);
    });

    it("redacts credentials under unexpected labels", () => {
      const raw = "passwd:top-secret credential=also-secret token=abc123";
      const out = redactPrismaDiagnosticText(raw);
      expect(out).not.toMatch(/top-secret/);
      expect(out).not.toMatch(/also-secret/);
      expect(out).not.toMatch(/abc123/);
    });
  });

  describe("allowlisted drift parsing", () => {
    it("retains only recognized schema-diff statements", () => {
      const stdout = [
        'ALTER TABLE "Supplier" DROP COLUMN "vendorNotes"',
        "CREATE INDEX Supplier_shopId_idx ON public.\"Supplier\"",
        "DROP INDEX Concurrently \"Old_idx\"",
        "SECRET HINT postgresql://u:p@evil.host:5432/db",
        "some unrecognized prisma chatter with password=leak",
      ].join("\n");
      const { differences, truncated } = parseAllowlistedDriftDifferences(stdout);
      expect(truncated).toBe(false);
      expect(differences.length).toBe(3);
      expect(differences.map((d) => d.identifier).sort()).toEqual([
        "Old_idx",
        "Supplier",
        "Supplier_shopId_idx",
      ]);
      const serialized = JSON.stringify(differences);
      expect(serialized).not.toMatch(/postgresql/);
      expect(serialized).not.toMatch(/password/);
      expect(serialized).not.toMatch(/evil\.host/);
    });

    it("caps reported differences and marks truncation", () => {
      const lines = Array.from(
        { length: MAX_REPORTED_DRIFT_DIFFERENCES + 5 },
        (_, i) => `DROP INDEX "idx_${i}"`,
      );
      const { differences, truncated } = parseAllowlistedDriftDifferences(
        lines.join("\n"),
      );
      expect(truncated).toBe(true);
      expect(differences.length).toBe(MAX_REPORTED_DRIFT_DIFFERENCES);
    });

    it("discards unrecognized identifiers and unknown output", () => {
      const { differences } = parseAllowlistedDriftDifferences(
        [
          "completely unknown prisma noise",
          'ALTER TABLE "Supplier; DROP TABLE users--" ADD COLUMN x int',
          'CREATE TABLE "OkTable"',
        ].join("\n"),
      );
      expect(differences).toEqual([
        {
          objectType: "table",
          identifier: "OkTable",
          changeCategory: "create",
        },
      ]);
    });
  });

  describe("classifyDriftFailure", () => {
    it("returns allowlisted differences for exit 2 and discards unsafe stderr", () => {
      const failure = classifyDriftFailure({
        exitCode: 2,
        stdout: 'ALTER TABLE "Supplier" DROP COLUMN "shop"',
        stderr: "hint postgresql://u:p@host:5432/db password=leak",
      });
      expect(failure.errorCategory).toBe("schema_drift");
      expect(failure.summary).not.toMatch(/postgresql/);
      expect(failure.summary).not.toMatch(/password/);
      expect(JSON.stringify(failure)).not.toMatch(/postgresql/);
      expect(JSON.stringify(failure)).not.toMatch(/password=leak/);
      expect(failure.differences).toEqual([
        {
          objectType: "table",
          identifier: "Supplier",
          changeCategory: "drop",
        },
      ]);
    });

    it("collapses runtime P1001 to fixed diagnostic without raw stderr", () => {
      const failure = classifyDriftFailure({
        exitCode: 1,
        stdout: "",
        stderr:
          "P1001: Can't reach database server at `10.0.0.9:5432` password=super-secret",
      });
      expect(failure.errorCategory).toBe("runtime_error");
      expect(failure.prismaErrorCode).toBe("P1001");
      expect(JSON.stringify(failure)).not.toMatch(/10\.0\.0\.9/);
      expect(JSON.stringify(failure)).not.toMatch(/super-secret/);
      expect(failure.differences).toBeUndefined();
      const message = formatSafeDriftFailure(failure);
      expect(message).toMatch(/Raw tool output discarded/);
      expect(message).not.toMatch(/10\.0\.0\.9/);
    });

    it("collapses unknown Prisma output to a generic fixed diagnostic", () => {
      const failure = classifyDriftFailure({
        exitCode: 1,
        stdout: "unexpected binary dump @@HOST@@ db.secret.internal",
        stderr: "stack trace /Users/me/.env DATABASE_URL=postgresql://a:b@c/d",
      });
      expect(failure.errorCategory).toBe("command_error");
      expect(failure.summary).toBe(
        "prisma migrate diff failed. Raw tool output discarded for confidentiality.",
      );
      const message = formatSafeDriftFailure(failure);
      expect(
        thrownDriftMessageContainsSensitive(message, [
          "db.secret.internal",
          "postgresql://",
          "/Users/me/.env",
          "a:b@c",
        ]),
      ).toEqual([]);
    });

    it("handles oversized mixed safe diff plus unsafe stderr", () => {
      const safeLines = Array.from(
        { length: 3 },
        (_, i) => `CREATE INDEX "idx_${i}" ON t`,
      );
      const failure = classifyDriftFailure({
        exitCode: 2,
        stdout: [
          ...safeLines,
          "password=should-not-appear",
          "host=db.evil.internal",
        ].join("\n"),
        stderr: "postgresql://u:p@[2001:db8::1]:5432/db",
      });
      expect(failure.errorCategory).toBe("schema_drift");
      expect(failure.differences?.length).toBe(3);
      const message = formatSafeDriftFailure(failure);
      expect(message).not.toMatch(/password/);
      expect(message).not.toMatch(/2001:db8/);
      expect(message).not.toMatch(/postgresql/);
      expect(message).toMatch(/create index idx_0/);
    });
  });

  describe("architecture: no raw stream logging on error paths", () => {
    it("drift-lib and drift CLI do not log raw stdout/stderr or unsanitized exceptions", () => {
      const lib = readFileSync(join(__dirname, "..", "drift-lib.ts"), "utf8");
      const cli = readFileSync(join(__dirname, "..", "drift.ts"), "utf8");

      // Error-path logging must not interpolate result.stdout / result.stderr.
      expect(lib).not.toMatch(/console\.(log|error|warn)\([^)]*result\.stdout/);
      expect(lib).not.toMatch(/console\.(log|error|warn)\([^)]*result\.stderr/);
      expect(lib).not.toMatch(
        /throw new Error\([^)]*result\.(stdout|stderr)/,
      );
      // Thrown message is always formatSafeDriftFailure(classifyDriftFailure(...)).
      expect(lib).toMatch(
        /throw new Error\(formatSafeDriftFailure\(classifyDriftFailure\(result\)\)\)/,
      );
      // CLI only logs error.message (already fail-closed).
      expect(cli).toMatch(
        /console\.error\(error instanceof Error \? error\.message : error\)/,
      );
      expect(cli).not.toMatch(/result\.stdout|result\.stderr/);
    });
  });
});
