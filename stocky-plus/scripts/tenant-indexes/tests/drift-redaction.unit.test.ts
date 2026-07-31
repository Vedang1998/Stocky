import { describe, expect, it } from "vitest";
import {
  classifyDriftFailure,
  redactPrismaDiagnosticText,
} from "../drift-lib";

describe("drift stderr redaction (F-N09)", () => {
  it("redacts postgresql URLs with credentials", () => {
    const raw =
      "Error: P1001: Can't reach database server at `postgresql://stocky:s3cret@db.internal:5432/stocky_plus_ci?sslmode=require`";
    const out = redactPrismaDiagnosticText(raw);
    expect(out).not.toMatch(/s3cret/);
    expect(out).not.toMatch(/db\.internal/);
    expect(out).not.toMatch(/5432/);
    expect(out).not.toMatch(/postgresql:\/\//);
    expect(out).toMatch(/REDACTED/);
  });

  it("redacts host:port and IPs from P1001-style messages", () => {
    const raw =
      "Can't reach database server at `127.0.0.1:5432`. Please make sure your database server is running.";
    const out = redactPrismaDiagnosticText(raw);
    expect(out).not.toMatch(/127\.0\.0\.1/);
    expect(out).toMatch(/REDACTED/);
  });

  it("redacts user:password@host fragments", () => {
    const raw = "connection failed for stocky:hunter2@pgbouncer.example.com:6432";
    const out = redactPrismaDiagnosticText(raw);
    expect(out).not.toMatch(/hunter2/);
    expect(out).not.toMatch(/pgbouncer\.example\.com/);
  });

  it("classifyDriftFailure keeps sanitized diff for exit 2 only", () => {
    const failure = classifyDriftFailure({
      exitCode: 2,
      stdout: "ALTER TABLE \"Supplier\" DROP COLUMN \"shop\"",
      stderr: "hint postgresql://u:p@host:5432/db",
    });
    expect(failure.errorCategory).toBe("schema_drift");
    expect(failure.sanitizedDiff).toBeTruthy();
    expect(failure.sanitizedDiff).not.toMatch(/postgresql:\/\//);
    expect(failure.sanitizedDiff).not.toMatch(/\bu:p@/);
  });

  it("classifyDriftFailure redacts runtime P1001 without retaining raw stderr", () => {
    const failure = classifyDriftFailure({
      exitCode: 1,
      stdout: "",
      stderr:
        "P1001: Can't reach database server at `10.0.0.9:5432` password=super-secret",
    });
    expect(failure.errorCategory).toBe("runtime_error");
    expect(failure.redactedSummary).not.toMatch(/10\.0\.0\.9/);
    expect(failure.redactedSummary).not.toMatch(/super-secret/);
    expect(failure.sanitizedDiff).toBeUndefined();
  });
});
