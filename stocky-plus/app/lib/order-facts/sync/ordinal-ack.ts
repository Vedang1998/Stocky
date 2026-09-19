/**
 * Disk-backed committed-ordinal bitset for D import checkpoints.
 * The contiguous prefix is the only durable skip cursor. Pending holes live
 * in a bounded scratch bitset, not an in-memory Set of ordinals.
 */
import { open, writeFile } from "node:fs/promises";
import path from "node:path";
import { ORDER_FACTS_JSONL_MAX_ACK_BITSET_BYTES } from "./constants";
import { OrderFactsJsonlError } from "./errors";

export class DiskOrdinalAck {
  private readonly bits: Buffer;
  private readonly lastOrdinal: number;
  private contiguous: number;
  readonly filePath: string;

  private constructor(input: {
    bits: Buffer;
    lastOrdinal: number;
    contiguous: number;
    filePath: string;
  }) {
    this.bits = input.bits;
    this.lastOrdinal = input.lastOrdinal;
    this.contiguous = input.contiguous;
    this.filePath = input.filePath;
  }

  static async open(input: {
    dir: string;
    lastOrdinal: number;
    contiguous: number;
  }): Promise<DiskOrdinalAck> {
    if (!Number.isInteger(input.lastOrdinal) || input.lastOrdinal < 0) {
      throw new OrderFactsJsonlError(
        "jsonl_ack_ordinal_invalid",
        "lastPhysicalOrdinal must be a non-negative integer",
      );
    }
    const bytes =
      input.lastOrdinal === 0 ? 0 : Math.ceil(input.lastOrdinal / 8);
    if (bytes > ORDER_FACTS_JSONL_MAX_ACK_BITSET_BYTES) {
      throw new OrderFactsJsonlError(
        "jsonl_ack_bitset_bound",
        `ack bitset ${bytes} exceeded ${ORDER_FACTS_JSONL_MAX_ACK_BITSET_BYTES}`,
      );
    }
    const filePath = path.join(input.dir, "ack.bits");
    const bits = Buffer.alloc(bytes);
    await writeFile(filePath, bits, { mode: 0o600 });
    const ack = new DiskOrdinalAck({
      bits,
      lastOrdinal: input.lastOrdinal,
      contiguous: input.contiguous,
      filePath,
    });
    for (let ordinal = 1; ordinal <= input.contiguous; ordinal += 1) {
      ack.setBit(ordinal);
    }
    await ack.flush();
    return ack;
  }

  getContiguous(): number {
    return this.contiguous;
  }

  mark(ordinals: number[]): number {
    for (const ordinal of ordinals) {
      if (!Number.isInteger(ordinal) || ordinal < 1) continue;
      if (ordinal > this.lastOrdinal) {
        throw new OrderFactsJsonlError(
          "jsonl_ack_ordinal_invalid",
          `committed ordinal ${ordinal} exceeds lastPhysicalOrdinal ${this.lastOrdinal}`,
        );
      }
      this.setBit(ordinal);
    }
    while (
      this.contiguous < this.lastOrdinal &&
      this.getBit(this.contiguous + 1)
    ) {
      this.contiguous += 1;
    }
    return this.contiguous;
  }

  async flush(): Promise<void> {
    const handle = await open(this.filePath, "r+");
    try {
      await handle.write(this.bits, 0, this.bits.length, 0);
    } finally {
      await handle.close();
    }
  }

  private setBit(ordinal: number): void {
    const index = ordinal - 1;
    this.bits[index >> 3] |= 1 << (index & 7);
  }

  private getBit(ordinal: number): boolean {
    const index = ordinal - 1;
    return (this.bits[index >> 3] & (1 << (index & 7))) !== 0;
  }
}
