import { OrderFactReadWalkError } from "./errors";
import type { OrderReadIssueExtras } from "./types";

export function assertReturnedGidMatches(
  requested: string,
  returned: unknown,
  noun: string,
  extras: OrderReadIssueExtras = {},
): string {
  if (returned == null) {
    throw new OrderFactReadWalkError(
      "IDENTITY_MISMATCH",
      `${noun} returned identity is missing`,
      extras,
    );
  }
  if (typeof returned !== "string") {
    throw new OrderFactReadWalkError(
      "IDENTITY_MISMATCH",
      `${noun} returned identity type:${typeof returned} does not match requested ${requested}`,
      extras,
    );
  }
  if (returned === "") {
    throw new OrderFactReadWalkError(
      "IDENTITY_MISMATCH",
      `${noun} returned identity is empty`,
      extras,
    );
  }
  if (returned !== requested) {
    throw new OrderFactReadWalkError(
      "IDENTITY_MISMATCH",
      `${noun} returned identity ${returned} does not match requested ${requested}`,
      extras,
    );
  }
  return returned;
}
