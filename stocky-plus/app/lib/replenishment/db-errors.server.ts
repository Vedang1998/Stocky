import { Prisma } from "@prisma/client";

/** A unique index rejected the write, usually because a concurrent request created the row first. */
export function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}
