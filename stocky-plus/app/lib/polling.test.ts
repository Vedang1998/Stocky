import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startPolling, type PageVisibility } from "./polling";

function fakeVisibility(hidden = false) {
  const listeners = new Set<() => void>();
  const visibility: PageVisibility = {
    isHidden: () => hidden,
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return {
    visibility,
    listeners,
    set(next: boolean) {
      hidden = next;
      for (const listener of listeners) listener();
    },
  };
}

describe("startPolling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-11T09:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("polls on every interval, and not before the first one", () => {
    const poll = vi.fn();
    const { visibility } = fakeVisibility();
    startPolling({ poll, intervalMs: 5000, deadline: Date.now() + 60_000, visibility });

    expect(poll).not.toHaveBeenCalled();
    vi.advanceTimersByTime(15_000);
    expect(poll).toHaveBeenCalledTimes(3);
  });

  it("stops at the deadline", () => {
    const poll = vi.fn();
    const { visibility } = fakeVisibility();
    startPolling({ poll, intervalMs: 5000, deadline: Date.now() + 12_000, visibility });

    vi.advanceTimersByTime(60_000);
    expect(poll).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("stops polling and listening when stopped", () => {
    const poll = vi.fn();
    const page = fakeVisibility();
    const stop = startPolling({
      poll,
      intervalMs: 5000,
      deadline: Date.now() + 60_000,
      visibility: page.visibility,
    });

    vi.advanceTimersByTime(5000);
    stop();
    vi.advanceTimersByTime(30_000);
    expect(poll).toHaveBeenCalledTimes(1);
    expect(page.listeners.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("pauses while the page is hidden and catches up at once when it is shown", () => {
    const poll = vi.fn();
    const page = fakeVisibility();
    startPolling({
      poll,
      intervalMs: 5000,
      deadline: Date.now() + 120_000,
      visibility: page.visibility,
    });

    vi.advanceTimersByTime(5000);
    page.set(true);
    vi.advanceTimersByTime(30_000);
    expect(poll).toHaveBeenCalledTimes(1);

    page.set(false);
    expect(poll).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(10_000);
    expect(poll).toHaveBeenCalledTimes(4);
  });

  it("does not start while hidden, and never runs two timers", () => {
    const poll = vi.fn();
    const page = fakeVisibility(true);
    startPolling({
      poll,
      intervalMs: 5000,
      deadline: Date.now() + 120_000,
      visibility: page.visibility,
    });

    vi.advanceTimersByTime(20_000);
    expect(poll).not.toHaveBeenCalled();

    page.set(false);
    page.set(false);
    expect(vi.getTimerCount()).toBe(1);
  });

  it("does not poll when shown again after the deadline", () => {
    const poll = vi.fn();
    const page = fakeVisibility(true);
    startPolling({
      poll,
      intervalMs: 5000,
      deadline: Date.now() + 10_000,
      visibility: page.visibility,
    });

    vi.advanceTimersByTime(20_000);
    page.set(false);
    vi.advanceTimersByTime(20_000);
    expect(poll).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
