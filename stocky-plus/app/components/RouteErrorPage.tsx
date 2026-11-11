import type { RouteErrorView } from "../lib/route-error";

const containerStyle = {
  maxWidth: "36rem",
  margin: "4rem auto",
  padding: "0 1rem",
  fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
  color: "#303030",
  lineHeight: 1.5,
} as const;

// Rendered by error boundaries, which run without the App Bridge / Polaris
// providers, so this uses plain markup only.
export function RouteErrorPage({ view }: { view: RouteErrorView }) {
  return (
    <main style={containerStyle}>
      <h1 style={{ fontSize: "1.25rem", margin: "0 0 0.5rem" }}>
        {view.title}
      </h1>
      <p style={{ margin: "0 0 1rem" }}>{view.message}</p>
      {view.status >= 500 ? (
        <button type="button" onClick={() => window.location.reload()}>
          Reload
        </button>
      ) : null}
    </main>
  );
}
