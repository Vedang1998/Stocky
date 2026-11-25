import { Prisma } from "@prisma/client";

/** A unique index rejected the write, usually because a concurrent request created the row first. */
export function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

/**
 * The transaction gave up without writing: it ran past its time limit or
 * waited too long to start (P2028), or lost a write conflict or deadlock
 * (P2034). Nothing was saved, and trying again may succeed.
 */
export function isTransactionAbandoned(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2028" || error.code === "P2034")
  );
}
