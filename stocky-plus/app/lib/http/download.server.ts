/**
 * Response headers for merchant data downloads (CSV, PDF, ZPL).
 *
 * Downloads carry shop data such as costs and valuations, so they must not be
 * stored by shared caches, must not be content-sniffed into another type, and
 * must use a filename that cannot break out of the Content-Disposition header.
 */

const MAX_FILENAME_LENGTH = 120;

/**
 * Reduce a filename to a conservative ASCII set: letters, digits, dot,
 * underscore and hyphen. Path separators, quotes, control characters and
 * header delimiters are replaced, and leading dots are removed so the result
 * is never a hidden or relative path.
 */
export function sanitizeDownloadFilename(filename: string): string {
  const cleaned = filename
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[.-]+/, "")
    .replace(/-+$/, "")
    .slice(0, MAX_FILENAME_LENGTH);
  return cleaned === "" ? "download" : cleaned;
}

export type DownloadDisposition = "attachment" | "inline";

export function downloadHeaders(input: {
  contentType: string;
  filename: string;
  disposition?: DownloadDisposition;
}): Headers {
  const filename = sanitizeDownloadFilename(input.filename);
  return new Headers({
    "Content-Type": input.contentType,
    "Content-Disposition": `${input.disposition ?? "attachment"}; filename="${filename}"`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  });
}
