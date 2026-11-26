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
  transferShipsInParts,
  transferTotals,
  transferUnshippedQuantity,
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

  it("ships exactly what was picked, which may be nothing, on a draft that ships in parts", () => {
    expect(transferShipQuantity(line(), true)).toBe(0);
    expect(transferShipQuantity(line({ pickedQty: 7 }), true)).toBe(7);
  });

  it("reads a shipped line's units from what it shows as shipped, whatever is picked for its next shipment", () => {
    const partShipped = line({ shippedQty: 4, pickedQty: 3 });
    expect(transferShipQuantity(partShipped)).toBe(4);
    expect(transferShipQuantity(partShipped, true)).toBe(4);
    // A line of which nothing has shipped yet says 0, not its whole quantity.
    expect(transferShipQuantity(line({ shippedQty: 0 }))).toBe(0);
    // A line shipped before shipments in parts existed keeps the earlier rule.
    expect(transferShipQuantity(line({ shippedQty: null, pickedQty: 7 }))).toBe(
      7,
    );
  });

  it("takes a transfer in transit for one that ships in parts only when every line says what it shipped", () => {
    const flagged = (status: string) => ({ status, shipsInParts: true });

    expect(
      transferShipsInParts(flagged("IN_TRANSIT"), [
        { shippedQty: 3 },
        { shippedQty: 0 },
      ]),
    ).toBe(true);
    // Shipped whole by earlier code: the shipped units are in `pickedQty`.
    expect(
      transferShipsInParts(flagged("IN_TRANSIT"), [
        { shippedQty: 3 },
        { shippedQty: null },
      ]),
    ).toBe(false);
    expect(transferShipsInParts(flagged("IN_TRANSIT"), [{}])).toBe(false);
    // A draft has shipped nothing yet, so its lines say nothing.
    expect(transferShipsInParts(flagged("DRAFT"), [{ shippedQty: null }])).toBe(
      true,
    );
    expect(
      transferShipsInParts({ status: "IN_TRANSIT", shipsInParts: false }, [
        { shippedQty: 3 },
      ]),
    ).toBe(false);
  });

  it("knows the units of a shipped line that have not left the source yet", () => {
    expect(transferUnshippedQuantity(line({ shippedQty: 4 }))).toBe(6);
    expect(transferUnshippedQuantity(line({ shippedQty: 0 }))).toBe(10);
    expect(transferUnshippedQuantity(line({ shippedQty: 10 }))).toBe(0);
    // A draft line, or one shipped under the earlier rule, has none.
    expect(transferUnshippedQuantity(line())).toBe(0);
    expect(transferUnshippedQuantity(line({ pickedQty: 7 }))).toBe(0);
  });

  it("counts only shipped units as outstanding on a transfer that ships in parts", () => {
    expect(
      transferOutstandingQuantity(
        line({ shippedQty: 4, pickedQty: 3, receivedQty: 1 }),
      ),
    ).toBe(3);
    expect(transferOutstandingQuantity(line({ shippedQty: 0 }))).toBe(0);
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
      toShipUnits: 0,
      nextShipmentUnits: 0,
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

  it("adds up the units still to ship and the units picked for the next shipment on a transfer that ships in parts", () => {
    const lines = [
      line({ shippedQty: 4, pickedQty: 3, receivedQty: 1 }),
      line({ quantity: 5, shippedQty: 0 }),
      line({ quantity: 2, shippedQty: 2 }),
    ];
    expect(transferTotals("IN_TRANSIT", lines, true)).toMatchObject({
      requestedUnits: 17,
      shipUnits: 6,
      receivedUnits: 1,
      outstandingUnits: 5,
      toShipUnits: 11,
      nextShipmentUnits: 3,
    });
    // Once the transfer is closed nothing is still to ship or picked.
    expect(transferTotals("RECEIVED", lines)).toMatchObject({
      shipUnits: 6,
      toShipUnits: 0,
      nextShipmentUnits: 0,
      writtenOffUnits: 5,
    });
  });

  it("adds up only the picked units as the first shipment of a draft that ships in parts", () => {
    const lines = [line({ pickedQty: 3 }), line({ quantity: 5 })];
    expect(transferTotals("DRAFT", lines, true)).toMatchObject({
      requestedUnits: 15,
      shipUnits: 3,
      toShipUnits: 0,
      nextShipmentUnits: 3,
    });
    expect(transferTotals("DRAFT", lines)).toMatchObject({ shipUnits: 8 });
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

  it("points at an unfinished later shipment on a transfer that ships in parts", () => {
    // More out of the source than the lines show as shipped.
    expect(
      transferAttention(
        "IN_TRANSIT",
        totals,
        ledger({ ...shipped, unitsOutOfSource: 12, unitsIntoDestination: 4 }),
        true,
      ),
    ).toBe("NEXT_SHIPMENT_UNFINISHED");
    // A request Shopify is still answering.
    expect(
      transferAttention(
        "IN_TRANSIT",
        totals,
        ledger({ ...shipped, shipmentUnfinished: true }),
        true,
      ),
    ).toBe("NEXT_SHIPMENT_UNFINISHED");
    // A request that puts units back is a close Shopify is still answering.
    expect(
      transferAttention(
        "IN_TRANSIT",
        totals,
        ledger({
          ...shipped,
          shipmentUnfinished: true,
          returnUnfinished: true,
        }),
        true,
      ),
    ).toBe("RETURN_UNFINISHED");
    // Less out of the source than was shipped is still a close that stopped.
    expect(
      transferAttention(
        "IN_TRANSIT",
        totals,
        ledger({ ...shipped, unitsOutOfSource: 7 }),
        true,
      ),
    ).toBe("RETURN_UNFINISHED");
    expect(
      transferAttention(
        "IN_TRANSIT",
        totals,
        ledger({ ...shipped, unitsIntoDestination: 4 }),
        true,
      ),
    ).toBeNull();
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
    expect(label("IN_TRANSIT", { toShipUnits: 4 })).toBe("Partly shipped");
    expect(label("IN_TRANSIT", { toShipUnits: 4, receivedUnits: 1 })).toBe(
      "Partly received",
    );
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
