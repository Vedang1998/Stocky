import { useState } from "react";

type Props = {
  /** Same-origin export URL, including the report's query string. */
  href: string;
  fallbackFilename: string;
};

type DownloadState =
  | { status: "idle" | "working" }
  | { status: "done"; truncated: boolean }
  | { status: "failed"; message: string };

function filenameFrom(response: Response, fallback: string): string {
  const match = /filename="([^"]+)"/.exec(
    response.headers.get("Content-Disposition") ?? "",
  );
  return match?.[1] ?? fallback;
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/**
 * Downloads a CSV through `fetch`, which App Bridge signs with the session
 * token. A plain link or a new tab would reach the server unauthenticated.
 */
export function CsvDownloadButton({ href, fallbackFilename }: Props) {
  const [state, setState] = useState<DownloadState>({ status: "idle" });

  async function download() {
    setState({ status: "working" });
    try {
      const response = await fetch(href, { headers: { Accept: "text/csv" } });
      if (!response.ok) {
        const detail =
          response.status < 500 ? (await response.text()).slice(0, 200) : "";
        setState({
          status: "failed",
          message:
            detail ||
            "The download could not be prepared. Try again in a moment.",
        });
        return;
      }
      saveBlob(await response.blob(), filenameFrom(response, fallbackFilename));
      setState({
        status: "done",
        truncated: response.headers.get("X-Report-Truncated") === "true",
      });
    } catch {
      setState({
        status: "failed",
        message:
          "The download did not finish. Check your connection and try again.",
      });
    }
  }

  return (
    <s-stack direction="block" gap="small">
      <s-button
        variant="secondary"
        loading={state.status === "working"}
        disabled={state.status === "working"}
        onClick={download}
      >
        Download CSV
      </s-button>
      {state.status === "failed" && (
        <s-banner tone="critical" heading="CSV download failed">
          <s-paragraph>{state.message}</s-paragraph>
        </s-banner>
      )}
      {state.status === "done" && state.truncated && (
        <s-banner tone="warning" heading="The download is not the whole report">
          <s-paragraph>
            It holds the first rows only. Narrow the date range or add a filter
            to download the rest.
          </s-paragraph>
        </s-banner>
      )}
    </s-stack>
  );
}
