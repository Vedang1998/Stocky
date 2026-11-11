import { describe, expect, it } from "vitest";
import { downloadHeaders, sanitizeDownloadFilename } from "./download.server";

describe("sanitizeDownloadFilename", () => {
  it.each([
    ["valuation-2026-11-10.csv", "valuation-2026-11-10.csv"],
    ['a"; filename*=UTF-8\'\'evil.html', "a-filename-UTF-8-evil.html"],
    ["../../etc/passwd", "etc-passwd"],
    [".hidden", "hidden"],
    ["line\r\nbreak.csv", "line-break.csv"],
    ["Café report.csv", "Cafe-report.csv"],
    ["", "download"],
    ["///", "download"],
  ])("%j -> %j", (input, expected) => {
    expect(sanitizeDownloadFilename(input)).toBe(expected);
  });

  it("caps the length", () => {
    expect(sanitizeDownloadFilename("a".repeat(500))).toHaveLength(120);
  });
});

describe("downloadHeaders", () => {
  it("marks downloads private, non-cacheable and non-sniffable", () => {
    const headers = downloadHeaders({
      contentType: "application/pdf",
      filename: "receiver-abc123.pdf",
      disposition: "inline",
    });
    expect(headers.get("Content-Type")).toBe("application/pdf");
    expect(headers.get("Content-Disposition")).toBe('inline; filename="receiver-abc123.pdf"');
    expect(headers.get("Cache-Control")).toBe("private, no-store");
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("defaults to attachment", () => {
    expect(
      downloadHeaders({ contentType: "text/plain", filename: "labels.zpl" }).get(
        "Content-Disposition",
      ),
    ).toBe('attachment; filename="labels.zpl"');
  });
});
