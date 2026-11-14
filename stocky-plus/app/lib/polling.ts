export type PageVisibility = {
  isHidden(): boolean;
  /** Returns a function that removes the listener. */
  onChange(listener: () => void): () => void;
};

export type PollingOptions = {
  poll: () => void;
  intervalMs: number;
  /** Epoch milliseconds after which nothing more is polled. */
  deadline: number;
  visibility: PageVisibility;
  now?: () => number;
};

/**
 * Calls `poll` every `intervalMs` until `deadline`, pausing while the page
 * is hidden. Showing the page again polls at once and then resumes the
 * interval. Returns a function that stops everything.
 */
export function startPolling({
  poll,
  intervalMs,
  deadline,
  visibility,
  now = Date.now,
}: PollingOptions): () => void {
  let timer: ReturnType<typeof setInterval> | null = null;

  const pause = () => {
    if (timer !== null) clearInterval(timer);
    timer = null;
  };
  const tick = () => {
    if (now() >= deadline) {
      pause();
      return;
    }
    poll();
  };
  const resume = () => {
    if (timer === null && now() < deadline) {
      timer = setInterval(tick, intervalMs);
    }
  };

  if (!visibility.isHidden()) resume();
  const removeListener = visibility.onChange(() => {
    if (visibility.isHidden()) {
      pause();
    } else {
      tick();
      resume();
    }
  });

  return () => {
    pause();
    removeListener();
  };
}
