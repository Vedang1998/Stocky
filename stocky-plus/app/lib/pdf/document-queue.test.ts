/**
 * Documents are laid out one at a time (see `renderPdf`). These tests use
 * the real renderer on one-line documents.
 */
import { createElement as h } from "react";
import { describe, expect, it } from "vitest";
import { renderPdf } from "./document.server";

type Build = Parameters<typeof renderPdf>[0];

/** A one-line document that notes when its layout starts and how it ended. */
function paper(name: string, log: string[]): Promise<void> {
  const build: Build = ({ Document, Page, Text }) => {
    log.push(`${name} starts`);
    return h(Document, null, h(Page, { size: "LETTER" }, h(Text, null, name)));
  };
  return renderPdf(build).then((bytes) => {
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    log.push(`${name} done`);
  });
}

describe("Laying out documents asked for at the same time", () => {
  it("finishes each document before the next one starts, in the order asked", async () => {
    const log: string[] = [];

    await Promise.all([paper("A", log), paper("B", log), paper("C", log)]);

    expect(log).toEqual([
      "A starts",
      "A done",
      "B starts",
      "B done",
      "C starts",
      "C done",
    ]);
  });

  it("starts no layout in the turn it was asked for: waiting requests go first", async () => {
    const log: string[] = [];
    const asked = paper("A", log);
    const waiting = new Promise<void>((resolve) =>
      setImmediate(() => {
        log.push("a waiting request ran");
        resolve();
      }),
    );

    await Promise.all([asked, waiting]);

    expect(log.slice(0, 2)).toEqual(["a waiting request ran", "A starts"]);
  });

  it("goes on with the next document when one fails", async () => {
    const log: string[] = [];
    const broken = renderPdf(() => {
      log.push("broken starts");
      throw new Error("no such font");
    });
    const next = paper("B", log);

    await expect(broken).rejects.toThrow("no such font");
    await next;

    expect(log).toEqual(["broken starts", "B starts", "B done"]);
  });
});
