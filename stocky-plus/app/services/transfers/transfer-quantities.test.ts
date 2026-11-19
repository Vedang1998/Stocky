import { describe, expect, it } from "vitest";
import {
  transferEventLabel,
  transferReference,
  transferStatusBadge,
} from "./transfer-display";
import {
  transferAttention,
  transferOutstandingQuantity,
  transferShipQuantity,
  transferTotals,
  transferWrittenOffQuantity,
  type TransferLedgerStanding,
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

describe("unfinished steps of a transfer", () => {
  const ledger = (
    values: Partial<TransferLedgerStanding> = {},
  ): TransferLedgerStanding => ({
    shipmentRequests: 0,
    unitsOutOfSource: 0,
    unitsIntoDestination: 0,
    shipmentUnfinished: false,
    receiptUnfinished: false,
    ...values,
  });
  const shipped = ledger({ shipmentRequests: 1, unitsOutOfSource: 10 });
  const totals = { shipUnits: 10, receivedUnits: 4 };

  it("finds nothing unfinished on a draft or a cancelled transfer whose stock is all at the source", () => {
    for (const status of ["DRAFT", "CANCELLED"]) {
      expect(transferAttention(status, totals, ledger())).toBeNull();
      // A request Shopify refused whole moved nothing.
      expect(
        transferAttention(status, totals, ledger({ shipmentRequests: 2 })),
      ).toBeNull();
    }
  });

  it("points at stock that is out of the source before the transfer shipped or after it was cancelled", () => {
    const partlyOut = ledger({ shipmentRequests: 1, unitsOutOfSource: 4 });
    const unanswered = ledger({
      shipmentRequests: 1,
      shipmentUnfinished: true,
    });

    for (const standing of [partlyOut, unanswered, shipped]) {
      expect(transferAttention("DRAFT", totals, standing)).toBe(
        "SHIPMENT_UNFINISHED",
      );
      expect(transferAttention("CANCELLED", totals, standing)).toBe(
        "PUT_BACK_UNFINISHED",
      );
    }
  });

  it("finds a transfer in transit in order when the ledger matches its lines", () => {
    expect(
      transferAttention(
        "IN_TRANSIT",
        totals,
        ledger({ ...shipped, unitsIntoDestination: 4 }),
      ),
    ).toBeNull();
  });

  it("points at a transfer in transit that never left the source in the ledger", () => {
    expect(transferAttention("IN_TRANSIT", totals, ledger())).toBe(
      "NO_SHIPMENT_RECORD",
    );
  });

  it("points at a return to the source before it looks at the receipt", () => {
    const receiptOutOfLine = { unitsIntoDestination: 1 };
    expect(
      transferAttention(
        "IN_TRANSIT",
        totals,
        ledger({ ...shipped, ...receiptOutOfLine, unitsOutOfSource: 7 }),
      ),
    ).toBe("RETURN_UNFINISHED");
    // More out of the source than the lines say is out of line as well.
    expect(
      transferAttention(
        "IN_TRANSIT",
        totals,
        ledger({ ...shipped, unitsOutOfSource: 12, unitsIntoDestination: 4 }),
      ),
    ).toBe("RETURN_UNFINISHED");
    expect(
      transferAttention(
        "IN_TRANSIT",
        totals,
        ledger({ ...shipped, ...receiptOutOfLine, shipmentUnfinished: true }),
      ),
    ).toBe("RETURN_UNFINISHED");
  });

  it("points at a receipt whose units are not all in stock at the destination, or one too many", () => {
    for (const unitsIntoDestination of [0, 3, 5]) {
      expect(
        transferAttention(
          "IN_TRANSIT",
          totals,
          ledger({ ...shipped, unitsIntoDestination }),
        ),
      ).toBe("RECEIPT_UNFINISHED");
    }
    expect(
      transferAttention(
        "IN_TRANSIT",
        totals,
        ledger({
          ...shipped,
          unitsIntoDestination: 4,
          receiptUnfinished: true,
        }),
      ),
    ).toBe("RECEIPT_UNFINISHED");
  });

  it("finds nothing unfinished on a finished transfer", () => {
    expect(
      transferAttention(
        "RECEIVED",
        totals,
        ledger({ shipmentRequests: 2, unitsOutOfSource: 4 }),
      ),
    ).toBeNull();
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
