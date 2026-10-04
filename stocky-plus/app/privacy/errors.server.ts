export class PrivacyBoundaryError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "PrivacyBoundaryError";
  }
}

export function isPrivacyBoundaryError(
  error: unknown,
): error is PrivacyBoundaryError {
  return error instanceof PrivacyBoundaryError;
}
