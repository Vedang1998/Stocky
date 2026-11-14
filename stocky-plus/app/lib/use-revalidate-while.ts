import { useEffect, useRef } from "react";
import { useRevalidator } from "react-router";
import { startPolling, type PageVisibility } from "./polling";

const documentVisibility: PageVisibility = {
  isHidden: () => document.hidden,
  onChange(listener) {
    document.addEventListener("visibilitychange", listener);
    return () => document.removeEventListener("visibilitychange", listener);
  },
};

/**
 * Reloads the current page's data on an interval while `active` is true, so
 * a page showing background work catches up without a manual reload.
 *
 * Reloading stops when `active` turns false, while the tab is hidden and
 * `maxMs` after it began, so work that never finishes cannot keep a
 * forgotten tab requesting forever.
 */
export function useRevalidateWhile(
  active: boolean,
  { intervalMs, maxMs }: { intervalMs: number; maxMs: number },
): void {
  const { revalidate } = useRevalidator();
  // Survives the re-render each reload causes, so the limit is measured from
  // when the work was first seen rather than from the latest reload.
  const startedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) {
      startedAtRef.current = null;
      return;
    }
    startedAtRef.current ??= Date.now();
    return startPolling({
      poll: () => void revalidate(),
      intervalMs,
      deadline: startedAtRef.current + maxMs,
      visibility: documentVisibility,
    });
  }, [active, intervalMs, maxMs, revalidate]);
}
