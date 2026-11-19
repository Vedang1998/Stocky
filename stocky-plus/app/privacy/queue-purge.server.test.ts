import { beforeEach, describe, expect, it, vi } from "vitest";

const queues = vi.hoisted(() => ({
  webhook: null as unknown,
  cron: null as unknown,
}));

vi.mock("../jobs/queue.server", () => ({
  getWebhookQueue: () => queues.webhook,
  getCronQueue: () => queues.cron,
}));

import { purgeQueuedJobsForShop } from "./queue-purge.server";

type FakeJob = { data: unknown; remove: () => Promise<void> };

/** A queue whose listing shrinks as jobs are removed, like BullMQ's. */
function fakeQueue(jobsByState: Record<string, unknown[]>, locked = new Set()) {
  const lists = new Map<string, FakeJob[]>();
  for (const [state, all] of Object.entries(jobsByState)) {
    const list: FakeJob[] = [];
    for (const data of all) {
      const job: FakeJob = {
        data,
        remove: async () => {
          if (locked.has(data)) throw new Error("job is locked");
          list.splice(list.indexOf(job), 1);
        },
      };
      list.push(job);
    }
    lists.set(state, list);
  }
  return {
    getJobs: vi.fn(async ([state]: string[], start: number, end: number) =>
      (lists.get(state) ?? []).slice(start, end + 1),
    ),
    remaining: (state: string) => (lists.get(state) ?? []).map((j) => j.data),
  };
}

const job = (shopId: string, n = 0) => ({ tenant: { shopId }, n });

describe("purgeQueuedJobsForShop", () => {
  beforeEach(() => {
    queues.webhook = fakeQueue({});
    queues.cron = fakeQueue({});
  });

  it("removes the shop's jobs in every state of both queues and nothing else", async () => {
    const webhook = fakeQueue({
      waiting: [job("shop-a"), job("shop-b")],
      delayed: [job("shop-a")],
      completed: [job("shop-b"), job("shop-a")],
      failed: [job("shop-a")],
    });
    const cron = fakeQueue({
      waiting: [{ kind: "abc-analysis-fanout" }, job("shop-a")],
    });
    queues.webhook = webhook;
    queues.cron = cron;

    expect(await purgeQueuedJobsForShop("shop-a")).toBe(5);

    expect(webhook.remaining("waiting")).toEqual([job("shop-b")]);
    expect(webhook.remaining("delayed")).toEqual([]);
    expect(webhook.remaining("completed")).toEqual([job("shop-b")]);
    expect(webhook.remaining("failed")).toEqual([]);
    expect(cron.remaining("waiting")).toEqual([{ kind: "abc-analysis-fanout" }]);
  });

  it("walks past the first page without skipping jobs that shift down", async () => {
    const mixed = Array.from({ length: 1200 }, (_, n) =>
      job(n % 3 === 0 ? "shop-b" : "shop-a", n),
    );
    const webhook = fakeQueue({ completed: mixed });
    queues.webhook = webhook;

    expect(await purgeQueuedJobsForShop("shop-a")).toBe(800);
    expect(webhook.remaining("completed")).toHaveLength(400);
    expect(
      webhook
        .remaining("completed")
        .every((data) => (data as { tenant: { shopId: string } }).tenant.shopId === "shop-b"),
    ).toBe(true);
  });

  it("leaves a job a worker holds and carries on", async () => {
    const held = job("shop-a", 1);
    const webhook = fakeQueue(
      { waiting: [held, job("shop-a", 2)] },
      new Set([held]),
    );
    queues.webhook = webhook;

    expect(await purgeQueuedJobsForShop("shop-a")).toBe(1);
    expect(webhook.remaining("waiting")).toEqual([held]);
  });
});
