import { describe, expect, it } from "vitest";
import {
  emptyDScratchLedger,
  resolveDScratchLedger,
} from "./scratch-quota";

describe("PR6-D NEW-SCQ-01 ledger resolution", () => {
  it("treats absent evidence plus a newly created marker and no attempts as first init", () => {
    const resolved = resolveDScratchLedger({
      file: { kind: "absent" },
      namespaceMarkerCreated: true,
      attemptDirCount: 0,
    });
    expect(resolved).toEqual({
      status: "ok",
      integrity: "uninitialized",
      ledger: emptyDScratchLedger(),
    });
  });

  it("does not reset an initialized namespace when the ledger file is missing", () => {
    const resolved = resolveDScratchLedger({
      file: { kind: "absent" },
      namespaceMarkerCreated: false,
      attemptDirCount: 0,
    });
    expect(resolved).toEqual({
      status: "integrity_failed",
      integrity: "missing",
    });
  });

  it("does not collapse corrupt or wrong-version evidence into an empty ledger", () => {
    expect(
      resolveDScratchLedger({
        file: { kind: "integrity_failed", integrity: "corrupt" },
        namespaceMarkerCreated: true,
        attemptDirCount: 0,
      }),
    ).toEqual({ status: "integrity_failed", integrity: "corrupt" });
    expect(
      resolveDScratchLedger({
        file: { kind: "integrity_failed", integrity: "wrong_version" },
        namespaceMarkerCreated: false,
        attemptDirCount: 1,
      }),
    ).toEqual({ status: "integrity_failed", integrity: "wrong_version" });
  });
});
