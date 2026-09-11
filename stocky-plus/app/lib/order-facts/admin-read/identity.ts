import { OrderFactReadWalkError } from "./errors";

export function assertReturnedGidMatches(
  requested: string,
  returned: unknown,
  noun: string,
): string {
  if (returned == null) {
    throw new OrderFactReadWalkError(
      "IDENTITY_MISMATCH",
      `${noun} returned identity is missing`,
    );
  }
  if (typeof returned !== "string") {
    throw new OrderFactReadWalkError(
      "IDENTITY_MISMATCH",
      `${noun} returned identity type:${typeof returned} does not match requested ${requested}`,
    );
  }
  if (returned === "") {
    throw new OrderFactReadWalkError(
      "IDENTITY_MISMATCH",
      `${noun} returned identity is empty`,
    );
  }
  if (returned !== requested) {
    throw new OrderFactReadWalkError(
      "IDENTITY_MISMATCH",
      `${noun} returned identity ${returned} does not match requested ${requested}`,
    );
  }
  return returned;
}
