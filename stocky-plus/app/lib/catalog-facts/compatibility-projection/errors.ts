import type { CompatibilityProjectionIdentity } from "./types";

export class CompatibilityProjectionError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly identity?: CompatibilityProjectionIdentity;

  constructor(
    code: string,
    message: string,
    options?: {
      retryable?: boolean;
      identity?: CompatibilityProjectionIdentity;
    },
  ) {
    super(message);
    this.name = "CompatibilityProjectionError";
    this.code = code;
    this.retryable = options?.retryable ?? true;
    this.identity = options?.identity;
  }
}
