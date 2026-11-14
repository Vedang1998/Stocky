import { useCallback, useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
// Browsers can refuse storage (private windows, blocked site data). The value
// then lives for the page's lifetime instead of failing.
const memory = new Map<string, string>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function read(key: string): string | null {
  const remembered = memory.get(key);
  if (remembered !== undefined) return remembered;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * A string kept in the browser's local storage. It reads as null on the
 * server and on the first client render, then as the stored value, so the two
 * renders agree.
 */
export function useStoredString(key: string): [string | null, (value: string) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null,
  );
  const set = useCallback(
    (next: string) => {
      memory.set(key, next);
      try {
        window.localStorage.setItem(key, next);
      } catch {
        // Kept in memory above.
      }
      for (const listener of listeners) listener();
    },
    [key],
  );
  return [value, set];
}
