import { describe, expect, it } from "vitest";
import {
  transferEventLabel,
  transferReference,
  transferStatusBadge,
} from "./transfer-display";
import {
  transferOutstandingQuantity,
  transferShipQuantity,
  transferTotals,
  transferWrittenOffQuantity,
  type TransferLineQuantities,
} from "./transfer-quantities";

const line = (
  values: Partial<TransferLineQuantities> = {},
): TransferLineQuantities => ({
  quantity: 10,
  pickedQty: 0,
  receivedQty: 0,
  pendingReceiveQty: 0,
  rejectedQty: 0,
  returnedQty: 0,
  ...values,
});

describe("transfer quantities", () => {
  it("ships what was picked, or everything requested when nothing was picked", () => {
    expect(transferShipQuantity(line())).toBe(10);
    expect(transferShipQuantity(line({ pickedQty: 7 }))).toBe(7);
  });

  it("counts a shipped unit as outstanding until it is received, counted in, rejected or returned", () => {
    expect(transferOutstandingQuantity(line({ pickedQty: 8 }))).toBe(8);
    expect(
      transferOutstandingQuantity(
        line({
          pickedQty: 8,
          receivedQty: 3,
          pendingReceiveQty: 2,
          rejectedQty: 1,
          returnedQty: 1,
        }),
      ),
    ).toBe(1);
  });

  it("writes off what is still unaccounted for only once the transfer is finished", () => {
    const short = line({ receivedQty: 6, rejectedQty: 1 });
    expect(transferWrittenOffQuantity("IN_TRANSIT", short)).toBe(0);
    expect(transferWrittenOffQuantity("RECEIVED", short)).toBe(3);
    expect(
      transferWrittenOffQuantity("RECEIVED", line({ receivedQty: 10 })),
    ).toBe(0);
    // A transfer received before partial receipts existed may hold more than it shipped.
    expect(
      transferWrittenOffQuantity("RECEIVED", line({ receivedQty: 12 })),
    ).toBe(0);
  });

  it("adds up where the units of a transfer stand", () => {
    const lines = [
      line({ pickedQty: 8, receivedQty: 3, pendingReceiveQty: 2 }),
      line({ quantity: 5, rejectedQty: 1 }),
    ];
    expect(transferTotals("IN_TRANSIT", lines)).toEqual({
      lineCount: 2,
      requestedUnits: 15,
      shipUnits: 13,
      receivedUnits: 3,
      countedInUnits: 2,
      rejectedUnits: 1,
      returnedUnits: 0,
      writtenOffUnits: 0,
      outstandingUnits: 7,
    });
    expect(transferTotals("RECEIVED", lines)).toMatchObject({
      writtenOffUnits: 7,
      outstandingUnits: 0,
    });
    expect(transferTotals("CANCELLED", lines)).toMatchObject({
      requestedUnits: 15,
      shipUnits: 0,
      outstandingUnits: 0,
    });
    expect(transferTotals("DRAFT", [])).toMatchObject({
      lineCount: 0,
      shipUnits: 0,
    });
  });
});

describe("transfer wording", () => {
  const progress = (
    values: Partial<Parameters<typeof transferStatusBadge>[1]>,
  ) => ({
    shipUnits: 10,
    receivedUnits: 0,
    rejectedUnits: 0,
    returnedUnits: 0,
    writtenOffUnits: 0,
    ...values,
  });

  it("says how a transfer stands", () => {
    const label = (
      status: Parameters<typeof transferStatusBadge>[0],
      values = {},
    ) => transferStatusBadge(status, progress(values)).label;

    expect(label("DRAFT")).toBe("Draft");
    expect(label("CANCELLED")).toBe("Cancelled");
    expect(label("IN_TRANSIT")).toBe("In transit");
    expect(label("IN_TRANSIT", { receivedUnits: 1 })).toBe("Partly received");
    expect(label("IN_TRANSIT", { rejectedUnits: 1 })).toBe("Partly received");
    expect(label("RECEIVED", { receivedUnits: 10 })).toBe("Received");
    expect(label("RECEIVED", { receivedUnits: 9, rejectedUnits: 1 })).toBe(
      "Received with rejects",
    );
    expect(label("RECEIVED", { receivedUnits: 9, returnedUnits: 1 })).toBe(
      "Closed short",
    );
    expect(label("RECEIVED", { receivedUnits: 9, writtenOffUnits: 1 })).toBe(
      "Closed short",
    );
  });

  it("names a transfer by the end of its ID", () => {
    expect(transferReference("cmhx0abc9k3f2q")).toBe("T-9K3F2Q");
  });

  it("describes a ledger entry by its leg and direction", () => {
    expect(transferEventLabel("shipment", -10)).toBe(
      "10 units left the source",
    );
    expect(transferEventLabel("shipment", 1)).toBe(
      "1 unit put back at the source",
    );
    expect(transferEventLabel("receipt", 3)).toBe(
      "3 units received at the destination",
    );
    expect(transferEventLabel("receipt", -2)).toBe(
      "2 units taken back out at the destination",
    );
    expect(transferEventLabel("shipment", 0)).toBe("Change at the source");
    expect(transferEventLabel("receipt", 0)).toBe("Change at the destination");
  });
});
