import { afterEach, describe, expect, it } from "vitest";
import { withAdmissionPrincipal } from "../../../app/sync/admission-principal.server";

describe("admission principal URL fallback (F-11)", () => {
  const keys = [
    "STOCKY_ALLOW_CONTROL_PLANE_URL_FALLBACK",
    "STOCKY_ORIGINAL_ADMISSION_DATABASE_URL",
    "NODE_ENV",
  ] as const;
  const previous: Record<string, string | undefined> = {};

  afterEach(() => {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  });

  function snapshot(): void {
    for (const key of keys) previous[key] = process.env[key];
  }

  it("NODE_ENV=development without the test flag cannot use elevated URLs (negative)", async () => {
    snapshot();
    delete process.env.STOCKY_ORIGINAL_ADMISSION_DATABASE_URL;
    delete process.env.STOCKY_ALLOW_CONTROL_PLANE_URL_FALLBACK;
    process.env.NODE_ENV = "development";
    await expect(
      withAdmissionPrincipal("stocky_original_admission", async () => 1),
    ).rejects.toThrow(/admission_principal_url_required/);
  });

  it("test flag is the only elevated-URL bypass (positive)", async () => {
    snapshot();
    delete process.env.STOCKY_ORIGINAL_ADMISSION_DATABASE_URL;
    process.env.STOCKY_ALLOW_CONTROL_PLANE_URL_FALLBACK = "1";
    process.env.NODE_ENV = "development";
    if (!process.env.DATABASE_URL && !process.env.DATABASE_MIGRATION_URL) {
      await expect(
        withAdmissionPrincipal("stocky_original_admission", async () => 1),
      ).rejects.toThrow(/admission_principal_url_missing/);
      return;
    }
    try {
      await withAdmissionPrincipal("stocky_original_admission", async () => 1);
    } catch (err) {
      expect(String(err)).not.toMatch(/admission_principal_url_required/);
    }
  });
});
